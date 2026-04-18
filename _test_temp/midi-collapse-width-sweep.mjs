import { chromium } from 'playwright';

const BASE = 'http://localhost:8000';
const HEIGHT = 720;
const WIDTH_START = 900;
const WIDTH_END = 1600;
const PRE_STABILIZE_MS = 130;
const POST_CHECK_STABILIZE_MS = 70;

let failures = 0;

function pass(msg) {
  console.log(`PASS  ${msg}`);
}

function fail(msg) {
  failures += 1;
  console.log(`FAIL  ${msg}`);
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

async function configureSongWithLongestInstrument(page, songIndex) {
  await page.evaluate(async ({ idx }) => {
    if (typeof openPdfViewer === 'function') {
      openPdfViewer(idx);
      await new Promise((r) => setTimeout(r, 950));
    }

    const banner = document.querySelector('.update-banner');
    if (banner) banner.style.display = 'none';

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

    if (typeof checkLayoutCollisions === 'function') {
      checkLayoutCollisions();
    }

    await new Promise((r) => setTimeout(r, 80));
  }, { idx: songIndex });
}

async function collectState(page) {
  return await page.evaluate(() => {
    const btn = document.getElementById('midi-toggle-btn');
    const panel = document.querySelector('#midi-collapse .midi-panel');
    const nav = document.querySelector('.song-navigation');
    const midiCollapse = document.getElementById('midi-collapse');
    const hideBtn =
      document.querySelector('.hide-chord-btn-landscape') ||
      document.querySelector('.hide-chord-btn-portrait');
    const actions = document.querySelector('#custom-midi-player .custom-player-actions');

    const rect = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return {
        left: Math.round(r.left),
        right: Math.round(r.right),
        top: Math.round(r.top),
        bottom: Math.round(r.bottom),
      };
    };

    const areaOverlap = (a, b) => {
      if (!a || !b) return 0;
      const w = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
      const h = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
      return w * h;
    };

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

    let actionsOverflow = false;
    if (actions && actionChildren.length) {
      const actionsRect = actions.getBoundingClientRect();
      const minLeft = Math.min(...actionChildren.map((el) => el.getBoundingClientRect().left));
      const maxRight = Math.max(...actionChildren.map((el) => el.getBoundingClientRect().right));
      actionsOverflow = minLeft < actionsRect.left - 1 || maxRight > actionsRect.right + 1;
    }

    return {
      width: window.innerWidth,
      height: window.innerHeight,
      isExpanded: document.body.classList.contains('is-expanded-layout'),
      btnDisplay: btn ? getComputedStyle(btn).display : 'missing',
      panelPosition: panel ? getComputedStyle(panel).position : 'missing',
      navOverlapsMidi: areaOverlap(rect(nav), rect(midiCollapse)),
      navOverlapsHide: areaOverlap(rect(nav), rect(hideBtn)),
      actionRows: rowBands.length,
      actionsOverflow,
      missing: !btn || !panel || !nav || !midiCollapse,
    };
  });
}

function summarizeTransitions(states) {
  const transitions = [];
  let prev = states[0]?.isExpanded;
  for (let i = 1; i < states.length; i += 1) {
    const curr = states[i].isExpanded;
    if (curr !== prev) {
      transitions.push({
        width: states[i].width,
        from: prev,
        to: curr,
      });
      prev = curr;
    }
  }
  return transitions;
}

function buildWidthRange(start, end, step) {
  const arr = [];
  if (step > 0) {
    for (let w = start; w <= end; w += step) arr.push(w);
  } else {
    for (let w = start; w >= end; w += step) arr.push(w);
  }
  return arr;
}

