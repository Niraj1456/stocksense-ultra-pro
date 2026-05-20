const { EMA } = require("technicalindicators");
const axios = require("axios");

async function fetchYahooDailyCloses(symbol, days = 220) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`;
  const resp = await axios.get(url, {
    headers: { "User-Agent": "Mozilla/5.0" },
    params: { range: `${days}d`, interval: "1d" },
    timeout: 20000,
    validateStatus: () => true
  });
  if (resp.status >= 400) throw new Error(`yahoo_chart_failed:${resp.status}`);
  const closes = resp.data?.chart?.result?.[0]?.indicators?.quote?.[0]?.close || [];
  return closes.filter((x) => typeof x === "number");
}

async function nifty50() {
  try {
    const symbol = "^NSEI";
    const closes = await fetchYahooDailyCloses(symbol, 220);
    
    if (closes.length < 20) {
      return { ok: false, error: "insufficient_data" };
    }

    const nifty_current = closes[closes.length - 1];
    
    const ema20_arr = EMA.calculate({ period: 20, values: closes });
    const ema50_arr = closes.length >= 50 ? EMA.calculate({ period: 50, values: closes }) : null;
    const ema200_arr = closes.length >= 200 ? EMA.calculate({ period: 200, values: closes }) : null;

    const nifty_ema20 = ema20_arr[ema20_arr.length - 1];
    const nifty_ema50 = ema50_arr ? ema50_arr[ema50_arr.length - 1] : null;
    const nifty_ema200 = ema200_arr ? ema200_arr[ema200_arr.length - 1] : null;

    let nifty_slope20 = 0;
    if (ema20_arr.length >= 6) {
      nifty_slope20 = (ema20_arr[ema20_arr.length - 1] - ema20_arr[ema20_arr.length - 6]) / 5;
    }

    const ema20_slope_positive = nifty_slope20 > 0;

    let regime = "";
    let env_score_adjustment = 0;
    let min_score_to_act = 0;
    let flag = null;

    if (nifty_current > nifty_ema20 && ema20_slope_positive) {
      regime = "UPTREND";
      env_score_adjustment = 5;
      min_score_to_act = 50;
    } else if (nifty_ema50 && nifty_current > nifty_ema50 && nifty_current <= nifty_ema20) {
      regime = "CONSOLIDATION";
      env_score_adjustment = 0;
      min_score_to_act = 55;
    } else if (nifty_ema200 && nifty_current < nifty_ema50 && nifty_current > nifty_ema200) {
      regime = "DISTRIBUTION";
      env_score_adjustment = 0;
      min_score_to_act = 72;
      flag = "INDEX_HEADWIND";
    } else if (nifty_ema200 && nifty_current < nifty_ema200) {
      regime = "BEAR_MARKET";
      env_score_adjustment = -5;
      min_score_to_act = 80;
      flag = "BEAR_CONTEXT";
    } else {
      // Fallback for missing higher timeframe EMAs but clear trend
      regime = "UNCLEAR";
      min_score_to_act = 60;
    }

    return {
      ok: true,
      data: {
        inputs: {
          nifty_current,
          nifty_ema20,
          nifty_ema50,
          nifty_ema200,
          nifty_slope20,
          ema20_slope_positive
        },
        regime,
        env_score_adjustment,
        min_score_to_act,
        flag
      },
      meta: { fetchedAt: new Date().toISOString(), source: "yahoo:chart:^NSEI" }
    };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

module.exports = { nifty50 };
