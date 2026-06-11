const { app } = require("@azure/functions");
const { CosmosClient } = require("@azure/cosmos");
const crypto = require("crypto");

// ── Cosmos Setup ────────────────────────────────────────────
const COSMOS_CONNECTION_STRING = process.env.COSMOS_CONNECTION_STRING;
if (!COSMOS_CONNECTION_STRING) {
  throw new Error("Missing COSMOS_CONNECTION_STRING in Application Settings");
}

const cosmosClient  = new CosmosClient(COSMOS_CONNECTION_STRING);
const database      = cosmosClient.database("surveydb");
const container     = database.container("responses");
const insightsContainer = database.container("insights");

// ── Valid question IDs (matches survey.js QUESTIONS array) ──
const VALID_QUESTION_IDS = ["q1","q2","q3","q4","q5","q6","q7","q8","q9","q10"];

// ── Question metadata — mirrors survey.js QUESTIONS ─────────
// Used by /api/stats to return human-readable labels alongside counts.
const QUESTION_META = {
  q1:  { text: "How do you like your coffee?",              options: ["Hot coffee","Iced coffee","Tea or non-coffee drink","I don't drink caffeine"] },
  q2:  { text: "What is your preferred meeting time?",      options: ["Early morning","Late morning","Afternoon","No preference"] },
  q3:  { text: "What is your least favorite workday?",      options: ["Monday","Tuesday","Wednesday","Thursday","Friday"] },
  q4:  { text: "How do you prefer to work on projects?",    options: ["Mostly alone","Small groups","Large groups","Depends on the task"] },
  q5:  { text: "When do you feel most productive?",         options: ["Early morning","Late morning","Afternoon","Evening"] },
  q6:  { text: "How do you feel about meetings in general?",options: ["Necessary and useful","Useful but too many","Mostly a distraction","Avoid whenever possible"] },
  q7:  { text: "How do you prefer to receive information?", options: ["Written documentation","Chat or instant message","Meetings or calls","Visuals or diagrams"] },
  q8:  { text: "Where do you prefer to work?",              options: ["Office","Home","Hybrid","No strong preference"] },
  q9:  { text: "What helps you focus the most?",            options: ["Quiet environment","Background noise","Music","Complete silence"] },
  q10: { text: "How do you usually start your workday?",    options: ["Check email first","Review tasks or plans","Dive straight into work","Grab coffee first"] }
};

// ── Validation ──────────────────────────────────────────────
function validateSubmission(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { valid: false, error: "Invalid request body" };
  }

  if (body.website) {
    return { valid: false, error: "Submission rejected" };
  }

  if (!body.answers || typeof body.answers !== "object") {
    return { valid: false, error: "Missing answers object" };
  }

  const answers = body.answers;
  for (const qid of VALID_QUESTION_IDS) {
    const entry = answers[qid];
    if (!entry || typeof entry !== "object") {
      return { valid: false, error: `Missing answer for ${qid}` };
    }
    if (typeof entry.response !== "string" || entry.response.trim() === "") {
      return { valid: false, error: `Empty or invalid response for ${qid}` };
    }
    if (typeof entry.question !== "string" || entry.question.trim() === "") {
      return { valid: false, error: `Missing question text for ${qid}` };
    }
  }

  // Reject unexpected top-level fields beyond what survey.js sends
  const allowedTopLevel = new Set(["id","surveyVersion","submittedAt","source","answers","website","archetype"]);
  for (const key of Object.keys(body)) {
    if (!allowedTopLevel.has(key)) {
      return { valid: false, error: `Unexpected field: ${key}` };
    }
  }

  return { valid: true };
}

// ── CORS Helper ────────────────────────────────────────────

const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "https://skyforgedlabs.com";

function corsHeaders(extraMethods = "") {
  return {
    "Access-Control-Allow-Origin":  ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": `GET, POST, OPTIONS${extraMethods}`,
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json"
  };
}

