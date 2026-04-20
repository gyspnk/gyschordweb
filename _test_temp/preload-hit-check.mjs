import { chromium } from 'playwright';

const BASE = 'http://localhost:8000';
const SETTLE_MS = Number.parseInt(process.env.PRELOAD_PROBE_SETTLE_MS || '0', 10) || 0;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function forceSequentialAutoNextMode(page) {
  await page.evaluate(() => {
    try {
      if (typeof prefs !== 'undefined' && prefs) {
        prefs.preloadEnabled = true;
        if (!Number.isFinite(Number(prefs.preloadCount)) || Number(prefs.preloadCount) < 1) {
          prefs.preloadCount = 1;
        }
        localStorage.setItem('prefs', JSON.stringify(prefs));
      }
    } catch (_e) {}

    if (typeof setNextMode === 'function') {
      setNextMode('number', { silentToast: true, skipShuffleRefresh: true });
      return;
    }

    if (typeof PlaylistManager !== 'undefined' && PlaylistManager && typeof PlaylistManager.setAutoNextMode === 'function') {
      PlaylistManager.setAutoNextMode('number');
    }
  });
}

async function installPreloadDiagnostics(page) {
  await page.evaluate(() => {
    if (window.__preloadProbeInstalled) return;
    window.__preloadProbeInstalled = true;
    window.__preloadProbeData = { calls: [], requests: [] };

    if (typeof _preloadNextSong === 'function') {
      const originalPreloadNextSong = _preloadNextSong;
      _preloadNextSong = function wrappedPreloadNextSong() {
        try {
          const mode = (typeof PlaylistManager !== 'undefined' && PlaylistManager && typeof PlaylistManager.getAutoNextMode === 'function')
            ? PlaylistManager.getAutoNextMode()
            : null;
          window.__preloadProbeData.calls.push({
            ts: Date.now(),
            currentSongIndex: typeof currentSongIndex === 'number' ? currentSongIndex : null,
            mode,
            preloadEnabled: !!(typeof prefs !== 'undefined' && prefs && prefs.preloadEnabled),
            preloadCount: (typeof prefs !== 'undefined' && prefs) ? prefs.preloadCount : null,
          });
        } catch (_e) {}
        return originalPreloadNextSong.apply(this, arguments);
      };
    }

    if (typeof MidiEngine !== 'undefined' && MidiEngine && typeof MidiEngine.preload === 'function') {
      const originalPreload = MidiEngine.preload;
      MidiEngine.preload = function wrappedMidiPreload(url, opts) {
        try {
          window.__preloadProbeData.requests.push({
            ts: Date.now(),
            currentSongIndex: typeof currentSongIndex === 'number' ? currentSongIndex : null,
            url: String(url || ''),
            transpose: opts && opts.transpose,
            instrument: opts && opts.instrument,
          });
        } catch (_e) {}
        return originalPreload.apply(this, arguments);
      };
    }
  });
}

