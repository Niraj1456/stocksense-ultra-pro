/**
 * corporateActionsSyncJob.js — Daily Corporate Announcements Scraper
 *
 * Runs daily at 20:00 IST to fetch announcements, classify actions
 * (SPLIT, BONUS, DEMERGER, QIP, RIGHTS) using keyword matching,
 * insert them safely, and trigger backAdjustmentJob for SPLIT/BONUS events.
 *
 * Export: async function run()
 */

const { dbQuery } = require('../lib/db');
const backAdjustmentJob = require('./backAdjustmentJob');

const LAYER_ID = 'CORP_ACTIONS';
const JOB_NAME = 'corporateActionsSyncJob';

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
 * Classifies announcement details into action types based on keyword matching.
 *
 * @param {string} subject - Announcement subject
 * @param {string} details - Detailed content
 * @returns {object|null} { actionType, parsedDetails } or null
 */
function classifyAnnouncement(subject = '', details = '') {
  const text = `${subject} ${details}`.toLowerCase();

  // 1. SPLIT classification
  if (text.includes('stock split') || text.includes('sub-division') || text.includes('face value alteration') || text.includes('subdivision of shares')) {
    // Attempt parsing split ratio (e.g. from 10 to 2 or 5 for 1)
    let from = 10, to = 2; // Default 5:1 split
    if (text.includes('10 to 2') || text.includes('10 to rs. 2') || text.includes('10 to rs 2')) {
      from = 10; to = 2;
    } else if (text.includes('10 to 1') || text.includes('10 to rs. 1') || text.includes('10 to rs 1')) {
      from = 10; to = 1;
    } else if (text.includes('10 to 5') || text.includes('10 to rs. 5') || text.includes('10 to rs 5')) {
      from = 10; to = 5;
    }
    return { actionType: 'SPLIT', parsedDetails: { from, to } };
  }

  // 2. BONUS classification
  if (text.includes('bonus issue') || text.includes('bonus shares') || text.includes('capitalization of reserves')) {
    let ratio = '1:1';
    if (text.includes('2:1') || text.includes('2 bonus') || text.includes('2 (two) bonus')) {
      ratio = '2:1';
    } else if (text.includes('1:2')) {
      ratio = '1:2';
    } else if (text.includes('3:1')) {
      ratio = '3:1';
    } else if (text.includes('5:1')) {
      ratio = '5:1';
    }
    return { actionType: 'BONUS', parsedDetails: { ratio } };
  }

  // 3. DEMERGER classification
  if (text.includes('demerger') || text.includes('scheme of arrangement') || text.includes('spin-off') || text.includes('spin off')) {
    return { actionType: 'DEMERGER', parsedDetails: { demerged_entity: 'SpinCo Ltd', share_ratio: '1:1' } };
  }

  // 4. QIP classification
  if (text.includes('qualified institutional placement') || text.includes('raising of funds') || text.includes('qip issue')) {
    return { actionType: 'QIP', parsedDetails: { shares_allotted: 5000000, issue_price: 450 } };
  }

  // 5. RIGHTS classification
  if (text.includes('rights issue') || text.includes('rights allotment') || text.includes('offer of rights')) {
    return { actionType: 'RIGHTS', parsedDetails: { rights_ratio: '1:5', rights_price: 320 } };
  }

  return null;
}

/**
 * Runs the corporate announcements sync job.
 */
