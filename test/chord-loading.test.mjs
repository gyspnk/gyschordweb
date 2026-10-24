import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const viewer = readFileSync(new URL('../docs/js/viewer-core.js', import.meta.url), 'utf8');
const app = readFileSync(new URL('../docs/js/app-core.js', import.meta.url), 'utf8');
const ui = readFileSync(new URL('../docs/js/ui-core.js', import.meta.url), 'utf8');
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((a, b) => { resolve = a; reject = b; });
  return { promise, resolve, reject };
};
function element() {
  const classes = new Set();
  return {
    style: {}, classList: {
      add: (...names) => names.forEach(n => classes.add(n)),
      remove: (...names) => names.forEach(n => classes.delete(n)),
      contains: n => classes.has(n),
    },
    setAttribute() {}, removeAttribute() {}, querySelector: () => ({ textContent: '' }),
    getBoundingClientRect: () => ({ width: 100 }),
  };
}
function runtime() {
  const body = element();
  body.classList.add('viewer-active');
  const c = vm.createContext({ console, setTimeout, clearTimeout,
    document: { body, getElementById: () => null, querySelector: () => null },
    localStorage: { setItem() {} }, window: {}, prefs: {},
    _openPdfViewerGeneration: 0, pdfDoc: null, currentSongIndex: 0,
    chordConfig: { pages: {} }, noteChordConfig: { pages: {} }, pageNotesCache: {},
    chordsHidden: false, chordEditorEnabled: false, hideChordBtns: [element()],
    midiToggleBtn: null, midiPreloadBar: null, midiPreloadFill: null,
    canvasWrapper: element(), songTitleWrapper: element(),
    pdfViewerTitle: element(), pdfViewerNumber: element(), viewerLoader: element(),
    pageCountElPortrait: element(), pageCountElLandscape: element(),
    activePdfLoadingTask: null, activePdfLoadingGeneration: 0,
    requestAnimationFrame: fn => fn(),
    pujianItems: [{ fileHref: '/pdf/A.pdf', judul: 'A', nomor: '1' },
      { fileHref: '/pdf/B.pdf', judul: 'B', nomor: '2' }],
  });
  vm.runInContext(app.slice(app.indexOf('const NOTE_NAMES_SHARP ='), app.indexOf('const NUMBER_TO_NOTE =')), c);
  vm.runInContext(viewer, c);
  vm.runInContext(ui.slice(ui.indexOf('let _chordStatus ='), ui.indexOf('\nfunction applyStoredPreferences')), c);
  for (const name of ['resetMidiState', 'syncSeekbarUI', 'fitViewerTitle',
    'updateTransposeUI', 'updateChordEditorUI', 'updateViewerUI', 'updateSongNavButtons',
    '_scheduleNeighborAssetPrefetch', '_resetPdfRecovery']) c[name] = () => {};
  c._pdfLibIsBroken = () => false;
  c._getSongTargetTempoBpm = () => 120;
  c._getSongTargetTranspose = () => 0;
  c._extractPdfMetaFromDoc = async () => ({ key: 'C', tempo: 120 });
  c._resolveSongTempoForLoad = async () => 120;
  c.renderPage = async () => c.canvasWrapper;
  return c;
}
const payload = chord => JSON.stringify({ version: 2, type: 'note-aligned', pages: { '1': [{ noteIdx: 0, chord }] } });
const response = chord => ({ ok: true, text: async () => payload(chord) });

test('late chord response cannot overwrite the newly selected song', async () => {
  const c = runtime(), old = deferred();
  c.fetch = url => url.includes('A.') ? old.promise : Promise.resolve(response('G'));
  const first = c.loadNoteChordConfiguration(c.pujianItems[0]);
  c._openPdfViewerGeneration++;
  await c.loadNoteChordConfiguration(c.pujianItems[1]);
  old.resolve(response('C'));
  await first;
  assert.equal(c.noteChordConfig.pages['1'][0].chord, 'G');
});

test('late chord error cannot erase the active song chords', async () => {
  const c = runtime(), old = deferred();
  c.fetch = url => url.includes('A.') ? old.promise : Promise.resolve(response('G'));
  const first = c.loadNoteChordConfiguration(c.pujianItems[0]);
  c._openPdfViewerGeneration++;
  await c.loadNoteChordConfiguration(c.pujianItems[1]);
  old.reject(new Error('offline'));
  await first;
  assert.equal(c.noteChordConfig.pages['1']?.[0]?.chord, 'G');
});

test('chord button stays stable until PDF and chord rendering finish', () => {
  const c = runtime(), btn = c.hideChordBtns[0];
  c.noteChordConfig = JSON.parse(payload('C'));
  c.setChordStatus('ready');
  assert.equal(btn.style.display, '');
  c.setChordStatus('loading');
  c.noteChordConfig = { pages: {} };
  c.updateHideChordButton();
  assert.equal(btn.classList.contains('is-fading-out'), false);
  assert.equal(btn.style.display, '');
  c.noteChordConfig = JSON.parse(payload('G'));
  c.setChordStatus('ready');
  assert.equal(btn.classList.contains('is-fading-out'), false);
});

