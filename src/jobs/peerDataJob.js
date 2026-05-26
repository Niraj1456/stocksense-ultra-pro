/**
 * peerDataJob.js — Daily Peer Metrics Cache (Layer 23 support)
 *
 * Fetches fundamental metrics for the active universe, groups by sector,
 * computes peer_score percentile, and caches in peer_metrics table.
 *
 * Schedule: daily after market close
 */

const { dbQuery } = require('../lib/db');

const JOB_NAME = 'peer_data_job';
const LAYER_ID = 'L23';

// Metrics used for peer scoring with equal weight
const METRIC_KEYS = ['roe', 'roce', 'de_ratio', 'revenue_growth', 'operating_margin', 'fcf_yield'];

// Higher is better for all except D/E ratio (lower is better)
const LOWER_IS_BETTER = new Set(['de_ratio']);

function log(severity, eventCode, message, details = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    layer_id: LAYER_ID,
    event_code: eventCode,
    severity,
    message,
    details
  };
  if (severity === 'ERROR') {
    console.error(JSON.stringify(entry));
  } else {
    console.log(JSON.stringify(entry));
  }
}

/**
 * Extract a numeric metric from the fundamentals JSONB.
 * Looks for common key variants.
 */
function extractMetric(jsonData, metricKey) {
  if (!jsonData) return null;

  const keyMap = {
    roe: ['roe', 'return_on_equity', 'ROE'],
    roce: ['roce', 'return_on_capital_employed', 'ROCE'],
    de_ratio: ['de_ratio', 'debt_to_equity', 'D/E', 'debtEquity'],
    revenue_growth: ['revenue_growth', 'revenueGrowth', 'revenue_growth_yoy'],
    operating_margin: ['operating_margin', 'operatingMargin', 'opm'],
    fcf_yield: ['fcf_yield', 'fcfYield', 'free_cash_flow_yield']
  };

  const candidates = keyMap[metricKey] || [metricKey];
  for (const k of candidates) {
    if (jsonData[k] != null) {
      const val = Number(jsonData[k]);
      return Number.isFinite(val) ? val : null;
    }
  }
  return null;
}

/**
 * Compute percentile rank within a sorted array.
 * Mutates objects by adding `peer_score` property.
 */
function computePeerPercentiles(sectorSymbols) {
  if (sectorSymbols.length === 0) return;

  // For each metric, rank within sector
  const metricRanks = {};
  for (const key of METRIC_KEYS) {
    const withValue = sectorSymbols.filter(s => s.metrics[key] != null);
    if (withValue.length === 0) continue;

    const ascending = !LOWER_IS_BETTER.has(key);
    withValue.sort((a, b) => ascending
      ? a.metrics[key] - b.metrics[key]
      : b.metrics[key] - a.metrics[key]
    );

    for (let i = 0; i < withValue.length; i++) {
      const sym = withValue[i].symbol;
      if (!metricRanks[sym]) metricRanks[sym] = [];
      const pctile = withValue.length > 1
        ? Math.round((i / (withValue.length - 1)) * 100)
        : 50;
      metricRanks[sym].push(pctile);
    }
  }

  // Average percentile across all metrics = peer_score
  for (const s of sectorSymbols) {
    const ranks = metricRanks[s.symbol];
    if (ranks && ranks.length > 0) {
      s.peerScore = Math.round(ranks.reduce((a, b) => a + b, 0) / ranks.length);
    } else {
      s.peerScore = null;
    }
  }
}

