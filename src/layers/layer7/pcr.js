const { summarizeOi } = require("./optionsChain");

function pcr(raw) {
  const { callOi, putOi, pcr } = summarizeOi(raw);
  return {
    ok: true,
    data: { callOi, putOi, pcr },
    meta: { fetchedAt: new Date().toISOString(), source: "calc:pcr" }
  };
}

module.exports = { pcr };

