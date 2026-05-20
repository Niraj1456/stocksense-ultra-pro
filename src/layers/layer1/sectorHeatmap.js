const { fetchAllIndices } = require("../../services/nse");

function isSectorIndex(name) {
  if (!name) return false;
  const s = String(name).toUpperCase();
  if (!s.startsWith("NIFTY")) return false;
  // Heuristic: exclude broad benchmarks.
  const exclude = new Set([
    "NIFTY 50",
    "NIFTY NEXT 50",
    "NIFTY 100",
    "NIFTY 200",
    "NIFTY 500",
    "NIFTY MIDCAP 50",
    "NIFTY MIDCAP 100",
    "NIFTY MIDCAP 150",
    "NIFTY SMALLCAP 50",
    "NIFTY SMALLCAP 100",
    "NIFTY SMALLCAP 250",
    "NIFTY MICROCAP 250",
    "NIFTY TOTAL MARKET",
    "NIFTY500 MULTICAP 50:25:25",
    "NIFTY MIDSMALLCAP 400"
  ]);
  if (exclude.has(s)) return false;
  // Typical sectors
  return (
    s.includes("BANK") ||
    s.includes("IT") ||
    s.includes("AUTO") ||
    s.includes("PHARMA") ||
    s.includes("FMCG") ||
    s.includes("METAL") ||
    s.includes("REALTY") ||
    s.includes("ENERGY") ||
    s.includes("OIL") ||
    s.includes("PSU") ||
    s.includes("FIN") ||
    s.includes("MEDIA") ||
    s.includes("HEALTH") ||
    s.includes("CONSUMPTION") ||
    s.includes("COMMODITIES") ||
    s.includes("INFRA") ||
    s.includes("PVT") ||
    s.includes("MNC") ||
    s.includes("SERVICES")
  );
}

async function sectorHeatmap() {
  const raw = await fetchAllIndices();
  const rows = Array.isArray(raw?.data?.data) ? raw.data.data : Array.isArray(raw?.data) ? raw.data : [];

  const sectors = rows
    .filter((r) => isSectorIndex(r?.index))
    .map((r) => ({
      index: r.index,
      last: Number(r.last),
      change: Number(r.change),
      percentChange: Number(r.percentChange)
    }))
    .sort((a, b) => (b.percentChange || 0) - (a.percentChange || 0));

  return {
    ok: true,
    data: { sectors },
    meta: { fetchedAt: new Date().toISOString(), source: "nse:/api/allIndices" }
  };
}

module.exports = { sectorHeatmap };

