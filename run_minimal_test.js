const puppeteer = require('puppeteer');
const path = require('path');
const { spawn } = require('child_process');

(async () => {
  let browser;
  let httpServer;

  // Total time for this script to run, must be less than the tool's timeout (e.g. 400s)
  const SCRIPT_TIMEOUT = 60000; // 60 seconds for the whole test script
  const scriptTimeoutPromise = new Promise((_, reject) => 
    setTimeout(() => reject(new Error('Global script timeout reached')), SCRIPT_TIMEOUT)
  );

  try {
    await Promise.race([
      (async () => {
        console.log('[Runner] Starting HTTP server...');
        const publicDir = path.join(__dirname, 'public');
        httpServer = spawn('npx', ['http-server', publicDir, '-p', '8080', '-c-1', '--silent'], {
          detached: true,
          stdio: 'ignore',
        });
        httpServer.unref();
        await new Promise(resolve => setTimeout(resolve, 3000)); // Wait for server to start
        console.log('[Runner] HTTP server should be running on port 8080.');

        console.log('[Runner] Launching Puppeteer...');
        browser = await puppeteer.launch({
          headless: true,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process',
            '--disable-gpu'
          ],
        });
        console.log('[Runner] Puppeteer launched.');

        const page = await browser.newPage();
        console.log('[Runner] New page created.');

        page.on('console', msg => {
          const type = msg.type().toUpperCase();
          const text = msg.text();
          // Log all console messages from the page
          console.log(`[PAGE ${type}] ${text}`);
        });
        page.on('pageerror', error => {
            console.error('[PAGE ERROR] Uncaught exception:', error.message);
        });
        page.on('requestfailed', request => {
            if (!request.url().includes('favicon.ico')) { // Ignore favicon
                console.warn(`[PAGE WARN] Request Failed: ${request.url()} (${request.failure().errorText})`);
            }
        });

        const url = 'http://localhost:8080/minimal_test.html';
        console.log(`[Runner] Navigating to ${url}...`);
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
        console.log('[Runner] Page navigation complete (DOMContentLoaded).');

        // The minimal_test.html has internal polling up to ~20s, plus PDF generation.
        // Let's give it up to 35 seconds after navigation to complete all its tasks.
        console.log('[Runner] Waiting 35 seconds for tests within the page to complete...');
        await new Promise(resolve => setTimeout(resolve, 35000));
        console.log('[Runner] Test duration on page finished.');

      })(),
      scriptTimeoutPromise
    ]);

  } catch (e) {
    console.error('[Runner] Error in test script:', e.message, e.stack);
  } finally {
    if (browser) {
      console.log('[Runner] Closing browser...');
      await browser.close().catch(e => console.error('[Runner] Error closing browser:', e));
      console.log('[Runner] Browser closed.');
    }
    // httpServer is detached and unref'd, should not need explicit kill to allow parent exit.
    console.log('[Runner] Script finished.');
    // Ensure the process exits, even if there are lingering async tasks from Puppeteer/browser
    process.exit(0); 
  }
})();
