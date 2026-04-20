import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('console', msg => {
    if (msg.text().includes('TXT_FETCH_STACK')) {
      console.log(msg.text());
    }
  });

  await page.addInitScript(() => {
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      let url = args[0];
      if (typeof url !== 'string') {
          url = (url && url.url) || String(url);
      }
      
      // Look for any fetch to a .txt file
      if (typeof url === 'string' && url.endsWith('.txt')) {
        console.log('TXT_FETCH_STACK', url, new Error().stack);
      }
      return originalFetch(...args);
    };
  });

  try {
    await page.goto('http://127.0.0.1:8000/?stack404=' + Date.now(), { waitUntil: 'networkidle' });
    
    // Switch to chord mode
    await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(el => el.textContent === 'Chord');
        if (btn) btn.click();
    });

    await page.waitForTimeout(1000);
    
    // Click first item
    await page.waitForSelector('.pujian-item');
    await page.click('.pujian-item');
    
    await page.waitForTimeout(1500);
    
    const next = async () => {
        await page.evaluate(() => { if (window.onNextSong) window.onNextSong(); });
        await page.waitForTimeout(1500);
    };

    await next();
    await next();
    
    await page.waitForTimeout(2000);

  } catch (err) {
    // console.error(err);
  } finally {
    await browser.close();
  }
})();
