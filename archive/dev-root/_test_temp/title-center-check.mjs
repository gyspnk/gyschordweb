import { chromium } from 'playwright';

const BASE = 'http://localhost:8000';
const VIEWPORTS = [
  { width: 698, height: 573, label: '698x573 (reported issue)' },
  { width: 720, height: 560, label: '720x560' },
  { width: 767, height: 600, label: '767x600 edge' },
  { width: 760, height: 520, label: '760x520' },
  { width: 640, height: 520, label: '640x520' },
  { width: 640, height: 480, label: '640x480' },
  { width: 800, height: 600, label: '800x600' },
  { width: 1000, height: 600, label: '1000x600' },
  { width: 1100, height: 600, label: '1100x600' },
];

const PASS_THRESHOLD = 20; // px

function fmt(n) {
  return Number.isFinite(n) ? `${n}`.padStart(5, ' ') : '  n/a';
}

const browser = await chromium.launch({ headless: true });
let failures = 0;

for (const vp of VIEWPORTS) {
  const context = await browser.newContext({
    viewport: vp,
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
    userAgent:
      'Mozilla/5.0 (Linux; Android 14; SM-X716B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  });

  const page = await context.newPage();
  await page.goto(`${BASE}/?center-check=${Date.now()}`, { waitUntil: 'networkidle' });

  await page.evaluate(async () => {
    document.documentElement.classList.add('chrome-android');
    if (typeof openPdfViewer === 'function') {
      openPdfViewer(88);
    }
    await new Promise((r) => setTimeout(r, 900));
    const banner = document.querySelector('.update-banner');
    if (banner) banner.style.display = 'none';
  });

  const result = await page.evaluate(() => {
    const header = document.querySelector('.pdf-viewer-header');
    const nav = document.querySelector('.song-navigation');
    const title = document.querySelector('.song-title-wrapper');

    if (!header || !nav || !title) {
      return {
        missing: true,
        hasHeader: !!header,
        hasNav: !!nav,
        hasTitle: !!title,
      };
    }

    const hb = header.getBoundingClientRect();
    const nb = nav.getBoundingClientRect();
    const tb = title.getBoundingClientRect();

    const headerCenter = (hb.left + hb.right) / 2;
    const titleCenter = (tb.left + tb.right) / 2;
    const centerDelta = Math.round(titleCenter - headerCenter);

    return {
      missing: false,
      centerDelta,
      headerWidth: Math.round(hb.width),
      navLeft: Math.round(nb.left),
      navRight: Math.round(nb.right),
      titleLeft: Math.round(tb.left),
      titleRight: Math.round(tb.right),
      bodyClasses: document.body.className,
      navComputedLeft: getComputedStyle(nav).left,
      navComputedRight: getComputedStyle(nav).right,
      navComputedTransform: getComputedStyle(nav).transform,
      titleText: document.querySelector('#pdf-viewer-title')?.textContent || '',
    };
  });

  const status = !result.missing && Math.abs(result.centerDelta) <= PASS_THRESHOLD ? 'PASS' : 'FAIL';
  if (status === 'FAIL') failures += 1;

  if (result.missing) {
    console.log(`${status}  ${vp.label}  missing-elements=${JSON.stringify(result)}`);
  } else {
    console.log(
      `${status}  ${vp.label}  delta=${fmt(result.centerDelta)}px  nav=[${result.navLeft},${result.navRight}] title=[${result.titleLeft},${result.titleRight}]`
    );
  }

  await context.close();
}

await browser.close();

if (failures > 0) {
  console.error(`\nTitle centering check failed in ${failures} viewport(s).`);
  process.exit(1);
}

console.log('\nAll viewport checks passed.');
