// --- 3. Init ---
async function init() {
  // Detect Chrome on Android and apply 20% UI scale reduction to prevent overlaps
  const ua = navigator.userAgent || "";
  if (/Android/i.test(ua) && /Chrome\/\d+/i.test(ua) && !/OPR|Edge|Firefox/i.test(ua)) {
    document.documentElement.classList.add("chrome-android");
  }

  // Restore user preferences FIRST so MidiEngine init can use the stored soundfont
  chordConfig = createDefaultChordConfig();
  applyStoredPreferences();

  try {
    // Initialize MidiEngine with FluidSynth WASM backend.
    // The engine handles its own AudioContext, compressor, and limiter chain.
    // Soundfont + WASM are loaded lazily on first MIDI playback via the Web Worker.
    if (typeof MidiEngine !== 'undefined') {
      const sfUrl = (typeof prefs !== 'undefined' && prefs && prefs.midiSoundfont) || MIDI_SF2_URL;
      isSoundfontSwitching = true;
      MidiEngine.loadCrossfadePrefs();
      MidiEngine.init(sfUrl, {
        onSongEnd: function () {
          // Dispatch custom event so 05-events.js can handle auto-next, loop, etc.
          window.dispatchEvent(new CustomEvent('midi-song-end'));
        },
        onStateChange: function (playing, time, duration) {
          window._midiKnownDuration = duration;
          // Sync mini player / UI state
          if (typeof syncMiniPlayerUI === 'function') syncMiniPlayerUI();
        }
      }).then(function () {
        isSoundfontSwitching = false;
        if (typeof rebuildInstrumentSelectors === 'function') {
          rebuildInstrumentSelectors(sfUrl);
        }
      }).catch(function (err) {
        isSoundfontSwitching = false;
        if (typeof rebuildInstrumentSelectors === 'function') {
          rebuildInstrumentSelectors(sfUrl);
        }
        console.warn('MidiEngine init deferred (will retry on first play):', err.message);
      });
    } else if (typeof rebuildInstrumentSelectors === 'function') {
      const initSfUrl = (typeof prefs !== 'undefined' && prefs && prefs.midiSoundfont) || MIDI_SF2_URL;
      rebuildInstrumentSelectors(initSfUrl);
    }

    await document.fonts.load('16px "GoudyOldStyleBT-Roman"');
    await document.fonts.load('16px "AbadiMT-CondensedLight"');
  } catch (err) {
    console.warn("Gagal pre-load font PDF:", err);
  }

  // Resume AudioContext on first user interaction
  const resumeAudioContext = () => {
    if (typeof MidiEngine !== 'undefined') {
      MidiEngine.resumeContext();
    }
  };
  document.body.addEventListener('click', resumeAudioContext, { once: true, capture: true });
  document.body.addEventListener('touchstart', resumeAudioContext, { once: true, capture: true });

  const systemThemeMedia = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  if (systemThemeMedia && typeof syncHeaderBranding === 'function') {
    systemThemeMedia.addEventListener('change', function () {
      if (localStorage.getItem('dark-theme') == null) {
        syncHeaderBranding();
      }
    });
  }


  setupEventListeners();
  setupRippleEffect();
  updateChordEditorUI();
  updateTransposeUI();
  syncTransposeCollapseState();
  updateHideChordButton();
  navigateTo("pujian");

  // Check for app updates via service worker
  checkForAppUpdate();
}

/**
 * App update detection — checks if the service worker has a newer version.
 * Shows a non-intrusive banner if an update is available.
 */
function checkForAppUpdate() {
  if (!('serviceWorker' in navigator)) return;

  const APP_VERSION_KEY = 'gys-app-version';
  const savedVersion = localStorage.getItem(APP_VERSION_KEY);

  navigator.serviceWorker.ready.then(function(registration) {
    // Listen for new service worker installing
    registration.addEventListener('updatefound', function() {
      const newWorker = registration.installing;
      if (!newWorker) return;
      newWorker.addEventListener('statechange', function() {
        if (newWorker.state === 'activated') {
          showUpdateBanner();
        }
      });
    });

    // Also ask the active worker for its version
    if (registration.active) {
      var msgChannel = new MessageChannel();
      msgChannel.port1.onmessage = function(event) {
        if (event.data && event.data.type === 'VERSION') {
          var swVersion = event.data.version;
          if (savedVersion && savedVersion !== swVersion) {
            showUpdateBanner();
          }
          localStorage.setItem(APP_VERSION_KEY, swVersion);
        }
      };
      registration.active.postMessage({ type: 'GET_VERSION' }, [msgChannel.port2]);
    }

    // Check for updates (non-blocking)
    registration.update().catch(function() {});
  });
}

function showUpdateBanner() {
  // Don't show duplicate banners
  if (document.getElementById('update-banner')) return;

  var banner = document.createElement('div');
  banner.id = 'update-banner';
  banner.innerHTML =
    '<div class="update-banner-content">' +
      '<span class="material-symbols-outlined update-banner-icon">system_update</span>' +
      '<div class="update-banner-text">' +
        '<strong>Pembaruan Tersedia</strong>' +
        '<span>Versi baru telah tersedia. Perbarui untuk pengalaman terbaik.</span>' +
      '</div>' +
      '<button id="update-banner-btn" class="update-banner-action">Perbarui</button>' +
      '<button id="update-banner-dismiss" class="update-banner-dismiss">&times;</button>' +
    '</div>';
  document.body.appendChild(banner);

  // Animate in
  requestAnimationFrame(function() {
    banner.classList.add('is-visible');
  });

  document.getElementById('update-banner-btn').addEventListener('click', function() {
    // Preserve playlists before clearing
    var playlistData = localStorage.getItem('playlists');
    var activePlaylist = localStorage.getItem('active-playlist-id');

    // Ask SW to clear all caches
    if (navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'CLEAR_CACHE' });
    }

    // Clear localStorage except playlists
    var keysToKeep = {};
    if (playlistData) keysToKeep['playlists'] = playlistData;
    if (activePlaylist) keysToKeep['active-playlist-id'] = activePlaylist;

    localStorage.clear();
    Object.keys(keysToKeep).forEach(function(k) {
      localStorage.setItem(k, keysToKeep[k]);
    });

    // Hard reload
    window.location.reload(true);
  });

  document.getElementById('update-banner-dismiss').addEventListener('click', function() {
    banner.classList.remove('is-visible');
    setTimeout(function() { banner.remove(); }, 300);
  });
}
