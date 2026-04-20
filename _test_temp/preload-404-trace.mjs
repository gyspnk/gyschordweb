import { chromium } from 'playwright';

(async () => {
    const browser = await chromium.launch();
    const context = await browser.newContext();
    const page = await context.newPage();
    const urls404 = new Set();

    page.on('response', response => {
        if (response.status() === 404) {
            urls404.add(response.url());
        }
    });

    try {
        await page.goto(`http://localhost:8000/?t=${Date.now()}`);
        await page.waitForSelector('.pujian-item');
        await page.click('.pujian-item');
        
        for (let i = 0; i < 6; i++) {
            await new Promise(r => setTimeout(r, 2800));
            await page.evaluate(() => {
                if (typeof window.onNextSong === 'function') {
                    window.onNextSong();
                }
            });
            console.log(`Triggered onNextSong ${i + 1}/6`);
        }
    } catch (e) {
        console.error(e);
    }

    console.log('---UNIQUE 404 URLS---');
    urls404.forEach(url => console.log(url));
    console.log('---END---');

    await browser.close();
})();