test('MIDI ready before PDF does not reuse the previous PDF or skip new chords', async () => {
  const c = runtime(), pdf = deferred(), render = deferred();
  c.pdfDoc = { numPages: 7 };
  c.window._midiCurrentlyLoadedRawUrl = '/midi/B.mid';
  c.pdfjsLib = { getDocument: () => ({ promise: pdf.promise, destroy() {} }) };
  c.fetch = async () => response('G');
  c.renderPage = () => render.promise;
  const opened = c.openPdfViewer(1);
  assert.equal(c.pdfDoc.numPages, 7);
  pdf.resolve({ numPages: 1 });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(c.pdfDoc.numPages, 1, 'must load B even though its MIDI is already ready');
  assert.equal(c.noteChordConfig.pages['1']?.[0]?.chord, 'G');
  render.resolve(c.canvasWrapper);
  await opened;
});


test('a completed same-song render is reused and keeps edited chords', async () => {
  const c = runtime();
  let pdfLoads = 0;
  c.pdfjsLib = { getDocument: () => { pdfLoads++; return { promise: Promise.resolve({ numPages: 1 }), destroy() {} }; } };
  c.fetch = async () => response('G');
  await c.openPdfViewer(1);
  c.noteChordConfig.pages['1'][0].chord = 'Am';
  c.window._midiCurrentlyLoadedRawUrl = '/midi/B.mid';
  await c.openPdfViewer(1);
  assert.equal(pdfLoads, 1);
  assert.equal(c.noteChordConfig.pages['1'][0].chord, 'Am');
});

test('superseded lazy PDF startup cannot cancel the newer navigation', async () => {
  const c = runtime(), startup = deferred();
  let starts = 0;
  c.gysLoadPdfjs = () => ++starts === 1 ? startup.promise : Promise.resolve();
  const requested = [];
  c.pdfjsLib = { getDocument: options => {
    requested.push(options.url);
    return { promise: Promise.resolve({ numPages: 1 }), destroy() {} };
  } };
  c.fetch = async () => response('G');
  const old = c.openPdfViewer(0);
  await c.openPdfViewer(1);
  startup.resolve();
  await old;
  assert.deepEqual(requested, ['/pdf/B.pdf']);
  assert.equal(c.noteChordConfig.pages['1'][0].chord, 'G');
});

test('pending PDF raster keeps chord button stable until the new layer is ready', async () => {
  const c = runtime(), render = deferred();
  c.noteChordConfig = JSON.parse(payload('C'));
  c.setChordStatus('ready');
  c.pdfjsLib = { getDocument: () => ({ promise: Promise.resolve({ numPages: 1 }), destroy() {} }) };
  c.fetch = async () => response('G');
  c.renderPage = () => render.promise;
  const opened = c.openPdfViewer(1);
  await new Promise(resolve => setImmediate(resolve));
  c.updateHideChordButton();
  assert.equal(vm.runInContext('_chordStatus', c), 'loading');
  assert.equal(c.hideChordBtns[0].classList.contains('is-fading-out'), false);
  render.resolve(c.canvasWrapper);
  await opened;
  assert.equal(vm.runInContext('_chordStatus', c), 'ready');
});

test('late note extraction cannot overwrite the new PDF page cache', async () => {
  const c = runtime(), notes = deferred();
  c.renderRequestId = 0;
  c.zoomDeferInsert = false;
  c.currentScale = 1;
  c.currentScrollMode = 'horizontal';
  c.currentViewMode = 'single';
  c.canvasWrapper.className = 'canvas-wrapper';
  c.document.createElement = () => ({ ...element(), dataset: {}, appendChild() {}, getContext() {} });
  c.pdfDoc = { numPages: 1, getPage: async () => ({
    getViewport: () => ({ width: 100, height: 100 }),
    render: () => ({ promise: Promise.resolve(), cancel() {} }),
  }) };
  for (const name of ['updatePageIndicator', 'updatePageNavButtons', 'updateZoomIndicator', 'updateCenteringAndOverflow']) c[name] = () => {};
  // Exercise the real renderer; only the external raster/text operations pause.
  vm.runInContext(viewer.slice(viewer.indexOf('async function renderPage('), viewer.indexOf('\nfunction onPrevPage(')), c);
  c.extractPageNotes = () => notes.promise;
  const old = c.renderPage(1);
  await new Promise(resolve => setImmediate(resolve));
  c._openPdfViewerGeneration++;
  c.currentSongIndex = 1;
  const activeNotes = { notes: [{ x: 42 }], pageWidth: 100, pageHeight: 100 };
  c.pageNotesCache = { 1: activeNotes };
  notes.resolve({ notes: [{ x: 1 }], pageWidth: 100, pageHeight: 100 });
  await old;
  assert.equal(c.pageNotesCache[1], activeNotes);
});