async function waitForSongSettled(page, expectedIndex = null, timeoutMs = 30000) {
  const start = Date.now();
  let lastState = null;
  while (Date.now() - start < timeoutMs) {
    const state = await page.evaluate((targetIndex) => {
      const hasEngine = typeof MidiEngine !== 'undefined' && !!MidiEngine;
      const hasSongs = typeof pujianItems !== 'undefined' && Array.isArray(pujianItems) && pujianItems.length > 0;
      const currentIdx = typeof currentSongIndex === 'number' ? currentSongIndex : -1;
      const switching = !!window.isMidiSwitching;
      const loading = hasEngine && typeof MidiEngine.isLoading === 'function' ? !!MidiEngine.isLoading() : false;
      const loadedUrl = hasEngine && typeof MidiEngine.getCurrentMidiUrl === 'function'
        ? String(MidiEngine.getCurrentMidiUrl() || '')
        : '';

      let expectedUrl = '';
      if (hasSongs) {
        const idx = Number.isFinite(Number(targetIndex)) ? Number(targetIndex) : currentIdx;
        const song = pujianItems[idx];
        if (song && song.fileHref) {
          expectedUrl = String(song.fileHref).replace(/\/pdf\//i, '/midi/').replace(/\.pdf$/i, '.mid');
        }
      }

      const indexMatch = Number.isFinite(Number(targetIndex)) ? currentIdx === Number(targetIndex) : currentIdx >= 0;
      const urlMatch = expectedUrl ? loadedUrl === expectedUrl : loadedUrl.length > 0;
      const ready = hasEngine && currentIdx >= 0 && !switching && !loading && indexMatch && urlMatch;

      return {
        ready,
        currentIdx,
        switching,
        loading,
        loadedUrl,
        expectedUrl,
        indexMatch,
        urlMatch,
      };
    }, expectedIndex);
    lastState = state;
    if (state && state.ready) return state;
    await sleep(150);
  }
  throw new Error(`Timed out waiting for stable song load: ${JSON.stringify(lastState)}`);
}

async function waitForPreloadIdle(page, timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const status = await page.evaluate(() => {
      if (typeof MidiEngine === 'undefined' || !MidiEngine || typeof MidiEngine.getPreloadStatus !== 'function') {
        return { busy: false, queueLength: 0, cacheSize: 0, unavailable: true };
      }
      const s = MidiEngine.getPreloadStatus();
      return {
        busy: !!s.busy,
        queueLength: Number(s.queueLength) || 0,
        cacheSize: Number(s.cacheSize) || 0,
      };
    });
    if (!status.busy && status.queueLength === 0) return status;
    await sleep(200);
  }
  throw new Error('Timed out waiting for preload queue to settle');
}

async function openFirstSong(page) {
  await page.goto(`${BASE}/?preload-hit-check=${Date.now()}`, { waitUntil: 'networkidle' });
  await forceSequentialAutoNextMode(page);
  await page.waitForTimeout(1100);
  const first = await page.$('.pujian-item');
  if (!first) throw new Error('First song card not found');
  await first.click();
  await waitForSongSettled(page, 0);
  await forceSequentialAutoNextMode(page);
  await installPreloadDiagnostics(page);
}

