const { logger } = require("./logger");

/**
 * Truth Protocol waterfall:
 * Try sources in order; return first ok result.
 *
 * Each source function returns:
 *  { ok: true, data, meta } OR { ok: false, error, meta }
 */
async function truthWaterfall({ datum, sources }) {
  const tried = [];
  for (const s of sources) {
    try {
      const out = await s.fn();
      tried.push({ source: s.name, ok: Boolean(out?.ok), error: out?.error });
      if (out?.ok) {
        return {
          ok: true,
          data: out.data,
          meta: { ...(out.meta || {}), datum, source: s.name, tried }
        };
      }
    } catch (e) {
      tried.push({ source: s.name, ok: false, error: e?.message || "unknown_error" });
      logger.warn("truth_source_failed", { datum, source: s.name, message: e?.message });
    }
  }
  return { ok: false, error: "all_sources_failed", meta: { datum, tried } };
}

module.exports = { truthWaterfall };

