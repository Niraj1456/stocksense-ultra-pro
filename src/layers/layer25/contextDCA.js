// ═══════════════════════════════════════════════════════════════════════════
// LAYER 25 — SECTOR-REGIME CONTEXT DCA
//
// Tracks per-layer Directional Conviction Accuracy (DCA) segmented by:
//   1. Sector group (BFSI, TECH, INDUSTRIAL, CONSUMER, COMMODITY, HEALTHCARE, GENERAL)
//   2. VIX regime (LOW_VIX, HIGH_VIX)
//
// This allows the Oracle Confidence Multiplier to assess how well each
// layer performs for specific TYPES of stocks, rather than using one
// global accuracy figure.
//
// Example: L19 (Promoter Pledge) may be 89% accurate for BFSI but only
// 31% accurate for IT stocks. Using global DCA (60%) for both is wrong.
// ═══════════════════════════════════════════════════════════════════════════

'use strict';

const { EWMA_LAMBDA } = require('../../config/mathConstants');

const LAYER_ID = 'L25_CTX';

function logEvent(eventCode, severity, message, details = {}) {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    layer_id: LAYER_ID,
    event_code: eventCode,
    severity,
    message,
    details
  }));
}

/**
 * Sector groupings for context DCA. Stocks are mapped to broad sector groups
 * to maintain sufficient sample size per group.
 */
const SECTOR_GROUPS = {
  BFSI: ['BANKING', 'NBFC', 'INSURANCE', 'FINSERV', 'BANK', 'FINANCIAL', 'FINANCE'],
  TECH: ['IT', 'SOFTWARE', 'DIGITAL', 'TECHNOLOGY', 'INFOTECH'],
  INDUSTRIAL: ['CAPITAL_GOODS', 'INFRASTRUCTURE', 'ENGINEERING', 'CONSTRUCTION', 'INDUSTRIAL'],
  CONSUMER: ['FMCG', 'RETAIL', 'CONSUMER_DURABLES', 'CONSUMER', 'AUTO', 'AUTOMOBILE'],
  COMMODITY: ['METALS', 'MINING', 'OIL_GAS', 'CHEMICALS', 'STEEL', 'CEMENT', 'ENERGY'],
  HEALTHCARE: ['PHARMA', 'HOSPITALS', 'DIAGNOSTICS', 'HEALTHCARE', 'PHARMACEUTICAL']
};

/**
 * Maps a raw sector string to a sector group key.
 * Returns 'GENERAL' if no match found.
 *
 * @param {string|null} sector - Raw sector string from trade/stock data
 * @returns {string} Sector group key
 */
function mapToSectorGroup(sector) {
  if (!sector || typeof sector !== 'string') return 'GENERAL';

  const normalized = sector.toUpperCase().replace(/[^A-Z_]/g, '');

  for (const [group, keywords] of Object.entries(SECTOR_GROUPS)) {
    for (const keyword of keywords) {
      if (normalized.includes(keyword)) {
        return group;
      }
    }
  }

  return 'GENERAL';
}

/**
 * Computes EWMA + Profit-Weighted DCA per layer, segmented by sector group and regime.
 *
 * @param {Object} params
 * @param {Object[]} params.trades - Closed trades with:
 *   - entry_price, exit_price, exit_ts (required)
 *   - json.layer_scores or layer_scores_json (layer scores at trade time)
 *   - sector or json.sector (stock sector)
 *   - mode (INTRADAY/INVESTMENT)
 *   - vix_regime or json.vix_regime (LOW_VIX/HIGH_VIX)
 * @param {string[]} params.layerKeys - Layer keys to compute DCA for
 * @param {string} [params.targetSector] - Filter trades to this sector group
 * @param {string} [params.targetRegime] - Filter trades to this VIX regime
 * @param {number} [params.minTrades=30] - Minimum trades for valid context DCA
 * @param {number} [params.ewmaLambda] - EWMA decay factor (default from mathConstants)
 * @returns {Object} {
 *   contextDCA: { layer1_macro: 0.62, ... },
 *   profitWeightedDCA: { layer1_macro: 0.71, ... },
 *   effectiveDCA: { layer1_macro: 0.67, ... },  // 0.6 × PWDCA + 0.4 × EWMA_DCA
 *   tradeCount: number,
 *   sectorGroup: string,
 *   regime: string,
 *   isFallback: boolean  // true if fell back to global DCA due to insufficient context data
 * }
 */
