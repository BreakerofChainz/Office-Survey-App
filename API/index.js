const { app } = require("@azure/functions");
const { CosmosClient } = require("@azure/cosmos");
const crypto = require("crypto");

// ── Cosmos Setup ────────────────────────────────────────────
// COSMOS_CONNECTION_STRING must be set in Azure Function App Settings.
// Never hardcode this value.
const COSMOS_CONNECTION_STRING = process.env.COSMOS_CONNECTION_STRING;
if (!COSMOS_CONNECTION_STRING) {
  throw new Error("Missing COSMOS_CONNECTION_STRING in Application Settings");
}

const cosmosClient = new CosmosClient(COSMOS_CONNECTION_STRING);
const database  = cosmosClient.database("surveydb");
const container = database.container("responses");

// ── Valid question IDs (matches survey.js QUESTIONS array) ──
const VALID_QUESTION_IDS = ["q1","q2","q3","q4","q5","q6","q7","q8","q9","q10"];

// ── Question metadata — mirrors survey.js QUESTIONS ─────────
// Used by /api/stats to return human-readable labels alongside counts.
const QUESTION_META = {
  q1:  { text: "How do you like your coffee?",         options: ["Hot coffee","Iced coffee","Tea or non-coffee drink","I don't drink caffeine"] },
  q2:  { text: "What is your preferred meeting time?", options: ["Early morning","Late morning","Afternoon","No preference"] },
  q3:  { text: "What is your least favorite workday?", options: ["Monday","Tuesday","Wednesday","Thursday","Friday"] },
  q4:  { text: "How do you prefer to work on projects?", options: ["Mostly alone","Small groups","Large groups","Depends on the task"] },
  q5:  { text: "When do you feel most productive?",    options: ["Early morning","Late morning","Afternoon","Evening"] },
  q6:  { text: "How do you feel about meetings in general?", options: ["Necessary and useful","Useful but too many","Mostly a distraction","Avoid whenever possible"] },
  q7:  { text: "How do you prefer to receive information?", options: ["Written documentation","Chat or instant message","Meetings or calls","Visuals or diagrams"] },
  q8:  { text: "Where do you prefer to work?",        options: ["Office","Home","Hybrid","No strong preference"] },
  q9:  { text: "What helps you focus the most?",      options: ["Quiet environment","Background noise","Music","Complete silence"] },
  q10: { text: "How do you usually start your workday?", options: ["Check email first","Review tasks or plans","Dive straight into work","Grab coffee first"] }
};

// ── Validation ──────────────────────────────────────────────
function validateSubmission(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { valid: false, error: "Invalid request body" };
  }

  // Honeypot – bots often fill hidden fields
  if (body.website) {
    return { valid: false, error: "Submission rejected" };
  }

  // Must have an answers object
  if (!body.answers || typeof body.answers !== "object") {
    return { valid: false, error: "Missing answers object" };
  }

  const answers = body.answers;

  // Every expected question must be present and have a non-empty string response
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
  const allowedTopLevel = new Set(["id","surveyVersion","submittedAt","source","answers","website"]);
  for (const key of Object.keys(body)) {
    if (!allowedTopLevel.has(key)) {
      return { valid: false, error: `Unexpected field: ${key}` };
    }
  }

  return { valid: true };
}

// ── CORS Helper ─────────────────────────────────────────────
// Allows requests from your Static Web App domain.
// Update ALLOWED_ORIGIN if your custom domain changes.
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "https://skyforgedlabs.com";

function corsHeaders(extraMethods = "") {
  return {
    "Access-Control-Allow-Origin":  ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": `GET, POST, OPTIONS${extraMethods}`,
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json"
  };
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
      context.log.error("Cosmos DB write failed:", err.message);
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
// The dashboard page calls this endpoint to render Chart.js charts.
//
// Optional query parameter:
//   ?since=YYYY-MM-DD  — filters results to documents submitted on
//                        or after the given date (UTC). The Logic App
//                        digest calls this with today's date to get
//                        the daily count and breakdown.
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
    // Expected format: YYYY-MM-DD (e.g. 2026-04-07)
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
      // Set to start of day UTC
      sinceDate.setUTCHours(0, 0, 0, 0);
    }

    try {
      // Fetch documents — filter by date if ?since= was provided
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

      // Build per-question aggregation
      // Shape: { q1: { "Hot coffee": 4, "Iced coffee": 2, ... }, ... }
      const counts = {};
      for (const qid of VALID_QUESTION_IDS) {
        counts[qid] = {};
        // Pre-seed every known option with 0 so the chart always has all labels
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
            // Unknown option — still count it so nothing is silently dropped
            counts[qid][resp] = (counts[qid][resp] || 0) + 1;
          }
        }
      }

      // Build the submissions-per-day time series for the line chart
      // Shape: { "2026-04-01": 3, "2026-04-02": 7, ... }
      const byDay = {};
      for (const doc of docs) {
        if (!doc.submittedAt) continue;
        const day = doc.submittedAt.slice(0, 10); // "YYYY-MM-DD"
        byDay[day] = (byDay[day] || 0) + 1;
      }

      // Sort days chronologically
      const sortedDays   = Object.keys(byDay).sort();
      const timeSeries   = sortedDays.map(d => ({ date: d, count: byDay[d] }));

      // Shape the final response so dashboard.html can consume it cleanly
      const questions = VALID_QUESTION_IDS.map(qid => ({
        id:      qid,
        text:    QUESTION_META[qid].text,
        options: QUESTION_META[qid].options,
        counts:  counts[qid]
      }));

      context.log(`Stats served: ${totalResponses} responses${sinceDate ? ` (filtered since ${sinceDate.toISOString()})` : ""}`);

      return {
        status: 200,
        headers: corsHeaders(),
        jsonBody: {
          ok:             true,
          totalResponses,
          generatedAt:    new Date().toISOString(),
          filteredSince:  sinceDate ? sinceDate.toISOString().slice(0, 10) : null,
          questions,
          timeSeries
        }
      };

    } catch (err) {
      context.log.error("Stats query failed:", err.message);
      return {
        status: 500,
        headers: corsHeaders(),
        jsonBody: { ok: false, error: "Failed to retrieve stats" }
      };
    }
  }
});