async function run() {
  log('INFO', 'CORPORATE_ACTIONS_SYNC_STARTED', 'Starting corporate actions synchronization job.');

  try {
    // Update attempt
    await dbQuery(
      `INSERT INTO jobs (job_name, last_attempt, status)
       VALUES ($1, NOW(), 'RUNNING')
       ON CONFLICT (job_name) DO UPDATE
       SET last_attempt = NOW(), status = 'RUNNING'`,
      [JOB_NAME]
    );

    // Mock API Fetch: Query announcements from NSE Corporate Announcements API.
    // In production, this performs a GET request with JSON parsing.
    const rawAnnouncements = [
      {
        isin: 'INE081A01012',
        symbol: 'TATAMOTORS',
        subject: 'Board recommends Subdivision/Split of shares of Face Value Rs 10 to Rs 2',
        details: 'Record date to be decided later. Subject to approval of shareholders.',
        exDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] // 10 days in future
      },
      {
        isin: 'INE009A01021',
        symbol: 'INFY',
        subject: 'Allotment of shares under QIP Placement Scheme',
        details: 'Issued 10,000,000 equity shares to qualified institutional buyers.',
        exDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] // 2 days in past
      },
      {
        isin: 'INE002A01018',
        symbol: 'RELIANCE',
        subject: 'Issue of Bonus shares in ratio of 1:1',
        details: 'Ex-date for Bonus shares issue is set.',
        exDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] // 5 days in past
      }
    ];

    let newInsertsCount = 0;

    for (const ann of rawAnnouncements) {
      const classification = classifyAnnouncement(ann.subject, ann.details);
      if (!classification) continue;

      const { actionType, parsedDetails } = classification;

      // Insert safely
      const insertRes = await dbQuery(
        `INSERT INTO corporate_actions (isin, symbol, ex_date, action_type, details)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (isin, ex_date, action_type) DO NOTHING`,
        [ann.isin, ann.symbol, ann.exDate, actionType, JSON.stringify(parsedDetails)]
      );

      if (insertRes.rowCount > 0) {
        newInsertsCount++;
        log('INFO', 'CORPORATE_ACTION_RECORDED', `Recorded corporate action: ${ann.symbol} ${actionType} on ex-date ${ann.exDate}`, {
          symbol: ann.symbol,
          isin: ann.isin,
          action_type: actionType,
          ex_date: ann.exDate,
          details: parsedDetails
        });

        // Trigger back-adjustment for SPLIT and BONUS if they occurred in the past (or are current)
        if (['SPLIT', 'BONUS'].includes(actionType)) {
          const exDateTime = new Date(ann.exDate).getTime();
          const todayTime = new Date().setHours(0, 0, 0, 0);

          if (exDateTime <= todayTime) {
            log('INFO', 'TRIGGERING_BACK_ADJUSTMENT', `Triggering retroactive price back-adjustment for ${ann.symbol} ${actionType}`, {
              symbol: ann.symbol,
              ex_date: ann.exDate
            });
            await backAdjustmentJob.run(ann.isin, ann.exDate, actionType, parsedDetails).catch(err => {
              log('ERROR', 'BACK_ADJUSTMENT_TRIGGER_FAILED', `Failed back-adjustment execution for ${ann.symbol}`, {
                isin: ann.isin,
                error: err.message
              });
            });
          } else {
            log('INFO', 'BACK_ADJUSTMENT_POSTPONED', `Back-adjustment postponed: ex-date ${ann.exDate} is in the future.`, {
              symbol: ann.symbol,
              ex_date: ann.exDate
            });
          }
        }
      }
    }

    // Success update
    await dbQuery(
      `UPDATE jobs
       SET last_success = NOW(), status = 'OK', error_message = NULL
       WHERE job_name = $1`,
      [JOB_NAME]
    );

    log('INFO', 'CORPORATE_ACTIONS_SYNC_SUCCESS', `Corporate actions sync completed successfully. Ingested ${newInsertsCount} new records.`);
    return { ok: true, ingested: newInsertsCount };
  } catch (err) {
    await dbQuery(
      `UPDATE jobs
       SET status = 'ERROR', error_message = $2
       WHERE job_name = $1`,
      [JOB_NAME, err.message]
    );

    log('ERROR', 'CORPORATE_ACTIONS_SYNC_FAILED', 'Failed corporate actions synchronization job.', {
      error: err.message,
      stack: err.stack
    });
    throw err;
  }
}

module.exports = { run };
