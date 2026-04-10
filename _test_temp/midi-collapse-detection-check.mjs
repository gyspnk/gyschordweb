import { chromium } from 'playwright';

const BASE = 'http://localhost:8000';
const ANDROID_UA =
  'Mozilla/5.0 (Linux; Android 14; SM-X716B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36';

const androidViewports = [
  { width: 640, height: 480, label: '640x480' },
  { width: 698, height: 573, label: '698x573 (reported)' },
  { width: 760, height: 520, label: '760x520' },
  { width: 1000, height: 600, label: '1000x600' },
  { width: 1100, height: 600, label: '1100x600 edge' },
];

let failures = 0;

function pass(msg) {
  console.log(`PASS  ${msg}`);
}

function fail(msg) {
  failures += 1;
  console.log(`FAIL  ${msg}`);
}

async function collectLayoutState(page, openPanel) {
  return await page.evaluate(async (shouldOpenPanel) => {
    if (typeof openPdfViewer === 'function') {
      openPdfViewer(0);
      await new Promise((r) => setTimeout(r, 900));
    }

    const banner = document.querySelector('.update-banner');
    if (banner) banner.style.display = 'none';

    const btn = document.getElementById('midi-toggle-btn');
    const panel = document.querySelector('#midi-collapse .midi-panel');
    const header = document.querySelector('.pdf-viewer-header');
    const nav = document.querySelector('.song-navigation');

    if (!btn || !panel || !header || !nav) {
      return {
        missing: true,
        hasBtn: !!btn,
        hasPanel: !!panel,
        hasHeader: !!header,
        hasNav: !!nav,
      };
    }

    if (shouldOpenPanel) {
      if (btn.getAttribute('aria-expanded') !== 'true') {
        btn.click();
      }
      await new Promise((r) => setTimeout(r, 120));
    } else if (btn.getAttribute('aria-expanded') === 'true') {
      btn.click();
      await new Promise((r) => setTimeout(r, 120));
    }

    const rect = (el) => {
      const r = el.getBoundingClientRect();
      return {
        left: Math.round(r.left),
        right: Math.round(r.right),
        top: Math.round(r.top),
        bottom: Math.round(r.bottom),
        width: Math.round(r.width),
        height: Math.round(r.height),
      };
    };

    const areaOverlap = (a, b) => {
      const w = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
      const h = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
      return w * h;
    };

    const btnRect = rect(btn);
    const panelRect = rect(panel);
    const headerRect = rect(header);
    const navRect = rect(nav);

    return {
      missing: false,
      viewport: { w: window.innerWidth, h: window.innerHeight },
      htmlClass: document.documentElement.className,
      bodyClass: document.body.className,
      isExpanded: document.body.classList.contains('is-expanded-layout'),
      btnDisplay: getComputedStyle(btn).display,
      panelPosition: getComputedStyle(panel).position,
      panelVisibility: getComputedStyle(panel).visibility,
      panelOverlapsHeader: areaOverlap(panelRect, headerRect),
      panelOverlapsBtn: areaOverlap(panelRect, btnRect),
      navOverlapsBtn: areaOverlap(navRect, btnRect),
    };
  }, openPanel);
}

const browser = await chromium.launch({ headless: true });

for (const vp of androidViewports) {
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    userAgent: ANDROID_UA,
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
  });

  const page = await context.newPage();
  await page.goto(`${BASE}/?midi-detection-check=${Date.now()}`, { waitUntil: 'networkidle' });

  const closedState = await collectLayoutState(page, false);
  const openState = await collectLayoutState(page, true);

  if (closedState.missing || openState.missing) {
    fail(`${vp.label} missing elements`);
  } else {
    const collapsedOK =
      closedState.isExpanded === false &&
      closedState.btnDisplay !== 'none' &&
      closedState.panelPosition === 'absolute';

    const overlapFree =
      openState.panelOverlapsHeader === 0 &&
      openState.panelOverlapsBtn === 0 &&
      openState.navOverlapsBtn === 0;

    if (!collapsedOK) {
      fail(`${vp.label} expected collapsed mode (isExpanded=false, button visible, absolute panel), got isExpanded=${closedState.isExpanded}, btnDisplay=${closedState.btnDisplay}, panelPosition=${closedState.panelPosition}`);
    } else if (!overlapFree) {
      fail(`${vp.label} overlap detected after opening panel (header=${openState.panelOverlapsHeader}, btn=${openState.panelOverlapsBtn}, navBtn=${openState.navOverlapsBtn})`);
    } else {
      pass(`${vp.label} collapsed mode active and no overlap`);
    }
  }

  await context.close();
}

// Desktop control: wide viewport should still allow expanded inline MIDI.
{
  const context = await browser.newContext({
    viewport: { width: 1300, height: 700 },
    isMobile: false,
    hasTouch: false,
    deviceScaleFactor: 1,
  });

  const page = await context.newPage();
  await page.goto(`${BASE}/?midi-detection-check=desktop-${Date.now()}`, { waitUntil: 'networkidle' });

  const state = await collectLayoutState(page, false);
  if (state.missing) {
    fail('desktop 1300x700 missing elements');
  } else if (!(state.isExpanded === true && state.btnDisplay === 'none' && state.panelPosition === 'static')) {
    fail(`desktop 1300x700 expected expanded inline mode, got isExpanded=${state.isExpanded}, btnDisplay=${state.btnDisplay}, panelPosition=${state.panelPosition}`);
  } else {
    pass('desktop 1300x700 expanded inline mode preserved');
  }

  await context.close();
}

await browser.close();

if (failures > 0) {
  console.error(`\nMIDI collapse detection check failed in ${failures} case(s).`);
  process.exit(1);
}

console.log('\nAll MIDI collapse detection checks passed.');