function computeContextDCA({
  trades,
  layerKeys,
  targetSector = null,
  targetRegime = null,
  minTrades = 30,
  ewmaLambda = null
}) {
  const lambda = ewmaLambda ?? EWMA_LAMBDA;
  const sectorGroup = targetSector ? mapToSectorGroup(targetSector) : 'GENERAL';
  const regime = targetRegime || 'ALL';

  if (!trades || !Array.isArray(trades) || trades.length === 0 || !layerKeys || layerKeys.length === 0) {
    return buildEmptyResult(layerKeys, sectorGroup, regime, true);
  }

  // Filter trades by sector group and regime
  let contextTrades = trades;

  if (targetSector && sectorGroup !== 'GENERAL') {
    contextTrades = contextTrades.filter(t => {
      const tradeSector = t.sector || (t.json && t.json.sector) || '';
      return mapToSectorGroup(tradeSector) === sectorGroup;
    });
  }

  if (targetRegime && targetRegime !== 'ALL') {
    contextTrades = contextTrades.filter(t => {
      const tradeRegime = t.vix_regime || (t.json && t.json.vix_regime) || 'LOW_VIX';
      return tradeRegime === targetRegime;
    });
  }

  // Fallback: if insufficient context-specific trades, use all trades
  let isFallback = false;
  if (contextTrades.length < minTrades) {
    logEvent('CONTEXT_DCA_FALLBACK_TO_GLOBAL', 'INFO',
      `Insufficient trades for ${sectorGroup}/${regime} (${contextTrades.length} < ${minTrades}). Falling back to global DCA.`,
      { sectorGroup, regime, contextTradeCount: contextTrades.length, minTrades });
    contextTrades = trades;
    isFallback = true;
  }

  // Sort by exit_ts descending (most recent first) for EWMA weighting
  const sortedTrades = [...contextTrades]
    .filter(t => t.exit_ts && t.entry_price && t.exit_price)
    .sort((a, b) => new Date(b.exit_ts) - new Date(a.exit_ts));

  if (sortedTrades.length === 0) {
    return buildEmptyResult(layerKeys, sectorGroup, regime, true);
  }

  // Compute EWMA-DCA and Profit-Weighted DCA simultaneously
  const ewmaDCA = {};
  const profitWeightedDCA = {};

  for (const key of layerKeys) {
    let ewmaCorrectSum = 0;
    let ewmaWeightSum = 0;
    let pwCorrectSum = 0;
    let pwWeightSum = 0;

    for (let k = 0; k < sortedTrades.length; k++) {
      const trade = sortedTrades[k];
      const entry = Number(trade.entry_price);
      const exit = Number(trade.exit_price);

      if (!entry || !exit || entry === exit) continue;

      const actualDirection = exit > entry ? 'UP' : 'DOWN';
      const returnMagnitude = Math.abs((exit - entry) / entry);

      // Parse layer scores
      let lScores = {};
      if (typeof trade.json === 'object' && trade.json !== null) {
        lScores = trade.json.layer_scores || trade.json.layer_scores_json || {};
      } else if (typeof trade.layer_scores_json === 'object' && trade.layer_scores_json !== null) {
        lScores = trade.layer_scores_json;
      } else if (typeof trade.json === 'string') {
        try {
          const parsed = JSON.parse(trade.json);
          lScores = parsed.layer_scores || parsed.layer_scores_json || {};
        } catch (e) { /* skip */ }
      }

      const score = lScores[key];
      if (score == null) {
        // Missing score → 0.5 credit (neutral)
        const decayWeight = Math.pow(lambda, k);
        ewmaCorrectSum += 0.5 * decayWeight;
        ewmaWeightSum += decayWeight;
        continue;
      }

      const predictedDirection = score > 50 ? 'UP' : (score < 50 ? 'DOWN' : 'NEUTRAL');
      if (predictedDirection === 'NEUTRAL') continue;

      const correct = predictedDirection === actualDirection ? 1 : 0;
      const decayWeight = Math.pow(lambda, k);

      // EWMA-DCA: temporal weighting only
      ewmaCorrectSum += correct * decayWeight;
      ewmaWeightSum += decayWeight;

      // Profit-Weighted DCA: temporal + magnitude weighting
      const profitWeight = decayWeight * returnMagnitude;
      pwCorrectSum += correct * profitWeight;
      pwWeightSum += profitWeight;
    }

    // Compute final DCA values
    ewmaDCA[key] = ewmaWeightSum > 0 ? ewmaCorrectSum / ewmaWeightSum : 0.50;
    profitWeightedDCA[key] = pwWeightSum > 0 ? pwCorrectSum / pwWeightSum : 0.50;
  }

  // Compute effective DCA: 60% profit-weighted + 40% EWMA directional
  const effectiveDCA = {};
  for (const key of layerKeys) {
    effectiveDCA[key] = Math.round((0.6 * profitWeightedDCA[key] + 0.4 * ewmaDCA[key]) * 10000) / 10000;
  }

  return {
    contextDCA: ewmaDCA,
    profitWeightedDCA,
    effectiveDCA,
    tradeCount: sortedTrades.length,
    sectorGroup,
    regime,
    isFallback
  };
}

