const { rbiGetJson } = require("../../services/rbi");

async function rbiData() {
  // RBI DBIE requires series configuration; without a key we still implement the caller.
  // Users can set RBI_DBIE_API_KEY and adjust series endpoints later.
  // We attempt a lightweight ping path commonly available on DBIE deployments.
  try {
    const data = await rbiGetJson("/service", undefined);
    return { ok: true, data, meta: { fetchedAt: new Date().toISOString(), source: "rbi:dbie" } };
  } catch (e) {
    return {
      ok: false,
      error: e?.message || "rbi_failed",
      meta: { fetchedAt: new Date().toISOString(), source: "rbi:dbie" }
    };
  }
}

module.exports = { rbiData };

