function verdictClassifier(totalScore) {
  const s = Number(totalScore);
  let band = "AVOID";
  if (s >= 75) band = "STRONG_BUY";
  else if (s >= 65) band = "BUY";
  else if (s >= 55) band = "WATCH";
  else if (s >= 45) band = "NEUTRAL";

  const confidence = s >= 75 ? "HIGH" : s >= 60 ? "MEDIUM" : "LOW";
  return {
    ok: true,
    data: { verdict: band, confidence },
    meta: { fetchedAt: new Date().toISOString(), source: "calc:verdictClassifier" }
  };
}

module.exports = { verdictClassifier };

