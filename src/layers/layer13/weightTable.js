const ST = {
  l1: 0.1,
  l3: 0.2,
  l7: 0.2,
  l10: 0.1,
  l11: 0.2,
  l12: 0.2
};

const LT = {
  l1: 0.1,
  l8: 0.2,
  l9: 0.2,
  l10: 0.2,
  l11: 0.15,
  l12: 0.15
};

function getWeights(mode) {
  return mode === "LT" ? LT : ST;
}

module.exports = { getWeights };

