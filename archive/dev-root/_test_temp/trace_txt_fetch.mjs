import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.addInitScript(() => {
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const url = typeof args[0] === 'string' ? args[0] : args[0].url;
      if (url.includes('/assets/chord/') && url.endsWith('.txt')) {
        console.log('TXT_FETCH_STACK', url, new Error().stack);
      }
      return originalFetch(...args);
    };
  });

  page.on('console', msg => {
    if (msg.text().startsWith('TXT_FETCH_STACK')) {
      console.log(msg.text());
    }
  });

  try {
    await page.goto('http://127.0.0.1:8000/?stack404=20260420092159');
    
    // Click first .pujian-item
    await page.waitForSelector('.pujian-item');
    await page.click('.pujian-item');
    
    // Wait a bit for any initial side effects
    await page.waitForTimeout(1000);
    
    // Run window.onNextSong() twice
    await page.evaluate(() => {
      if (typeof window.onNextSong === 'function') {
        window.onNextSong();
      }
    });
    await page.waitForTimeout(500);
    await page.evaluate(() => {
      if (typeof window.onNextSong === 'function') {
        window.onNextSong();
      }
    });
    await page.waitForTimeout(1000);

  } catch (err) {
    console.error(err);
  } finally {
    await browser.close();
  }
})();
