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
  return await page.evaluate(async ({ shouldOpenPanel, songIndex, chooseLongestInstrument }) => {
    if (typeof openPdfViewer === 'function') {
      openPdfViewer(songIndex);
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

    if (chooseLongestInstrument) {
      const instrumentBtn = document.querySelector('#custom-midi-player .midi-instrument-action .instrument-capsule-btn');
      if (instrumentBtn) {
        instrumentBtn.click();
        await new Promise((r) => setTimeout(r, 140));

        const openWrapper =
          instrumentBtn.closest('.instrument-selector-wrapper.is-open') ||
          document.querySelector('.instrument-selector-wrapper.is-open');

        if (openWrapper) {
          const options = Array.from(openWrapper.querySelectorAll('.cis-option'));
          if (options.length) {
            const longest = options.reduce((best, opt) => {
              const label = (opt.getAttribute('title') || opt.textContent || '').trim();
              if (!best) return { opt, len: label.length };
              return label.length > best.len ? { opt, len: label.length } : best;
            }, null);
            if (longest && longest.opt) {
              longest.opt.click();
              await new Promise((r) => setTimeout(r, 160));
            }
          }
        }
      }
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
    const midiCollapseRect = rect(document.getElementById('midi-collapse'));
    const actions = document.querySelector('#custom-midi-player .custom-player-actions');
    const actionChildren = actions
      ? Array.from(actions.children).filter((el) => {
          const style = getComputedStyle(el);
          return style.display !== 'none' && style.visibility !== 'hidden' && el.offsetParent !== null;
        })
      : [];
    const rowBands = [];
    actionChildren.forEach((el) => {
      const top = el.getBoundingClientRect().top;
      const hasBand = rowBands.some((bandTop) => Math.abs(bandTop - top) <= 8);
      if (!hasBand) rowBands.push(top);
    });
    const actionRows = rowBands.length;
    let actionsOverflow = false;
    if (actions && actionChildren.length) {
      const actionsRect = actions.getBoundingClientRect();
      const minLeft = Math.min(...actionChildren.map((el) => el.getBoundingClientRect().left));
      const maxRight = Math.max(...actionChildren.map((el) => el.getBoundingClientRect().right));
      actionsOverflow = minLeft < actionsRect.left - 1 || maxRight > actionsRect.right + 1;
    }
    const instrumentBtn = document.querySelector('#custom-midi-player .midi-instrument-action .instrument-capsule-btn');
    const instrumentWrap = document.querySelector('#custom-midi-player .midi-instrument-action');
    const labelEl = document.querySelector('#custom-midi-player #cis-label');
    const hideBtn =
      document.querySelector('.hide-chord-btn-landscape') ||
      document.querySelector('.hide-chord-btn-portrait');

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
      navOverlapsMidi: areaOverlap(navRect, midiCollapseRect),
      navOverlapsHide: hideBtn ? areaOverlap(navRect, rect(hideBtn)) : 0,
      actionRows,
      actionsOverflow,
      instrumentBtnWidth: instrumentBtn ? Math.round(instrumentBtn.getBoundingClientRect().width) : 0,
      instrumentWrapWidth: instrumentWrap ? Math.round(instrumentWrap.getBoundingClientRect().width) : 0,
      instrumentLabel: labelEl ? labelEl.textContent.trim() : '',
    };
  }, {
    shouldOpenPanel: !!openPanel,
    songIndex: 0,
    chooseLongestInstrument: false,
  });
}

async function getShortLongSongIndices(page) {
  return await page.evaluate(() => {
    const songs = Array.from(document.querySelectorAll('.pujian-item'))
      .map((el, idx) => ({
        idx,
        title: (el.querySelector('.pujian-title')?.textContent || '').trim(),
      }))
      .filter((s) => s.title)
      .map((s) => ({ ...s, len: s.title.length }));

    if (!songs.length) return null;
    songs.sort((a, b) => a.len - b.len);
    return {
      short: songs[0],
      long: songs[songs.length - 1],
    };
  });
}

