const puppeteer = require("puppeteer");
const { logger } = require("../lib/logger");

let sharedBrowser = null;
let pageCounter = 0;
const MAX_PAGES_BEFORE_RESTART = 100; // Recycles browser after 100 scrapings to prevent internal memory leaks
let browserPromise = null;

/**
 * Launch or retrieve the active singleton browser process.
 * Recovers dynamically from process crashes and terminations.
 */
async function getBrowser() {
  if (sharedBrowser && sharedBrowser.connected) {
    return sharedBrowser;
  }

  // Prevent race conditions where multiple threads launch browsers simultaneously
  if (browserPromise) {
    return browserPromise;
  }

  logger.info("puppeteer_launching_shared_browser_process");
  
  browserPromise = puppeteer.launch({
    headless: "new",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage", // extremely useful in Docker containers (prevents memory limit crashes)
      "--disable-gpu",           // saves CPU overhead in headless servers
      "--no-first-run",
      "--no-zygote",
      "--single-process"         // minimizes memory footprint
    ]
  }).then(browser => {
    sharedBrowser = browser;
    pageCounter = 0;
    browserPromise = null;
    
    // Setup disconnect event listener to handle unexpected crashes
    sharedBrowser.on("disconnected", () => {
      logger.warn("puppeteer_shared_browser_disconnected_or_crashed");
      sharedBrowser = null;
    });
    
    return sharedBrowser;
  }).catch(err => {
    browserPromise = null;
    logger.error("puppeteer_launch_failed", { error: err.message });
    throw err;
  });

  return browserPromise;
}

/**
 * Gracefully close the shared browser process (used on SIGTERM/SIGINT shutdowns).
 */
async function closeSharedBrowser() {
  if (sharedBrowser) {
    logger.info("puppeteer_closing_shared_browser_process");
    try {
      await sharedBrowser.close();
    } catch (e) {
      logger.error("puppeteer_close_error", { error: e.message });
    } finally {
      sharedBrowser = null;
      pageCounter = 0;
    }
  }
}

/**
 * Resource-safe Puppeteer page pool wrapper.
 * Keeps browser process active, opening/closing tab pages cleanly and recycling after 100 pages.
 */
async function withBrowser(fn) {
  let browser;
  let page;
  
  try {
    browser = await getBrowser();
    pageCounter++;
    
    logger.info("puppeteer_acquiring_page", { activePages: pageCounter });
    page = await browser.newPage();
    
    // Set standard browser headers for polite scraping and consistent responses
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    );
    await page.setExtraHTTPHeaders({ "Accept-Language": "en-US,en;q=0.9" });
    
    // Execute user scraper function
    const result = await fn({ browser, page });
    return result;
  } catch (error) {
    logger.error("puppeteer_scraper_execution_failed", { error: error.message });
    throw error;
  } finally {
    if (page) {
      try {
        await page.close();
      } catch (err) {
        logger.error("puppeteer_page_close_failed", { error: err.message });
      }
    }
    
    // Recycle the entire browser process after 100 executions to wipe internal memory bloat
    if (pageCounter >= MAX_PAGES_BEFORE_RESTART) {
      logger.info("puppeteer_max_pages_reached_recycling_browser");
      // Do not block current thread during cleanup
      closeSharedBrowser().catch(() => {});
    }
  }
}

async function retry(fn, { retries = 3 } = {}) {
  let last;
  for (let i = 1; i <= retries; i++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      const wait = Math.min(5000, 300 * Math.pow(2, i - 1));
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  throw last;
}

async function sleep(ms) {
  await new Promise((r) => setTimeout(r, ms));
}

module.exports = { withBrowser, retry, sleep, closeSharedBrowser };
