/**
 * universeRegistrySyncJob.js — Historical Listing Universe Registry Sync
 *
 * Runs daily at startup to populate universe_registry from NSE/BSE listing data,
 * detect symbol renames, update delisted_at, and log changes.
 *
 * Export: async function run()
 */

const { dbQuery } = require('../lib/db');

const LAYER_ID = 'SYSTEM';
const JOB_NAME = 'universeRegistrySyncJob';

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
 * Runs the historical listed universe sync job.
 */
async function run() {
  log('INFO', 'UNIVERSE_SYNC_STARTED', 'Starting historical listing universe sync job.');

  try {
    // Update attempt
    await dbQuery(
      `INSERT INTO jobs (job_name, last_attempt, status)
       VALUES ($1, NOW(), 'RUNNING')
       ON CONFLICT (job_name) DO UPDATE
       SET last_attempt = NOW(), status = 'RUNNING'`,
      [JOB_NAME]
    );

    // Mock API fetch: Fetch current listed stocks from NSE/BSE.
    // In production, this would query a regulatory CSV feed or exchange listing API.
    // We seed a diverse list of Indian market stocks for testing and demonstration.
    const fetchedStocks = [
      { isin: 'INE002A01018', symbol: 'RELIANCE', listed_at: '1977-11-01' },
      { isin: 'INE009A01021', symbol: 'INFY', listed_at: '1993-06-14' },
      { isin: 'INE040A01034', symbol: 'HDFCBANK', listed_at: '1995-05-19' },
      { isin: 'INE154A01025', symbol: 'TCS', listed_at: '2004-08-25' },
      { isin: 'INE081A01012', symbol: 'TATAMOTORS', listed_at: '1955-01-01' },
      { isin: 'INE062A01020', symbol: 'SBI', listed_at: '1995-03-01' },
      { isin: 'INE280A01028', symbol: 'TITAN', listed_at: '1984-07-26' },
      { isin: 'INE467B01029', symbol: 'TCS-NEW', listed_at: '2026-05-25' }, // Mock rename example
      { isin: 'INE758A01017', symbol: 'ADANIENT', listed_at: '1994-11-01' }
    ];

    // Begin PG Transaction
    await dbQuery('BEGIN');

    // 1. Get currently registered symbols to detect delistings and renames
    const existingRes = await dbQuery(
      `SELECT isin, symbol, listed_at, delisted_at, previous_symbols
       FROM universe_registry`
    );
    const registryMap = new Map();
    existingRes.rows.forEach(r => registryMap.set(r.isin, r));

    const activeFetchedIsins = new Set(fetchedStocks.map(s => s.isin));

    // 2. Process fetched listings
    for (const fetched of fetchedStocks) {
      const existing = registryMap.get(fetched.isin);

      if (!existing) {
        // New listing
        await dbQuery(
          `INSERT INTO universe_registry (isin, symbol, listed_at, delisted_at, previous_symbols)
           VALUES ($1, $2, $3, NULL, '[]'::jsonb)`,
          [fetched.isin, fetched.symbol, fetched.listed_at]
        );
        log('INFO', 'NEW_SECURITY_REGISTERED', `Registered new security: ${fetched.symbol} (${fetched.isin})`, {
          isin: fetched.isin,
          symbol: fetched.symbol
        });
      } else {
        // Existing listing - Check for Symbol Rename
        if (existing.symbol !== fetched.symbol) {
          log('WARN', 'SECURITY_SYMBOL_RENAMED', `Detected symbol rename for ISIN ${fetched.isin}: ${existing.symbol} → ${fetched.symbol}`, {
            isin: fetched.isin,
            old_symbol: existing.symbol,
            new_symbol: fetched.symbol
          });

          // Append old symbol to previous_symbols history
          const prevHistory = Array.isArray(existing.previous_symbols) ? existing.previous_symbols : [];
          const updatedHistory = [...prevHistory, {
            symbol: existing.symbol,
            valid_until: new Date().toISOString().split('T')[0]
          }];

          await dbQuery(
            `UPDATE universe_registry
             SET symbol = $1, previous_symbols = $2, delisted_at = NULL
             WHERE isin = $3`,
            [fetched.symbol, JSON.stringify(updatedHistory), fetched.isin]
          );
        } else if (existing.delisted_at !== null) {
          // Relisted security
          await dbQuery(
            `UPDATE universe_registry
             SET delisted_at = NULL
             WHERE isin = $1`,
            [fetched.isin]
          );
          log('INFO', 'SECURITY_RELISTED', `Security ${fetched.symbol} (${fetched.isin}) relisted.`, {
            isin: fetched.isin,
            symbol: fetched.symbol
          });
        }
      }
    }

    // 3. Mark delisted securities (present in DB but not in current API listing)
    for (const [isin, existing] of registryMap.entries()) {
      if (!activeFetchedIsins.has(isin) && existing.delisted_at === null) {
        await dbQuery(
          `UPDATE universe_registry
           SET delisted_at = CURRENT_DATE
           WHERE isin = $1`,
          [isin]
        );
        log('WARN', 'SECURITY_DELISTED', `Marked security ${existing.symbol} (${isin}) as delisted today.`, {
          isin,
          symbol: existing.symbol
        });
      }
    }

    await dbQuery('COMMIT');

    // Update job success
    await dbQuery(
      `UPDATE jobs
       SET last_success = NOW(), status = 'OK', error_message = NULL
       WHERE job_name = $1`,
      [JOB_NAME]
    );

    log('INFO', 'UNIVERSE_SYNC_SUCCESS', 'Historical listing universe sync completed successfully.');
    return { ok: true };
  } catch (err) {
    try {
      await dbQuery('ROLLBACK');
    } catch (_) {}

    await dbQuery(
      `UPDATE jobs
       SET status = 'ERROR', error_message = $2
       WHERE job_name = $1`,
      [JOB_NAME, err.message]
    );

    log('ERROR', 'UNIVERSE_SYNC_FAILED', 'Failed to synchronize historical listing universe.', {
      error: err.message,
      stack: err.stack
    });
    throw err;
  }
}

module.exports = { run };
