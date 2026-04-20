import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('console', msg => {
    if (msg.text().startsWith('STACK:')) {
      console.log(msg.text().substring(6));
    }
  });

  await page.addInitScript(() => {
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const url = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].url ? args[0].url : String(args[0]));
      if (url && url.includes('/assets/chord/') && url.endsWith('.txt')) {
        console.log('STACK: ' + url + '\n' + new Error().stack);
      }
      return originalFetch(...args);
    };
  });

  try {
    await page.goto('http://127.0.0.1:8000/?stack404=' + Date.now(), { waitUntil: 'networkidle' });
    
    // Toggle chord mode if necessary. Based on earlier runs, I should click .pujian-item
    await page.waitForSelector('.pujian-item');
    await page.click('.pujian-item');
    
    // Attempt to click Chord button if it exists to ensure chord fetching is active
    try {
        await page.click('button:has-text("Chord")', { timeout: 2000 });
    } catch(e) {}

    await page.waitForTimeout(1000);
    
    const next = async () => {
        await page.evaluate(() => { if (window.onNextSong) window.onNextSong(); });
        await page.waitForTimeout(1000);
    };

    await next();
    await next();
    await page.waitForTimeout(1000);

  } catch (err) {
    // console.error(err);
  } finally {
    await browser.close();
  }
})();
