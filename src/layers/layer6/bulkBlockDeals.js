const { fetchBulkDeals, fetchBlockDeals } = require("../../services/nseDerivatives");

async function bulkDeals() {
  const data = await fetchBulkDeals();
  return {
    ok: true,
    data,
    meta: { fetchedAt: new Date().toISOString(), source: "nse:/api/bulk-deals" }
  };
}

async function blockDeals() {
  const data = await fetchBlockDeals();
  return {
    ok: true,
    data,
    meta: { fetchedAt: new Date().toISOString(), source: "nse:/api/block-deals" }
  };
}

module.exports = { bulkDeals, blockDeals };

