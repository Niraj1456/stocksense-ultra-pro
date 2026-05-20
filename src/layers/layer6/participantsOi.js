const { fetchParticipantsOi } = require("../../services/nseDerivatives");

async function participantsOi() {
  const data = await fetchParticipantsOi();
  return {
    ok: true,
    data,
    meta: { fetchedAt: new Date().toISOString(), source: "nse:/api/participants-oi" }
  };
}

module.exports = { participantsOi };

