const { fetchFiiDii } = require("../../services/nseDerivatives");

async function fiiDii() {
  const data = await fetchFiiDii();
  return {
    ok: true,
    data,
    meta: { fetchedAt: new Date().toISOString(), source: "nse:/api/fiidiiTradeReact" }
  };
}

module.exports = { fiiDii };

