function sectorRotation({
  rbi_rate_direction = "PAUSING",
  iip_trend = "STABLE",
  cpi_level = 5.0,
  gdp_growth_trend = "STABLE",
  nifty_6m_return = 0,
  stock_sector = "UNKNOWN"
} = {}) {
  try {
    let economic_phase_score = 0;

    if (rbi_rate_direction === "CUTTING") economic_phase_score += 2;
    if (rbi_rate_direction === "HIKING") economic_phase_score -= 2;

    if (iip_trend === "RECOVERING") economic_phase_score += 1;
    if (iip_trend === "DECLINING") economic_phase_score -= 1;

    if (cpi_level < 4) economic_phase_score += 1;
    if (cpi_level > 6) economic_phase_score -= 1;

    if (gdp_growth_trend === "ACCELERATING") economic_phase_score += 2;
    if (gdp_growth_trend === "DECELERATING") economic_phase_score -= 2;

    if (nifty_6m_return > 15) economic_phase_score += 1;
    if (nifty_6m_return < -10) economic_phase_score -= 2;

    let phase = "";
    let leading_sectors = [];
    let lagging_sectors = [];

    if (economic_phase_score >= 4) {
      phase = "EXPANSION";
      leading_sectors = ["CAPITAL_GOODS", "METALS", "ENERGY", "MANUFACTURING"];
      lagging_sectors = ["FMCG", "PHARMA", "IT"];
    } else if (economic_phase_score >= 1 && economic_phase_score < 4) {
      phase = "EARLY_RECOVERY";
      leading_sectors = ["BANKING", "NBFC", "AUTO", "REAL_ESTATE"];
      lagging_sectors = ["METALS", "CAPITAL_GOODS"];
    } else if (economic_phase_score >= -2 && economic_phase_score < 1) {
      phase = "LATE_CYCLE";
      leading_sectors = ["IT", "PHARMA", "FMCG"];
      lagging_sectors = ["METALS", "AUTO", "REAL_ESTATE"];
    } else if (economic_phase_score < -2) {
      phase = "RECESSION";
      leading_sectors = ["PHARMA", "FMCG", "GOLD_PROXIES"];
      lagging_sectors = ["BANKING", "METALS", "AUTO", "REAL_ESTATE", "CAPITAL_GOODS"];
    }

    let tailwind_pts = 0;
    let label = "SECTOR_NEUTRAL";

    if (leading_sectors.includes(stock_sector.toUpperCase())) {
      tailwind_pts = 5;
      label = "SECTOR_TAILWIND";
    } else if (lagging_sectors.includes(stock_sector.toUpperCase())) {
      tailwind_pts = -4;
      label = "SECTOR_HEADWIND";
    }

    return {
      ok: true,
      data: {
        inputs: {
          rbi_rate_direction,
          iip_trend,
          cpi_level,
          gdp_growth_trend,
          nifty_6m_return,
          stock_sector
        },
        economic_phase_score,
        economic_phase: phase,
        sector_status: label,
        tailwind_pts,
        leading_sectors,
        lagging_sectors
      },
      meta: { fetchedAt: new Date().toISOString(), source: "calc:sectorRotation" }
    };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

module.exports = { sectorRotation };
