function verdictClassifier(totalScore) {
  const s = Number(totalScore);
  let band = "AVOID";
  if (s >= 70) band = "STRONG_BUY";
  else if (s >= 55) band = "BUY";
  else if (s >= 45) band = "NEUTRAL_WATCH";

  const confidence = s >= 70 ? "HIGH" : s >= 55 ? "MEDIUM" : "LOW";
  return {
    ok: true,
    data: { verdict: band, confidence },
    meta: { fetchedAt: new Date().toISOString(), source: "calc:verdictClassifier" }
  };
}

module.exports = { verdictClassifier };