// ── Aggregation Helper ───────────────────────────────────────
function aggregateCounts(docs) {
  const counts = {};
  for (const qid of VALID_QUESTION_IDS) {
    counts[qid] = {};
    for (const opt of QUESTION_META[qid].options) {
      counts[qid][opt] = 0;
    }
  }
  for (const doc of docs) {
    if (!doc.answers) continue;
    for (const qid of VALID_QUESTION_IDS) {
      const entry = doc.answers[qid];
      if (!entry || typeof entry.response !== "string") continue;
      const resp = entry.response.trim();
      if (counts[qid][resp] !== undefined) {
        counts[qid][resp]++;
      } else {
        counts[qid][resp] = (counts[qid][resp] || 0) + 1;
      }
    }
  }
  return counts;
}

// ── Dominant Answer Helper ───────────────────────────────────
// For each question, calculates the gap between the top answer
// and the second place answer as a percentage of total responses.
// Returns the top 3 questions sorted by gap descending.
// Tiebreaker: higher absolute count for the top answer wins.
function getTopThreeDominantQuestions(counts, totalResponses) {
  if (totalResponses === 0) return [];

  const gaps = VALID_QUESTION_IDS.map(qid => {
    const optionCounts = counts[qid];
    const sorted = Object.entries(optionCounts)
      .sort((a, b) => b[1] - a[1]);

    const topAnswer   = sorted[0] ? sorted[0][0] : null;
    const topCount    = sorted[0] ? sorted[0][1] : 0;
    const secondCount = sorted[1] ? sorted[1][1] : 0;
    const gap         = ((topCount - secondCount) / totalResponses) * 100;

    return { qid, topAnswer, topCount, gap };
  });

  // Sort by gap descending, tiebreak by topCount descending
  gaps.sort((a, b) => {
    if (Math.abs(a.gap - b.gap) < 0.001) return b.topCount - a.topCount;
    return b.gap - a.gap;
  });

  return gaps.slice(0, 3);
}

// ── Summary Paragraph Builder ────────────────────────────────
// Constructs a concise natural language paragraph from the top 3
// dominant questions. This is what gets sent to the Language API.
function buildSummaryInput(topThree, totalResponses) {
  if (!topThree || topThree.length === 0) return null;

  const questionPhrases = {
    q1:  answer => `prefer ${answer.toLowerCase()} as their drink of choice`,
    q2:  answer => `prefer ${answer.toLowerCase()} for meetings`,
    q3:  answer => `consider ${answer} their least favorite workday`,
    q4:  answer => `prefer to work ${answer.toLowerCase()} on projects`,
    q5:  answer => `feel most productive in the ${answer.toLowerCase()}`,
    q6:  answer => `feel meetings are "${answer.toLowerCase()}"`,
    q7:  answer => `prefer ${answer.toLowerCase()} when receiving information`,
    q8:  answer => `prefer ${answer.toLowerCase()} as their work location`,
    q9:  answer => `focus best in a ${answer.toLowerCase()} environment`,
    q10: answer => `start their workday by choosing to ${answer.toLowerCase()}`
  };

  const phrases = topThree
    .map(({ qid, topAnswer }) => {
      const fn = questionPhrases[qid];
      return fn ? fn(topAnswer) : null;
    })
    .filter(Boolean);

  return `Most respondents ${phrases[0]}, ${phrases[1]}, and ${phrases[2]}.`;
}

// ── Azure AI Language Summarization ─────────────────────────

