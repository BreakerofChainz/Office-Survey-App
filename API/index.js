const { app } = require("@azure/functions");

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
  handler: async () => ({
    status: 200,
    headers: { "content-type": "application/json" },
    jsonBody: { ok: true, endpoint: "submit" }
  })
});
