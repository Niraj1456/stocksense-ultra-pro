const { fetchAllIndices } = require("../../services/nse");
const { fetchChart } = require("../../services/yahoo");

async function indiaVix() {
  try {
    // Fetch current VIX from NSE
    const raw = await fetchAllIndices();
    const arr = Array.isArray(raw?.data) ? raw.data : Array.isArray(raw?.data?.data) ? raw.data.data : Array.isArray(raw?.data?.data?.data) ? raw.data.data.data : [];
    const vix = arr.find((r) => r?.index === "INDIA VIX");

    if (!vix) {
      return { ok: false, error: "india_vix_not_found" };
    }

    const vix_current = vix.last;
    const vix_prev_close = vix.previousClose;

    // Fetch 5D historical for VIX
    let vix_5d_avg = null;
    try {
      const closes = await fetchChart("^INDIAVIX", "5d", "1d");
      if (closes && closes.length > 0) {
        vix_5d_avg = closes.reduce((a, b) => a + b, 0) / closes.length;
      }
    } catch (err) {
      console.warn("Could not fetch 5D average for VIX:", err.message);
      // Fallback
      vix_5d_avg = vix_current;
    }

    // CALCULATIONS
    const vix_change_pct = ((vix_current - vix_prev_close) / vix_prev_close) * 100;
    const vix_spike = vix_change_pct > 20;

    let regime = "";
    let multiplier = 1.0;
    let sl_adjustment = 0.0;
    let target_compression = 0.0;
    let veto_triggered = false;

    if (vix_current < 12) {
      regime = "RISK_ON";
      multiplier = 1.15;
      sl_adjustment = 0;
      target_compression = 0;
    } else if (vix_current >= 12 && vix_current < 15) {
      regime = "NORMAL";
      multiplier = 1.05;
      sl_adjustment = 0;
      target_compression = 0;
    } else if (vix_current >= 15 && vix_current < 20) {
      regime = "CAUTION";
      multiplier = 1.00;
      sl_adjustment = 0;
      target_compression = 0;
    } else if (vix_current >= 20 && vix_current < 25) {
      regime = "FEAR";
      multiplier = 0.80;
      sl_adjustment = 0.5;
      target_compression = 0.20;
    } else if (vix_current >= 25 && vix_current < 28) {
      regime = "HIGH_FEAR";
      multiplier = 0.65;
      sl_adjustment = 1.0;
      target_compression = 0.35;
    } else if (vix_current >= 28) {
      regime = "VETO";
      veto_triggered = true;
    }

    // spike_override
    if (vix_spike && regime !== "VETO") {
      multiplier = multiplier * 0.90;
      sl_adjustment = sl_adjustment + 0.25;
    }

    return {
      ok: true,
      data: {
        inputs: {
          vix_current,
          vix_5d_avg,
          vix_prev_close
        },
        regime,
        multiplier,
        sl_adjustment,
        target_compression,
        veto_triggered,
        vix_spike,
        vix_change_pct
      },
      meta: { fetchedAt: new Date().toISOString(), source: "nse:/api/allIndices & yahoo:^INDIAVIX" }
    };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

module.exports = { indiaVix };
