const { extractChainRows } = require("./optionsChain");

function maxPain(raw) {
  const rows = extractChainRows(raw);
  const strikes = rows.map((r) => Number(r?.strikePrice)).filter((x) => Number.isFinite(x));
  const uniqStrikes = Array.from(new Set(strikes)).sort((a, b) => a - b);

  // Loss for writers if expiry at strike S:
  // Calls ITM: sum(callOI * max(0, S - K))
  // Puts ITM:  sum(putOI  * max(0, K - S))
  const losses = uniqStrikes.map((S) => {
    let loss = 0;
    for (const r of rows) {
      const K = Number(r?.strikePrice);
      if (!Number.isFinite(K)) continue;
      const callOi = Number(r?.CE?.openInterest) || 0;
      const putOi = Number(r?.PE?.openInterest) || 0;
      loss += callOi * Math.max(0, S - K);
      loss += putOi * Math.max(0, K - S);
    }
    return { strike: S, loss };
  });

  const best = losses.reduce((a, b) => (b.loss < a.loss ? b : a), losses[0] || { strike: null, loss: null });
  return {
    ok: best?.strike !== null,
    data: { maxPainStrike: best.strike, losses: losses.slice(0, 200) },
    meta: { fetchedAt: new Date().toISOString(), source: "calc:maxPain" },
    error: best?.strike !== null ? undefined : "max_pain_unavailable"
  };
}

module.exports = { maxPain };