async function run() {
  const startedAt = new Date();
  log('INFO', 'PEER_DATA_JOB_STARTED', 'Peer data computation started');

  try {
    // 1. Fetch active universe with sectors
    const universeRes = await dbQuery(
      `SELECT symbol, isin, sector FROM universe_registry
       WHERE listed_at <= CURRENT_DATE
         AND (delisted_at IS NULL OR delisted_at >= CURRENT_DATE)`
    );
    const symbols = universeRes.rows;

    if (symbols.length === 0) {
      log('WARN', 'PEER_DATA_EMPTY_UNIVERSE', 'No active symbols in universe_registry');
      await updateJobStatus(JOB_NAME, 'SUCCESS', startedAt, 'Empty universe');
      return;
    }

    log('INFO', 'PEER_DATA_UNIVERSE_LOADED', `Processing ${symbols.length} symbols`);

    const snapshotDate = new Date().toISOString().slice(0, 10);
    const symbolMetrics = [];

    // 2. Fetch latest fundamentals for each symbol
    for (const { symbol, isin, sector } of symbols) {
      try {
        const fundRes = await dbQuery(
          `SELECT json FROM fundamentals
           WHERE symbol = $1 AND period = 'TTM'
           ORDER BY ts DESC
           LIMIT 1`,
          [symbol]
        );

        if (fundRes.rows.length === 0) continue;

        const jsonData = fundRes.rows[0].json;
        const metrics = {};
        for (const key of METRIC_KEYS) {
          metrics[key] = extractMetric(jsonData, key);
        }

        // Skip if all metrics are null
        const hasAny = Object.values(metrics).some(v => v != null);
        if (!hasAny) continue;

        symbolMetrics.push({
          symbol,
          isin,
          sector: sector || 'UNKNOWN',
          metrics
        });
      } catch (err) {
        log('WARN', 'PEER_DATA_SYMBOL_ERROR', `Error fetching fundamentals for ${symbol}`, {
          symbol,
          error: err.message
        });
      }
    }

    // 3. Group by sector and compute peer percentiles
    const bySector = {};
    for (const s of symbolMetrics) {
      if (!bySector[s.sector]) bySector[s.sector] = [];
      bySector[s.sector].push(s);
    }

    for (const [sector, group] of Object.entries(bySector)) {
      log('DEBUG', 'PEER_DATA_SECTOR_PROCESSING', `Sector ${sector}: ${group.length} symbols`);
      computePeerPercentiles(group);
    }

    // 4. Insert into peer_metrics table
    let insertedCount = 0;
    for (const s of symbolMetrics) {
      if (s.peerScore == null) continue;

      await dbQuery(
        `INSERT INTO peer_metrics
           (symbol, sector, snapshot_date, roe, roce, debt_to_equity,
            revenue_growth_yoy, operating_margin, fcf_yield, peer_score)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (symbol, snapshot_date) DO UPDATE SET
           sector = EXCLUDED.sector,
           roe = EXCLUDED.roe,
           roce = EXCLUDED.roce,
           debt_to_equity = EXCLUDED.debt_to_equity,
           revenue_growth_yoy = EXCLUDED.revenue_growth_yoy,
           operating_margin = EXCLUDED.operating_margin,
           fcf_yield = EXCLUDED.fcf_yield,
           peer_score = EXCLUDED.peer_score`,
        [
          s.symbol, s.sector, snapshotDate,
          s.metrics.roe, s.metrics.roce, s.metrics.de_ratio,
          s.metrics.revenue_growth, s.metrics.operating_margin,
          s.metrics.fcf_yield, s.peerScore
        ]
      );
      insertedCount++;
    }

    log('INFO', 'PEER_DATA_JOB_COMPLETE', `Peer metrics computed for ${insertedCount} symbols`, {
      total_universe: symbols.length,
      sectors_processed: Object.keys(bySector).length,
      snapshot_date: snapshotDate
    });

    await updateJobStatus(JOB_NAME, 'SUCCESS', startedAt, `Computed ${insertedCount} peer metrics across ${Object.keys(bySector).length} sectors`);
  } catch (err) {
    log('ERROR', 'PEER_DATA_JOB_FAILED', 'Peer data job failed', { error: err.message, stack: err.stack });
    await updateJobStatus(JOB_NAME, 'FAILED', startedAt, err.message);
    throw err;
  }
}

async function updateJobStatus(jobName, status, startedAt, message) {
  try {
    await dbQuery(
      `INSERT INTO jobs (job_name, status, started_at, finished_at, message)
       VALUES ($1, $2, $3, NOW(), $4)
       ON CONFLICT (job_name) DO UPDATE SET
         status = EXCLUDED.status,
         started_at = EXCLUDED.started_at,
         finished_at = EXCLUDED.finished_at,
         message = EXCLUDED.message`,
      [jobName, status, startedAt, message]
    );
  } catch (err) {
    log('ERROR', 'JOB_STATUS_UPDATE_FAILED', 'Failed to update jobs table', { error: err.message });
  }
}

module.exports = { run };
