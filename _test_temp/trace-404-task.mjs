import { chromium } from 'playwright';

(async () => {
    const browser = await chromium.launch();
    const context = await browser.newContext();
    const page = await context.newPage();

    const fourOhFours = {};
    page.on('response', response => {
        if (response.status() === 404) {
            const url = response.url();
            fourOhFours[url] = (fourOhFours[url] || 0) + 1;
        }
    });

    const timestamp = Date.now();
    try {
        await page.goto(`http://127.0.0.1:8000/?trace404rerun=${timestamp}`, { waitUntil: 'networkidle' });
    } catch (e) {
        console.error('Failed to load page:', e.message);
    }

    try {
        const item = page.locator('.pujian-item').first();
        await item.waitFor({ timeout: 5000 });
        await item.click();
    } catch (e) {
        console.error('Could not find/click .pujian-item');
    }

    for (let i = 0; i < 6; i++) {
        await page.evaluate(() => {
            if (typeof window.onNextSong === 'function') {
                window.onNextSong();
            }
        });
        await page.waitForTimeout(500);
    }

    console.log('404_REPORT_START');
    console.log(JSON.stringify(fourOhFours, null, 2));
    console.log('404_REPORT_END');

    await browser.close();
})();
