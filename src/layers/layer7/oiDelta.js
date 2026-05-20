const { extractChainRows } = require("./optionsChain");

function oiDelta(raw) {
  const rows = extractChainRows(raw);
  const byStrike = rows
    .map((r) => {
      const strike = Number(r?.strikePrice);
      const ce = r?.CE || null;
      const pe = r?.PE || null;
      return {
        strike,
        ceOi: Number(ce?.openInterest) || 0,
        ceChgOi: Number(ce?.changeinOpenInterest) || 0,
        peOi: Number(pe?.openInterest) || 0,
        peChgOi: Number(pe?.changeinOpenInterest) || 0
      };
    })
    .filter((r) => Number.isFinite(r.strike))
    .sort((a, b) => a.strike - b.strike);

  const topCeOi = [...byStrike].sort((a, b) => b.ceOi - a.ceOi).slice(0, 10);
  const topPeOi = [...byStrike].sort((a, b) => b.peOi - a.peOi).slice(0, 10);
  const topCeChg = [...byStrike].sort((a, b) => b.ceChgOi - a.ceChgOi).slice(0, 10);
  const topPeChg = [...byStrike].sort((a, b) => b.peChgOi - a.peChgOi).slice(0, 10);

  return {
    ok: true,
    data: { byStrike, topCeOi, topPeOi, topCeChg, topPeChg },
    meta: { fetchedAt: new Date().toISOString(), source: "calc:oiDelta" }
  };
}

module.exports = { oiDelta };

