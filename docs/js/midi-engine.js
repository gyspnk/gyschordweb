/**
 * MidiEngine — FluidSynth WASM-based MIDI player with pre-rendered AudioBuffer playback.
 *
 * Architecture:
 *   1. A Web Worker runs FluidSynth WASM to offline-render MIDI → Float32Array PCM
 *   2. Main thread creates AudioBuffer from the PCM data
 *   3. Playback uses standard Web Audio API AudioBufferSourceNode (rock-solid, no glitches)
 *   4. A/B deck system enables gapless crossfade between songs
 *   5. Next song is pre-rendered in background while current plays
 *
 * This eliminates ALL real-time synthesis issues: no crackling, no sound cutting,
 * no glitching, because we're just playing back pre-computed audio samples.
 */

/* global AudioContext */
/* eslint-disable no-var */

var MidiEngine = (function () {
  'use strict';

  // ─── State ────────────────────────────────────────────────────────
  var _ctx = null;              // AudioContext
  var _masterGain = null;       // GainNode: master volume
  var _limiter = null;          // DynamicsCompressorNode (as limiter)

  // A/B deck system
  var _deckA = null;            // { source, gain, buffer, startTime, offset }
  var _deckB = null;            // Same structure, used during crossfade

  // Worker
  var _worker = null;
  var _workerReady = false;
  var _workerInitPromise = null;
  var _sfontLoaded = false;
  var _soundFontLoadPromise = null;
  var _pendingRenders = {};     // id → { resolve, reject }
  var _renderIdCounter = 0;

  // Soundfont
  var _sfontUrl = '';
  var _sfontBuffer = null;      // ArrayBuffer

  // Playback state
  var _playing = false;
  var _currentTime = 0;         // Playback position in seconds (when paused)
  var _startWallTime = 0;       // performance.now() when playback started
  var _duration = 0;            // Current song duration
  var _currentBuffer = null;    // Current AudioBuffer
  var _volume = 1.0;            // Linear gain (0-1)
  var _muted = false;

  // Song metadata
  var _currentMidiUrl = '';
  var _currentMidiBuffer = null; // Raw MIDI ArrayBuffer
  var _currentTranspose = 0;
  var _renderedTranspose = 0;   // Transpose value of the currently-playing AudioBuffer
  var _currentInstrument = -1;  // -1 = use original
  var _currentSourceLabel = '';

  // Tempo control (BPM-based UI mapped to render-time tempo scaling)
  var _DEFAULT_TEMPO_BPM = 76;
  var _tempoBaseBpm = _DEFAULT_TEMPO_BPM;
  var _tempoBpm = _DEFAULT_TEMPO_BPM;
  var _tempoRate = 1.0;
  var _tempoApplyTimer = null;

  // Preload cache (supports multiple pre-rendered buffers)
  var _preloadCache = {};        // key → { buffer, transpose, instrument }
  var _preloadedBuffer = null;   // Legacy compat: last-preloaded buffer
  var _preloadedMidiUrl = '';
  var _preloadedTranspose = 0;
  var _preloadedInstrument = -1;
  var _preloadRenderId = null;
  var _preloadQueue = [];        // URLs queued for preloading
  var _preloadInFlight = {};     // key → Promise currently rendering
  var _preloadBusy = false;      // True while a preload render is in progress
  var _PRELOAD_CACHE_MAX = 12;   // Max cached buffers

  // Crossfade
  var _crossfadeEnabled = false;
  var _crossfadeDuration = 3.0; // seconds
  var _isCrossfading = false;

  // Callbacks
  var _onSongEnd = null;
  var _onProgress = null;       // (percent) during render
  var _onStateChange = null;    // (playing, time, duration)

  // Loading state
  var _isLoading = false;
  var _loadGeneration = 0;

  // ─── Audio Context Setup ──────────────────────────────────────────

  function _ensureContext() {
    if (_ctx) return _ctx;
    _ctx = new (window.AudioContext || window.webkitAudioContext)();

    // Chain: source → deckGain → masterGain → limiter → destination.
    // The audio is already pre-rendered offline, so an always-on compressor here
    // can add audible artifacts on bright/brassy presets.
    _masterGain = _ctx.createGain();
    _masterGain.gain.value = _volume;

    _limiter = _ctx.createDynamicsCompressor();
    _limiter.threshold.value = -2.5;
    _limiter.ratio.value = 12;
    _limiter.attack.value = 0.003;
    _limiter.knee.value = 0;
    _limiter.release.value = 0.04;

    _masterGain.connect(_limiter);
    _limiter.connect(_ctx.destination);

    return _ctx;
  }

  function _resumeContext() {
    if (_ctx && _ctx.state === 'suspended') {
      return _ctx.resume();
    }
    return Promise.resolve();
  }

  // ─── Worker Management ────────────────────────────────────────────

  function _initWorker() {
    if (_workerReady) return Promise.resolve();
    if (_workerInitPromise) return _workerInitPromise;

    _workerInitPromise = new Promise(function (resolve, reject) {
      var settled = false;
      var initTimeout = null;

      function fail(err) {
        if (settled) return;
        settled = true;
        if (initTimeout) clearTimeout(initTimeout);
        _workerReady = false;
        _workerInitPromise = null;
        try { if (_worker) _worker.terminate(); } catch (_e) {}
        _worker = null;
        reject(err);
      }

      try {
        var workerUrl = 'js/midi-render-worker.min.js?v=4';
        _worker = new Worker(workerUrl);
      } catch (err) {
        fail(new Error('Failed to create MIDI render worker: ' + err.message));
        return;
      }

      initTimeout = setTimeout(function () {
        fail(new Error('MIDI render worker init timeout'));
      }, 30000);

      _worker.onmessage = function (e) {
        var msg = e.data;

        if (msg.type === 'ready') {
          if (settled) return;
          settled = true;
          _workerReady = true;
          clearTimeout(initTimeout);
          _workerInitPromise = null;
          resolve();
          return;
        }

        if (msg.type === 'sfLoaded') {
          _sfontLoaded = true;
          if (msg.presets && typeof SOUNDFONT_INSTRUMENTS !== 'undefined') {
            // Update the global map dynamically so the UI always shows actual SoundFont contents
            SOUNDFONT_INSTRUMENTS[_sfontUrl] = msg.presets;
            if (typeof rebuildInstrumentSelectors === 'function') {
               rebuildInstrumentSelectors(_sfontUrl);
            }
          }
          if (_pendingRenders[msg.id]) {
            _pendingRenders[msg.id].resolve();
            delete _pendingRenders[msg.id];
          }
          return;
        }

        if (msg.type === 'rendered') {
          if (_pendingRenders[msg.id]) {
            _pendingRenders[msg.id].resolve(msg);
            delete _pendingRenders[msg.id];
          }
          return;
        }

        if (msg.type === 'error') {
          if (_pendingRenders[msg.id]) {
            _pendingRenders[msg.id].reject(new Error(msg.error));
            delete _pendingRenders[msg.id];
          }
          return;
        }
      };

      _worker.onerror = function (err) {
        console.error('MIDI render worker error:', err);
        if (!_workerReady) {
          fail(new Error('MIDI render worker crashed during init'));
        }
      };

      _worker.postMessage({ type: 'init' });
    });

    return _workerInitPromise;
  }

  function _sendToWorker(msg) {
    var id = ++_renderIdCounter;
    msg.id = id;
    return new Promise(function (resolve, reject) {
      _pendingRenders[id] = { resolve: resolve, reject: reject };
      if (msg.type === 'loadSoundFont') {
        _worker.postMessage(msg, [msg.buffer]);
      } else {
        _worker.postMessage(msg);
      }
    });
  }

  // ─── IndexedDB SoundFont Cache ─────────────────────────────────────

  var _sfDB = null;
  var _SF_DB_NAME = 'gys-sf-cache';
  var _SF_STORE = 'soundfonts';

  function _openSFDB() {
    if (_sfDB) return Promise.resolve(_sfDB);
    return new Promise(function (resolve) {
      try {
        var req = indexedDB.open(_SF_DB_NAME, 1);
        req.onupgradeneeded = function (e) {
          e.target.result.createObjectStore(_SF_STORE);
        };
        req.onsuccess = function (e) {
          _sfDB = e.target.result;
          resolve(_sfDB);
        };
        req.onerror = function () { resolve(null); };
      } catch (e) { resolve(null); }
    });
  }

  function _getCachedSF(url) {
    return _openSFDB().then(function (db) {
      if (!db) return null;
      return new Promise(function (resolve) {
        try {
          var tx = db.transaction(_SF_STORE, 'readonly');
          var req = tx.objectStore(_SF_STORE).get(url);
          req.onsuccess = function () { resolve(req.result || null); };
          req.onerror = function () { resolve(null); };
        } catch (e) { resolve(null); }
      });
    });
  }

  function _putCachedSF(url, buffer) {
    _openSFDB().then(function (db) {
      if (!db) return;
      try {
        var tx = db.transaction(_SF_STORE, 'readwrite');
        tx.objectStore(_SF_STORE).put(buffer, url);
      } catch (e) {}
    }).catch(function () {});
  }

  // ─── Soundfont Loading ────────────────────────────────────────────

  function _loadSoundFont(url) {
    if (!url) return Promise.reject(new Error('No soundfont URL configured'));
    if (_sfontUrl === url && _sfontLoaded) return Promise.resolve();
    if (_soundFontLoadPromise && _sfontUrl === url) return _soundFontLoadPromise;

    _sfontUrl = url;
    _sfontLoaded = false;

    _soundFontLoadPromise = _getCachedSF(url).then(function (cached) {
      if (cached) {
        _sfontBuffer = cached;
        return _sendToWorker({ type: 'loadSoundFont', buffer: cached });
      }
      return fetch(url).then(function (resp) {
        if (!resp.ok) throw new Error('Failed to fetch soundfont: ' + resp.status);
        return resp.arrayBuffer();
      }).then(function (buf) {
        var toCache = buf.slice(0); // copy before transfer
        _sfontBuffer = toCache;
        _putCachedSF(url, toCache);
        return _sendToWorker({ type: 'loadSoundFont', buffer: buf });
      });
    }).then(function (result) {
      _soundFontLoadPromise = null;
      return result;
    }).catch(function (err) {
      _soundFontLoadPromise = null;
      throw err;
    });

    return _soundFontLoadPromise;
  }

  function _resolveSoundFontUrl(preferredUrl) {
    if (preferredUrl) return preferredUrl;
    if (_sfontUrl) return _sfontUrl;
    if (typeof prefs !== 'undefined' && prefs && prefs.midiSoundfont) return prefs.midiSoundfont;
    if (typeof MIDI_SF2_URL !== 'undefined') return MIDI_SF2_URL;
    return '';
  }

  function _ensureEngineReady(preferredSoundFontUrl) {
    if (_workerReady && _sfontLoaded) return Promise.resolve();

    return _initWorker().then(function () {
      if (_sfontLoaded) return;
      return _loadSoundFont(_resolveSoundFontUrl(preferredSoundFontUrl));
    });
  }

  function _rememberCurrentSongForBackNavigation(excludeKey) {
    if (!_currentBuffer || !_currentMidiUrl) return;
    // Buffers rendered with non-default tempo are song-state specific.
    // Keep preload cache tempo-neutral to avoid stale-tempo reuse.
    if (Math.abs(_tempoRate - 1) > 0.0001) return;

    var prevKey = _preloadKey(_currentMidiUrl, _renderedTranspose, _currentInstrument);
    if (excludeKey && prevKey === excludeKey) return;
    if (_preloadCache[prevKey]) return;

    _preloadCache[prevKey] = {
      buffer: _currentBuffer,
      rawMidi: _currentMidiBuffer,
      transpose: _renderedTranspose,
      instrument: _currentInstrument,
      source: 'preserved-current',
      sourceLabel: _currentSourceLabel || _currentMidiUrl
    };
    _evictCache();
    console.log('[Preload] Preserved current song for back navigation:', prevKey);
  }

  function _getMatchingCacheEntries(url) {
    var keys = Object.keys(_preloadCache);
    var matches = [];
    for (var i = 0; i < keys.length; i++) {
      if (keys[i].indexOf(url + '|') !== 0) continue;
      matches.push({
        key: keys[i],
        source: _preloadCache[keys[i]].source || 'unknown',
        label: _preloadCache[keys[i]].sourceLabel || '',
        transpose: _preloadCache[keys[i]].transpose,
        instrument: _preloadCache[keys[i]].instrument
      });
    }
    return matches;
  }

  function _findReusableRawMidi(url, instrument) {
    var inst = instrument != null ? instrument : -1;
    var suffix = '|' + inst;
    var keys = Object.keys(_preloadCache);

    for (var i = keys.length - 1; i >= 0; i--) {
      var key = keys[i];
      if (key.indexOf(url + '|') !== 0) continue;
      if (key.slice(-suffix.length) !== suffix) continue;

      var entry = _preloadCache[key];
      if (!entry || !entry.rawMidi) continue;

      return {
        key: key,
        rawMidi: entry.rawMidi,
        source: entry.source || 'unknown',
        sourceLabel: entry.sourceLabel || ''
      };
    }

    return null;
  }

  function _findReusableInFlight(url, instrument) {
    var inst = instrument != null ? instrument : -1;
    var suffix = '|' + inst;
    var keys = Object.keys(_preloadInFlight);

    for (var i = keys.length - 1; i >= 0; i--) {
      var key = keys[i];
      if (key.indexOf(url + '|') !== 0) continue;
      if (key.slice(-suffix.length) !== suffix) continue;

      return {
        key: key,
        promise: _preloadInFlight[key]
      };
    }

    return null;
  }

  // ─── Rendering ────────────────────────────────────────────────────

  /**
   * Render a MIDI file to AudioBuffer via the worker.
   * @param {ArrayBuffer} midiBuffer - Raw MIDI file data
   * @param {object} opts - { transpose, instrument, sampleRate, tempoRate }
   * @returns {Promise<AudioBuffer>}
   */
  function _renderToBuffer(midiBuffer, opts) {
    opts = opts || {};
    // Render at a stable higher-quality rate even before the AudioContext exists.
    // This avoids the first render being locked to 44.1 kHz on devices that later
    // play back at much higher sample rates.
    var preferredRate = _ctx ? _ctx.sampleRate : 48000;
    var sampleRate = opts.sampleRate || Math.max(48000, Math.min(96000, preferredRate));
    var tempoRate = Number(opts.tempoRate);
    if (!Number.isFinite(tempoRate) || tempoRate <= 0) tempoRate = 1;
    // Apply optional global transpose offset from config.
    var globalOffset = (typeof MIDI_GLOBAL_TRANSPOSE_OFFSET !== 'undefined') ? MIDI_GLOBAL_TRANSPOSE_OFFSET : 0;

    return _sendToWorker({
      type: 'render',
      midiBuffer: midiBuffer,
      sampleRate: sampleRate,
      transpose: (opts.transpose || 0) + globalOffset,
      instrument: opts.instrument != null ? opts.instrument : -1,
      tempoRate: tempoRate
    }).then(function (result) {
      // Create AudioContext lazily — by the time rendering completes the user
      // has already interacted with the page (clicking a song to open it).
      var ctx = _ensureContext();
      var audioBuffer = ctx.createBuffer(2, result.left.length, result.sampleRate);
      audioBuffer.getChannelData(0).set(result.left);
      audioBuffer.getChannelData(1).set(result.right);
      return audioBuffer;
    });
  }

  // ─── Deck Playback ────────────────────────────────────────────────

  function _clampTempoBpm(value, fallback) {
    var raw = Number(value);
    var safeFallback = Number.isFinite(Number(fallback)) ? Number(fallback) : _DEFAULT_TEMPO_BPM;
    var candidate = Number.isFinite(raw) ? raw : safeFallback;
    candidate = Math.round(candidate);
    if (candidate < 30) candidate = 30;
    if (candidate > 220) candidate = 220;
    return candidate;
  }

  function _computeTempoRate() {
    var base = _clampTempoBpm(_tempoBaseBpm, _DEFAULT_TEMPO_BPM);
    var bpm = _clampTempoBpm(_tempoBpm, base);
    var ratio = bpm / base;
    if (!isFinite(ratio) || ratio <= 0) ratio = 1;
    if (ratio < 0.25) ratio = 0.25;
    if (ratio > 4) ratio = 4;
    return ratio;
  }

  function _clearPendingTempoApply() {
    if (_tempoApplyTimer !== null) {
      clearTimeout(_tempoApplyTimer);
      _tempoApplyTimer = null;
    }
  }

  function _applyTempoToCurrentSong() {
    if (!_currentMidiBuffer) return Promise.resolve();
    return _renderAndSwap(_currentMidiBuffer, {
      transpose: _currentTranspose,
      instrument: _currentInstrument,
      tempoRate: _tempoRate
    });
  }

  function _scheduleTempoApply() {
    if (!_currentMidiBuffer) return;

    // Latest-wins behavior: apply immediately so repeated tempo changes
    // always start a fresh render right away and stale renders are discarded
    // by _loadGeneration checks inside _renderAndSwap.
    _clearPendingTempoApply();
    _applyTempoToCurrentSong();
  }

  function _createDeck(buffer, startOffset) {
    var ctx = _ensureContext();
    var gain = ctx.createGain();
    gain.connect(_masterGain);

    var source = ctx.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = 1;
    source.connect(gain);

    return {
      source: source,
      gain: gain,
      buffer: buffer,
      startOffset: startOffset || 0,
      startCtxTime: 0,   // Set when actually started
      ended: false
    };
  }

  function _startDeck(deck, fadeInMs) {
    var ctx = _ensureContext();
    deck.startCtxTime = ctx.currentTime;

    if (fadeInMs > 0) {
      deck.gain.gain.setValueAtTime(0, ctx.currentTime);
      deck.gain.gain.linearRampToValueAtTime(1.0, ctx.currentTime + fadeInMs / 1000);
    } else {
      deck.gain.gain.value = 1.0;
    }

    deck.source.start(0, deck.startOffset);

    deck.source.onended = function () {
      deck.ended = true;
      // Check if this was the active deck and song really ended
      if (deck === _deckA && _playing && !_isCrossfading) {
        _playing = false;
        _currentTime = _duration;
        if (_onStateChange) _onStateChange(false, _duration, _duration);
        if (_onSongEnd) _onSongEnd();
      }
    };
  }

  function _stopDeck(deck, fadeOutMs) {
    if (!deck || !deck.source) return Promise.resolve();

    var ctx = _ensureContext();

    if (fadeOutMs > 0) {
      deck.gain.gain.setValueAtTime(deck.gain.gain.value, ctx.currentTime);
      deck.gain.gain.linearRampToValueAtTime(0, ctx.currentTime + fadeOutMs / 1000);

      return new Promise(function (resolve) {
        setTimeout(function () {
          try { deck.source.stop(); } catch (_e) {}
          try { deck.gain.disconnect(); } catch (_e2) {}
          resolve();
        }, fadeOutMs + 50);
      });
    } else {
      try { deck.source.stop(); } catch (_e) {}
      try { deck.gain.disconnect(); } catch (_e2) {}
      return Promise.resolve();
    }
  }

  function _getDeckTime(deck) {
    if (!deck) return 0;
    var ctx = _ensureContext();
    var elapsed = Math.max(0, ctx.currentTime - deck.startCtxTime);
    return deck.startOffset + elapsed;
  }

  // ─── Public API ───────────────────────────────────────────────────

  /**
   * Initialize the engine. Must be called once before use.
   * @param {string} sfontUrl - URL to SF2/SF3 soundfont file
   * @param {object} [opts] - { onSongEnd, onProgress, onStateChange }
   */
  function init(sfontUrl, opts) {
    opts = opts || {};
    _onSongEnd = opts.onSongEnd || null;
    _onProgress = opts.onProgress || null;
    _onStateChange = opts.onStateChange || null;

    // AudioContext is created lazily on first user interaction to satisfy
    // browser autoplay policy (no AudioContext before user gesture).

    return _ensureEngineReady(sfontUrl);
  }

  /**
   * Change soundfont. Re-renders current song if one is loaded.
   * @param {string} sfontUrl
   */
  function changeSoundFont(sfontUrl) {
    return _loadSoundFont(sfontUrl).then(function () {
      // Re-render current song with new soundfont if playing
      if (_currentMidiBuffer) {
        return _renderAndSwap(_currentMidiBuffer, {
          transpose: _currentTranspose,
          instrument: _currentInstrument,
          tempoRate: _tempoRate
        });
      }
    });
  }

  /**
   * Load a MIDI file and prepare for playback.
   * @param {string} url - URL to MIDI file
   * @param {object} [opts] - { autoplay, transpose, instrument }
   * @returns {Promise<number>} Duration in seconds
   */
  function loadMidi(url, opts) {
    opts = opts || {};
    var thisGen = ++_loadGeneration;

    // Per-call onProgress overrides global _onProgress for this load
    var progressCb = opts.onProgress || _onProgress;

    var targetTranspose = opts.transpose || 0;
    var targetInstrument = opts.instrument != null ? opts.instrument : -1;
    var cacheKey = _preloadKey(url, targetTranspose, targetInstrument);
    var targetSourceLabel = opts.sourceLabel || url;

    // Keep the outgoing song in cache so back/prev navigation is instant.
    _rememberCurrentSongForBackNavigation(cacheKey);

    _currentTranspose = targetTranspose;
    _renderedTranspose = _currentTranspose; // Will be rendered at this transpose
    _currentInstrument = targetInstrument;
    _currentSourceLabel = targetSourceLabel;
    _tempoRate = _computeTempoRate();
    var useTempoNeutralCache = Math.abs(_tempoRate - 1) < 0.0001;

    // Check if we have a preloaded buffer for this exact URL+transpose+instrument
    var cached = _preloadCache[cacheKey];
    if (useTempoNeutralCache && cached && cached.buffer) {
      console.log('[Preload] Cache HIT for', url,
        'key=' + cacheKey,
        'source=' + (cached.source || 'unknown'),
        cached.sourceLabel ? 'label=' + cached.sourceLabel : '');
      _preloadedBuffer = cached.buffer;
      _preloadedMidiUrl = url;
      _preloadedTranspose = _currentTranspose;
      _preloadedInstrument = _currentInstrument;
      if (progressCb) progressCb(100);
      return _activatePreloaded(opts.autoplay, thisGen);
    }
    if (useTempoNeutralCache && _preloadedBuffer && _preloadedMidiUrl === url &&
        _preloadedTranspose === _currentTranspose &&
        _preloadedInstrument === _currentInstrument) {
      console.log('[Preload] Legacy buffer HIT for', url);
      if (progressCb) progressCb(100);
      return _activatePreloaded(opts.autoplay, thisGen);
    }

    _isLoading = true;

    console.log('[Preload] Cache MISS for', url, 'key=' + cacheKey,
      'cacheKeys=', Object.keys(_preloadCache),
      'matchingVariants=', _getMatchingCacheEntries(url));

    // Stop current playback
    var stopPromise = _playing ? stop(200) : Promise.resolve();

    function _finishLoadError(err) {
      _isLoading = false;
      if (err && err.message === 'cancelled') return 0;
      throw err;
    }

    function _activateExactPreload(hit) {
      _preloadedBuffer = hit.buffer;
      _preloadedMidiUrl = url;
      _preloadedTranspose = _currentTranspose;
      _preloadedInstrument = _currentInstrument;
      if (progressCb) progressCb(100);
      return _activatePreloaded(opts.autoplay, thisGen);
    }

    function _finalizeRenderedLoad(audioBuffer) {
      if (_loadGeneration !== thisGen) throw new Error('cancelled');
      if (progressCb) progressCb(100);

      _currentBuffer = audioBuffer;
      _duration = audioBuffer.duration;
      _currentTime = 0;
      _isLoading = false;

      if (opts.autoplay) {
        return _startPlayback(0, 120);
      }

      if (_onStateChange) _onStateChange(false, 0, _duration);
      return _duration;
    }

    function _renderLoadedMidiBuffer(buf) {
      if (_loadGeneration !== thisGen) throw new Error('cancelled');
      _currentMidiBuffer = buf;
      if (progressCb) progressCb(30);
      return _renderToBuffer(buf, {
        transpose: _currentTranspose,
        instrument: _currentInstrument,
        tempoRate: _tempoRate
      }).then(_finalizeRenderedLoad);
    }

    function _loadFromReusableRaw(reusable) {
      console.log('[Preload] Reusing raw MIDI variant for', url,
        'target=' + cacheKey,
        'variant=' + reusable.key,
        'source=' + (reusable.source || 'unknown'),
        reusable.sourceLabel ? 'label=' + reusable.sourceLabel : '');

      return _ensureEngineReady().then(function () {
        return stopPromise;
      }).then(function () {
        if (_loadGeneration !== thisGen) throw new Error('cancelled');
        _currentMidiUrl = url;
        return _renderLoadedMidiBuffer(reusable.rawMidi);
      });
    }

    function _loadFromNetwork() {
      return _ensureEngineReady().then(function () {
        return stopPromise;
      }).then(function () {
        if (_loadGeneration !== thisGen) throw new Error('cancelled');
        _currentMidiUrl = url;
        return fetch(url);
      }).then(function (resp) {
        if (!resp.ok) throw new Error('MIDI fetch failed: ' + resp.status);
        return resp.arrayBuffer();
      }).then(function (buf) {
        return _renderLoadedMidiBuffer(buf);
      });
    }

    if (useTempoNeutralCache && _preloadInFlight[cacheKey]) {
      console.log('[Preload] Awaiting in-flight render for', url, 'key=' + cacheKey);
      if (progressCb) progressCb(15);

      return _preloadInFlight[cacheKey].catch(function () {
        return null;
      }).then(function () {
        if (_loadGeneration !== thisGen) throw new Error('cancelled');
        var cachedAfterWait = _preloadCache[cacheKey];
        if (cachedAfterWait && cachedAfterWait.buffer) {
          console.log('[Preload] Cache HIT after await for', url,
            'key=' + cacheKey,
            'source=' + (cachedAfterWait.source || 'unknown'),
            cachedAfterWait.sourceLabel ? 'label=' + cachedAfterWait.sourceLabel : '');
          return _activateExactPreload(cachedAfterWait);
        }
        return _loadFromNetwork();
      }).catch(_finishLoadError);
    }

    var reusableVariant = _findReusableRawMidi(url, _currentInstrument);
    if (reusableVariant && reusableVariant.rawMidi) {
      return _loadFromReusableRaw(reusableVariant).catch(_finishLoadError);
    }

    var reusableInFlight = _findReusableInFlight(url, _currentInstrument);
    if (reusableInFlight && reusableInFlight.promise) {
      console.log('[Preload] Awaiting reusable in-flight render for', url,
        'target=' + cacheKey,
        'variant=' + reusableInFlight.key);
      if (progressCb) progressCb(15);

      return reusableInFlight.promise.catch(function () {
        return null;
      }).then(function () {
        if (_loadGeneration !== thisGen) throw new Error('cancelled');

        var cachedAfterWait = _preloadCache[cacheKey];
        if (useTempoNeutralCache && cachedAfterWait && cachedAfterWait.buffer) {
          console.log('[Preload] Cache HIT after reusable await for', url,
            'key=' + cacheKey,
            'source=' + (cachedAfterWait.source || 'unknown'),
            cachedAfterWait.sourceLabel ? 'label=' + cachedAfterWait.sourceLabel : '');
          return _activateExactPreload(cachedAfterWait);
        }

        var reusableAfterWait = _findReusableRawMidi(url, _currentInstrument);
        if (reusableAfterWait && reusableAfterWait.rawMidi) {
          return _loadFromReusableRaw(reusableAfterWait);
        }

        return _loadFromNetwork();
      }).catch(_finishLoadError);
    }

    return _loadFromNetwork().catch(_finishLoadError);
  }

  /**
   * Activate a preloaded buffer (instant transition).
   */
  function _activatePreloaded(autoplay, gen) {
    var oldDeck = _deckA;

    // Try multi-buffer cache first
    var key = _preloadKey(_preloadedMidiUrl, _preloadedTranspose, _preloadedInstrument);
    var cached = _preloadCache[key];
    var buf = cached ? cached.buffer : _preloadedBuffer;

    _currentMidiUrl = _preloadedMidiUrl;
    _currentBuffer = buf;
    _currentMidiBuffer = cached && cached.rawMidi ? cached.rawMidi : _currentMidiBuffer;
    _currentSourceLabel = cached && cached.sourceLabel ? cached.sourceLabel : (_currentSourceLabel || _preloadedMidiUrl);
    _duration = buf.duration;
    _currentTime = 0;
    _currentTranspose = _preloadedTranspose;
    _renderedTranspose = _preloadedTranspose;
    _currentInstrument = _preloadedInstrument;

    // Keep used entry in cache so recent songs can be reused without re-render.
    // This prevents immediate re-preload of the same song when navigating next/prev.
    if (cached) {
      delete _preloadCache[key];
      _preloadCache[key] = cached; // touch as most-recently used
    }
    _preloadedBuffer = null;
    _preloadedMidiUrl = '';

    _isLoading = false;

    if (autoplay) {
      if (_crossfadeEnabled && oldDeck && _playing) {
        return _crossfadeTo(_currentBuffer, gen);
      }
      return _startPlayback(0, 120);
    }

    // Stop old deck
    if (oldDeck) _stopDeck(oldDeck, 200);
    _deckA = null;
    _playing = false;

    if (_onStateChange) _onStateChange(false, 0, _duration);
    return Promise.resolve(_duration);
  }

  /**
   * Crossfade from current deck to new buffer.
   */
  function _crossfadeTo(newBuffer, gen) {
    var ctx = _ensureContext();
    _isCrossfading = true;

    var fadeMs = _crossfadeDuration * 1000;
    var oldDeck = _deckA;
    var newDeck = _createDeck(newBuffer, 0);

    _deckA = newDeck;
    _duration = newBuffer.duration;
    _currentTime = 0;

    // Start new deck with fade in
    _startDeck(newDeck, fadeMs);
    _playing = true;

    if (_onStateChange) _onStateChange(true, 0, _duration);

    // Fade out old deck
    if (oldDeck) {
      _stopDeck(oldDeck, fadeMs).then(function () {
        _isCrossfading = false;
      });
    } else {
      _isCrossfading = false;
    }

    return Promise.resolve(_duration);
  }

  function _startPlayback(offset, fadeInMs) {
    return _resumeContext().then(function () {
      // Stop any existing deck
      if (_deckA) {
        try { _deckA.source.stop(); } catch (_e) {}
        try { _deckA.gain.disconnect(); } catch (_e2) {}
      }

      _deckA = _createDeck(_currentBuffer, offset);
      _startDeck(_deckA, fadeInMs || 0);
      _playing = true;
      _currentTime = offset;
      _startWallTime = performance.now();

      if (_onStateChange) _onStateChange(true, offset, _duration);
      return _duration;
    });
  }

  /**
   * Render MIDI and swap into active playback (for transpose/instrument changes).
   * Uses dual-layer crossfade: old deck keeps playing while new deck fades in
   * at the exact live position — no gap, no backwards jump.
   */
  function _renderAndSwap(midiBuffer, opts) {
    var wasPlaying = _playing;
    var pausedTime = wasPlaying ? 0 : getTime();
    var thisGen = ++_loadGeneration;

    _isLoading = true;

    return _renderToBuffer(midiBuffer, opts).then(function (audioBuffer) {
      if (_loadGeneration !== thisGen) return false;

      _currentBuffer = audioBuffer;
      _duration = audioBuffer.duration;
      _isLoading = false;

      if (wasPlaying && _deckA && !_deckA.ended) {
        // ── Dual-layer crossfade ──
        // Capture LIVE position (not stale pre-render position)
        var liveTime = _getDeckTime(_deckA);
        var startAt = Math.max(0, Math.min(liveTime, _duration - 0.1));
        var oldDeck = _deckA;
        var fadeMs = 200;

        // Create new deck at the exact live position
        return _resumeContext().then(function () {
          var newDeck = _createDeck(audioBuffer, startAt);
          _deckA = newDeck;

          // Start new deck with fade-in
          _startDeck(newDeck, fadeMs);
          _playing = true;

          // Fade out old deck simultaneously
          _stopDeck(oldDeck, fadeMs);

          if (_onStateChange) _onStateChange(true, startAt, _duration);
          return true;
        });
      } else {
        // Not playing — just update buffer
        if (_deckA) _stopDeck(_deckA, 0);
        _deckA = null;
        _currentTime = Math.min(pausedTime, _duration);
        if (_onStateChange) _onStateChange(false, _currentTime, _duration);
        return true;
      }
    }).catch(function () {
      _isLoading = false;
      return false;
    });
  }

  // ─── Playback Controls ────────────────────────────────────────────

  function play() {
    if (_playing) return Promise.resolve();
    if (!_currentBuffer) return Promise.resolve();

    // If at the end, restart from beginning
    if (_currentTime >= _duration - 0.5) {
      _currentTime = 0;
    }

    return _startPlayback(_currentTime, 120);
  }

  function pause() {
    if (!_playing) return Promise.resolve();

    _currentTime = getTime();   // capture deck position while _playing is still true
    _playing = false;

    if (_onStateChange) _onStateChange(false, _currentTime, _duration);

    return _stopDeck(_deckA, 400).then(function () {
      _deckA = null;
    });
  }

  function stop(fadeMs) {
    if (!_deckA) {
      _playing = false;
      _currentTime = 0;
      return Promise.resolve();
    }

    _playing = false;
    _currentTime = 0;

    if (_onStateChange) _onStateChange(false, 0, _duration);

    return _stopDeck(_deckA, fadeMs || 0).then(function () {
      _deckA = null;
    });
  }

  function seek(timeSeconds) {
    timeSeconds = Math.max(0, Math.min(timeSeconds, _duration));
    _currentTime = timeSeconds;

    if (_playing) {
      // Restart from new position
      return _startPlayback(timeSeconds, 50);
    } else {
      if (_onStateChange) _onStateChange(false, timeSeconds, _duration);
      return Promise.resolve();
    }
  }

  function getTime() {
    if (_playing && _deckA) {
      var t = _getDeckTime(_deckA);
      return Math.min(t, _duration);
    }
    return _currentTime;
  }

  function getDuration() {
    return _duration;
  }

  function isPlaying() {
    return _playing;
  }

  function isLoading() {
    return _isLoading;
  }

  // ─── Volume ───────────────────────────────────────────────────────

  function setVolume(linearGain) {
    _volume = Math.max(0, Math.min(1, linearGain));
    if (_masterGain) {
      _masterGain.gain.setTargetAtTime(_volume, _ctx.currentTime, 0.02);
    }
  }

  function getVolume() {
    return _volume;
  }

  function setMuted(muted) {
    _muted = muted;
    if (_masterGain) {
      _masterGain.gain.setTargetAtTime(muted ? 0 : _volume, _ctx.currentTime, 0.02);
    }
  }

  // ─── Transpose / Instrument ───────────────────────────────────────

  /**
   * Instantly shift the pitch of the currently-playing deck by the given offset
   * in semitones, using Web Audio detune (100 cents = 1 semitone).
   * This is gapless — no re-render needed. Used for immediate auditory feedback
   * while a background re-render is in progress.
   * @param {number} semitones - Offset relative to the rendered transpose
   */
  function applyDetuneOffset(semitones) {
    if (_deckA && _deckA.source) {
      try { _deckA.source.detune.value = semitones * 100; } catch (_e) {}
    }
  }

  function setTranspose(step) {
    if (step === _currentTranspose) return Promise.resolve();
    _currentTranspose = step;

    if (!_currentMidiBuffer) return Promise.resolve();
    return _renderAndSwap(_currentMidiBuffer, {
      transpose: step,
      instrument: _currentInstrument,
      tempoRate: _tempoRate
    }).then(function (applied) {
      // Only update rendered transpose for the latest winning request.
      if (applied && _currentTranspose === step) {
        _renderedTranspose = step;
      }
    });
  }

  function setInstrument(program) {
    if (program === _currentInstrument) return Promise.resolve();
    _currentInstrument = program;

    if (!_currentMidiBuffer) return Promise.resolve();
    return _renderAndSwap(_currentMidiBuffer, {
      transpose: _currentTranspose,
      instrument: program,
      tempoRate: _tempoRate
    });
  }

  function setTempoBaseBpm(baseBpm, opts) {
    opts = opts || {};
    var keepCurrent = opts.keepCurrentTempo === true;
    var skipApply = opts.skipApply === true;

    _tempoBaseBpm = _clampTempoBpm(baseBpm, _tempoBaseBpm);
    if (keepCurrent) {
      _tempoBpm = _clampTempoBpm(_tempoBpm, _tempoBaseBpm);
    } else {
      _tempoBpm = _tempoBaseBpm;
    }

    _tempoRate = _computeTempoRate();
    if (!skipApply) _scheduleTempoApply();
    return _tempoBaseBpm;
  }

  function setTempoBpm(tempoBpm, opts) {
    opts = opts || {};
    _tempoBpm = _clampTempoBpm(tempoBpm, _tempoBpm);
    _tempoRate = _computeTempoRate();
    if (!opts.skipApply) _scheduleTempoApply();
    return _tempoBpm;
  }

  function getTempoBpm() {
    return _tempoBpm;
  }

  function getTempoBaseBpm() {
    return _tempoBaseBpm;
  }

  function getTempoRate() {
    return _tempoRate;
  }

  function getTranspose() { return _currentTranspose; }
  function getRenderedTranspose() { return _renderedTranspose; }
  function getInstrument() { return _currentInstrument; }

  // ─── Preloading ───────────────────────────────────────────────────

  /**
   * Build a cache key from url + transpose + instrument.
   */
  function _preloadKey(url, transpose, instrument) {
    return url + '|' + (transpose || 0) + '|' + (instrument != null ? instrument : -1);
  }

  /**
   * Evict oldest cache entries when over limit.
   */
  function _evictCache() {
    var keys = Object.keys(_preloadCache);
    while (keys.length > _PRELOAD_CACHE_MAX) {
      delete _preloadCache[keys.shift()];
    }
  }

  /**
   * Process the next item in the preload queue.
   */
  function _processPreloadQueue() {
    if (_preloadBusy || _preloadQueue.length === 0) return;

    // Guard: don't attempt render if worker/soundfont not ready
    if (!_workerReady || !_sfontLoaded) {
      _ensureEngineReady().catch(function (err) {
        console.warn('[Preload] Init failed:', err.message || err);
      });
      console.warn('[Preload] Worker not ready (workerReady=' + _workerReady +
        ', sfontLoaded=' + _sfontLoaded + '), deferring queue (' +
        _preloadQueue.length + ' items)');
      // Retry after a delay once init completes
      setTimeout(function () { _processPreloadQueue(); }, 2000);
      return;
    }

    _preloadBusy = true;

    var item = _preloadQueue.shift();
    var key = _preloadKey(item.url, item.transpose, item.instrument);

    // Already cached — skip
    if (_preloadCache[key]) {
      console.log('[Preload] Already cached, skipping:', key);
      _preloadBusy = false;
      _processPreloadQueue();
      return;
    }

    // Already rendering this exact key — skip duplicate work
    if (_preloadInFlight[key]) {
      console.log('[Preload] Already rendering, skipping:', key);
      _preloadBusy = false;
      _processPreloadQueue();
      return;
    }

    console.log('[Preload] Starting preload for', item.url,
      'transpose=' + item.transpose, 'instrument=' + item.instrument);
    var startTime = performance.now();

    var rawMidiBuf = null;
    var preloadPromise = fetch(item.url).then(function (resp) {
      if (!resp.ok) throw new Error('Preload fetch failed: ' + resp.status + ' for ' + item.url);
      return resp.arrayBuffer();
    }).then(function (buf) {
      rawMidiBuf = buf;
      console.log('[Preload] Fetched', item.url, '(' + (buf.byteLength / 1024).toFixed(1) + 'KB), rendering...');
      return _renderToBuffer(buf, {
        transpose: item.transpose,
        instrument: item.instrument,
        tempoRate: 1
      });
    }).then(function (audioBuffer) {
      _preloadCache[key] = {
        buffer: audioBuffer,
        rawMidi: rawMidiBuf,
        transpose: item.transpose,
        instrument: item.instrument,
        source: item.source || 'neighbor-preload',
        sourceLabel: item.sourceLabel || item.url
      };
      // Also set legacy single-buffer vars for compat
      _preloadedBuffer = audioBuffer;
      _preloadedMidiUrl = item.url;
      _preloadedTranspose = item.transpose;
      _preloadedInstrument = item.instrument;
      _evictCache();
      console.log('[Preload] Completed:', item.url,
        'duration=' + audioBuffer.duration.toFixed(1) + 's',
        'took=' + ((performance.now() - startTime) / 1000).toFixed(1) + 's',
        'cacheSize=' + Object.keys(_preloadCache).length);
    }).catch(function (err) {
      console.warn('[Preload] FAILED for', item.url + ':', err.message || err);
    });

    _preloadInFlight[key] = preloadPromise;

    preloadPromise.then(function () {}, function () {}).then(function () {
      delete _preloadInFlight[key];
      _preloadBusy = false;
      _processPreloadQueue();
    });
  }

  /**
   * Pre-render a MIDI file in background so the next transition is instant.
   * @param {string} url - MIDI file URL
   * @param {object} [opts] - { transpose, instrument }
   */
  function preload(url, opts) {
    opts = opts || {};
    var transpose = opts.transpose || 0;
    var instrument = opts.instrument != null ? opts.instrument : -1;
    var key = _preloadKey(url, transpose, instrument);

    // Already cached
    if (_preloadCache[key]) {
      console.log('[Preload] Already cached, skipping preload request:', url);
      return Promise.resolve();
    }

    // Already rendering this exact key
    if (_preloadInFlight[key]) {
      console.log('[Preload] Already rendering, skipping preload request:', url);
      return Promise.resolve();
    }

    // Add to queue if not already queued
    var dominated = _preloadQueue.some(function (q) {
      return q.url === url && q.transpose === transpose && q.instrument === instrument;
    });
    if (!dominated) {
      console.log('[Preload] Queued:', url, 'key=' + key);
      _preloadQueue.push({
        url: url,
        transpose: transpose,
        instrument: instrument,
        source: opts.source,
        sourceLabel: opts.sourceLabel
      });
    }

    _ensureEngineReady().catch(function (err) {
      console.warn('[Preload] Init failed:', err.message || err);
    });
    _processPreloadQueue();
    return Promise.resolve();
  }

  /**
   * Pre-render multiple MIDI files sequentially.
   * @param {Array<{url:string, transpose?:number, instrument?:number}>} items
   */
  function preloadMultiple(items) {
    items.forEach(function (item) {
      preload(item.url, { transpose: item.transpose, instrument: item.instrument });
    });
  }

  function cancelPreload() {
    if (_preloadRenderId) {
      delete _pendingRenders[_preloadRenderId];
      _preloadRenderId = null;
    }
    _preloadQueue = [];
    _preloadBusy = false;
    _preloadedBuffer = null;
    _preloadedMidiUrl = '';
    // Keep cache — already-rendered buffers are still useful
  }

  function hasPreloaded(url, transpose, instrument) {
    // If transpose/instrument given, check for exact match
    if (arguments.length >= 3) {
      var exactKey = _preloadKey(url, transpose, instrument);
      if (_preloadCache[exactKey]) return true;
      return !!(_preloadedBuffer && _preloadedMidiUrl === url &&
        _preloadedTranspose === transpose && _preloadedInstrument === instrument);
    }
    // Otherwise check any variant of this URL
    var keys = Object.keys(_preloadCache);
    for (var i = 0; i < keys.length; i++) {
      if (keys[i].indexOf(url + '|') === 0) return true;
    }
    return !!(_preloadedBuffer && _preloadedMidiUrl === url);
  }

  function hasReusablePreload(url, instrument) {
    var inst = instrument != null ? instrument : -1;
    var keys = Object.keys(_preloadCache);
    var suffix = '|' + inst;
    for (var i = 0; i < keys.length; i++) {
      if (keys[i].indexOf(url + '|') === 0 && keys[i].slice(-suffix.length) === suffix) {
        return true;
      }
    }
    return !!(_preloadedBuffer && _preloadedMidiUrl === url && _preloadedInstrument === inst);
  }

  /**
   * Debug: get preload cache status for console inspection.
   */
  function getPreloadStatus() {
    return {
      cacheKeys: Object.keys(_preloadCache),
      cacheSize: Object.keys(_preloadCache).length,
      cacheMax: _PRELOAD_CACHE_MAX,
      queueLength: _preloadQueue.length,
      busy: _preloadBusy,
      workerReady: _workerReady,
      sfontLoaded: _sfontLoaded,
      legacyUrl: _preloadedMidiUrl,
      legacyTranspose: _preloadedTranspose,
      legacyInstrument: _preloadedInstrument
    };
  }

  function setPreloadCacheMax(maxItems) {
    var nextMax = Number(maxItems);
    if (!isFinite(nextMax)) return _PRELOAD_CACHE_MAX;
    nextMax = Math.round(nextMax);
    if (nextMax < 1) nextMax = 1;
    if (nextMax > 100) nextMax = 100;
    _PRELOAD_CACHE_MAX = nextMax;
    _evictCache();
    return _PRELOAD_CACHE_MAX;
  }

  function getPreloadCacheMax() {
    return _PRELOAD_CACHE_MAX;
  }

  // ─── Crossfade Settings ───────────────────────────────────────────

  function setCrossfadeEnabled(enabled) {
    _crossfadeEnabled = !!enabled;
    localStorage.setItem('midi-crossfade-enabled', _crossfadeEnabled ? '1' : '0');
  }

  function getCrossfadeEnabled() {
    return _crossfadeEnabled;
  }

  function setCrossfadeDuration(seconds) {
    _crossfadeDuration = Math.max(0.5, Math.min(10, seconds));
    localStorage.setItem('midi-crossfade-duration', String(_crossfadeDuration));
  }

  function getCrossfadeDuration() {
    return _crossfadeDuration;
  }

  function loadCrossfadePrefs() {
    var stored = localStorage.getItem('midi-crossfade-enabled');
    if (stored !== null) _crossfadeEnabled = stored === '1';
    var dur = localStorage.getItem('midi-crossfade-duration');
    if (dur !== null) _crossfadeDuration = parseFloat(dur) || 3.0;
  }

  // ─── Cleanup ──────────────────────────────────────────────────────

  function destroy() {
    _clearPendingTempoApply();

    if (_deckA) { try { _deckA.source.stop(); } catch (_e) {} }
    if (_deckB) { try { _deckB.source.stop(); } catch (_e) {} }
    if (_worker) _worker.terminate();
    if (_ctx) _ctx.close();

    _deckA = null;
    _deckB = null;
    _worker = null;
    _ctx = null;
    _playing = false;
    _currentBuffer = null;
    _preloadedBuffer = null;
    _preloadQueue = [];
    _preloadInFlight = {};
    _preloadBusy = false;
    _tempoBaseBpm = _DEFAULT_TEMPO_BPM;
    _tempoBpm = _DEFAULT_TEMPO_BPM;
    _tempoRate = 1;
  }

  /**
   * Resume AudioContext (needed after user gesture on mobile).
   */
  function resumeContext() {
    return _resumeContext();
  }

  /**
   * Get the raw AudioContext (for advanced usage / media session).
   */
  function getAudioContext() {
    return _ctx;
  }

  /**
   * Get current MIDI URL.
   */
  function getCurrentMidiUrl() {
    return _currentMidiUrl;
  }

  /**
   * Reset playback state without destroying engine.
   */
  function reset() {
    _clearPendingTempoApply();

    if (_deckA) { try { _deckA.source.stop(); } catch (_e) {} try { _deckA.gain.disconnect(); } catch (_e2) {} }
    _deckA = null;
    _playing = false;
    _currentTime = 0;
    _duration = 0;
    _currentBuffer = null;
    _currentMidiUrl = '';
    _currentMidiBuffer = null;
    _currentTranspose = 0;
    _currentInstrument = -1;
    _currentSourceLabel = '';
    _tempoBaseBpm = _DEFAULT_TEMPO_BPM;
    _tempoBpm = _DEFAULT_TEMPO_BPM;
    _tempoRate = 1;
  }

  // ─── Export ───────────────────────────────────────────────────────

  return {
    init: init,
    loadMidi: loadMidi,
    play: play,
    pause: pause,
    stop: stop,
    seek: seek,
    getTime: getTime,
    getDuration: getDuration,
    isPlaying: isPlaying,
    isLoading: isLoading,
    setVolume: setVolume,
    getVolume: getVolume,
    setMuted: setMuted,
    setTempoBaseBpm: setTempoBaseBpm,
    setTempoBpm: setTempoBpm,
    getTempoBpm: getTempoBpm,
    getTempoBaseBpm: getTempoBaseBpm,
    getTempoRate: getTempoRate,
    setTranspose: setTranspose,
    applyDetuneOffset: applyDetuneOffset,
    setInstrument: setInstrument,
    getTranspose: getTranspose,
    getRenderedTranspose: getRenderedTranspose,
    getInstrument: getInstrument,
    preload: preload,
    preloadMultiple: preloadMultiple,
    cancelPreload: cancelPreload,
    hasPreloaded: hasPreloaded,
    hasReusablePreload: hasReusablePreload,
    getPreloadStatus: getPreloadStatus,
    setPreloadCacheMax: setPreloadCacheMax,
    getPreloadCacheMax: getPreloadCacheMax,
    setCrossfadeEnabled: setCrossfadeEnabled,
    getCrossfadeEnabled: getCrossfadeEnabled,
    setCrossfadeDuration: setCrossfadeDuration,
    getCrossfadeDuration: getCrossfadeDuration,
    loadCrossfadePrefs: loadCrossfadePrefs,
    changeSoundFont: changeSoundFont,
    resumeContext: resumeContext,
    getAudioContext: getAudioContext,
    getCurrentMidiUrl: getCurrentMidiUrl,
    reset: reset,
    destroy: destroy
  };
})();
