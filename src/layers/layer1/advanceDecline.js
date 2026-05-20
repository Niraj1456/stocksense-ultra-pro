const { fetchAllIndices } = require("../../services/nse");

async function advanceDecline() {
  try {
    const raw = await fetchAllIndices();
    const arr = Array.isArray(raw?.data) ? raw.data : Array.isArray(raw?.data?.data) ? raw.data.data : Array.isArray(raw?.data?.data?.data) ? raw.data.data.data : [];
    
    // We try to get NIFTY 500 for broad market breadth. If unavailable, fallback to NIFTY 50.
    const broadIndex = arr.find(r => r?.index === "NIFTY 500") || arr.find(r => r?.index === "NIFTY 50");
    
    if (!broadIndex) {
      return { ok: false, error: "broad_market_index_not_found_for_advances_declines" };
    }

    const advances = parseInt(broadIndex.advances || "0", 10);
    const declines = parseInt(broadIndex.declines || "0", 10);
    const unchanged = parseInt(broadIndex.unchanged || "0", 10);

    const ad_ratio = declines === 0 ? 99.99 : advances / declines;

    let signal = "";
    let multiplier_adjustment = 0;
    let confidence_boost = false;
    let position_size_reduction = 0;
    let suppress_new_longs = false;

    if (ad_ratio > 2.0) {
      signal = "STRONG_BREADTH";
      multiplier_adjustment = 0.10;
      confidence_boost = true;
    } else if (ad_ratio >= 1.5 && ad_ratio <= 2.0) {
      signal = "HEALTHY_BREADTH";
      multiplier_adjustment = 0.05;
    } else if (ad_ratio >= 1.2 && ad_ratio < 1.5) {
      signal = "MODERATE_BREADTH";
      multiplier_adjustment = 0;
    } else if (ad_ratio >= 0.8 && ad_ratio < 1.2) {
      signal = "MIXED_BREADTH";
      multiplier_adjustment = 0;
      position_size_reduction = 0.20;
    } else if (ad_ratio >= 0.5 && ad_ratio < 0.8) {
      signal = "WEAK_BREADTH";
      multiplier_adjustment = -0.10;
    } else if (ad_ratio < 0.5) {
      signal = "BREADTH_COLLAPSE";
      multiplier_adjustment = -0.15;
      suppress_new_longs = true;
    }

    const total = advances + declines + unchanged;
    const participation_pct = total === 0 ? 0 : (advances / total) * 100;

    return {
      ok: true,
      data: {
        inputs: {
          advances,
          declines,
          unchanged
        },
        ad_ratio,
        signal,
        multiplier_adjustment,
        confidence_boost,
        position_size_reduction,
        suppress_new_longs,
        participation_pct
      },
      meta: { fetchedAt: new Date().toISOString(), source: "nse:/api/allIndices" }
    };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

module.exports = { advanceDecline };
