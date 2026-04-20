import puppeteer from 'puppeteer';
(async () => {
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    const fourOhFours = {};
    page.on('response', response => {
        if (response.status() === 404) {
            const url = response.url();
            fourOhFours[url] = (fourOhFours[url] || 0) + 1;
        }
    });
    try {
        await page.goto('http://127.0.0.1:8000', { waitUntil: 'networkidle2' });
        // Wait for potential app load
        await new Promise(r => setTimeout(r, 2000));
        
        for (let i = 0; i < 6; i++) {
            const clicked = await page.evaluate(() => {
                // Try different common IDs or selectors for 'next'
                const btn = document.querySelector('#next-btn') || document.querySelector('.next-button') || document.querySelector('[data-action="next"]');
                if (btn) { btn.click(); return true; }
                return false;
            });
            if (!clicked) {
                console.log('Next button not found at step ' + i);
                // Dump IDs of buttons to help debug
                const ids = await page.evaluate(() => Array.from(document.querySelectorAll('button')).map(b => b.id || b.className));
                console.log('Available buttons: ' + ids.join(', '));
            }
            await new Promise(r => setTimeout(r, 2000));
        }
        console.log('404_REPORT_START');
        console.log(JSON.stringify(fourOhFours, null, 2));
        console.log('404_REPORT_END');
    } catch (e) {
        console.error(e);
    } finally {
        await browser.close();
    }
})();
