const { nseGetJson } = require("./nseInternal");

async function fetchAllIndices() {
  return nseGetJson("/api/allIndices");
}

async function fetchAdvancesDeclines() {
  return nseGetJson("/api/advances-declines");
}

module.exports = {
  fetchAllIndices,
  fetchAdvancesDeclines
};

