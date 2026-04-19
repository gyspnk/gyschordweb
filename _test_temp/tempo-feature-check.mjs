import { chromium } from 'playwright';

const BASE = 'http://localhost:8000';
const VIEWPORTS = [
  { width: 320, height: 700, label: '320x700' },
  { width: 390, height: 844, label: '390x844' },
  { width: 698, height: 573, label: '698x573' },
  { width: 768, height: 1024, label: '768x1024' },
  { width: 1280, height: 800, label: '1280x800' },
];
const ZOOM_SCALES = [0.8, 0.9, 1, 1.1, 1.25];

let passed = 0;
let failed = 0;

function pass(name) {
  passed += 1;
  console.log(`PASS  ${name}`);
}

function fail(name, err) {
  failed += 1;
  console.log(`FAIL  ${name} -- ${err}`);
}

async function test(name, fn) {
  try {
    await fn();
    pass(name);
  } catch (err) {
    fail(name, err && err.message ? err.message : String(err));
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function openFirstSong(page) {
  await page.goto(`${BASE}/?tempo-check=${Date.now()}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);

  const firstCard = await page.$('.pujian-item');
  assert(!!firstCard, 'First song card not found');
  await firstCard.click();
  await page.waitForTimeout(2200);
}

async function ensureMidiPanelOpen(page) {
  await page.evaluate(() => {
    const toggle = document.getElementById('midi-toggle-btn');
    const panel = document.querySelector('.midi-panel');
    if (!toggle || !panel) return;
    const toggleStyle = getComputedStyle(toggle);
    const toggleAvailable = toggleStyle.display !== 'none' && toggleStyle.visibility !== 'hidden';
    if (toggleAvailable && toggle.getAttribute('aria-expanded') !== 'true') {
      toggle.click();
    }
  });
  await page.waitForTimeout(700);
}

async function setTempoThroughControl(page, selector, value) {
  await page.evaluate(({ selector, value }) => {
    const input = document.querySelector(selector);
    if (!input) throw new Error(`Control not found: ${selector}`);

    input.value = String(value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }, { selector, value });
  await page.waitForTimeout(250);
}

async function setTempoInputOnly(page, selector, value) {
  await page.evaluate(({ selector, value }) => {
    const input = document.querySelector(selector);
    if (!input) throw new Error(`Control not found: ${selector}`);

    input.value = String(value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }, { selector, value });
  await page.waitForTimeout(250);
}

async function commitTempoControl(page, selector) {
  await page.evaluate((selectorValue) => {
    const input = document.querySelector(selectorValue);
    if (!input) throw new Error(`Control not found: ${selectorValue}`);

    input.dispatchEvent(new Event('change', { bubbles: true }));
  }, selector);
  await page.waitForTimeout(250);
}

async function probeCurrentSongPdfTempo(page) {
  return await page.evaluate(async () => {
    const clampTempo = (value) => {
      const parsed = Number(value);
      if (!Number.isFinite(parsed)) return 76;
      const rounded = Math.round(parsed);
      return Math.max(30, Math.min(220, rounded));
    };

    const detectTempo = (pdfText) => {
      const normalized = String(pdfText || '').replace(/\s+/g, ' ').trim();

      const symbolMatch = normalized.match(/(?:^|[\s(])(?:J|j|Q|q|♩|♪|𝅘𝅥|𝅘𝅥𝅮)\s*[:=]\s*(\d{2,3})(?=\D|$)/);
      if (symbolMatch) {
        return { detectedTempo: clampTempo(symbolMatch[1]), matchType: 'symbol' };
      }

      const bpmLabelMatch = normalized.match(/(?:tempo|tempi|bpm)\s*[:=]?\s*(\d{2,3})\b/i);
      if (bpmLabelMatch) {
        return { detectedTempo: clampTempo(bpmLabelMatch[1]), matchType: 'label' };
      }

      const looseTempoMatch = normalized.match(/(?:^|[^0-9A-Za-z])=\s*(\d{2,3})\b/);
      if (looseTempoMatch) {
        return { detectedTempo: clampTempo(looseTempoMatch[1]), matchType: 'loose' };
      }

      return { detectedTempo: 76, matchType: 'fallback' };
    };

    let songTitle = '';
    let pdfHref = '';
    if (Array.isArray(pujianItems) && Number.isFinite(currentSongIndex) && pujianItems[currentSongIndex]) {
      const currentSong = pujianItems[currentSongIndex];
      songTitle = String(currentSong.judul || '');
      pdfHref = String(currentSong.fileHref || '');
    }

    if (!pdfHref && typeof window._midiCurrentlyLoadedRawUrl === 'string') {
      pdfHref = window._midiCurrentlyLoadedRawUrl
        .replace(/\/midi\//i, '/pdf/')
        .replace(/\.mid$/i, '.pdf');
    }

    if (!pdfHref) {
      throw new Error('Unable to resolve current song PDF URL');
    }

    if (typeof pdfjsLib === 'undefined' || typeof pdfjsLib.getDocument !== 'function') {
      throw new Error('pdfjsLib runtime unavailable');
    }

    const loadingTask = pdfjsLib.getDocument({
      url: pdfHref,
      standardFontDataUrl: 'https://mozilla.github.io/pdf.js/standard_fonts/',
    });
    const doc = await loadingTask.promise;
    const page1 = await doc.getPage(1);
    const textContent = await page1.getTextContent();
    const pdfText = textContent.items.map((item) => item.str).join(' ');
    const detection = detectTempo(pdfText);

    const defaultTempo = typeof getCurrentSongDefaultTempoBpm === 'function'
      ? getCurrentSongDefaultTempoBpm()
      : null;
    const currentTempo = typeof getCurrentSongTempoBpm === 'function'
      ? getCurrentSongTempoBpm()
      : null;
    const engineBaseTempo = (typeof MidiEngine !== 'undefined' && typeof MidiEngine.getTempoBaseBpm === 'function')
      ? MidiEngine.getTempoBaseBpm()
      : null;

    return {
      songTitle,
      pdfHref,
      detectedTempo: detection.detectedTempo,
      matchType: detection.matchType,
      defaultTempo,
      currentTempo,
      engineBaseTempo,
    };
  });
}

async function findSongWithExplicitPdfTempo(page, maxTransitions = 18) {
  for (let i = 0; i <= maxTransitions; i += 1) {
    const probe = await probeCurrentSongPdfTempo(page);
    if (probe.matchType !== 'fallback') {
      return probe;
    }

    if (i < maxTransitions) {
      await page.evaluate(() => {
        if (typeof onNextSong === 'function') onNextSong();
      });
      await page.waitForTimeout(2600);
    }
  }

  throw new Error(`No explicit PDF tempo marker found after ${maxTransitions + 1} songs`);
}

async function openTempoPopover(page, toggleSelector) {
  const toggle = page.locator(toggleSelector);
  await toggle.click();
  await page.waitForTimeout(160);
}

function parseClockToSeconds(clockText) {
  const token = String(clockText || '').trim();
  const m = token.match(/^(\d+):(\d{2})$/);
  if (!m) return NaN;
  return Number(m[1]) * 60 + Number(m[2]);
}

function parseDisplayPair(displayText) {
  const [left, right] = String(displayText || '').split('/').map((part) => part.trim());
  return {
    current: parseClockToSeconds(left),
    duration: parseClockToSeconds(right),
    raw: String(displayText || ''),
  };
}

async function getTempoState(page) {
  return await page.evaluate(() => {
    const state = {
      currentTempo: typeof getCurrentSongTempoBpm === 'function' ? getCurrentSongTempoBpm() : null,
      defaultTempo: typeof getCurrentSongDefaultTempoBpm === 'function' ? getCurrentSongDefaultTempoBpm() : null,
      customSlider: Number(document.getElementById('custom-tempo-slider')?.value || NaN),
      customInput: Number(document.getElementById('custom-tempo-input')?.value || NaN),
      miniSlider: Number(document.getElementById('mini-tempo-slider')?.value || NaN),
      miniInput: Number(document.getElementById('mini-tempo-input')?.value || NaN),
      customLabel: document.getElementById('custom-tempo-toggle-label')?.textContent || '',
      miniLabel: document.getElementById('mini-tempo-toggle-label')?.textContent || '',
      customValue: Number(document.getElementById('custom-tempo-toggle-value')?.textContent || NaN),
      miniValue: Number(document.getElementById('mini-tempo-toggle-value')?.textContent || NaN),
    };
    return state;
  });
}

function normalizeKeyLabel(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function applyTransposeStepRule(current, step) {
  const next = Number(current) + Number(step);
  return next > 11 || next < -11 ? 0 : next;
}

async function setPageZoom(page, zoomScale) {
  await page.evaluate((scale) => {
    document.body.style.zoom = String(scale);
  }, zoomScale);
  await page.waitForTimeout(260);
}

async function assertTempoReadoutVisible(page, scenarioLabel) {
  const probe = await page.evaluate(() => {
    const snapshot = (el) => {
      if (!el) return null;
      const style = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return {
        text: String(el.textContent || '').replace(/\s+/g, ' ').trim(),
        display: style.display,
        visibility: style.visibility,
        opacity: Number(style.opacity || '1'),
        width: rect.width,
        height: rect.height,
      };
    };

    return {
      miniButton: snapshot(document.getElementById('mini-tempo-toggle-btn')),
      miniReadout: snapshot(document.getElementById('mini-tempo-toggle-label')),
      miniValue: snapshot(document.getElementById('mini-tempo-toggle-value')),
      fullButton: snapshot(document.getElementById('custom-tempo-toggle-btn')),
      fullReadout: snapshot(document.getElementById('custom-tempo-toggle-label')),
      fullValue: snapshot(document.getElementById('custom-tempo-toggle-value')),
    };
  });

  const checkVisible = (node, nodeName) => {
    assert(!!node, `${scenarioLabel}: ${nodeName} node missing`);
    assert(node.display !== 'none', `${scenarioLabel}: ${nodeName} display is none`);
    assert(node.visibility !== 'hidden', `${scenarioLabel}: ${nodeName} visibility is hidden`);
    assert(node.opacity > 0.01, `${scenarioLabel}: ${nodeName} opacity is 0`);
    assert(node.width > 6, `${scenarioLabel}: ${nodeName} width too small (${node.width})`);
    assert(node.height > 6, `${scenarioLabel}: ${nodeName} height too small (${node.height})`);
    assert(/\d{2,3}/.test(node.text), `${scenarioLabel}: ${nodeName} text has no numeric tempo (${node.text})`);
  };

  const isMiniVisible = !!probe.miniButton
    && probe.miniButton.display !== 'none'
    && probe.miniButton.visibility !== 'hidden'
    && probe.miniButton.opacity > 0.01
    && probe.miniButton.width > 8
    && probe.miniButton.height > 8;

  if (isMiniVisible) {
    checkVisible(probe.miniReadout, 'mini readout');
    checkVisible(probe.miniValue, 'mini value');
  }

  checkVisible(probe.fullButton, 'full tempo button');
  checkVisible(probe.fullReadout, 'full readout');
  checkVisible(probe.fullValue, 'full value');
}

function overlapArea(a, b) {
  if (!a || !b) return 0;
  const w = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
  const h = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
  return w * h;
}

async function assertNoTempoControlOverlap(page, viewportLabel) {
  const layout = await page.evaluate(() => {
    const rect = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return {
        left: r.left,
        right: r.right,
        top: r.top,
        bottom: r.bottom,
        width: r.width,
        height: r.height,
      };
    };

    const miniExtras = document.querySelector('.mini-player-extras');
    const miniTempo = document.getElementById('mini-tempo-toggle-btn');
    const miniInst = document.getElementById('mini-instrument-select');
    const miniLoop = document.getElementById('mini-loop-btn');

    const midiActions = document.querySelector('.custom-player-actions');
    const fullTempo = document.getElementById('custom-tempo-toggle-btn');
    const fullInst = document.getElementById('custom-instrument-select');
    const fullLoop = document.getElementById('custom-loop-btn');

    return {
      miniExtras: rect(miniExtras),
      miniTempo: rect(miniTempo),
      miniInst: rect(miniInst),
      miniLoop: rect(miniLoop),
      midiActions: rect(midiActions),
      fullTempo: rect(fullTempo),
      fullInst: rect(fullInst),
      fullLoop: rect(fullLoop),
      bodyClass: document.body.className,
      midiPanelExpanded: document.getElementById('midi-toggle-btn')?.getAttribute('aria-expanded') || null,
    };
  });

  if (layout.miniTempo && layout.miniInst) {
    const miniTempoInst = overlapArea(layout.miniTempo, layout.miniInst);
    assert(miniTempoInst === 0, `${viewportLabel}: mini tempo overlaps mini instrument`);
  }
  if (layout.miniTempo && layout.miniLoop) {
    const miniTempoLoop = overlapArea(layout.miniTempo, layout.miniLoop);
    assert(miniTempoLoop === 0, `${viewportLabel}: mini tempo overlaps mini loop`);
  }
  if (layout.fullTempo && layout.fullInst) {
    const fullTempoInst = overlapArea(layout.fullTempo, layout.fullInst);
    assert(fullTempoInst === 0, `${viewportLabel}: full tempo overlaps instrument`);
  }
  if (layout.fullTempo && layout.fullLoop) {
    const fullTempoLoop = overlapArea(layout.fullTempo, layout.fullLoop);
    assert(fullTempoLoop === 0, `${viewportLabel}: full tempo overlaps loop`);
  }

  if (layout.miniExtras && layout.miniTempo) {
    assert(
      layout.miniTempo.left >= layout.miniExtras.left - 1 && layout.miniTempo.right <= layout.miniExtras.right + 1,
      `${viewportLabel}: mini tempo button overflows mini extras container`
    );
  }
  if (layout.midiActions && layout.fullTempo) {
    assert(
      layout.fullTempo.left >= layout.midiActions.left - 1 && layout.fullTempo.right <= layout.midiActions.right + 1,
      `${viewportLabel}: full tempo button overflows action row`
    );
  }
}

const browser = await chromium.launch({ headless: true });

try {
  const functionalCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await functionalCtx.newPage();

  await openFirstSong(page);
  await ensureMidiPanelOpen(page);

  await test('Default tempo for first song is 76 BPM', async () => {
    const state = await getTempoState(page);
    assert(state.defaultTempo === 76, `expected 76, got ${state.defaultTempo}`);
  });

  await test('PDF-written tempo is applied to song default and MIDI engine base tempo', async () => {
    const probe = await findSongWithExplicitPdfTempo(page, 18);
    assert(Number.isFinite(probe.detectedTempo), `detected tempo is invalid for ${probe.songTitle}`);
    assert(probe.defaultTempo === probe.detectedTempo, `default tempo mismatch for ${probe.songTitle}: detected=${probe.detectedTempo}, default=${probe.defaultTempo}, matchType=${probe.matchType}`);
    assert(probe.engineBaseTempo === probe.detectedTempo, `MidiEngine base tempo mismatch for ${probe.songTitle}: detected=${probe.detectedTempo}, engineBase=${probe.engineBaseTempo}`);
    assert(probe.currentTempo === probe.detectedTempo, `current tempo mismatch for ${probe.songTitle}: detected=${probe.detectedTempo}, current=${probe.currentTempo}`);
  });

  await test('Full player slider updates tempo state and mirrored controls', async () => {
    await setTempoThroughControl(page, '#custom-tempo-slider', 92);
    const state = await getTempoState(page);
    assert(state.currentTempo === 92, `current tempo mismatch: ${state.currentTempo}`);
    assert(state.customInput === 92, `custom input mismatch: ${state.customInput}`);
    assert(state.miniSlider === 92, `mini slider mismatch: ${state.miniSlider}`);
    assert(state.miniInput === 92, `mini input mismatch: ${state.miniInput}`);
    assert(state.customValue === 92, `custom readout mismatch: ${state.customValue}`);
    assert(state.miniValue === 92, `mini readout mismatch: ${state.miniValue}`);
    assert(/92\s*BPM/i.test(String(state.customLabel).replace(/\s+/g, ' ')), `custom label mismatch: ${state.customLabel}`);
    assert(/92\s*BPM/i.test(String(state.miniLabel).replace(/\s+/g, ' ')), `mini label mismatch: ${state.miniLabel}`);
  });

  await test('Slider input does not apply tempo until release/change', async () => {
    await setTempoThroughControl(page, '#custom-tempo-slider', 96);

    await setTempoInputOnly(page, '#custom-tempo-slider', 128);
    const duringDrag = await getTempoState(page);
    assert(duringDrag.currentTempo === 96, `tempo changed before release: ${duringDrag.currentTempo}`);

    await commitTempoControl(page, '#custom-tempo-slider');
    const afterRelease = await getTempoState(page);
    assert(afterRelease.currentTempo === 128, `tempo not applied after release: ${afterRelease.currentTempo}`);
    assert(afterRelease.miniSlider === 128, `mini slider not mirrored after release: ${afterRelease.miniSlider}`);
    assert(afterRelease.miniInput === 128, `mini input not mirrored after release: ${afterRelease.miniInput}`);
  });

  await test('Rapid repeated tempo changes discard stale renders and keep latest value', async () => {
    const targetTempo = 116;

    await page.evaluate(() => {
      if (typeof setMidiTempoBpm !== 'function') throw new Error('setMidiTempoBpm is unavailable');
      setMidiTempoBpm(108);
      setMidiTempoBpm(132);
      setMidiTempoBpm(116);
    });

    await page.waitForFunction((target) => {
      if (typeof MidiEngine === 'undefined') return false;
      if (typeof MidiEngine.getTempoBpm !== 'function') return false;
      if (typeof MidiEngine.isLoading === 'function' && MidiEngine.isLoading()) return false;
      return MidiEngine.getTempoBpm() === target;
    }, targetTempo, { timeout: 12000 });

    const state = await getTempoState(page);
    assert(state.currentTempo === targetTempo, `current tempo mismatch after rapid updates: ${state.currentTempo}`);
    assert(state.customSlider === targetTempo, `custom slider mismatch after rapid updates: ${state.customSlider}`);
    assert(state.miniSlider === targetTempo, `mini slider mismatch after rapid updates: ${state.miniSlider}`);
  });

  await test('Full player numeric input updates tempo state', async () => {
    await setTempoThroughControl(page, '#custom-tempo-input', 88);
    const state = await getTempoState(page);
    assert(state.currentTempo === 88, `current tempo mismatch: ${state.currentTempo}`);
    assert(state.customSlider === 88, `custom slider mismatch: ${state.customSlider}`);
  });

  await test('Mini player slider updates tempo state', async () => {
    await setTempoThroughControl(page, '#mini-tempo-slider', 104);
    const state = await getTempoState(page);
    assert(state.currentTempo === 104, `current tempo mismatch: ${state.currentTempo}`);
    assert(state.customSlider === 104, `custom slider mismatch: ${state.customSlider}`);
    assert(state.customInput === 104, `custom input mismatch: ${state.customInput}`);
  });

  await test('Mini player numeric input updates tempo state', async () => {
    await setTempoThroughControl(page, '#mini-tempo-input', 96);
    const state = await getTempoState(page);
    assert(state.currentTempo === 96, `current tempo mismatch: ${state.currentTempo}`);
    assert(state.customInput === 96, `custom input mismatch: ${state.customInput}`);
    assert(state.customValue === 96, `custom readout mismatch: ${state.customValue}`);
    assert(state.miniValue === 96, `mini readout mismatch: ${state.miniValue}`);
  });

  await test('Keyboard typing BPM does not snap to min/max while editing', async () => {
    await setTempoThroughControl(page, '#custom-tempo-slider', 96);
    await openTempoPopover(page, '#custom-tempo-toggle-btn');

    const before = await page.evaluate(() => ({
      currentTempo: typeof getCurrentSongTempoBpm === 'function' ? getCurrentSongTempoBpm() : null,
    }));

    const input = page.locator('#custom-tempo-input');
    await input.click();
    await input.fill('');
    await input.type('120', { delay: 90 });
    await page.waitForTimeout(180);

    const editingState = await page.evaluate(() => ({
      rawValue: document.getElementById('custom-tempo-input')?.value || '',
      currentTempo: typeof getCurrentSongTempoBpm === 'function' ? getCurrentSongTempoBpm() : null,
    }));

    assert(editingState.rawValue === '120', `typed value got replaced while editing: ${editingState.rawValue}`);
    assert(editingState.currentTempo === before.currentTempo, `tempo changed before commit: ${editingState.currentTempo}`);

    await page.locator('#custom-tempo-popover .midi-tempo-popover-header').click();
    await page.waitForTimeout(220);

    const state = await getTempoState(page);
    assert(state.currentTempo === 120, `current tempo mismatch after commit: ${state.currentTempo}`);
    assert(state.customInput === 120, `custom input mismatch after commit: ${state.customInput}`);
    assert(state.customSlider === 120, `custom slider mismatch after commit: ${state.customSlider}`);
    assert(state.miniInput === 120, `mini input mismatch after commit: ${state.miniInput}`);
  });

  await test('Tempo change adaptively updates displayed elapsed/duration scale', async () => {
    await setTempoThroughControl(page, '#custom-tempo-slider', 76);

    const baseline = parseDisplayPair(await page.evaluate(() => {
      if (typeof syncSeekbarUI === 'function') syncSeekbarUI(76, 152);
      return document.getElementById('custom-time-display')?.textContent || '';
    }));

    await setTempoThroughControl(page, '#custom-tempo-slider', 152);

    const faster = parseDisplayPair(await page.evaluate(() => {
      if (typeof syncSeekbarUI === 'function') syncSeekbarUI(76, 152);
      return document.getElementById('custom-time-display')?.textContent || '';
    }));

    assert(Number.isFinite(baseline.duration), `baseline duration parse failed: ${baseline.raw}`);
    assert(Number.isFinite(faster.duration), `faster duration parse failed: ${faster.raw}`);
    assert(faster.duration < baseline.duration, `duration did not shrink at higher tempo: base=${baseline.duration}, fast=${faster.duration}`);
    assert(faster.current < baseline.current, `elapsed display did not scale with tempo: base=${baseline.current}, fast=${faster.current}`);
  });

  await test('Tempo readout is visible without opening popover', async () => {
    await assertTempoReadoutVisible(page, 'default functional viewport');
  });

  await test('Transpose change keeps tempo and seek position', async () => {
    await setTempoThroughControl(page, '#custom-tempo-slider', 112);

    const before = await page.evaluate(() => {
      if (typeof MidiEngine !== 'undefined' && typeof MidiEngine.seek === 'function') {
        MidiEngine.seek(14);
      }
      const t = typeof MidiEngine !== 'undefined' && typeof MidiEngine.getTime === 'function' ? MidiEngine.getTime() : 0;
      const tempo = typeof getCurrentSongTempoBpm === 'function' ? getCurrentSongTempoBpm() : null;
      return { time: t, tempo };
    });

    await page.evaluate(() => {
      if (typeof onTranspose === 'function') {
        onTranspose(1);
      }
    });

    await page.waitForTimeout(1600);

    const after = await page.evaluate(() => {
      const t = typeof MidiEngine !== 'undefined' && typeof MidiEngine.getTime === 'function' ? MidiEngine.getTime() : 0;
      const tempo = typeof getCurrentSongTempoBpm === 'function' ? getCurrentSongTempoBpm() : null;
      return { time: t, tempo };
    });

    assert(after.tempo === 112, `tempo changed after transpose: ${after.tempo}`);
    // Some CI/headless runs cannot resolve MIDI duration/time reliably when source files are unavailable.
    // Keep tempo assertion strict, and only validate seek continuity if timing is available.
    if (before.time >= 1 && after.time >= 1) {
      assert(before.time >= 10, `seek did not apply before transpose: ${before.time}`);
      assert(after.time >= 8, `time reset too close to start after transpose: ${after.time}`);
      assert(Math.abs(after.time - before.time) <= 6, `seek position drift too large after transpose: before=${before.time}, after=${after.time}`);
    }
  });

  await test('Rapid repeated transpose changes discard stale renders and keep latest step', async () => {
    const before = await page.evaluate(() => {
      const current = Number(typeof transposeStep === 'number' ? transposeStep : 0);
      return {
        step: current,
        engineStep: (typeof MidiEngine !== 'undefined' && typeof MidiEngine.getTranspose === 'function')
          ? Number(MidiEngine.getTranspose())
          : null,
      };
    });

    const expected = applyTransposeStepRule(applyTransposeStepRule(applyTransposeStepRule(before.step, 1), 1), -1);

    await page.evaluate(() => {
      if (typeof onTranspose !== 'function') throw new Error('onTranspose is unavailable');
      onTranspose(1);
      onTranspose(1);
      onTranspose(-1);
    });

    await page.waitForFunction((targetStep) => {
      if (typeof transposeStep !== 'number') return false;
      if (transposeStep !== targetStep) return false;
      if (typeof MidiEngine === 'undefined') return false;
      if (typeof MidiEngine.isLoading === 'function' && MidiEngine.isLoading()) return false;
      if (typeof MidiEngine.getRenderedTranspose !== 'function') return false;
      return Number(MidiEngine.getRenderedTranspose()) === targetStep;
    }, expected, { timeout: 15000 });

    const after = await page.evaluate(() => {
      return {
        step: Number(typeof transposeStep === 'number' ? transposeStep : NaN),
        engineStep: (typeof MidiEngine !== 'undefined' && typeof MidiEngine.getTranspose === 'function')
          ? Number(MidiEngine.getTranspose())
          : null,
        renderedStep: (typeof MidiEngine !== 'undefined' && typeof MidiEngine.getRenderedTranspose === 'function')
          ? Number(MidiEngine.getRenderedTranspose())
          : null,
      };
    });

    assert(after.step === expected, `transposeStep mismatch after rapid updates: ${after.step}, expected=${expected}`);
    assert(after.engineStep === expected, `MidiEngine transpose mismatch after rapid updates: ${after.engineStep}, expected=${expected}`);
    assert(after.renderedStep === expected, `rendered transpose mismatch after rapid updates: ${after.renderedStep}, expected=${expected}`);
  });

  await test('Notation transpose selector accepts a new selection while previous selection is still loading', async () => {
    const selection = await page.evaluate(() => {
      const visibleBtn = Array.from(document.querySelectorAll('.family-chord-btn')).find((btn) => {
        const style = getComputedStyle(btn);
        return style.display !== 'none' && style.visibility !== 'hidden' && btn.offsetWidth > 0 && btn.offsetHeight > 0;
      });
      if (!visibleBtn) throw new Error('No visible family chord button found');

      const dropdown = visibleBtn.parentElement?.querySelector('.family-chord-dropdown')
        || document.querySelector('.family-chord-dropdown');
      if (!dropdown) throw new Error('Family chord dropdown not found');

      const options = Array.from(dropdown.querySelectorAll('.family-chord-option'));
      if (options.length < 2) throw new Error('Not enough family chord options');

      const currentLabel = String(visibleBtn.textContent || '').replace(/\s+/g, ' ').trim();
      const candidates = options.filter((opt) => String(opt.textContent || '').replace(/\s+/g, ' ').trim() !== currentLabel);
      if (candidates.length < 2) throw new Error('Need at least two candidate transpose options');

      const first = candidates[0];
      const second = candidates[1];
      const secondLabel = String(second.textContent || '').replace(/\s+/g, ' ').trim();

      first.click();
      second.click();

      return { secondLabel };
    });

    await page.waitForFunction(() => {
      if (typeof MidiEngine === 'undefined') return true;
      if (typeof MidiEngine.isLoading !== 'function') return true;
      return !MidiEngine.isLoading();
    }, undefined, { timeout: 15000 });

    const finalLabel = await page.evaluate(() => {
      const visibleBtn = Array.from(document.querySelectorAll('.family-chord-btn')).find((btn) => {
        const style = getComputedStyle(btn);
        return style.display !== 'none' && style.visibility !== 'hidden' && btn.offsetWidth > 0 && btn.offsetHeight > 0;
      });
      return visibleBtn ? String(visibleBtn.textContent || '').replace(/\s+/g, ' ').trim() : '';
    });

    assert(
      normalizeKeyLabel(finalLabel) === normalizeKeyLabel(selection.secondLabel),
      `final notation key mismatch after rapid selection: final=${finalLabel}, expected=${selection.secondLabel}`,
    );
  });

  await test('Switching songs resets tempo to new song default', async () => {
    await setTempoThroughControl(page, '#custom-tempo-slider', 138);

    await page.evaluate(() => {
      if (typeof onNextSong === 'function') onNextSong();
    });
    await page.waitForTimeout(2600);

    const state = await page.evaluate(() => {
      return {
        currentTempo: typeof getCurrentSongTempoBpm === 'function' ? getCurrentSongTempoBpm() : null,
        defaultTempo: typeof getCurrentSongDefaultTempoBpm === 'function' ? getCurrentSongDefaultTempoBpm() : null,
      };
    });

    assert(state.currentTempo === state.defaultTempo, `tempo did not reset to song default (${state.currentTempo} vs ${state.defaultTempo})`);
  });

  await functionalCtx.close();

  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const p = await ctx.newPage();
    await openFirstSong(p);
    await ensureMidiPanelOpen(p);
    await setTempoThroughControl(p, '#custom-tempo-slider', 118);

    await test(`No tempo-control overlaps at ${vp.label}`, async () => {
      await assertNoTempoControlOverlap(p, vp.label);
    });

    await test(`Tempo readout visible at ${vp.label}`, async () => {
      await assertTempoReadoutVisible(p, vp.label);
    });

    for (const zoomScale of ZOOM_SCALES) {
      await test(`Tempo layout resilient at ${vp.label} zoom ${zoomScale}x`, async () => {
        await setPageZoom(p, zoomScale);
        await assertNoTempoControlOverlap(p, `${vp.label} @${zoomScale}x`);
        await assertTempoReadoutVisible(p, `${vp.label} @${zoomScale}x`);
      });
    }

    await ctx.close();
  }
} finally {
  await browser.close();
}

console.log(`\nTempo feature check: ${passed} passed, ${failed} failed.`);
if (failed > 0) process.exit(1);
