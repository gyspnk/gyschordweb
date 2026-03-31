
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('http://localhost:8000/index.html');
  const toneExist = await page.evaluate(() => {
     let volNode = window.Tone && ((window.Tone.Destination || (window.Tone.getDestination ? window.Tone.getDestination() : null)) || window.Tone.Master);
     return { 
        hasTone: !!window.Tone, 
        hasDestination: !!window.Tone?.Destination, 
        hasGetDestination: !!window.Tone?.getDestination,
        hasMaster: !!window.Tone?.Master,
        volNodeStr: volNode ? 'exists' : 'null',
        playerState: document.getElementById('main-midi-player') !== null
     };
  });
  console.log(toneExist);
  await browser.close();
})();