async function generateSummary(inputText, context) {
  const endpoint = process.env.AI_LANGUAGE_ENDPOINT;
  const apiKey   = process.env.AI_LANGUAGE_KEY;

  if (!endpoint || !apiKey) {
    context.error("AI_LANGUAGE_ENDPOINT or AI_LANGUAGE_KEY not set — summary skipped.");
    return null;
  }

  const apiVersion = "2023-04-01";
  const submitUrl  = `${endpoint}language/analyze-text/jobs?api-version=${apiVersion}`;

  // ── Step 1: Submit the summarization job ──────────────────
  let jobUrl;
  try {
    const submitRes = await fetch(submitUrl, {
      method:  "POST",
      headers: {
        "Content-Type":              "application/json",
        "Ocp-Apim-Subscription-Key": apiKey
      },
      body: JSON.stringify({
        displayName: "SkyForgedLabs-DailySummary",
        analysisInput: {
          documents: [{ id: "1", language: "en", text: inputText }]
        },
        tasks: [
          {
            kind:       "AbstractiveSummarization",
            taskName:   "SummaryTask",
            parameters: { sentenceCount: 2 }
          }
        ]
      })
    });

    if (!submitRes.ok) {
      context.error(`Language API submit failed: ${submitRes.status} ${submitRes.statusText}`);
      return null;
    }

    // The job URL is returned in the Operation-Location header
    jobUrl = submitRes.headers.get("operation-location");
    if (!jobUrl) {
      context.error("Language API did not return Operation-Location header.");
      return null;
    }
  } catch (err) {
    context.error("Language API submit error:", err.message);
    return null;
  }

  // ── Step 2: Poll for job completion ───────────────────────
  const MAX_ATTEMPTS    = 30;
  const POLL_INTERVAL_MS = 2000;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    // Wait before polling
    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));

    try {
      const pollRes = await fetch(jobUrl, {
        headers: { "Ocp-Apim-Subscription-Key": apiKey }
      });

      if (!pollRes.ok) {
        context.error(`Language API poll failed: ${pollRes.status}`);
        return null;
      }

      const pollData = await pollRes.json();
      const status   = pollData.status;

      if (status === "succeeded") {
        // Extract the summary text from the nested response structure
        const summaryText = pollData
          ?.tasks
          ?.items?.[0]
          ?.results
          ?.documents?.[0]
          ?.summaries?.[0]
          ?.text;

        if (!summaryText) {
          context.error("Language API succeeded but summary text was missing.");
          return null;
        }

        context.log(`Summary generated on attempt ${attempt}: "${summaryText}"`);
        return summaryText;
      }

      if (status === "failed") {
        context.error("Language API job failed:", JSON.stringify(pollData.errors));
        return null;
      }

      // Status is "running" or "notStarted" — keep polling
      context.log(`Language API job status: ${status} (attempt ${attempt}/${MAX_ATTEMPTS})`);

    } catch (err) {
      context.error(`Language API poll error on attempt ${attempt}:`, err.message);
      return null;
    }
  }

  context.error("Language API timed out after 60 seconds.");
  return null;
}

// ── Significance Check ───────────────────────────────────────
// Compares current dominant answers against the stored snapshot.
// Returns true if 2+ questions have shifted dominant answer,
// or if total responses have grown by more than 20%.
function hasSignificantChange(currentTopThree, storedDominantAnswers, currentTotal, storedTotal) {
  // Always regenerate if no prior summary exists
  if (!storedDominantAnswers || !storedTotal) return true;

  // Check 20% response growth threshold
  if (storedTotal > 0 && currentTotal >= storedTotal * 1.20) {
    return true;
  }

  // Count how many of the top 3 questions have shifted dominant answer
  let shifts = 0;
  for (const { qid, topAnswer } of currentTopThree) {
    if (storedDominantAnswers[qid] !== topAnswer) {
      shifts++;
    }
  }

  return shifts >= 2;
}

