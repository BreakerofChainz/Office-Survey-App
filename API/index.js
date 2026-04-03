
const { app } = require("@azure/functions");

const ALLOWED_FIELDS = {
  coffeePreference: ["Hot", "Iced", "Tea", "None"],
  meetingTime: ["Morning", "Afternoon", "NoPreference"],
  workStyle: ["Remote", "Hybrid", "Onsite"]
};

// Optional honeypot field name (bots often fill this)
const HONEYPOT_FIELD = "website";

function validateSubmission(body) {
  if (!body || typeof body !== "object") {
    return { valid: false, error: "Invalid JSON body" };
  }

  // Honeypot check
  if (body[HONEYPOT_FIELD]) {
    return { valid: false, error: "Bot detected" };
  }

  const cleaned = {};

  // Enforce required fields + enum validation
  for (const [field, allowedValues] of Object.entries(ALLOWED_FIELDS)) {
    if (!(field in body)) {
      return { valid: false, error: `Missing field: ${field}` };
    }

    const value = body[field];

    if (!allowedValues.includes(value)) {
      return { valid: false, error: `Invalid value for ${field}` };
    }

    cleaned[field] = value;
  }

  // Reject any extra fields (strict allowlist)
  for (const key of Object.keys(body)) {
    if (!(key in ALLOWED_FIELDS) && key !== HONEYPOT_FIELD) {
      return { valid: false, error: `Unexpected field: ${key}` };
    }
  }

  return { valid: true, data: cleaned };
}

app.http("stats", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "stats",
  handler: async () => ({
    status: 200,
    headers: { "content-type": "application/json" },
    jsonBody: {
      ok: true,
      endpoint: "stats",
      timestamp: new Date().toISOString()
    }
  })
});

app.http("crosstabs", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "crosstabs",
  handler: async () => ({
    status: 200,
    headers: { "content-type": "application/json" },
    jsonBody: { ok: true, endpoint: "crosstabs" }
  })
});

app.http("submit", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "submit",
  handler: async (request) => {
    let body;

    try {
      body = await request.json();
    } catch {
      return {
        status: 400,
        jsonBody: { ok: false, error: "Malformed JSON" }
      };
    }

    const result = validateSubmission(body);

    if (!result.valid) {
      return {
        status: 400,
        jsonBody: { ok: false, error: result.error }
      };
    }

    // ✅ Cosmos DB write will go here later
    return {
      status: 200,
      jsonBody: { ok: true, accepted: result.data }
    };
  }
});