async function runDirectionalSweep(page, label, widths, direction) {
  const states = [];

  for (const width of widths) {
    await page.setViewportSize({ width, height: HEIGHT });
    await page.waitForTimeout(PRE_STABILIZE_MS);
    await page.evaluate(() => {
      if (typeof checkLayoutCollisions === 'function') {
        checkLayoutCollisions();
      }
    });
    await page.waitForTimeout(POST_CHECK_STABILIZE_MS);

    const state = await collectState(page);
    states.push(state);

    if (state.missing) {
      fail(`${label} ${direction} width=${width} missing layout elements`);
      continue;
    }

    const modeConsistent = state.isExpanded
      ? state.btnDisplay === 'none' && state.panelPosition === 'static'
      : state.btnDisplay !== 'none' && state.panelPosition === 'absolute';

    if (!modeConsistent) {
      fail(`${label} ${direction} width=${width} inconsistent mode wiring: isExpanded=${state.isExpanded}, btnDisplay=${state.btnDisplay}, panelPosition=${state.panelPosition}`);
    }

    if (state.actionRows > 1 || state.actionsOverflow || state.navOverlapsMidi > 0 || state.navOverlapsHide > 0) {
      fail(`${label} ${direction} width=${width} overlap/wrap: rows=${state.actionRows}, overflow=${state.actionsOverflow}, navMidi=${state.navOverlapsMidi}, navHide=${state.navOverlapsHide}`);
    }
  }

  const transitions = summarizeTransitions(states);
  const transitionText = transitions.length
    ? transitions.map((t) => `${t.from ? 'expanded' : 'collapsed'}->${t.to ? 'expanded' : 'collapsed'}@${t.width}`).join(', ')
    : 'none';

  if (transitions.length > 1) {
    fail(`${label} ${direction} unstable transitions: ${transitionText}`);
  } else if (
    transitions.length === 1 &&
    direction === 'ascending' &&
    !(transitions[0].from === false && transitions[0].to === true)
  ) {
    fail(`${label} ${direction} wrong transition direction: ${transitionText}`);
  } else if (
    transitions.length === 1 &&
    direction === 'descending' &&
    !(transitions[0].from === true && transitions[0].to === false)
  ) {
    fail(`${label} ${direction} wrong transition direction: ${transitionText}`);
  } else {
    pass(`${label} ${direction} stable transitions: ${transitionText}`);
  }

  return { states, transitions };
}

async function runSweepCase(page, label, songIndex) {
  await configureSongWithLongestInstrument(page, songIndex);

  const ascending = await runDirectionalSweep(
    page,
    label,
    buildWidthRange(WIDTH_START, WIDTH_END, 1),
    'ascending',
  );
  const descending = await runDirectionalSweep(
    page,
    label,
    buildWidthRange(WIDTH_END, WIDTH_START, -1),
    'descending',
  );

  const firstExpanded = ascending.states.find((s) => s.isExpanded)?.width ?? null;
  const lastCollapsed = [...ascending.states].reverse().find((s) => !s.isExpanded)?.width ?? null;
  const firstCollapsedFromTop = descending.states.find((s) => !s.isExpanded)?.width ?? null;
  const lastExpandedFromTop = [...descending.states].reverse().find((s) => s.isExpanded)?.width ?? null;

  console.log(
    `INFO  ${label} boundary summary: asc(firstExpanded=${firstExpanded ?? 'none'}, lastCollapsed=${lastCollapsed ?? 'none'}) desc(firstCollapsed=${firstCollapsedFromTop ?? 'none'}, lastExpanded=${lastExpandedFromTop ?? 'none'}) range=${WIDTH_START}-${WIDTH_END}`,
  );
}

const browser = await chromium.launch({ headless: true });

try {
  const context = await browser.newContext({
    viewport: { width: WIDTH_END, height: HEIGHT },
    isMobile: false,
    hasTouch: false,
    deviceScaleFactor: 1,
  });

  const page = await context.newPage();
  await page.goto(`${BASE}/?midi-width-sweep=${Date.now()}`, { waitUntil: 'networkidle' });

  const songCases = await getShortLongSongIndices(page);
  if (!songCases) {
    fail('unable to resolve short/long song cases');
  } else {
    await runSweepCase(page, 'short-title case', songCases.short.idx);
    await runSweepCase(page, 'long-title case', songCases.long.idx);
  }

  await context.close();
} finally {
  await browser.close();
}

if (failures > 0) {
  console.error(`\nMIDI width sweep failed in ${failures} case(s).`);
  process.exit(1);
}

console.log('\nMIDI width sweep passed with stable boundaries.');