// ── POST /api/submit ────────────────────────────────────────
app.http("submit", {
  methods: ["POST", "OPTIONS"],
  authLevel: "anonymous",
  route: "submit",
  handler: async (request, context) => {

    // Handle CORS pre-flight
    if (request.method === "OPTIONS") {
      return { status: 204, headers: corsHeaders() };
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return {
        status: 400,
        headers: corsHeaders(),
        jsonBody: { ok: false, error: "Malformed JSON" }
      };
    }

    const validation = validateSubmission(body);
    if (!validation.valid) {
      return {
        status: 400,
        headers: corsHeaders(),
        jsonBody: { ok: false, error: validation.error }
      };
    }

    // Build the Cosmos document
    const document = {
      id:            body.id || crypto.randomUUID(),
      partition:     "responses",
      surveyVersion: body.surveyVersion || "1.0",
      submittedAt:   body.submittedAt   || new Date().toISOString(),
      source:        body.source        || "SkyForgedLabs-WebApp",
      archetype:     body.archetype     || null,
      answers:       body.answers
    };

    try {
      await container.items.create(document);
      context.log("Survey submitted successfully, id:", document.id);
      return {
        status: 200,
        headers: corsHeaders(),
        jsonBody: { ok: true, id: document.id }
      };
    } catch (err) {
      context.error("Cosmos DB write failed:", err.message);
      return {
        status: 500,
        headers: corsHeaders(),
        jsonBody: { ok: false, error: "Failed to save response" }
      };
    }
  }
});

// ── GET /api/stats ──────────────────────────────────────────
// Reads documents from Cosmos DB and returns aggregated
// response counts per question per answer option.
// Also reads the cached AI summary from the insights container.

app.http("stats", {
  methods: ["GET", "OPTIONS"],
  authLevel: "anonymous",
  route: "stats",
  handler: async (request, context) => {

    // Handle CORS pre-flight
    if (request.method === "OPTIONS") {
      return { status: 204, headers: corsHeaders() };
    }

    // Parse optional ?since= query parameter
    const sinceParam = request.query.get("since");
    let sinceDate = null;
    if (sinceParam) {
      sinceDate = new Date(sinceParam);
      if (isNaN(sinceDate.getTime())) {
        return {
          status: 400,
          headers: corsHeaders(),
          jsonBody: { ok: false, error: "Invalid 'since' date format. Use YYYY-MM-DD." }
        };
      }
      sinceDate.setUTCHours(0, 0, 0, 0);
    }

    try {
      // Fetch response documents
      let query;
      if (sinceDate) {
        query = {
          query: "SELECT c.answers, c.submittedAt FROM c WHERE c.submittedAt >= @since",
          parameters: [{ name: "@since", value: sinceDate.toISOString() }]
        };
        context.log(`Stats filtered since: ${sinceDate.toISOString()}`);
      } else {
        query = "SELECT c.answers, c.submittedAt FROM c";
      }

      const { resources: docs } = await container.items
        .query(query)
        .fetchAll();

      const totalResponses = docs.length;
      const counts         = aggregateCounts(docs);

      // Build time series
      const byDay = {};
      for (const doc of docs) {
        if (!doc.submittedAt) continue;
        const day = doc.submittedAt.slice(0, 10);
        byDay[day] = (byDay[day] || 0) + 1;
      }
      const sortedDays = Object.keys(byDay).sort();
      const timeSeries = sortedDays.map(d => ({ date: d, count: byDay[d] }));

      const questions = VALID_QUESTION_IDS.map(qid => ({
        id:      qid,
        text:    QUESTION_META[qid].text,
        options: QUESTION_META[qid].options,
        counts:  counts[qid]
      }));

      // Read cached AI summary from insights container
      // Falls back gracefully if no summary exists yet
      let aiSummary = null;
      let summaryGeneratedAt = null;
      try {
        const { resource: summaryDoc } = await insightsContainer
          .item("latest-summary", "insights")
          .read();
        if (summaryDoc) {
          aiSummary          = summaryDoc.summary          || null;
          summaryGeneratedAt = summaryDoc.generatedAt      || null;
        }
      } catch (summaryErr) {
        // 404 is expected before the first nightly run — not an error
        if (!summaryErr.code || summaryErr.code !== 404) {
          context.error("Failed to read summary from insights container:", summaryErr.message);
        }
      }

      context.log(`Stats served: ${totalResponses} responses${sinceDate ? ` (filtered since ${sinceDate.toISOString()})` : ""}`);

      return {
        status: 200,
        headers: corsHeaders(),
        jsonBody: {
          ok:                 true,
          totalResponses,
          generatedAt:        new Date().toISOString(),
          filteredSince:      sinceDate ? sinceDate.toISOString().slice(0, 10) : null,
          questions,
          timeSeries,
          aiSummary,
          summaryGeneratedAt
        }
      };

    } catch (err) {
      context.error("Stats query failed:", err.message);
      return {
        status: 500,
        headers: corsHeaders(),
        jsonBody: { ok: false, error: "Failed to retrieve stats" }
      };
    }
  }
});

