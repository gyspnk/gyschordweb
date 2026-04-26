const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('console', msg => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      console.log(`CONSOLE ${msg.type().toUpperCase()}: ${msg.text()}`);
    }
  });

  page.on('request', request => {
    if (request.url().includes('/assets/midi/')) {
      console.log(`NETWORK REQUEST: ${request.method()} ${request.url()}`);
    }
  });

  page.on('response', response => {
    if (response.url().includes('/assets/midi/')) {
        console.log(`NETWORK RESPONSE: ${response.status()} ${response.url()}`);
    }
  });

  try {
    console.log('Navigating to http://127.0.0.1:8000/...');
    await page.goto('http://127.0.0.1:8000/', { waitUntil: 'networkidle' });

    console.log('Waiting for .pujian-item...');
    await page.waitForSelector('.pujian-item', { timeout: 10000 });

    const clickSong = async (songId) => {
      console.log(`\nClicking song number ${songId}...`);
      const songSelector = `.pujian-item:has-text("${songId}")`;
      await page.click(songSelector);
      
      const waitTime = songId === '001' ? 2000 : 3000;
      await page.waitForTimeout(waitTime);

      const midiData = await page.evaluate(() => {
        return {
          rawUrl: window._midiCurrentlyLoadedRawUrl,
          currentMidiUrl: typeof MidiEngine !== 'undefined' && MidiEngine.getCurrentMidiUrl ? MidiEngine.getCurrentMidiUrl() : 'MidiEngine/method not found'
        };
      });
      console.log(`window._midiCurrentlyLoadedRawUrl: ${midiData.rawUrl}`);
      console.log(`MidiEngine.getCurrentMidiUrl(): ${midiData.currentMidiUrl}`);
    };

    await clickSong('001');
    await clickSong('149');

  } catch (err) {
    console.error('ERROR during script execution:', err);
  } finally {
    await browser.close();
  }
})();
