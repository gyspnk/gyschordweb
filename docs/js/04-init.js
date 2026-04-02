// --- 3. Init ---
async function init() {
  try {
    // Setup Tone.js audio chain: Volume -> Compressor -> Limiter -> speakers
    // Intercepts the Destination's internal Volume node so ALL audio
    // (including SoundFontPlayer output) passes through dynamics processing.
    if (window.Tone) {
      if (Tone.getDestination) {
        Tone.getDestination().volume.value = -6; // Master volume: -6 dB
        try {
          // Build processing chain first (no audio impact yet)
          const compressor = new Tone.Compressor({
            threshold: -24,
            ratio: 4,
            attack: 0.003,
            release: 0.25  // Longer release for smoother dynamics
          });
          const limiter = new Tone.Limiter(-1);
          compressor.connect(limiter);

          // Intercept: disconnect Destination.input (Volume) from native output,
          // then reconnect through compressor -> limiter -> native output.
          const dest = Tone.getDestination();
          const rawDest = (Tone.context.rawContext || Tone.context).destination;
          dest.input.disconnect();
          dest.input.connect(compressor);
          limiter.connect(rawDest);
        } catch(e) {
          // If insertion fails, reconnect Volume directly so audio still works
          try {
            const dest = Tone.getDestination();
            const rawDest = (Tone.context.rawContext || Tone.context).destination;
            dest.input.connect(rawDest);
          } catch(e2) {}
        }
      } else if (Tone.Master) {
        Tone.Master.volume.value = -6;
      }
    }

    await document.fonts.load('16px "GoudyOldStyleBT-Roman"');
    await document.fonts.load('16px "AbadiMT-CondensedLight"');
  } catch (err) {
    console.warn("Gagal pre-load font PDF:", err);
  }

  // Resume AudioContext on first user interaction
  const resumeAudioContext = () => {
    if (window.Tone && Tone.context.state !== 'running') {
      Tone.context.resume();
    }
  };
  document.body.addEventListener('click', resumeAudioContext, { once: true, capture: true });
  document.body.addEventListener('touchstart', resumeAudioContext, { once: true, capture: true });


  chordConfig = createDefaultChordConfig();
  applyStoredPreferences();
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
