
module.exports = async function (context, req) {
  // Minimal allowlist to match your doc's "no PII, multiple-choice only" constraint
  const allowedFields = new Set([
    "coffeePreference",
    "meetingTime",
    "leastFavoriteDay",
    "workStyle"
  ]);

  const body = req.body || {};
  const cleaned = {};

  for (const [k, v] of Object.entries(body)) {
    if (allowedFields.has(k)) cleaned[k] = v;
  }

  // For now: stub response (no Cosmos yet)
  context.res = {
    status: 200,
    headers: { "content-type": "application/json" },
    body: { ok: true, accepted: Object.keys(cleaned) }
  };
};