// ── GET /api/responses ───────────────────────────────────────
// Returns individual anonymized response records for the dashboard
// cross-filtering feature. Capped at 1000 most recent responses
// to prevent oversized payloads if the survey scales unexpectedly.

app.http("responses", {
  methods: ["GET", "OPTIONS"],
  authLevel: "anonymous",
  route: "responses",
  handler: async (request, context) => {

    // Handle CORS pre-flight
    if (request.method === "OPTIONS") {
      return { status: 204, headers: corsHeaders() };
    }

    try {
      // Fetch the 1000 most recent responses ordered by submission date
      // Cosmos DB SQL supports TOP and ORDER BY for this pattern
      const { resources: docs } = await container.items
        .query({
          query: "SELECT TOP 1000 c.id, c.submittedAt, c.answers, c.archetype FROM c ORDER BY c.submittedAt DESC"
        })
        .fetchAll();

      // Flatten each document — strip question text, keep only response strings
      // This keeps the payload lean for client-side processing
      const responses = docs.map(doc => {
        const answers = {};
        for (const qid of VALID_QUESTION_IDS) {
          const entry = doc.answers?.[qid];
          answers[qid] = entry?.response?.trim() || null;
        }
        return {
          id:          doc.id,
          submittedAt: doc.submittedAt,
          archetype:   doc.archetype || null,
          answers
        };
      });

      context.log(`Responses served: ${responses.length} records`);

      return {
        status: 200,
        headers: corsHeaders(),
        jsonBody: {
          ok:             true,
          totalResponses: responses.length,
          responses
        }
      };

    } catch (err) {
      context.error("Responses query failed:", err.message);
      return {
        status: 500,
        headers: corsHeaders(),
        jsonBody: { ok: false, error: "Failed to retrieve responses" }
      };
    }
  }
});

// ── Timer: Daily Digest ─────────────────────────────────────
// Fires every day at 11:59 PM Eastern (04:59 UTC).

