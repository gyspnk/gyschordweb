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
      
      if (typeof url === 'string' && url.includes('001_Pujilah Allah Yang Maha Esa.txt')) {
        console.log('TXT_FETCH_STACK', url, new Error().stack);
      }
      return originalFetch(...args);
    };
  });

  try {
    // Navigate with a hash that triggers chord and specific song (assuming 001 exists)
    await page.goto('http://127.0.0.1:8000/#chord/001_Pujilah Allah Yang Maha Esa.txt');
    await page.waitForTimeout(3000);
    
    // Also try next
    await page.evaluate(() => { if (window.onNextSong) window.onNextSong(); });
    await page.waitForTimeout(2000);
    await page.evaluate(() => { if (window.onNextSong) window.onNextSong(); });
    await page.waitForTimeout(2000);

  } finally {
    await browser.close();
  }
})();
