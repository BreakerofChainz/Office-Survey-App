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

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin":  ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
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
      source:        body.source        || "OfficePulse-WebApp",
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
// Placeholder – reserved for future data visualisation endpoint.
app.http("stats", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "stats",
  handler: async (_request, _context) => ({
    status: 200,
    headers: corsHeaders(),
    jsonBody: {
      ok: true,
      message: "Stats endpoint – coming soon",
      timestamp: new Date().toISOString()
    }
  })
});
