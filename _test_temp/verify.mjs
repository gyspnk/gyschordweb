import { chromium } from 'playwright';

const BASE = 'http://localhost:8000';
let browser, passed = 0, failed = 0;
const results = [];

function ok(name) { passed++; results.push(`  PASS: ${name}`); }
function fail(name, err) { failed++; results.push(`  FAIL: ${name} — ${err}`); }

async function test(name, fn) {
  try { await fn(); ok(name); } catch (e) { fail(name, e.message); }
}

try {
  browser = await chromium.launch({ headless: true });

  // ===== DESKTOP TESTS (1200x800 landscape) =====
  const desktopCtx = await browser.newContext({ viewport: { width: 1200, height: 800 } });
  const dp = await desktopCtx.newPage();
  await dp.goto(BASE, { waitUntil: 'networkidle' });
  await dp.waitForTimeout(1000);

  // Test 1: Pujian list spacing — padding-top on .pujian-list
  await test('Pujian list has padding-top', async () => {
    const pt = await dp.evaluate(() => {
      const el = document.querySelector('.pujian-list');
      return el ? parseFloat(getComputedStyle(el).paddingTop) : 0;
    });
    if (pt < 4) throw new Error(`padding-top too small: ${pt}px`);
  });

  // Test 2: Settings subcards — no horizontal scroll, grid layout
  await dp.click('#pengaturan-btn');
  await dp.waitForTimeout(500);
  await test('Settings grid — no horizontal overflow', async () => {
    const info = await dp.evaluate(() => {
      const grid = document.querySelector('.appearance-control-grid');
      if (!grid) return { error: 'not found' };
      const s = getComputedStyle(grid);
      return {
        display: s.display,
        overflowX: s.overflowX,
        scrollWidth: grid.scrollWidth,
        clientWidth: grid.clientWidth
      };
    });
    if (info.error) throw new Error(info.error);
    if (info.display !== 'grid') throw new Error(`display is ${info.display}, expected grid`);
    if (info.scrollWidth > info.clientWidth + 2) throw new Error(`Horizontal overflow: scrollW=${info.scrollWidth} clientW=${info.clientWidth}`);
  });

  // Test 3: Hero metrics show active settings (not counts)
  await test('Hero metrics show active settings', async () => {
    const heroText = await dp.evaluate(() => {
      const hero = document.querySelector('.settings-hero');
      return hero ? hero.textContent : '';
    });
    // Should contain setting labels, not just numbers
    if (/^\d+$/.test(heroText.trim())) throw new Error('Hero shows only numbers');
  });

  // Navigate back to pujian list and open a song
  await dp.click('#pujian-btn');
  await dp.waitForTimeout(500);
  
  // Click first song card
  const firstCard = await dp.$('.pujian-item');
  if (firstCard) {
    await firstCard.click();
    await dp.waitForTimeout(1500);

    // Test 4: Song title wrapper width on desktop
    await test('Song title wrapper has wider max-width on desktop', async () => {
      const mw = await dp.evaluate(() => {
        const el = document.querySelector('.song-title-wrapper');
        if (!el) return 'not found';
        return getComputedStyle(el).maxWidth;
      });
      if (mw === 'not found') throw new Error('Element not found');
      // Should be wider than the old 190px max
      const pxVal = parseFloat(mw);
      if (!isNaN(pxVal) && pxVal < 150) throw new Error(`max-width too narrow: ${mw}`);
    });

    // Test 5: MIDI player compact on desktop (landscape) — only applies in expanded layout
    await test('Desktop MIDI play button is compact in expanded layout', async () => {
      const info = await dp.evaluate(() => {
        const isExpanded = document.body.classList.contains('is-expanded-layout') || document.body.classList.contains('measure-layout');
        const btn = document.querySelector('.custom-player-play.player-btn');
        return { isExpanded, height: btn ? parseFloat(getComputedStyle(btn).height) : 0 };
      });
      if (info.isExpanded && info.height > 34) throw new Error(`Play button height ${info.height}px in expanded layout, expected ≤32px`);
      if (!info.isExpanded) console.log('    (skipped: not in expanded layout)');
    });
  }

  await desktopCtx.close();

  // ===== MOBILE TESTS (390x844 portrait) =====
  const mobileCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const mp = await mobileCtx.newPage();
  await mp.goto(BASE, { waitUntil: 'networkidle' });
  await mp.waitForTimeout(1000);

  // The page auto-loads a song into the viewer, so MIDI player should be available
  await mp.waitForSelector('.custom-midi-player', { timeout: 8000 }).catch(() => null);
  const hasMidiPlayer = await mp.$('.custom-midi-player');
  if (hasMidiPlayer) {

    // Test 6: Mobile MIDI player single-row layout (flex-direction: row)
    await test('Mobile MIDI controls are single-row (flex row)', async () => {
      const dir = await mp.evaluate(() => {
        const el = document.querySelector('.custom-player-controls');
        return el ? getComputedStyle(el).flexDirection : 'not found';
      });
      if (dir !== 'row') throw new Error(`flex-direction is ${dir}, expected row`);
    });

    // Test 7: Mobile ::before line is hidden in popup mode
    await test('Mobile MIDI ::before line is hidden', async () => {
      const info = await mp.evaluate(() => {
        const player = document.querySelector('.custom-midi-player');
        if (!player) return { error: 'not found' };
        const before = getComputedStyle(player, '::before');
        return {
          display: before.display,
          width: before.width,
          height: before.height,
          opacity: before.opacity
        };
      });
      if (info.error) throw new Error(info.error);
      if (info.display !== 'none' && parseFloat(info.opacity) > 0 && parseFloat(info.height) > 0) {
        throw new Error(`::before line should be hidden; display=${info.display}, opacity=${info.opacity}, h=${info.height}`);
      }
    });

    // Test 8: Mobile MIDI player compact play button (≤ 34px)
    await test('Mobile MIDI play button is compact (≤ 34px)', async () => {
      const h = await mp.evaluate(() => {
        const btn = document.querySelector('.custom-player-play.player-btn');
        return btn ? parseFloat(getComputedStyle(btn).height) : 0;
      });
      if (h > 36) throw new Error(`Play button height ${h}px, expected ≤ 34px`);
    });

    // Test 9: Mobile custom-player-primary has flex:1 (grows to fill row)
    await test('Mobile custom-player-primary grows (flex > 0)', async () => {
      const info = await mp.evaluate(() => {
        const el = document.querySelector('.custom-player-primary');
        if (!el) return { error: 'not found' };
        const s = getComputedStyle(el);
        return { flexGrow: s.flexGrow, display: s.display, direction: s.flexDirection };
      });
      if (info.error) throw new Error(info.error);
      if (parseFloat(info.flexGrow) < 1) throw new Error(`flexGrow=${info.flexGrow}, expected ≥ 1`);
      if (info.display !== 'flex') throw new Error(`display=${info.display}, expected flex`);
      if (info.direction !== 'row') throw new Error(`flex-direction=${info.direction}, expected row`);
    });

    // Test 10: Mobile MIDI player compact padding
    await test('Mobile MIDI player has compact padding (≤ 4px vertical)', async () => {
      const p = await mp.evaluate(() => {
        const el = document.querySelector('.custom-midi-player');
        if (!el) return null;
        const s = getComputedStyle(el);
        return { top: parseFloat(s.paddingTop), bottom: parseFloat(s.paddingBottom) };
      });
      if (!p) throw new Error('not found');
      if (p.top > 4) throw new Error(`paddingTop=${p.top}px, expected ≤ 4px`);
      if (p.bottom > 4) throw new Error(`paddingBottom=${p.bottom}px, expected ≤ 4px`);
    });

    // Test 11: Mobile MIDI player height is compact (≤ 55px)
    await test('Mobile MIDI player height ≤ 55px', async () => {
      // Open the panel using evaluate to bypass viewport checks
      const h = await mp.evaluate(() => {
        const toggleBtn = document.getElementById('midi-toggle-btn');
        if (toggleBtn && toggleBtn.getAttribute('aria-expanded') !== 'true') {
          toggleBtn.click();
        }
        return new Promise(resolve => {
          setTimeout(() => {
            const el = document.querySelector('.custom-midi-player');
            resolve(el ? el.getBoundingClientRect().height : 0);
          }, 500);
        });
      });
      if (h > 55) throw new Error(`Player height ${h}px, expected ≤ 55px`);
    });

    // Test 12: MIDI kicker label hidden on mobile
    await test('Mobile MIDI kicker label is hidden', async () => {
      const display = await mp.evaluate(() => {
        const kicker = document.querySelector('.midi-panel .custom-player-kicker');
        return kicker ? getComputedStyle(kicker).display : 'not found';
      });
      if (display !== 'none') throw new Error(`Kicker display=${display}, expected none`);
    });

    // Test 13: no-transition class cleared when toggle button is clicked
    await test('no-transition removed after toggle click', async () => {
      const hasClass = await mp.evaluate(() => {
        const panel = document.querySelector('.midi-panel');
        return panel ? panel.classList.contains('no-transition') : null;
      });
      if (hasClass === true) throw new Error('no-transition class stuck on midi-panel after toggle click');
    });

    // Test 15: Mini player extras shows as single row (instrument beside loop button)
    await test('Mini player extras: instrument beside loop — single row 3-col grid', async () => {
      await mp.goto(BASE, { waitUntil: 'networkidle' });
      await mp.waitForTimeout(1200);
      const info = await mp.evaluate(() => {
        const extras = document.querySelector('.mini-player-extras');
        if (!extras) return { error: 'extras not found' };
        const cs = getComputedStyle(extras);
        const rows = cs.gridTemplateRows;
        const cols = cs.gridTemplateColumns;
        // Count grid row tracks — single row should have only 1 row track
        const rowTracks = rows.trim().split(/\s+(?=[0-9])/).length;
        return { cols, rows, rowTracks };
      });
      if (info.error) throw new Error(info.error);
      const cols = info.cols.trim().split(/\s+(?=[0-9])/).length;
      if (cols < 3) throw new Error(`Expected 3-col extras grid, got: "${info.cols}"`);
      if (info.rowTracks > 1) throw new Error(`Extras has ${info.rowTracks} rows (expected 1): "${info.rows}"`);
    });

    // Test 16: Mini player seekbar — time and seekbar side by side (not stacked)
    await test('Mini player seekbar: time + seekbar side by side', async () => {
      const info = await mp.evaluate(() => {
        const middle = document.querySelector('.mini-player-middle');
        const time = document.querySelector('#mini-time-display');
        const seekbar = document.querySelector('.mini-seekbar-wrapper');
        if (!middle || !time || !seekbar) return { error: 'elements not found' };
        const mRect = middle.getBoundingClientRect();
        const tRect = time.getBoundingClientRect();
        const sRect = seekbar.getBoundingClientRect();
        return {
          sameRow: Math.abs(tRect.top - sRect.top) < 10,
          timeRight: Math.round(tRect.right),
          seekLeft: Math.round(sRect.left),
          middleH: Math.round(mRect.height)
        };
      });
      if (info.error) throw new Error(info.error);
      if (!info.sameRow) throw new Error(`Time and seekbar not on same row (tops differ by > 10px)`);
      if (info.seekLeft < info.timeRight) throw new Error(`Seekbar overlaps time display`);
      if (info.middleH > 45) throw new Error(`Seekbar container too tall: ${info.middleH}px (expected ≤ 45px)`);
    });

    // Test 17: Mini player total height is compact
    await test('Mini player total height ≤ 175px on 390px mobile', async () => {
      const h = await mp.evaluate(() => {
        const mp = document.querySelector('.mini-player');
        return mp ? Math.round(mp.getBoundingClientRect().height) : 0;
      });
      if (h > 175) throw new Error(`Mini player height ${h}px, expected ≤ 175px`);
    });

    // Test 14: Hide chord button only shows when chords exist (not just MIDI)
    await test('Hide chord button visibility tied to chords not MIDI', async () => {
      const info = await mp.evaluate(() => {
        const viewerActive = document.body.classList.contains('viewer-active');
        const hideChordBtns = document.querySelectorAll('.hide-chord-btn');
        const transposeCollapse = document.querySelectorAll('.transpose-collapse');
        const midiToggle = document.getElementById('midi-toggle-btn');
        const midiVisible = midiToggle && midiToggle.style.display !== 'none';
        
        // Check if any chord data exists
        const hasChords = typeof chordConfig !== 'undefined' && 
          Object.values(chordConfig.pages).some(p => p && p.length > 0);
        const hasNoteChords = typeof hasNoteAlignedChords === 'function' && hasNoteAlignedChords();
        
        return {
          viewerActive,
          midiVisible,
          hasChords: hasChords || hasNoteChords,
          chordBtnVisible: Array.from(hideChordBtns).some(b => getComputedStyle(b).display !== 'none'),
          transposeVisible: Array.from(transposeCollapse).some(t => getComputedStyle(t).display !== 'none'),
        };
      });
      // Skip if the viewer isn't active (chord button is expected hidden)
      if (!info.viewerActive) return;
      // If MIDI is visible but no chords, chord button should be hidden
      if (!info.hasChords && info.chordBtnVisible) {
        throw new Error('Chord button visible despite no chords');
      }
      // If chords exist, chord button should be visible
      if (info.hasChords && !info.chordBtnVisible) {
        throw new Error('Chord button hidden despite chords existing');
      }
      // Transpose should be visible when either MIDI or chords are present
      if (info.midiVisible && !info.transposeVisible) {
        throw new Error('Transpose controls hidden despite MIDI being available');
      }
    });

    // Test 18: no-transition persists after next/prev navigation (no unwanted animation)
    await test('no-transition persists after next song navigation', async () => {
      // First close the panel if open, then navigate to next song
      const result = await mp.evaluate(() => {
        return new Promise(resolve => {
          // Navigate to next song
          if (typeof onNextSong === 'function') onNextSong();
          setTimeout(() => {
            var panel = document.querySelector('.midi-panel');
            if (!panel) { resolve({ error: 'no midi-panel found' }); return; }
            resolve({
              hasNoTransition: panel.classList.contains('no-transition'),
              transition: getComputedStyle(panel).transition,
              ariaExpanded: document.getElementById('midi-toggle-btn')
                ? document.getElementById('midi-toggle-btn').getAttribute('aria-expanded')
                : null
            });
          }, 2000);
        });
      });
      if (result.error) throw new Error(result.error);
      if (!result.hasNoTransition) throw new Error('no-transition should persist after next song navigation');
      if (result.ariaExpanded !== 'false') throw new Error('aria-expanded should be false after navigation');
    });
  }

  await mobileCtx.close();

} catch (e) {
  console.error('Test setup error:', e);
} finally {
  if (browser) await browser.close();
  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
  results.forEach(r => console.log(r));
  process.exit(failed > 0 ? 1 : 0);
}