app.timer("dailyDigest", {
  schedule: "0 55 23 * * *",   // 11:55 PM UTC — fires just before UTC day rolls over

  handler: async (myTimer, context) => {

    const webhookUrl = process.env.LOGIC_APP_WEBHOOK_URL;
    if (!webhookUrl) {
      context.error("LOGIC_APP_WEBHOOK_URL is not set — digest aborted.");
      return;
    }

    const today       = new Date();
    const todayStr    = today.toISOString().slice(0, 10);
    const startOfDay  = new Date(todayStr);
    startOfDay.setUTCHours(0, 0, 0, 0);

    try {
      // ── Query today's responses ──────────────────────────
      const { resources: todayDocs } = await container.items
        .query({
          query: "SELECT c.id FROM c WHERE c.submittedAt >= @since",
          parameters: [{ name: "@since", value: startOfDay.toISOString() }]
        })
        .fetchAll();

      // ── Query all-time responses with answers for aggregation
      const { resources: allDocs } = await container.items
        .query("SELECT c.id, c.answers, c.submittedAt FROM c")
        .fetchAll();

      const totalResponses = allDocs.length;
      const counts         = aggregateCounts(allDocs);
      const topThree       = getTopThreeDominantQuestions(counts, totalResponses);

      // ── Read existing summary snapshot from insights container
      let storedSummaryDoc        = null;
      let storedDominantAnswers   = null;
      let storedTotalResponses    = 0;
      let currentSummary          = null;

      try {
        const { resource } = await insightsContainer
          .item("latest-summary", "insights")
          .read();
        if (resource) {
          storedSummaryDoc      = resource;
          storedDominantAnswers = resource.dominantAnswers  || null;
          storedTotalResponses  = resource.totalResponsesAtGeneration || 0;
          currentSummary        = resource.summary          || null;
        }
      } catch (readErr) {
        // 404 expected on first run
        if (!readErr.code || readErr.code !== 404) {
          context.error("Failed to read insights summary:", readErr.message);
        }
      }

      // ── Build dominant answers snapshot for significance check
      const currentDominantAnswers = {};
      for (const { qid, topAnswer } of topThree) {
        currentDominantAnswers[qid] = topAnswer;
      }

      // ── Significance check — conditionally call Language API
      const significant = hasSignificantChange(
        topThree,
        storedDominantAnswers,
        totalResponses,
        storedTotalResponses
      );

      if (significant && totalResponses >= 5) {
        // Need at least 5 responses for a meaningful summary
        context.log("Significant change detected — regenerating AI summary.");

        const inputParagraph = buildSummaryInput(topThree, totalResponses);
        if (inputParagraph) {
          context.log(`Summary input: "${inputParagraph}"`);
          const newSummary = await generateSummary(inputParagraph, context);

          if (newSummary) {
            currentSummary = newSummary;

            // Upsert the summary document into the insights container
            // Fixed id ensures we always overwrite rather than accumulate
            const summaryDocument = {
              id:                        "latest-summary",
              partition:                 "insights",
              summary:                   newSummary,
              generatedAt:               new Date().toISOString(),
              totalResponsesAtGeneration: totalResponses,
              dominantAnswers:           currentDominantAnswers
            };

            await insightsContainer.items.upsert(summaryDocument);
            context.log("Summary document upserted to insights container.");
          } else {
            context.error("Summary generation failed — keeping existing summary.");
          }
        }
      } else if (!significant) {
        context.log("No significant change detected — keeping existing summary.");
      } else {
        context.log(`Only ${totalResponses} responses — minimum 5 needed for summary generation.`);
      }

      // ── Build digest payload and POST to Logic App ────────
      const payload = {
        date:         todayStr,
        todayCount:   todayDocs.length,
        allTimeCount: totalResponses,
        summary:      currentSummary || "Summary will appear after sufficient responses are collected."
      };

      context.log(`Digest payload: ${JSON.stringify(payload)}`);

      const response = await fetch(webhookUrl, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(payload)
      });

      if (!response.ok) {
        context.error(`Logic App webhook failed: ${response.status} ${response.statusText}`);
      } else {
        context.log("Daily digest sent successfully.");
      }

    } catch (err) {
      context.error("Daily digest error:", err.message);
    }
  }
});

// ── POST /api/contact ────────────────────────────────────────
// Receives contact form submissions from contact.html.