/**
 * Computes context DCA for ALL sector groups and regimes.
 * Returns a nested map for the Oracle to look up.
 *
 * @param {Object[]} trades - All closed trades
 * @param {string[]} layerKeys - Layer keys to compute DCA for
 * @param {number} [minTrades=30] - Minimum trades per context bucket
 * @returns {Object} {
 *   global: { effectiveDCA: {...}, tradeCount },
 *   byContext: { BFSI: { LOW_VIX: {...}, HIGH_VIX: {...} }, TECH: {...}, ... }
 * }
 */
function computeAllContextDCA(trades, layerKeys, minTrades = 30) {
  const allSectorGroups = [...Object.keys(SECTOR_GROUPS), 'GENERAL'];
  const regimes = ['LOW_VIX', 'HIGH_VIX'];

  // Global DCA (no sector/regime filter)
  const globalResult = computeContextDCA({ trades, layerKeys, minTrades });

  const byContext = {};
  for (const sg of allSectorGroups) {
    byContext[sg] = {};
    for (const reg of regimes) {
      byContext[sg][reg] = computeContextDCA({
        trades,
        layerKeys,
        targetSector: sg,
        targetRegime: reg,
        minTrades
      });
    }
  }

  return {
    global: globalResult,
    byContext
  };
}

/**
 * Helper: builds empty DCA result for early returns.
 */
function buildEmptyResult(layerKeys, sectorGroup, regime, isFallback) {
  const neutralDCA = {};
  if (layerKeys) {
    for (const k of layerKeys) {
      neutralDCA[k] = 0.50;
    }
  }
  return {
    contextDCA: { ...neutralDCA },
    profitWeightedDCA: { ...neutralDCA },
    effectiveDCA: { ...neutralDCA },
    tradeCount: 0,
    sectorGroup: sectorGroup || 'GENERAL',
    regime: regime || 'ALL',
    isFallback
  };
}

module.exports = {
  computeContextDCA,
  computeAllContextDCA,
  mapToSectorGroup,
  SECTOR_GROUPS
};
