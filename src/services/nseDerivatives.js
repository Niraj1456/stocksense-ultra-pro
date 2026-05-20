const { nseGetJson } = require("./nseInternal");

async function fetchOptionChainEquities(symbol) {
  return nseGetJson(`/api/option-chain-equities?symbol=${encodeURIComponent(symbol)}`);
}

async function fetchFiiDii() {
  return nseGetJson("/api/fiidiiTradeReact");
}

async function fetchParticipantsOi() {
  return nseGetJson("/api/participants-oi");
}

async function fetchBulkDeals() {
  return nseGetJson("/api/bulk-deals");
}

async function fetchBlockDeals() {
  return nseGetJson("/api/block-deals");
}

async function fetchMarketDepth(symbol) {
  const data = await nseGetJson(`/api/quote-equity?symbol=${encodeURIComponent(symbol)}&section=trade_info`);
  return data;
}

module.exports = {
  fetchOptionChainEquities,
  fetchFiiDii,
  fetchParticipantsOi,
  fetchBulkDeals,
  fetchBlockDeals,
  fetchMarketDepth
};

