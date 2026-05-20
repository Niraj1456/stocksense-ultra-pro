function predictiveSignals({ maxPain, pcr, technicals, valuationBand }) {
  const rsi = Number(technicals?.rsi14);
  const atr = Number(technicals?.atr14);
  const last = Number(technicals?.lastClose);
  const pcrV = Number(pcr?.pcr);
  const mp = Number(maxPain?.maxPainStrike);

  const maxPainGravityPct = Number.isFinite(last) && Number.isFinite(mp) && last !== 0 ? ((mp - last) / last) * 100 : null;
  const stretched = Number.isFinite(rsi) ? (rsi > 70 ? "overbought" : rsi < 30 ? "oversold" : "neutral") : "unknown";
  const volRegime = Number.isFinite(atr) && Number.isFinite(last) && last !== 0 ? (atr / last > 0.03 ? "high" : "normal") : "unknown";

  const hints = [];
  if (stretched === "oversold" && pcrV > 1) hints.push("contrarian_bullish");
  if (stretched === "overbought" && pcrV < 0.8) hints.push("contrarian_bearish");
  if (Number.isFinite(maxPainGravityPct) && Math.abs(maxPainGravityPct) > 2) hints.push("max_pain_pull_active");
  if (valuationBand === "EXPENSIVE") hints.push("valuation_headwind");
  if (valuationBand === "CHEAP") hints.push("valuation_tailwind");

  return {
    ok: true,
    data: { stretched, volRegime, maxPainGravityPct, hints },
    meta: { fetchedAt: new Date().toISOString(), source: "calc:layer11_predictive" }
  };
}

module.exports = { predictiveSignals };