async function collectSongLayoutState(page, options) {
  return await page.evaluate(async ({ songIndex, shouldOpenPanel, chooseLongestInstrument }) => {
    if (typeof openPdfViewer === 'function') {
      openPdfViewer(songIndex);
      await new Promise((r) => setTimeout(r, 950));
    }

    const banner = document.querySelector('.update-banner');
    if (banner) banner.style.display = 'none';

    const btn = document.getElementById('midi-toggle-btn');
    const panel = document.querySelector('#midi-collapse .midi-panel');
    const header = document.querySelector('.pdf-viewer-header');
    const nav = document.querySelector('.song-navigation');
    const midiCollapse = document.getElementById('midi-collapse');
    const hideBtn =
      document.querySelector('.hide-chord-btn-landscape') ||
      document.querySelector('.hide-chord-btn-portrait');

    if (!btn || !panel || !header || !nav || !midiCollapse) {
      return {
        missing: true,
        hasBtn: !!btn,
        hasPanel: !!panel,
        hasHeader: !!header,
        hasNav: !!nav,
        hasMidiCollapse: !!midiCollapse,
      };
    }

    const btnVisible = (() => {
      const style = getComputedStyle(btn);
      return style.display !== 'none' && style.visibility !== 'hidden' && btn.offsetParent !== null;
    })();

    if (btnVisible && shouldOpenPanel) {
      if (btn.getAttribute('aria-expanded') !== 'true') {
        btn.click();
        await new Promise((r) => setTimeout(r, 140));
      }
    } else if (btnVisible && btn.getAttribute('aria-expanded') === 'true') {
      btn.click();
      await new Promise((r) => setTimeout(r, 140));
    }

    if (chooseLongestInstrument) {
      const instrumentBtn = document.querySelector('#custom-midi-player .midi-instrument-action .instrument-capsule-btn');
      if (instrumentBtn) {
        instrumentBtn.click();
        await new Promise((r) => setTimeout(r, 150));

        const openWrapper =
          instrumentBtn.closest('.instrument-selector-wrapper.is-open') ||
          document.querySelector('.instrument-selector-wrapper.is-open');

        if (openWrapper) {
          const options = Array.from(openWrapper.querySelectorAll('.cis-option'));
          if (options.length) {
            const longest = options.reduce((best, opt) => {
              const label = (opt.getAttribute('title') || opt.textContent || '').trim();
              if (!best) return { opt, len: label.length };
              return label.length > best.len ? { opt, len: label.length } : best;
            }, null);

            if (longest && longest.opt) {
              longest.opt.click();
              await new Promise((r) => setTimeout(r, 170));
            }
          }
        }
      }

      document.querySelectorAll('.instrument-selector-wrapper.is-open').forEach((wrapper) => {
        wrapper.classList.remove('is-open');
        const trigger = wrapper.querySelector('.instrument-capsule-btn, .tempo-popover-toggle');
        if (trigger) trigger.setAttribute('aria-expanded', 'false');
      });
      await new Promise((r) => setTimeout(r, 60));
      if (typeof checkLayoutCollisions === 'function') {
        checkLayoutCollisions();
      }
      await new Promise((r) => setTimeout(r, 60));
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

    const actions = document.querySelector('#custom-midi-player .custom-player-actions');
    const actionChildren = actions
      ? Array.from(actions.children).filter((el) => {
          const style = getComputedStyle(el);
          return style.display !== 'none' && style.visibility !== 'hidden' && el.offsetParent !== null;
        })
      : [];
    const rowBands = [];
    actionChildren.forEach((el) => {
      const top = el.getBoundingClientRect().top;
      const hasBand = rowBands.some((bandTop) => Math.abs(bandTop - top) <= 8);
      if (!hasBand) rowBands.push(top);
    });
    const actionRows = rowBands.length;

    let actionsOverflow = false;
    if (actions && actionChildren.length) {
      const actionsRect = actions.getBoundingClientRect();
      const minLeft = Math.min(...actionChildren.map((el) => el.getBoundingClientRect().left));
      const maxRight = Math.max(...actionChildren.map((el) => el.getBoundingClientRect().right));
      actionsOverflow = minLeft < actionsRect.left - 1 || maxRight > actionsRect.right + 1;
    }

    const instrumentBtn = document.querySelector('#custom-midi-player .midi-instrument-action .instrument-capsule-btn');
    const instrumentWrap = document.querySelector('#custom-midi-player .midi-instrument-action');

    return {
      missing: false,
      bodyClass: document.body.className,
      isExpanded: document.body.classList.contains('is-expanded-layout'),
      btnDisplay: getComputedStyle(btn).display,
      panelPosition: getComputedStyle(panel).position,
      navOverlapsMidi: areaOverlap(rect(nav), rect(midiCollapse)),
      navOverlapsHide: hideBtn ? areaOverlap(rect(nav), rect(hideBtn)) : 0,
      actionRows,
      actionsOverflow,
      instrumentBtnWidth: instrumentBtn ? Math.round(instrumentBtn.getBoundingClientRect().width) : 0,
      instrumentWrapWidth: instrumentWrap ? Math.round(instrumentWrap.getBoundingClientRect().width) : 0,
    };
  }, {
    songIndex: options.songIndex,
    shouldOpenPanel: !!options.openPanel,
    chooseLongestInstrument: !!options.chooseLongestInstrument,
  });
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

// Desktop edge control: collapsible mode should keep controls on a single row with long instrument names.
{
  const context = await browser.newContext({
    viewport: { width: 1100, height: 700 },
    isMobile: false,
    hasTouch: false,
    deviceScaleFactor: 1,
  });

  const page = await context.newPage();
  await page.goto(`${BASE}/?midi-detection-check=desktop-collapsible-${Date.now()}`, { waitUntil: 'networkidle' });

  const songCases = await getShortLongSongIndices(page);
  if (!songCases) {
    fail('desktop 1100x700 unable to resolve short/long song cases');
  } else {
    for (const key of ['short', 'long']) {
      const song = songCases[key];
      const state = await collectSongLayoutState(page, {
        songIndex: song.idx,
        openPanel: true,
        chooseLongestInstrument: true,
      });

      if (state.missing) {
        fail(`desktop 1100x700 (${key}) missing elements`);
        continue;
      }

      const collapsedOK =
        state.isExpanded === false &&
        state.btnDisplay !== 'none' &&
        state.panelPosition === 'absolute';
      const controlsOK =
        state.actionRows <= 1 &&
        state.actionsOverflow === false &&
        state.navOverlapsMidi === 0 &&
        state.navOverlapsHide === 0;

      if (!collapsedOK) {
        fail(`desktop 1100x700 (${key}) expected collapsed mode, got isExpanded=${state.isExpanded}, btnDisplay=${state.btnDisplay}, panelPosition=${state.panelPosition}`);
      } else if (!controlsOK) {
        fail(`desktop 1100x700 (${key}) expected single-row non-overflow controls and no overlap, got rows=${state.actionRows}, overflow=${state.actionsOverflow}, navMidi=${state.navOverlapsMidi}, navHide=${state.navOverlapsHide}`);
      } else {
        pass(`desktop 1100x700 (${key}) collapsed controls remain single-row without overlap`);
      }
    }
  }

  await context.close();
}

// Desktop spacious control: expanded inline header should stay overlap-free for short and long titles.
{
  const context = await browser.newContext({
    viewport: { width: 1920, height: 900 },
    isMobile: false,
    hasTouch: false,
    deviceScaleFactor: 1,
  });

  const page = await context.newPage();
  await page.goto(`${BASE}/?midi-detection-check=desktop-expanded-${Date.now()}`, { waitUntil: 'networkidle' });

  const songCases = await getShortLongSongIndices(page);
  if (!songCases) {
    fail('desktop 1920x900 unable to resolve short/long song cases');
  } else {
    for (const key of ['short', 'long']) {
      const song = songCases[key];
      const state = await collectSongLayoutState(page, {
        songIndex: song.idx,
        openPanel: false,
        chooseLongestInstrument: true,
      });

      if (state.missing) {
        fail(`desktop 1920x900 (${key}) missing elements`);
        continue;
      }

      const expandedOK =
        state.isExpanded === true &&
        state.btnDisplay === 'none' &&
        state.panelPosition === 'static';
      const controlsOK =
        state.actionRows <= 1 &&
        state.actionsOverflow === false &&
        state.navOverlapsMidi === 0 &&
        state.navOverlapsHide === 0;

      if (!expandedOK) {
        fail(`desktop 1920x900 (${key}) expected expanded inline mode, got isExpanded=${state.isExpanded}, btnDisplay=${state.btnDisplay}, panelPosition=${state.panelPosition}`);
      } else if (!controlsOK) {
        fail(`desktop 1920x900 (${key}) expected single-row non-overflow controls and no overlap, got rows=${state.actionRows}, overflow=${state.actionsOverflow}, navMidi=${state.navOverlapsMidi}, navHide=${state.navOverlapsHide}`);
      } else {
        pass(`desktop 1920x900 (${key}) expanded header remains overlap-free`);
      }
    }
  }

  await context.close();
}

await browser.close();

if (failures > 0) {
  console.error(`\nMIDI collapse detection check failed in ${failures} case(s).`);
  process.exit(1);
}

console.log('\nAll MIDI collapse detection checks passed.');
