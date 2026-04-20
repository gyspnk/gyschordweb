import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  const fourOhFours = {};

  page.on('response', response => {
    if (response.status() === 404) {
      const url = response.url();
      const type = response.request().resourceType();
      const key = `${url} [${type}]`;
      fourOhFours[key] = (fourOhFours[key] || 0) + 1;
    }
  });

  const timestamp = Date.now();
  await page.goto(`http://127.0.0.1:8000/?trace404final=${timestamp}`);

  await page.waitForTimeout(2000);

  // Try to click first song by various common selectors
  try {
    const listItems = await page.$$('.song-item, .list-item, .song-link, [class*="song"]');
    if (listItems.length > 0) {
      await listItems[0].click();
      await page.waitForTimeout(1000);
    }
  } catch (e) {}

  for (let i = 0; i < 6; i++) {
    await page.evaluate(() => {
      if (typeof onNextSong === 'function') {
        onNextSong();
      } else {
        const nextBtn = document.querySelector('#nextSong, .next-button, [aria-label*="Next"]');
        if (nextBtn) nextBtn.click();
      }
    });
    await page.waitForTimeout(1000);
  }

  console.log('Unique 404 URLs and Counts:');
  console.log(JSON.stringify(fourOhFours, null, 2));

  await browser.close();
})();
