const { fetchOptionChainEquities } = require("../../services/nseDerivatives");

async function optionsChain(symbol) {
  const data = await fetchOptionChainEquities(symbol);
  return {
    ok: true,
    data,
    meta: { fetchedAt: new Date().toISOString(), source: "nse:/api/option-chain-equities" }
  };
}

function extractChainRows(raw) {
  const records = raw?.records;
  const data = records?.data || [];
  return Array.isArray(data) ? data : [];
}

function summarizeOi(raw) {
  const rows = extractChainRows(raw);
  let callOi = 0;
  let putOi = 0;
  for (const r of rows) {
    if (r?.CE?.openInterest) callOi += Number(r.CE.openInterest) || 0;
    if (r?.PE?.openInterest) putOi += Number(r.PE.openInterest) || 0;
  }
  const pcr = callOi > 0 ? putOi / callOi : null;
  return { callOi, putOi, pcr };
}

module.exports = { optionsChain, extractChainRows, summarizeOi };

