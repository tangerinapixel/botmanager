const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

// Versão compatível com whatsapp-web.js v1.27.0 e Puppeteer 21.6.0
module.exports = {
  clearChromeCache: () => {
    const cachePath = path.join(__dirname, '../chrome_cache');
    try {
      if (fs.existsSync(cachePath)) {
        fs.rmSync(cachePath, { recursive: true, force: true });
        console.log('[Cache] Chrome cache cleaned');
      }
    } catch (error) {
      console.error('[Cache] Clean error:', error.message);
    }
  },

  optimizeSession: async (client) => {
    try {
      const page = await client.getPage();
      await page.evaluate(() => {
        try {
          console.log('[Optimize] Cleaning browser storage...');
          localStorage.clear();
          sessionStorage.clear();
          if (typeof indexedDB.databases === 'function') {
            indexedDB.databases().then(dbs => {
              dbs.forEach(db => {
                try {
                  indexedDB.deleteDatabase(db.name);
                } catch (e) {
                  console.warn('[Optimize] Failed to delete DB:', db.name);
                }
              });
            }).catch(() => {});
          }
        } catch (e) {
          console.warn('[Optimize] Partial clean:', e.message);
        }
      });
    } catch (e) {
      console.warn('[Optimize] Session optimization skipped:', e.message);
    }
  },

  warmupBrowser: async () => {
    try {
      console.log('[Warmup] Starting browser pre-heat...');
      const dummyBrowser = await puppeteer.launch({
        headless: true,
        executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage'
        ]
      });
      await dummyBrowser.close();
      console.log('[Warmup] Browser ready');
    } catch (e) {
      console.log('[Warmup] Non-critical error:', e.message);
    }
  }
};