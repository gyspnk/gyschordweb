import { chromium } from 'playwright';
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const timestamp = Date.now();
  const requests404 = [];

  page.on('response', response => {
    if (response.status() === 404) {
      requests404.push({
        url: response.url(),
        method: response.request().method(),
        resourceType: response.request().resourceType()
      });
    }
  });

  await page.goto('http://127.0.0.1:8000/?trace404=' + timestamp);
  
  // Try to open first song if PDF viewer not active
  await page.evaluate(() => {
    if (typeof openPdfViewer === 'function') openPdfViewer(0);
  });
  await page.waitForTimeout(1000);

  // Trigger next song 6 times
  for (let i = 0; i < 6; i++) {
    await page.evaluate(() => {
      if (typeof onNextSong === 'function') onNextSong();
    });
    await page.waitForTimeout(500);
  }

  const unique404s = {};
  requests404.forEach(req => {
    unique404s[req.url] = (unique404s[req.url] || 0) + 1;
  });

  console.log(JSON.stringify(unique404s, null, 2));

  await browser.close();
})();
