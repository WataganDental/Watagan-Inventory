const puppeteer = require('puppeteer');
const path = require('path');
const { spawn } = require('child_process');

(async () => {
  let browser;
  let httpServer;
  try {
    console.log('Starting HTTP server...');
    // Serve the /app/public directory.
    const publicDir = path.join(__dirname, 'public');
    console.log(`Serving files from ${publicDir} on http://localhost:8080`);
    httpServer = spawn('npx', ['http-server', publicDir, '-p', '8080', '-c-1'], {
      detached: true, // Detach the child process
      stdio: 'ignore', // Ignore stdio to prevent parent from waiting
    });
    httpServer.unref(); // Allow parent to exit independently

    // Wait for http-server to start
    console.log('Waiting 3 seconds for http-server to initialize...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    console.log('HTTP server should be running.');

    console.log('Launching Puppeteer...');
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process', // Make sure this is not causing issues
        '--disable-gpu'
      ],
      executablePath: puppeteer.executablePath() // Ensure it uses the downloaded Chromium
    });
    console.log('Puppeteer launched.');

    const page = await browser.newPage();
    console.log('New page created.');

    // Capture console logs from the page
    page.on('console', msg => {
      const type = msg.type();
      const text = msg.text();
      if (type === 'error' || type === 'warn' || text.includes('PDF')) {
         console.log(`PAGE LOG [${type.toUpperCase()}]: ${text}`);
      }
    });
    page.on('pageerror', error => {
        console.error('PAGE ERROR:', error.message);
    });
    page.on('requestfailed', request => {
        // Ignore favicon.ico errors as it's not relevant for this test
        if (!request.url().includes('favicon.ico')) {
            console.error(`REQUEST FAILED: ${request.url()} (${request.failure().errorText})`);
        }
    });
    
    const url = 'http://localhost:8080/test_pdf.html';
    console.log(`Navigating to ${url}...`);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 }); 
    console.log('Page loaded (DOMContentLoaded).');

    // Wait for app.js to potentially load and initialize. 
    // Firebase should now connect properly over HTTP.
    // The testPdfFunctions in test_pdf.html has its own robust waiting logic.
    // We just need to wait for the page to load, then let testPdfFunctions do its thing.
    console.log('Page loaded (DOMContentLoaded).');
    console.log('Allowing 5 seconds for initial script parsing and early app.js setup before calling testPdfFunctions...');
    await new Promise(resolve => setTimeout(resolve, 5000)); 

    console.log('Calling testPdfFunctions() in Puppeteer page context...');
    // testPdfFunctions has internal polling for up to ~20s (15s for deps + 5s for inventory)
    // Give page.evaluate a generous timeout to accommodate this and the actual PDF generation.
    try {
      await page.evaluate(() => testPdfFunctions(), { timeout: 60000 }); // Increased to 60 seconds
      console.log('page.evaluate(testPdfFunctions) call has completed.');
    } catch (e) {
      console.error('Error or timeout during page.evaluate(testPdfFunctions):', e);
      // This will catch timeouts from page.evaluate itself or unhandled exceptions from testPdfFunctions
    }
    
    console.log('Waiting 2 seconds for any final console messages from the page...');
    await new Promise(resolve => setTimeout(resolve, 2000));

  } catch (e) {
    console.error('General error in Puppeteer script:', e);
  } finally {
    if (browser) {
      console.log('Closing browser...');
      await browser.close().catch(e => console.error('Error closing browser:', e));
      console.log('Browser closed.');
    }
    // httpServer was detached and unref'd.
    console.log('Puppeteer script finished.');
  }
})();
