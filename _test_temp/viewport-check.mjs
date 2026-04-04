import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });

for (const [w, h, label] of [
  [320, 700, '320px (tiny ≤359)'],
  [390, 844, '390px (iPhone 14)'],
  [768, 1024, '768px (iPad)'],
  [1280, 800, '1280px (desktop)'],
]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  const page = await ctx.newPage();
  await page.goto('http://localhost:8000/?bust=9', { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);

  const info = await page.evaluate(() => {
    const mp = document.querySelector('.mini-player');
    if (!mp) return { error: 'no mini-player' };
    const ex = document.querySelector('.mini-player-extras');
    const mid = document.querySelector('.mini-player-middle');
    const instr = document.querySelector('.instrument-selector-wrapper');
    const loop = document.querySelector('.mini-loop');
    const cs = getComputedStyle;

    // Count grid tracks (split by whitespace before a number to count reified track sizes)
    const eCols = cs(ex).gridTemplateColumns;
    const eRows = cs(ex).gridTemplateRows;
    const mCols = cs(mid).gridTemplateColumns;

    const instrR = instr.getBoundingClientRect();
    const loopR = loop.getBoundingClientRect();
    const sameRow = Math.abs(instrR.top - loopR.top) < 5;

    return {
      vw: window.innerWidth,
      mpHeight: Math.round(mp.getBoundingClientRect().height),
      extrasCols: eCols,
      extrasRows: eRows,
      middleCols: mCols,
      instrBesideLoop: sameRow,
    };
  });

  console.log(`\n[${label}]`);
  console.log(`  Mini-player height: ${info.mpHeight}px`);
  console.log(`  Extras grid cols: ${info.extrasCols}`);
  console.log(`  Extras grid rows: ${info.extrasRows}`);
  console.log(`  Seekbar middle cols: ${info.middleCols}`);
  console.log(`  Instrument beside loop: ${info.instrBesideLoop}`);

  await ctx.close();
}

await browser.close();
