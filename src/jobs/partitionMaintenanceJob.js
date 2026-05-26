/**
 * partitionMaintenanceJob.js — Monthly Partition Maintenance & Cleanup Job
 *
 * Runs monthly (1st of every month at 03:00 AM UTC).
 * 1. Checks if partitions for rs_ratings and peer_metrics exist for current year Y and Y+1.
 * 2. Dynamically creates partitions.
 * 3. Archives and prunes weight_calibration_log rows older than 365 days not referenced by trades.
 *
 * Export: async function run()
 */

const fs = require('fs');
const path = require('path');
const { dbQuery } = require('../lib/db');

const LAYER_ID = 'SYSTEM';
const JOB_NAME = 'partitionMaintenanceJob';

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
 * Creates partition tables dynamically for the given year if they do not exist.
 */
async function createPartitionsForYear(year) {
  const nextYear = year + 1;
  const startDate = `${year}-01-01`;
  const endDate = `${nextYear}-01-01`;

  log('INFO', 'CREATE_PARTITIONS_CHECK', `Checking/creating partitions for year ${year}`, { year, start: startDate, end: endDate });

  // 1. Create rs_ratings partition
  await dbQuery(`
    CREATE TABLE IF NOT EXISTS rs_ratings_${year} PARTITION OF rs_ratings
    FOR VALUES FROM ('${startDate}') TO ('${endDate}')
  `);

  // 2. Create peer_metrics partition
  await dbQuery(`
    CREATE TABLE IF NOT EXISTS peer_metrics_${year} PARTITION OF peer_metrics
    FOR VALUES FROM ('${startDate}') TO ('${endDate}')
  `);

  log('INFO', 'CREATE_PARTITIONS_SUCCESS', `Partitions checked/created for year ${year}`, { year });
}

/**
 * Append pruned rows to the archive file
 */
function appendToArchive(rows, year) {
  if (rows.length === 0) return;

  const logsDir = path.join(__dirname, '../../logs');
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }

  const archivePath = path.join(logsDir, `weight_calibration_archive_${year}.json`);
  let existingArchive = [];

  if (fs.existsSync(archivePath)) {
    try {
      const raw = fs.readFileSync(archivePath, 'utf8');
      existingArchive = JSON.parse(raw);
    } catch (e) {
      log('WARN', 'ARCHIVE_PARSE_FAILED', `Failed parsing archive file: ${e.message}`, { path: archivePath });
    }
  }

  const updatedArchive = [...existingArchive, ...rows];
  fs.writeFileSync(archivePath, JSON.stringify(updatedArchive, null, 2), 'utf8');
  log('INFO', 'ARCHIVE_WRITE_SUCCESS', `Archived ${rows.length} rows to ${archivePath}`, { path: archivePath });
}

/**
 * Runs the partition maintenance and pruning job.
 */
async function run() {
  log('INFO', 'PARTITION_MAINTENANCE_STARTED', 'Starting partition maintenance and pruning job.');

  // Update running status
  await dbQuery(
    `INSERT INTO jobs (job_name, last_attempt, status)
     VALUES ($1, NOW(), 'RUNNING')
     ON CONFLICT (job_name) DO UPDATE
     SET last_attempt = NOW(), status = 'RUNNING'`,
    [JOB_NAME]
  );

  try {
    const currentYear = new Date().getFullYear();

    // 1. Create partitions for current year (Y) and next year (Y+1)
    await createPartitionsForYear(currentYear);
    await createPartitionsForYear(currentYear + 1);

    // 2. Prune and Archive old weight_calibration_log rows (older than 365 days, inactive, not referenced by trades)
    await dbQuery('BEGIN');

    // Select candidate rows with row locks (FOR UPDATE)
    const selectRes = await dbQuery(`
      SELECT wcl.* FROM weight_calibration_log wcl
      LEFT JOIN trades t ON t.applied_weights_log_id = wcl.id
      WHERE wcl.is_active = FALSE
        AND wcl.calibrated_at < NOW() - INTERVAL '365 days'
        AND t.applied_weights_log_id IS NULL
      FOR UPDATE OF wcl
    `);

    const candidateRows = selectRes.rows;

    if (candidateRows.length > 0) {
      log('INFO', 'PRUNING_CANDIDATES_FOUND', `Found ${candidateRows.length} calibration log rows to prune.`, { count: candidateRows.length });

      // Write to archive file
      appendToArchive(candidateRows, currentYear);

      // Delete from DB
      for (const row of candidateRows) {
        await dbQuery('DELETE FROM weight_calibration_log WHERE id = $1', [row.id]);
      }

      log('INFO', 'PRUNING_COMPLETE', `Deleted ${candidateRows.length} rows from weight_calibration_log database.`, { count: candidateRows.length });
    } else {
      log('INFO', 'PRUNING_NOOP', 'No expired calibration log rows found to prune.');
    }

    await dbQuery('COMMIT');

    // Success update
    await dbQuery(
      `UPDATE jobs
       SET last_success = NOW(), status = 'OK', error_message = NULL
       WHERE job_name = $1`,
      [JOB_NAME]
    );

    log('INFO', 'PARTITION_MAINTENANCE_SUCCESS', 'Partition maintenance and pruning job completed successfully.');
    return { ok: true, partitionsCreated: [currentYear, currentYear + 1], prunedCount: candidateRows.length };

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

    log('ERROR', 'PARTITION_MAINTENANCE_FAILED', 'Failed partition maintenance and pruning job.', {
      error: err.message,
      stack: err.stack
    });
    throw err;
  }
}

module.exports = { run };
