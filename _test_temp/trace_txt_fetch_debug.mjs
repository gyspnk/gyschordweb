import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('console', msg => console.log('DEBUG_CONSOLE:', msg.text()));
  page.on('request', request => {
    if (request.url().includes('/assets/chord/') && request.url().endsWith('.txt')) {
      console.log('DEBUG_REQUEST:', request.url());
    }
  });

  await page.addInitScript(() => {
    console.log('DEBUG_INIT: script injected');
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const url = typeof args[0] === 'string' ? args[0] : args[0].url;
      console.log('DEBUG_FETCH_CALL:', url);
      if (url.includes('/assets/chord/') && url.endsWith('.txt')) {
        console.log('TXT_FETCH_STACK', url, new Error().stack);
      }
      return originalFetch(...args);
    };
  });

  try {
    console.log('Navigating...');
    await page.goto('http://127.0.0.1:8000/?stack404=' + Date.now(), { waitUntil: 'networkidle' });
    console.log('Navigation done');
    
    await page.waitForSelector('.pujian-item', { timeout: 5000 });
    console.log('Clicking .pujian-item');
    await page.click('.pujian-item');
    
    await page.waitForTimeout(2000);
    
    console.log('Calling window.onNextSong() 1');
    await page.evaluate(() => {
      if (typeof window.onNextSong === 'function') {
        window.onNextSong();
      } else {
        console.log('window.onNextSong is NOT a function');
      }
    });

    await page.waitForTimeout(1000);
    console.log('Calling window.onNextSong() 2');
    await page.evaluate(() => {
      if (typeof window.onNextSong === 'function') {
        window.onNextSong();
      }
    });
    
    await page.waitForTimeout(2000);

  } catch (err) {
    console.error('ERROR:', err);
  } finally {
    await browser.close();
  }
})();