app.http("contact", {
  methods: ["POST", "OPTIONS"],
  authLevel: "anonymous",
  route: "contact",
  handler: async (request, context) => {

    // Handle CORS pre-flight
    if (request.method === "OPTIONS") {
      return { status: 204, headers: corsHeaders() };
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return {
        status: 400,
        headers: corsHeaders(),
        jsonBody: { ok: false, error: "Malformed JSON" }
      };
    }

    if (body.website) {
      context.log("Contact honeypot triggered — submission silently dropped.");
      return { status: 200, headers: corsHeaders(), jsonBody: { ok: true } };
    }

    // ── Field validation ─────────────────────────────────────
    const { name, email, subject, message, turnstileToken } = body;

    if (!name    || typeof name    !== "string" || name.trim().length    === 0 || name.trim().length    > 100) {
      return { status: 400, headers: corsHeaders(), jsonBody: { ok: false, error: "Invalid name" } };
    }
    if (!email   || typeof email   !== "string" || email.trim().length   === 0 || email.trim().length   > 254) {
      return { status: 400, headers: corsHeaders(), jsonBody: { ok: false, error: "Invalid email" } };
    }
    if (!subject || typeof subject !== "string" || subject.trim().length === 0 || subject.trim().length > 150) {
      return { status: 400, headers: corsHeaders(), jsonBody: { ok: false, error: "Invalid subject" } };
    }
    if (!message || typeof message !== "string" || message.trim().length === 0 || message.trim().length > 2000) {
      return { status: 400, headers: corsHeaders(), jsonBody: { ok: false, error: "Invalid message" } };
    }
    if (!turnstileToken || typeof turnstileToken !== "string") {
      return { status: 400, headers: corsHeaders(), jsonBody: { ok: false, error: "Missing verification token" } };
    }

    // Basic email format check
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return { status: 400, headers: corsHeaders(), jsonBody: { ok: false, error: "Invalid email format" } };
    }

    // ── Turnstile server-side verification ───────────────────
    // Verifies the token with Cloudflare's siteverify endpoint.
    // This is the critical check — client-side alone is not sufficient.
    const turnstileSecret = process.env.TURNSTILE_SECRET_KEY;
    if (!turnstileSecret) {
      context.error("TURNSTILE_SECRET_KEY is not set — contact submission aborted.");
      return { status: 500, headers: corsHeaders(), jsonBody: { ok: false, error: "Server configuration error" } };
    }

    try {
      const verifyRes = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          secret:   turnstileSecret,
          response: turnstileToken,
          remoteip: request.headers.get("x-forwarded-for") || ""
        })
      });

      const verifyData = await verifyRes.json();

      if (!verifyData.success) {
        context.warn("Turnstile verification failed:", JSON.stringify(verifyData["error-codes"]));
        return {
          status: 400,
          headers: corsHeaders(),
          jsonBody: { ok: false, error: "Verification failed. Please try again." }
        };
      }
    } catch (err) {
      context.error("Turnstile verification request failed:", err.message);
      return { status: 500, headers: corsHeaders(), jsonBody: { ok: false, error: "Verification service unavailable" } };
    }

    // ── Forward to Logic App ─────────────────────────────────
    const contactWebhookUrl = process.env.CONTACT_WEBHOOK_URL;
    if (!contactWebhookUrl) {
      context.error("CONTACT_WEBHOOK_URL is not set — contact submission aborted.");
      return { status: 500, headers: corsHeaders(), jsonBody: { ok: false, error: "Server configuration error" } };
    }

    const emailPayload = {
      name:    name.trim(),
      email:   email.trim(),
      subject: subject.trim(),
      message: message.trim(),
      sentAt:  new Date().toISOString()
    };

    try {
      const webhookRes = await fetch(contactWebhookUrl, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(emailPayload)
      });

      if (!webhookRes.ok) {
        context.error(`Contact Logic App webhook failed: ${webhookRes.status} ${webhookRes.statusText}`);
        return { status: 500, headers: corsHeaders(), jsonBody: { ok: false, error: "Failed to send message" } };
      }

      context.log(`Contact form submitted by ${email.trim()} — forwarded to Logic App.`);
      return { status: 200, headers: corsHeaders(), jsonBody: { ok: true } };

    } catch (err) {
      context.error("Contact webhook request failed:", err.message);
      return { status: 500, headers: corsHeaders(), jsonBody: { ok: false, error: "Failed to send message" } };
    }
  }
});