async function getNextReadiness(page) {
  return page.evaluate(() => {
    if (typeof pujianItems === 'undefined' || !Array.isArray(pujianItems) || pujianItems.length < 2) {
      return { error: 'Not enough songs in list' };
    }
    if (typeof currentSongIndex !== 'number' || currentSongIndex < 0) {
      return { error: 'Current song index unavailable' };
    }

    const nextIdx = (currentSongIndex + 1) % pujianItems.length;
    const nextSong = pujianItems[nextIdx];
    const url = nextSong && nextSong.fileHref
      ? nextSong.fileHref.replace(/\/pdf\//i, '/midi/').replace(/\.pdf$/i, '.mid')
      : '';
    if (!url) return { error: 'Unable to resolve next MIDI URL' };

    let instrumentValue = -1;
    if (typeof prefs !== 'undefined' && prefs && prefs.midiInstrument !== undefined) {
      const parsed = parseInt(prefs.midiInstrument, 10);
      if (Number.isFinite(parsed) && parsed >= 0) instrumentValue = parsed;
    }

    const transpose = (typeof _resolveLoadTranspose === 'function')
      ? _resolveLoadTranspose(nextSong, url, instrumentValue)
      : 0;
    const instForCheck = instrumentValue >= 0 ? instrumentValue : -1;
    const exactHit = (typeof MidiEngine !== 'undefined' && MidiEngine && typeof MidiEngine.hasPreloaded === 'function')
      ? MidiEngine.hasPreloaded(url, transpose, instForCheck)
      : false;

    const preloadStatus = (typeof MidiEngine !== 'undefined' && MidiEngine && typeof MidiEngine.getPreloadStatus === 'function')
      ? MidiEngine.getPreloadStatus()
      : null;
    const matchingKeys = preloadStatus && Array.isArray(preloadStatus.cacheKeys)
      ? preloadStatus.cacheKeys.filter((k) => k.indexOf(`${url}|`) === 0)
      : [];

    return {
      currentIndex: currentSongIndex,
      currentTitle: (pujianItems[currentSongIndex] && pujianItems[currentSongIndex].judul) || '',
      nextIndex: nextIdx,
      nextTitle: (nextSong && nextSong.judul) || '',
      url,
      transpose,
      instrument: instForCheck,
      exactHit,
      queueLength: preloadStatus ? preloadStatus.queueLength : null,
      busy: preloadStatus ? preloadStatus.busy : null,
      cacheSize: preloadStatus ? preloadStatus.cacheSize : null,
      cacheKeys: preloadStatus && Array.isArray(preloadStatus.cacheKeys) ? preloadStatus.cacheKeys : [],
      matchingKeys,
      preloadCallCount: window.__preloadProbeData && Array.isArray(window.__preloadProbeData.calls)
        ? window.__preloadProbeData.calls.length
        : 0,
      preloadRequestCount: window.__preloadProbeData && Array.isArray(window.__preloadProbeData.requests)
        ? window.__preloadProbeData.requests.length
        : 0,
      hasPreloadFunction: typeof _preloadNextSong,
      diagnosticsInstalled: !!window.__preloadProbeInstalled,
      recentPreloadRequests: window.__preloadProbeData && Array.isArray(window.__preloadProbeData.requests)
        ? window.__preloadProbeData.requests.slice(-6)
        : [],
    };
  });
}

async function navigateNext(page) {
  const expectedIndex = await page.evaluate(() => {
    if (typeof pujianItems === 'undefined' || !Array.isArray(pujianItems) || pujianItems.length === 0) return null;
    if (typeof currentSongIndex !== 'number' || currentSongIndex < 0) return null;
    return (currentSongIndex + 1) % pujianItems.length;
  });

  await page.evaluate(() => {
    if (typeof onNextSong === 'function') onNextSong();
  });

  await waitForSongSettled(page, expectedIndex);
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const runtimeLogs = [];

  page.on('console', (msg) => {
    const text = String(msg.text() || '');
    if (!/Preload|Gagal memuat MIDI|MIDI fetch failed|FAILED/i.test(text)) return;
    runtimeLogs.push(`[${msg.type()}] ${text}`);
    if (runtimeLogs.length > 40) runtimeLogs.shift();
  });

  try {
    await openFirstSong(page);
    await waitForPreloadIdle(page);

    const rounds = 6;
    let hitCount = 0;
    const rows = [];

    for (let i = 0; i < rounds; i += 1) {
      if (SETTLE_MS > 0) {
        await page.waitForTimeout(SETTLE_MS);
      }
      const readiness = await getNextReadiness(page);
      if (readiness.error) throw new Error(readiness.error);
      if (readiness.exactHit) hitCount += 1;
      rows.push(readiness);

      await navigateNext(page);
      await waitForPreloadIdle(page);
    }

    console.log('Preload hit probe results:');
    rows.forEach((row, idx) => {
      console.log(
        `${idx + 1}. [${row.currentIndex} -> ${row.nextIndex}] ` +
        `${row.currentTitle} -> ${row.nextTitle} ` +
        `| hit=${row.exactHit} | t=${row.transpose} | inst=${row.instrument} ` +
        `| cache=${row.cacheSize} | queue=${row.queueLength} | busy=${row.busy} ` +
        `| preloadFn=${row.hasPreloadFunction} | diag=${row.diagnosticsInstalled} ` +
        `| preloadCalls=${row.preloadCallCount} | preloadReq=${row.preloadRequestCount} ` +
        `| variants=${JSON.stringify(row.matchingKeys)} ` +
        `| cacheKeys=${JSON.stringify(row.cacheKeys)} ` +
        `| recentReq=${JSON.stringify(row.recentPreloadRequests)}`
      );
    });

    const missCount = rounds - hitCount;
    console.log(`Summary: rounds=${rounds}, hits=${hitCount}, misses=${missCount}`);
    if (runtimeLogs.length) {
      console.log('Runtime log excerpts:');
      runtimeLogs.forEach((line) => console.log(line));
    }

    if (missCount > 0) {
      process.exitCode = 1;
    }
  } finally {
    await browser.close();
  }
}

run().catch((err) => {
  console.error('Preload hit probe failed:', err && err.message ? err.message : err);
  process.exitCode = 1;
});
