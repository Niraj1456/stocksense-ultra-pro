const { EMA } = require("technicalindicators");
const { fetchAllIndices } = require("../../services/nse");

function extractNetAdvances(raw) {
  const arr = Array.isArray(raw?.data) ? raw.data : Array.isArray(raw?.data?.data) ? raw.data.data : Array.isArray(raw?.data?.data?.data) ? raw.data.data.data : [];
  
  const preferred =
    arr.find((r) => r?.index === "NIFTY 500") ||
    arr.find((r) => r?.index === "NIFTY 50") ||
    null;

  if (!preferred) return null;

  const adv = Number(preferred.advances || NaN);
  const dec = Number(preferred.declines || NaN);

  if (Number.isFinite(adv) && Number.isFinite(dec)) return adv - dec;
  return null;
}

async function mcclellan({ history = [], wyckoff_spring_detected = false, volume_climax_detected = false } = {}) {
  try {
    const raw = await fetchAllIndices();
    const net = extractNetAdvances(raw);
    
    if (net === null) {
      return { ok: false, error: "net_advances_unavailable" };
    }

    const series = [...history, net].slice(-200);

    if (series.length < 40) {
      return {
        ok: true,
        data: { mcclellan_value: null, signal: "INSUFFICIENT_DATA" },
        meta: { fetchedAt: new Date().toISOString(), source: "calc:mcclellan" }
      };
    }

    const ema19 = EMA.calculate({ period: 19, values: series });
    const ema39 = EMA.calculate({ period: 39, values: series });
    const mcclellan_value = ema19[ema19.length - 1] - ema39[ema39.length - 1];

    let signal = "";
    let score_adjustment = 0;
    let action = null;
    let flag = null;
    let contrarian_opportunity = false;
    let triple_bottom_component_1 = false;
    let bonus_points = 0;

    if (mcclellan_value > 100) {
      signal = "OVERBOUGHT_BREADTH";
      action = "DO_NOT_INITIATE_LONGS_ON_MOMENTUM";
      score_adjustment = -5;
    } else if (mcclellan_value >= 20 && mcclellan_value <= 100) {
      signal = "HEALTHY_POSITIVE";
      score_adjustment = 0;
    } else if (mcclellan_value > -20 && mcclellan_value < 20) {
      signal = "NEUTRAL";
      score_adjustment = 0;
    } else if (mcclellan_value >= -100 && mcclellan_value <= -20) {
      signal = "NEGATIVE_MOMENTUM";
      score_adjustment = -5;
      flag = "UNDERLYING_WEAKNESS";
    } else if (mcclellan_value < -100) {
      signal = "BREADTH_WASHOUT";
      score_adjustment = 0;
      contrarian_opportunity = true;
      flag = "POTENTIAL_REVERSAL_ZONE";
    }

    if (mcclellan_value < -100 && wyckoff_spring_detected && volume_climax_detected) {
      triple_bottom_component_1 = true;
      bonus_points = 5;
    }

    return {
      ok: true,
      data: {
        inputs: {
          net_advances: net,
          wyckoff_spring_detected,
          volume_climax_detected
        },
        mcclellan_value,
        signal,
        action,
        score_adjustment,
        flag,
        contrarian_opportunity,
        triple_bottom_component_1,
        bonus_points
      },
      meta: { fetchedAt: new Date().toISOString(), source: "calc:mcclellan" }
    };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

module.exports = { mcclellan };
