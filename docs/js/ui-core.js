/* Auto-merged runtime source. Legacy split snapshot archived under archive/docs-js/legacy. */

/* SOURCE: 04-init.js */
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
;

/* SOURCE: 09-ui-helpers.js */
// --- 8. Tambahan UI ---
function handleOrientationChange() {
  checkOrientation();
  closeTransposeCollapse();
  setTimeout(() => {
    currentScale = "page-fit";
    animateViewChange(() => renderPage(currentPageNum));
    fitViewerTitle();
  }, 200);
}

let _layoutResizeTimer = null;
function onLayoutResize() {
  if (_layoutResizeTimer) clearTimeout(_layoutResizeTimer);
  _layoutResizeTimer = setTimeout(() => {
    checkOrientation();
    checkLayoutCollisions();
    syncTransposeCollapseState();
    fitViewerTitle();
    fitListTitles();
  }, 100);
}

function checkLayoutCollisions() {
  if (!document.body.classList.contains('viewer-active')) return;

  const isLandscape = window.matchMedia('(orientation: landscape)').matches;
  const isNarrowLandscape = window.matchMedia('(max-width: 1100px) and (orientation: landscape)').matches;

  // In narrow landscape we intentionally use footer mode and collapsed MIDI toggle.
  // Forcing non-expanded mode avoids inline MIDI overlap on scaled/mobile browsers.
  if (isNarrowLandscape) {
    document.body.classList.remove('measure-layout');
    document.body.classList.remove('is-expanded-layout');
    return;
  }

  // Add the measure class to temporarily force expanded state
  document.body.classList.add('measure-layout');
  document.body.classList.remove('is-expanded-layout');

  let layoutFits = true;
  const buffer = 24; // minimal buffer for safety margin

  // Check Header
  const header = document.querySelector('.pdf-viewer-header');
  if (header && header.offsetParent !== null) {
    const left = header.querySelector('.header-left');
    const center = header.querySelector('.song-navigation');
    const right = header.querySelector('.landscape-controls');

    // In expanded layout, center can shrink, but it still needs room for the
    // navigation buttons plus a readable title area.
    let fixedWidth = 0;
    [left, right].forEach(el => {
      if (el && el.offsetParent !== null) {
        const style = getComputedStyle(el);
        fixedWidth += el.scrollWidth +
          parseFloat(style.marginLeft || 0) + parseFloat(style.marginRight || 0);
      }
    });

    if (center && center.offsetParent !== null) {
      const style = getComputedStyle(center);
      const navButtons = Array.from(center.querySelectorAll('button')).reduce((sum, button) => {
        return sum + button.scrollWidth;
      }, 0);
      const navGap = parseFloat(style.gap || style.columnGap || 0);
      const minTitleWidth = window.innerWidth >= 1200 ? 220 : 180;
      fixedWidth += navButtons + navGap * Math.max(0, center.querySelectorAll('button').length - 1) + minTitleWidth +
        parseFloat(style.marginLeft || 0) + parseFloat(style.marginRight || 0);
    }

    // Account for header gaps
    const headerStyle = getComputedStyle(header);
    const headerGap = parseFloat(headerStyle.gap || headerStyle.columnGap || 0);
    fixedWidth += headerGap * 2;

    // Use visual width (getBoundingClientRect) so transformed/scaled headers
    // (e.g. chrome-android mode) are evaluated against real on-screen space.
    const visualHeaderWidth = header.getBoundingClientRect().width || header.clientWidth;
    if (visualHeaderWidth < (fixedWidth + buffer)) {
      layoutFits = false;
    }
  }

  // Check Footer (if visible)
  const footer = document.querySelector('.pdf-viewer-footer');
  if (layoutFits && footer && footer.offsetParent !== null) {
    const left = footer.querySelector('.transpose-collapse');
    const center = footer.querySelector('.zoom-controls');
    const right = footer.querySelector('.page-navigation');

    let footerRequiredWidth = 0;
    [left, center, right].forEach(el => {
      if (el && el.offsetParent !== null) {
        const style = getComputedStyle(el);
        footerRequiredWidth += el.scrollWidth +
          parseFloat(style.marginLeft || 0) + parseFloat(style.marginRight || 0);
      }
    });

    const footerStyle = getComputedStyle(footer);
    const footerGap = parseFloat(footerStyle.gap || footerStyle.columnGap || 0);
    footerRequiredWidth += footerGap * 2;

    const visualFooterWidth = footer.getBoundingClientRect().width || footer.clientWidth;
    if (visualFooterWidth < (footerRequiredWidth + buffer)) {
      layoutFits = false;
    }
  }

  document.body.classList.remove('measure-layout');

  // Only use expanded layout in landscape � in portrait, landscape-controls are hidden
  // so there's nowhere to show the inline MIDI or transpose controls.
  if (layoutFits && isLandscape) {
    document.body.classList.add('is-expanded-layout');
  } else {
    document.body.classList.remove('is-expanded-layout');
  }
}



function onToggleTransposeCollapse(event) {
  event.preventDefault();
  event.stopPropagation();

  if (!isCollapsibleLayout()) return;

  const targetCollapse = event.currentTarget.closest(".transpose-collapse");
  if (!targetCollapse) return;

  const shouldOpen = !targetCollapse.classList.contains("is-open");
  targetCollapse.classList.toggle("is-open", shouldOpen);
  
  const toggleBtn = targetCollapse.querySelector(".transpose-toggle-btn");
  if (toggleBtn) {
    toggleBtn.setAttribute("aria-expanded", shouldOpen ? "true" : "false");
  }

  syncViewerPopupState();
}

function closeTransposeCollapse() {
  transposeCollapses.forEach(collapse => {
    collapse.classList.remove("is-open");
    const toggleBtn = collapse.querySelector(".transpose-toggle-btn");
    if (toggleBtn) toggleBtn.setAttribute("aria-expanded", "false");
  });
}

function syncTransposeCollapseState() {
  if (!isCollapsibleLayout()) {
    closeTransposeCollapse();
  }
}

function isCollapsibleLayout() {
  // In narrow landscape (=1100px), footer navbar is visible with collapsible transpose
  if (window.matchMedia('(max-width: 1100px) and (orientation: landscape)').matches) {
    return true;
  }
  return !document.body.classList.contains('is-expanded-layout');
}

function onToggleFamilyChordDropdown(event) {
  event.stopPropagation();
  const dropdown = event.currentTarget.nextElementSibling;
  const wasOpen = dropdown.classList.contains('is-open');
  
  document.querySelectorAll('.family-chord-dropdown').forEach(dd => dd.classList.remove('is-open'));
  
  if (!wasOpen) {
    dropdown.classList.add('is-open');
  }

  // Suppress mini player when a viewer popup is open to prevent z-index conflict
  syncViewerPopupState();
}

function syncViewerPopupState() {
  const viewerOverlay = document.querySelector('.pdf-viewer-overlay');
  const hasViewerPopup = viewerOverlay && (
    viewerOverlay.querySelector('.family-chord-dropdown.is-open') ||
    viewerOverlay.querySelector('.transpose-collapse.is-open')
  );
  document.body.classList.toggle('viewer-popup-open', !!hasViewerPopup);
}

function onGlobalDocumentClick(event) {
  if (!event.target.closest(".family-chord-container")) {
    document.querySelectorAll('.family-chord-dropdown').forEach(dd => dd.classList.remove('is-open'));
  }
  
  if (!event.target.closest(".midi-collapse") && typeof midiPanel !== 'undefined' && midiPanel) {
    if (typeof midiToggleBtn !== 'undefined' && midiToggleBtn) midiToggleBtn.setAttribute('aria-expanded', 'false');
  }

  if (event.target.closest(".transpose-collapse")) return;
  closeTransposeCollapse();

  // Restore mini player when popups close
  syncViewerPopupState();
}

function fitViewerTitle() {
  autoFitTextSingleLine(pdfViewerTitle, {
    maxPx: 16,
    minPx: 9
  });
}

function fitListTitles() {
  document.querySelectorAll(".pujian-title").forEach((titleEl) => {
    autoFitTextSingleLine(titleEl, {
      maxPx: 16,
      minPx: 10
    });
  });
}

function autoFitTextSingleLine(element, { maxPx, minPx }) {
  if (!element) return;

  // Start at max and check if it fits
  element.style.fontSize = `${maxPx}px`;
  if (element.scrollWidth <= element.clientWidth + 1) return;

  // Binary search for the largest font size that fits
  let lo = minPx, hi = maxPx;
  while (hi - lo > 0.5) {
    const mid = (lo + hi) / 2;
    element.style.fontSize = `${mid}px`;
    if (element.scrollWidth > element.clientWidth + 1) {
      hi = mid;
    } else {
      lo = mid;
    }
  }
  element.style.fontSize = `${lo}px`;
}

function setupRippleEffect() {
  const createRipple = (event) => {
    const element = event.currentTarget;

    if (!element.classList.contains("ripple-effect")) {
      element.classList.add("ripple-effect");
    }

    const circle = document.createElement("span");
    const diameter = Math.max(element.clientWidth, element.clientHeight);
    const radius = diameter / 2;

    const rect = element.getBoundingClientRect();
    circle.style.width = circle.style.height = `${diameter}px`;
    circle.style.left = `${event.clientX - rect.left - radius}px`;
    circle.style.top = `${event.clientY - rect.top - radius}px`;
    circle.classList.add("ripple");

    element.appendChild(circle);

    setTimeout(() => {
      circle.remove();
    }, 600);
  };

  document.body.addEventListener("click", (e) => {
    const rippleTarget = e.target.closest(".nav-btn, .icon-button, .pujian-list li, .accent-color, .list-action-btn, .mini-player-info");
    if (rippleTarget) {
      createRipple({ currentTarget: rippleTarget, clientX: e.clientX, clientY: e.clientY });
    }
  });

  document.body.addEventListener(
    "touchstart",
    (e) => {
      const touch = e.touches && e.touches[0];
      if (!touch) return;

      const rippleTarget = e.target.closest(".nav-btn, .icon-button, .pujian-list li, .accent-color, .list-action-btn, .mini-player-info");
      if (rippleTarget) {
        createRipple({ currentTarget: rippleTarget, clientX: touch.clientX, clientY: touch.clientY });
      }
    },
    { passive: true }
  );
}

function checkOrientation() {
  // Use matchMedia first (CSS viewport orientation, most reliable across devices),
  // then screen.orientation API, then fallback to dimension check
  let isPortrait;
  if (window.matchMedia) {
    isPortrait = window.matchMedia("(orientation: portrait)").matches;
  } else if (screen.orientation && screen.orientation.type) {
    isPortrait = screen.orientation.type.startsWith("portrait");
  } else {
    isPortrait = window.innerHeight > window.innerWidth;
  }
  orientationWarning.classList.toggle("visible", currentViewMode === "double" && isPortrait);
}

function updatePageIndicator(num) {
  let text = String(num);
  if (currentViewMode === "double" && num + 1 <= pdfDoc.numPages) {
    text = `${num}-${num + 1}`;
  }
  [pageNumElPortrait, pageNumElLandscape].forEach((el) => {
    el.textContent = text;
  });
}

function updateZoomIndicator() {
  const zoomPercent = typeof currentScale === "number" ? Math.round((currentScale / initialScale) * 100) : 100;
  [zoomLevelIndicatorPortrait, zoomLevelIndicatorLandscape].forEach((el) => {
    if (el) el.textContent = `${zoomPercent}%`;
  });
}

function updatePageNavButtons() {
  const prevDisabled = currentPageNum <= 1;
  const step = currentViewMode === "double" ? 2 : 1;
  const nextDisabled = currentPageNum + step > pdfDoc.numPages;

  [prevPageBtnPortrait, prevPageBtnLandscape].forEach((btn) => {
    btn.disabled = prevDisabled;
  });
  [nextPageBtnPortrait, nextPageBtnLandscape].forEach((btn) => {
    btn.disabled = nextDisabled;
  });
}

function updateSongNavButtons() {
  prevSongBtn.disabled = currentSongIndex <= 0;
  nextSongBtn.disabled = currentSongIndex >= pujianItems.length - 1;
}

function rebuildInstrumentSelectors(sfUrl) {
  var sfKey = (typeof normalizeSoundfontKey === 'function')
    ? normalizeSoundfontKey(sfUrl || (prefs && prefs.midiSoundfont) || MIDI_SF2_URL)
    : (sfUrl || (prefs && prefs.midiSoundfont) || MIDI_SF2_URL);
  var preferredProgram = (typeof prefs !== 'undefined' && prefs && prefs.midiInstrument != null)
    ? String(prefs.midiInstrument)
    : '';
  var built = (typeof buildSoundfontInstrumentOptionsHtml === 'function')
    ? buildSoundfontInstrumentOptionsHtml(sfKey, preferredProgram)
    : { html: '', list: [], activeProgram: preferredProgram, activeLabel: 'Memuat Instrumen...' };

  if (!built.list.length) return;
  var currentVal = built.activeProgram;

  if (typeof prefs !== 'undefined') {
    if (!prefs.midiInstrumentBySoundfont || typeof prefs.midiInstrumentBySoundfont !== 'object') {
      prefs.midiInstrumentBySoundfont = {};
    }
    if (String(prefs.midiInstrument) !== currentVal || prefs.midiInstrumentBySoundfont[sfKey] !== currentVal || prefs.midiInstrumentUserSelected !== true) {
      prefs.midiInstrument = currentVal;
      prefs.midiInstrumentBySoundfont[sfKey] = currentVal;
      prefs.midiInstrumentUserSelected = true;
      localStorage.setItem('prefs', JSON.stringify(prefs));
    }
  }

  document.querySelectorAll('.instrument-capsule-btn').forEach(function (btn) {
    var wrapper = btn.closest('.instrument-selector-wrapper');
    if (!wrapper) return;
    var grid = wrapper.querySelector('.cis-menu-popover .cis-grid');
    if (grid) grid.innerHTML = built.html;
  });

  var titleText = built.activeLabel || 'Memuat Instrumen...';
  var labelText = titleText.length > 20 ? titleText.substring(0, 20) + '...' : titleText;
  var iconText = (typeof getMidiInstrumentIcon === 'function')
    ? getMidiInstrumentIcon(currentVal, titleText)
    : 'music_note';

  document.querySelectorAll('#cis-icon, #mini-cis-icon').forEach(function (el) {
    el.textContent = iconText;
  });

  document.querySelectorAll('#cis-label, #mini-cis-label').forEach(function (el) {
    el.textContent = labelText;
  });

  var mainBtn = document.getElementById('custom-instrument-select');
  var miniBtn = document.getElementById('mini-instrument-select');
  if (mainBtn) {
    mainBtn.dataset.value = currentVal;
    mainBtn.title = titleText;
    mainBtn.setAttribute('aria-label', titleText);
  }
  if (miniBtn) {
    miniBtn.dataset.value = currentVal;
    miniBtn.title = titleText;
    miniBtn.setAttribute('aria-label', titleText);
  }
}

async function closePdfViewer() {
  document.body.classList.remove("viewer-active");
  // Keep pdfDoc alive so reopening the same song from the mini player can skip
  // re-decoding and re-rendering � avoids main-thread jank that dips the audio.
  // pdfDoc is replaced automatically when a different song is loaded.
  // Do NOT reset currentSongIndex so the Mini Player remains globally synced.
  titleTapCount = 0;
  lastViewerTapAt = 0;
  lastViewerTapPoint = null;
  lastIndicatorTapAt = 0;
  lastIndicatorTapEl = null;
  chordsHidden = false;
  closeTransposeCollapse();
  updateHideChordButton();

  // We no longer stop the MIDI player when closing the PDF viewer so the Mini Player keeps it alive.
}
;

/* SOURCE: 10-zoom-gestures.js */
// --- 9. Zoom & gesture guards ---
function showToast(message, icon = "info") {
  if (toastTimeout) clearTimeout(toastTimeout);
  if (generalToastIcon) generalToastIcon.textContent = icon;

  const existingTextNode = Array.from(generalToast.childNodes).find(
    (n) => n.nodeType === Node.TEXT_NODE,
  );
  if (existingTextNode) {
    existingTextNode.textContent = ` ${message}`;
  } else {
    generalToast.appendChild(document.createTextNode(` ${message}`));
  }

  generalToast.classList.add("show");
  toastTimeout = setTimeout(() => {
    generalToast.classList.remove("show");
  }, 2500);
}

function showZoomToast(message, icon = "zoom_in") {
  if (zoomToastTimeout) clearTimeout(zoomToastTimeout);
  if (zoomToastIcon) zoomToastIcon.textContent = icon;

  const existingTextNode = Array.from(zoomToast.childNodes).find(
    (n) => n.nodeType === Node.TEXT_NODE,
  );
  if (existingTextNode) {
    existingTextNode.textContent = ` ${message}`;
  } else {
    zoomToast.appendChild(document.createTextNode(` ${message}`));
  }

  zoomToast.classList.add("show");
  zoomToastTimeout = setTimeout(() => {
    zoomToast.classList.remove("show");
  }, 2500);
}

function handleGlobalScroll(event) {
  if (!event.ctrlKey) return;

  event.preventDefault();
  if (!document.body.classList.contains("viewer-active")) return;

  // Smooth continuous scroll zoom instead of fixed steps
  handleContinuousWheelZoom(event);
}

function handleContinuousWheelZoom(event) {
  if (wheelRenderTimeout) {
    clearTimeout(wheelRenderTimeout);
    wheelRenderTimeout = null;
  }

  if (!wheelState) {
    const baseScale =
      typeof currentScale === "number" ? currentScale : initialScale;
    const rect = pdfViewerContent.getBoundingClientRect();
    const activeRect = canvasWrapper.getBoundingClientRect();

    const centerX = event.clientX;
    const centerY = event.clientY;

    const anchorInWrapperX = centerX - activeRect.left;
    const anchorInWrapperY = centerY - activeRect.top;

    wheelState = {
      baseScale,
      previewScale: baseScale,
      centerClientX: centerX,
      centerClientY: centerY,
      anchorInWrapperX,
      anchorInWrapperY,
      initScrollLeft: pdfViewerContent.scrollLeft,
      initScrollTop: pdfViewerContent.scrollTop,
      anchorViewportX: centerX - rect.left,
      anchorViewportY: centerY - rect.top,
    };

    // We use wheel-preview styling machinery for smooth un-rendered CSS scaling
    canvasWrapper.classList.add("wheel-preview");
  }

  // Normalize delta across browsers
  let deltaYPixels = event.deltaY;
  if (event.deltaMode === 1)
    deltaYPixels *= 33; // DOM_DELTA_LINE
  else if (event.deltaMode === 2) deltaYPixels *= 100; // DOM_DELTA_PAGE

  // Batasi kecepatan scroll yang berlebihan untuk mencegah glitch (clamp deltaY)
  const maxDelta = 120;
  deltaYPixels = Math.max(-maxDelta, Math.min(maxDelta, deltaYPixels));

  // Accumulate wheel delta (lower multiplier for smoother zooming)
  const zoomFactorMultiplier = Math.exp(-deltaYPixels * 0.0015);

  // Add CSS transition only for jerky mouse wheels, keep instant for trackpads.
  // Transition duration is lowered to 0.08s to reduce the bouncy elastic rubber-banding
  // effect when spamming zoom-in and zoom-out rapidly.
  if (Math.abs(deltaYPixels) >= 40) {
    canvasWrapper.style.transition = "transform 0.08s ease-out";
  } else {
    canvasWrapper.style.transition = "none";
  }

  const minScale = initialScale;
  const maxScale = initialScale * 8;
  const nextScale = Math.min(
    maxScale,
    Math.max(minScale, wheelState.previewScale * zoomFactorMultiplier),
  );

  wheelState.previewScale = nextScale;
  wheelState.centerClientX = event.clientX;
  wheelState.centerClientY = event.clientY;

  const ratio = nextScale / wheelState.baseScale;

  canvasWrapper.style.transformOrigin = `${wheelState.anchorInWrapperX}px ${wheelState.anchorInWrapperY}px`;
  canvasWrapper.style.transform = `scale(${ratio})`;

  const rect = pdfViewerContent.getBoundingClientRect();
  const currentMouseViewportX = event.clientX - rect.left;
  const currentMouseViewportY = event.clientY - rect.top;

  const anchorContentX = wheelState.initScrollLeft + wheelState.anchorViewportX;
  const anchorContentY = wheelState.initScrollTop + wheelState.anchorViewportY;

  // Selama zoom preview berlangsung, kita menonaktifkan update scroll untuk menghasilkan animasi CSS transisi yang sangat mulus,
  // karena `transform-origin` secara native sudah mengunci titik anchor. (Mencegah patah-patah antara scroll instant vs scale transisi)

  // Update real indicator values directly
  const tempPercent = Math.round((nextScale / initialScale) * 100);
  [zoomLevelIndicatorPortrait, zoomLevelIndicatorLandscape].forEach((el) => {
    if (el) el.textContent = `${tempPercent}%`;
  });

  wheelRenderTimeout = setTimeout(() => {
    wheelRenderTimeout = null;
    finalizeWheelZoom();
  }, 150);
}

async function finalizeWheelZoom() {
  if (!wheelState) return;
  if (isFinalizingWheelZoom) return;

  isFinalizingWheelZoom = true;

  const finalScale = wheelState.previewScale;
  const oldScale = wheelState.baseScale;
  const savedWheelState = { ...wheelState };

  if (!Number.isFinite(finalScale) || !Number.isFinite(oldScale)) {
    canvasWrapper.style.transform = "";
    canvasWrapper.style.transformOrigin = "";
    canvasWrapper.classList.remove("wheel-preview");
    wheelState = null;
    isFinalizingWheelZoom = false;
    return;
  }

  if (Math.abs(finalScale - oldScale) < 0.001) {
    currentScale = oldScale;
    canvasWrapper.style.transform = "";
    canvasWrapper.style.transformOrigin = "";
    canvasWrapper.classList.remove("wheel-preview");
    updateZoomIndicator();
    wheelState = null;
    isFinalizingWheelZoom = false;
    return;
  }

  const activeWrapper = canvasWrapper;
  currentScale = finalScale;
  updateZoomIndicator();

  zoomDeferInsert = true;
  let newWrapper;
  try {
    newWrapper = await renderPage(currentPageNum);
  } finally {
    zoomDeferInsert = false;
  }

  // Check if the user kept scrolling while we were rendering!
  // If they scrolled during the render, either wheelRenderTimeout is active,
  // or the finalScale has fundamentally drifted away from the rendered scale.
  if (wheelRenderTimeout || wheelState.previewScale !== finalScale) {
    isFinalizingWheelZoom = false;

    // If the timeout already expired but we blocked it using isFinalizingWheelZoom,
    // we need to re-trigger the finalize pipeline immediately to render the actual finalScale.
    if (!wheelRenderTimeout) {
      wheelRenderTimeout = setTimeout(() => {
        wheelRenderTimeout = null;
        finalizeWheelZoom();
      }, 50);
    }
    return;
  }

  // Now safely swap, as continuous scrolling has paused.
  wheelState = null;
  activeWrapper.style.transition = "";

  if (newWrapper === activeWrapper || !newWrapper) {
    activeWrapper.classList.remove("wheel-preview");
    activeWrapper.style.transform = "";
    activeWrapper.style.transformOrigin = "";
    updateCenteringAndOverflow();
    isFinalizingWheelZoom = false;
    return;
  }

  const oldVisualRect = activeWrapper.getBoundingClientRect();

  activeWrapper.classList.remove("wheel-preview");
  activeWrapper.style.transform = "";
  activeWrapper.style.transformOrigin = "";
  activeWrapper.replaceWith(newWrapper);
  canvasWrapper = newWrapper; // Update global reference so next pinch works

  updateCenteringAndOverflow();

  const containerRect = pdfViewerContent.getBoundingClientRect();
  const newWrapperRect = newWrapper.getBoundingClientRect();
  const ratio = finalScale / oldScale;

  const newWrapperDocX =
    pdfViewerContent.scrollLeft + (newWrapperRect.left - containerRect.left);
  const newWrapperDocY =
    pdfViewerContent.scrollTop + (newWrapperRect.top - containerRect.top);

  const newAnchorInWrapperX = savedWheelState.anchorInWrapperX * ratio;
  const newAnchorInWrapperY = savedWheelState.anchorInWrapperY * ratio;

  const targetViewportX = savedWheelState.centerClientX - containerRect.left;
  const targetViewportY = savedWheelState.centerClientY - containerRect.top;

  const targetScrollX = newWrapperDocX + newAnchorInWrapperX - targetViewportX;
  const targetScrollY = newWrapperDocY + newAnchorInWrapperY - targetViewportY;

  const maxScrollX = Math.max(
    0,
    pdfViewerContent.scrollWidth - pdfViewerContent.clientWidth,
  );
  const maxScrollY = Math.max(
    0,
    pdfViewerContent.scrollHeight - pdfViewerContent.clientHeight,
  );
  pdfViewerContent.scrollLeft = Math.min(
    Math.max(0, targetScrollX),
    maxScrollX,
  );
  pdfViewerContent.scrollTop = Math.min(Math.max(0, targetScrollY), maxScrollY);

  const newRect = newWrapper.getBoundingClientRect();
  const tx = oldVisualRect.left - newRect.left;
  const ty = oldVisualRect.top - newRect.top;
  const scaleX = oldVisualRect.width / (newRect.width || 1);
  const scaleY = oldVisualRect.height / (newRect.height || 1);

  if (Math.abs(tx) > 1 || Math.abs(ty) > 1 || Math.abs(scaleX - 1) > 0.01) {
    newWrapper.style.transition = "none";
    newWrapper.style.transformOrigin = "0 0";
    newWrapper.style.transform = `translate(${tx}px, ${ty}px) scale(${scaleX}, ${scaleY})`;

    newWrapper.getBoundingClientRect();

    newWrapper.style.transition = `transform ${ZOOM_SCROLL_SMOOTH_DURATION_MS}ms cubic-bezier(0.2, 0.8, 0.2, 1)`;
    newWrapper.style.transform = `translate(0px, 0px) scale(1)`;

    setTimeout(() => {
      newWrapper.style.transition = "";
      newWrapper.style.transform = "";
      newWrapper.style.transformOrigin = "";
    }, ZOOM_SCROLL_SMOOTH_DURATION_MS);
  }

  updateCenteringAndOverflow();
  isFinalizingWheelZoom = false;
}

function handleGlobalKeydown(event) {
  if (event.target.tagName === "INPUT" || event.target.tagName === "TEXTAREA")
    return;
  if (!document.body.classList.contains("viewer-active")) return;

  if (event.ctrlKey) {
    if (event.key === "+" || event.key === "=") {
      event.preventDefault();
      onZoom("in");
    } else if (event.key === "-") {
      event.preventDefault();
      onZoom("out");
    }
    return;
  }

  // Transpose shortcuts: [ = down, ] = up
  if (event.key === "[" || event.key === "]") {
    event.preventDefault();
    if (typeof onTranspose === "function") {
      onTranspose(event.key === "]" ? 1 : -1);
    }
    return;
  }

  // Don't hijack arrow keys when a family-chord dropdown is open
  const openDropdown = document.querySelector(".family-chord-dropdown.is-open");
  if (openDropdown) return;

  switch (event.key) {
    case "ArrowLeft":
      event.preventDefault();
      onPrevSong();
      break;
    case "ArrowRight":
      event.preventDefault();
      onNextSong();
      break;
    case "ArrowUp":
      event.preventDefault();
      onPrevPage();
      break;
    case "ArrowDown":
      event.preventDefault();
      onNextPage();
      break;
  }
}

function getPinchDistance(event) {
  const t1 = event.touches[0];
  const t2 = event.touches[1];
  return Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
}

function handleTouchStart(event) {
  if (event.touches.length !== 2) return;
  if (!document.body.classList.contains("viewer-active")) return;
  if (!event.target.closest(".pdf-viewer-content")) return;

  const baseScale = (typeof currentScale === "number" && Number.isFinite(currentScale)) ? currentScale : initialScale;
  initialPinchDistance = getPinchDistance(event);
  swipeStartPoint = null;

  const t1 = event.touches[0];
  const t2 = event.touches[1];
  const centerX = (t1.clientX + t2.clientX) / 2;
  const centerY = (t1.clientY + t2.clientY) / 2;
  const rect = pdfViewerContent.getBoundingClientRect();
  const activeRect = canvasWrapper.getBoundingClientRect();

  // Anchor position in wrapper-local coordinates (unscaled)
  const anchorInWrapperX = centerX - activeRect.left;
  const anchorInWrapperY = centerY - activeRect.top;

  pinchState = {
    baseScale,
    previewScale: baseScale,
    centerClientX: centerX,
    centerClientY: centerY,
    // Anchor position in wrapper-local coords at the start of pinch
    anchorInWrapperX,
    anchorInWrapperY,
    // Initial scroll offsets
    initScrollLeft: pdfViewerContent.scrollLeft,
    initScrollTop: pdfViewerContent.scrollTop,
    // Anchor position relative to viewport (container-local)
    anchorViewportX: centerX - rect.left,
    anchorViewportY: centerY - rect.top,
  };

  canvasWrapper.classList.add("pinch-preview");
  updateZoomIndicator();
}

function handleTouchMove(event) {
  if (event.touches.length !== 2 || !pinchState || initialPinchDistance <= 0)
    return;
  event.preventDefault();

  const distance = getPinchDistance(event);
  const factor = distance / initialPinchDistance;
  // Minimum 100%, maximum 800%
  const minScale = initialScale;
  const maxScale = initialScale * 8;
  const nextScale = Math.min(
    maxScale,
    Math.max(minScale, pinchState.baseScale * factor),
  );

  const t1 = event.touches[0];
  const t2 = event.touches[1];
  const centerX = (t1.clientX + t2.clientX) / 2;
  const centerY = (t1.clientY + t2.clientY) / 2;

  pinchState.previewScale = nextScale;
  pinchState.centerClientX = centerX;
  pinchState.centerClientY = centerY;

  const ratio = nextScale / pinchState.baseScale;

  // Use the anchor point as transform origin for accurate visual preview
  canvasWrapper.style.transformOrigin = `${pinchState.anchorInWrapperX}px ${pinchState.anchorInWrapperY}px`;
  canvasWrapper.style.transform = `scale(${ratio})`;

  // Compute correct scroll to keep anchor under finger
  // After CSS scale, the anchor point in the wrapper has moved.
  // We want the anchor's screen position to follow the current finger center.
  const rect = pdfViewerContent.getBoundingClientRect();
  const currentFingerViewportX = centerX - rect.left;
  const currentFingerViewportY = centerY - rect.top;

  // The anchor's document position after scaling (wrapper origin + scaled anchor offset)
  const wrapperBaseX =
    pinchState.initScrollLeft +
    (canvasWrapper.getBoundingClientRect().left - rect.left) -
    pdfViewerContent.scrollLeft +
    pdfViewerContent.scrollLeft;
  // Simpler: anchor position in content-space = initScroll + anchorViewport initially.
  // After scale with transform-origin at anchor, the anchor stays at same content position.
  // So we just need scroll such that anchor appears at finger position.
  const anchorContentX = pinchState.initScrollLeft + pinchState.anchorViewportX;
  const anchorContentY = pinchState.initScrollTop + pinchState.anchorViewportY;

  // With transform-origin at anchor, the anchor doesn't move in the wrapper's local pre-scale coords.
  // But CSS scale around that point means the wrapper's bounding rect changes.
  // The anchor in document space stays at: anchorContentX, anchorContentY
  // We want it to appear at finger viewport position:
  let targetScrollX = anchorContentX - currentFingerViewportX;
  let targetScrollY = anchorContentY - currentFingerViewportY;

  // Clamp scroll to viewport bounds
  const maxScrollX = Math.max(
    0,
    pdfViewerContent.scrollWidth - pdfViewerContent.clientWidth,
  );
  const maxScrollY = Math.max(
    0,
    pdfViewerContent.scrollHeight - pdfViewerContent.clientHeight,
  );
  pdfViewerContent.scrollLeft = Math.min(
    Math.max(0, targetScrollX),
    maxScrollX,
  );
  pdfViewerContent.scrollTop = Math.min(Math.max(0, targetScrollY), maxScrollY);

  currentScale = nextScale;
  updateZoomIndicator();
}

async function handleTouchEnd(event) {
  initialPinchDistance = 0;

  if (!pinchState) return;
  if (event.touches && event.touches.length >= 2) return;

  if (zoomInProgress) {
    canvasWrapper.style.transform = "";
    canvasWrapper.style.transformOrigin = "";
    canvasWrapper.classList.remove("pinch-preview");
    pinchState = null;
    return;
  }

  const finalScale = pinchState.previewScale;
  const oldScale = pinchState.baseScale;
  const savedPinchState = { ...pinchState };

  // Record the current preview scroll position - this is what looks correct to the user
  const previewScrollLeft = pdfViewerContent.scrollLeft;
  const previewScrollTop = pdfViewerContent.scrollTop;
  const ratio = finalScale / oldScale;

  pinchState = null;

  if (!Number.isFinite(finalScale) || !Number.isFinite(oldScale)) {
    canvasWrapper.style.transform = "";
    canvasWrapper.style.transformOrigin = "";
    canvasWrapper.classList.remove("pinch-preview");
    return;
  }
  if (Math.abs(finalScale - oldScale) < 0.005) {
    currentScale = oldScale;
    canvasWrapper.style.transform = "";
    canvasWrapper.style.transformOrigin = "";
    canvasWrapper.classList.remove("pinch-preview");
    updateZoomIndicator();
    return;
  }

  // Keep the CSS-scaled preview visible while we render new content offscreen
  // DO NOT remove transform yet - that causes the glitch
  const activeWrapper = canvasWrapper;

  zoomInProgress = true;
  currentScale = finalScale;
  updateZoomIndicator();

  // Render new content into a DETACHED element
  zoomDeferInsert = true;
  let newWrapper = null;
  try {
    newWrapper = await renderPage(currentPageNum);
  } catch (e) {
    zoomDeferInsert = false;
    activeWrapper.classList.remove("pinch-preview");
    activeWrapper.style.transform = "";
    activeWrapper.style.transformOrigin = "";
    zoomInProgress = false;
    return;
  } finally {
    zoomDeferInsert = false;
  }

  if (newWrapper === activeWrapper || !newWrapper) {
    activeWrapper.classList.remove("pinch-preview");
    activeWrapper.style.transform = "";
    activeWrapper.style.transformOrigin = "";
    updateCenteringAndOverflow();
    zoomInProgress = false;
    return;
  }

  // Save old visual state WITH preview transform still applied!
  const oldVisualRect = activeWrapper.getBoundingClientRect();

  // Atomic swap: remove CSS preview, insert freshly rendered wrapper
  activeWrapper.classList.remove("pinch-preview");
  activeWrapper.style.transform = "";
  activeWrapper.style.transformOrigin = "";
  activeWrapper.replaceWith(newWrapper);
  canvasWrapper = newWrapper; // Update global reference so next pinch works

  updateCenteringAndOverflow();

  // Restore scroll position based on the anchor point
  // The anchor was at anchorInWrapperX/Y in old wrapper coords.
  // In new wrapper it's at anchorInWrapperX * ratio, anchorInWrapperY * ratio.
  // We want the anchor to appear at the same viewport position as during preview.
  const containerRect = pdfViewerContent.getBoundingClientRect();
  const newWrapperRect = newWrapper.getBoundingClientRect();
  const newWrapperDocX =
    pdfViewerContent.scrollLeft + (newWrapperRect.left - containerRect.left);
  const newWrapperDocY =
    pdfViewerContent.scrollTop + (newWrapperRect.top - containerRect.top);

  // Anchor position in new wrapper = old anchor * ratio
  const newAnchorInWrapperX = savedPinchState.anchorInWrapperX * ratio;
  const newAnchorInWrapperY = savedPinchState.anchorInWrapperY * ratio;

  // Place anchor at same viewport position as finger
  const targetViewportX = savedPinchState.centerClientX - containerRect.left;
  const targetViewportY = savedPinchState.centerClientY - containerRect.top;

  const targetScrollX = newWrapperDocX + newAnchorInWrapperX - targetViewportX;
  const targetScrollY = newWrapperDocY + newAnchorInWrapperY - targetViewportY;

  const maxScrollX = Math.max(
    0,
    pdfViewerContent.scrollWidth - pdfViewerContent.clientWidth,
  );
  const maxScrollY = Math.max(
    0,
    pdfViewerContent.scrollHeight - pdfViewerContent.clientHeight,
  );
  pdfViewerContent.scrollLeft = Math.min(
    Math.max(0, targetScrollX),
    maxScrollX,
  );
  pdfViewerContent.scrollTop = Math.min(Math.max(0, targetScrollY), maxScrollY);

  // The new scroll is set. Calculate where the new wrapper actually landed on screen.
  const newRect = newWrapper.getBoundingClientRect();

  // How much it shifted on screen compared to the visual preview
  const tx = oldVisualRect.left - newRect.left;
  const ty = oldVisualRect.top - newRect.top;

  // In theory the scale should be exactly 1, but we calculate it to ensure perfect overlap
  const scaleX = oldVisualRect.width / (newRect.width || 1);
  const scaleY = oldVisualRect.height / (newRect.height || 1);

  // If there is ANY layout shift (e.g. snapping to center, clamping), glide it!
  if (Math.abs(tx) > 1 || Math.abs(ty) > 1 || Math.abs(scaleX - 1) > 0.01) {
    newWrapper.style.transition = "none";
    newWrapper.style.transformOrigin = "0 0";
    newWrapper.style.transform = `translate(${tx}px, ${ty}px) scale(${scaleX}, ${scaleY})`;

    // Force browser to recalculate styles before starting transition
    newWrapper.getBoundingClientRect();

    // "Play": smoothly glide to its natural layout position (snapped/centered)
    newWrapper.style.transition = `transform ${ZOOM_SCROLL_SMOOTH_DURATION_MS}ms cubic-bezier(0.2, 0.8, 0.2, 1)`;
    newWrapper.style.transform = `translate(0px, 0px) scale(1)`;

    setTimeout(() => {
      newWrapper.style.transition = "";
      newWrapper.style.transform = "";
      newWrapper.style.transformOrigin = "";
    }, ZOOM_SCROLL_SMOOTH_DURATION_MS);
  }

  updateCenteringAndOverflow();
  zoomInProgress = false;
}

function handleViewerTouchStart(event) {
  if (
    !document.body.classList.contains("viewer-active") ||
    event.touches.length !== 1
  )
    return;

  const touch = event.touches[0];
  const isFromControl = event.target.closest(
    "button, input, select, label, .chord-layer.editor-mode, .chord-marker",
  );

  if (isFromControl) {
    swipeStartPoint = null;
    return;
  }

  swipeStartPoint = {
    x: touch.clientX,
    y: touch.clientY,
    time: Date.now(),
  };
}

function handleViewerTouchEnd(event) {
  if (!document.body.classList.contains("viewer-active")) {
    swipeStartPoint = null;
    return;
  }

  if (!swipeStartPoint || !document.body.classList.contains("viewer-active")) {
    swipeStartPoint = null;
    return;
  }

  const touch = event.changedTouches && event.changedTouches[0];
  if (!touch) {
    swipeStartPoint = null;
    return;
  }

  const isControlInteraction = event.target.closest(
    "button, input, select, label, .chord-layer.editor-mode, .chord-marker",
  );
  const elapsed = Date.now() - swipeStartPoint.time;
  const dx = touch.clientX - swipeStartPoint.x;
  const dy = touch.clientY - swipeStartPoint.y;

  const absX = Math.abs(dx);
  const absY = Math.abs(dy);
  const isTap = absX < 14 && absY < 14 && elapsed < 260;

  if (!isControlInteraction && isTap) {
    const now = Date.now();
    const isFastEnough = now - lastViewerTapAt <= DOUBLE_TAP_MAX_DELAY;
    const isNearEnough =
      lastViewerTapPoint &&
      Math.hypot(
        touch.clientX - lastViewerTapPoint.x,
        touch.clientY - lastViewerTapPoint.y,
      ) <= DOUBLE_TAP_MAX_DISTANCE;

    if (isFastEnough && isNearEnough) {
      lastViewerTapAt = 0;
      lastViewerTapPoint = null;
      swipeStartPoint = null;
      resetZoomToDefault(touch.clientX, touch.clientY);
      return;
    }

    lastViewerTapAt = now;
    lastViewerTapPoint = { x: touch.clientX, y: touch.clientY };
    swipeStartPoint = null;
    return;
  }

  if (!isTap) {
    lastViewerTapAt = 0;
    lastViewerTapPoint = null;
  }

  swipeStartPoint = null;

  processSwipeGesture(dx, dy, elapsed);
}

function handleViewerPointerStart(event) {
  if (!document.body.classList.contains("viewer-active")) return;
  if (event.button !== 0) return;

  const isFromControl = event.target.closest(
    "button, input, select, label, .chord-layer.editor-mode, .chord-marker",
  );
  if (isFromControl) {
    swipeStartPoint = null;
    isMouseDragging = false;
    return;
  }

  swipeStartPoint = {
    x: event.clientX,
    y: event.clientY,
    time: Date.now(),
  };

  if (event.type === "mousedown") {
    isMouseDragging = true;
    pdfViewerContent.style.cursor = "grabbing";
    mouseDragStartX = event.clientX;
    mouseDragStartY = event.clientY;
    mouseDragScrollLeft = pdfViewerContent.scrollLeft;
    mouseDragScrollTop = pdfViewerContent.scrollTop;
  }
}

function handleViewerPointerMove(event) {
  if (!isMouseDragging) return;
  if (!document.body.classList.contains("viewer-active")) return;

  event.preventDefault(); // Prevent default text selection
  const dx = event.clientX - mouseDragStartX;
  const dy = event.clientY - mouseDragStartY;

  pdfViewerContent.scrollLeft = mouseDragScrollLeft - dx;
  pdfViewerContent.scrollTop = mouseDragScrollTop - dy;
}

function handleViewerPointerEnd(event) {
  if (isMouseDragging) {
    isMouseDragging = false;
    pdfViewerContent.style.cursor = "";
  }

  if (!document.body.classList.contains("viewer-active")) {
    swipeStartPoint = null;
    return;
  }

  if (!swipeStartPoint || event.button !== 0) {
    swipeStartPoint = null;
    return;
  }

  const elapsed = Date.now() - swipeStartPoint.time;
  const dx = event.clientX - swipeStartPoint.x;
  const dy = event.clientY - swipeStartPoint.y;
  swipeStartPoint = null;

  processSwipeGesture(dx, dy, elapsed);
}

function processSwipeGesture(dx, dy, elapsed) {
  // Disable page/song swipe while zoomed in to avoid accidental navigation.
  if (isViewerZoomedIn()) return;

  const now = Date.now();
  if (now - lastSwipeHandledAt < 220) return;

  const absX = Math.abs(dx);
  const absY = Math.abs(dy);
  if (elapsed > 850) return;
  if (absX < 30 && absY < 30) return;

  if (absY > absX * 1.2 && canSwipePdfPage()) {
    if (dy > 30) {
      onPrevPage();
      lastSwipeHandledAt = now;
    } else if (dy < -30) {
      onNextPage();
      lastSwipeHandledAt = now;
    }
    return;
  }

  if (absX > absY * 1.2) {
    if (dx < -30) {
      onNextSong();
      lastSwipeHandledAt = now;
    } else if (dx > 30) {
      onPrevSong();
      lastSwipeHandledAt = now;
    }
  }
}

function canSwipePdfPage() {
  return (
    Boolean(pdfDoc) &&
    pdfDoc.numPages > 1 &&
    currentViewMode === "single" &&
    currentScrollMode === "horizontal"
  );
}

function isViewerZoomedIn() {
  if (!Number.isFinite(initialScale) || initialScale <= 0) return false;
  if (typeof currentScale !== "number" || !Number.isFinite(currentScale))
    return false;
  return currentScale > initialScale * 1.001;
}
;

/* SOURCE: 11-handlers.js */
// --- 10. Handlers lainnya ---
function handleMainContentClick(e) {
  const uiStyleButton = e.target.closest(".ui-style-option");
  if (uiStyleButton) {
    const styleKey = uiStyleButton.dataset.uiStyle;
    const appliedStyle = applyUiStyleSelection(styleKey);
    const activeStyleLabel = document.getElementById("settings-active-style-label");
    const activeStyleMeta = UI_STYLE_PRESETS.find((preset) => preset.key === appliedStyle);
    if (activeStyleLabel && activeStyleMeta) {
      activeStyleLabel.textContent = activeStyleMeta.label;
    }
    document.querySelectorAll(".ui-style-option").forEach((button) => {
      const isSelected = button.dataset.uiStyle === appliedStyle;
      button.classList.toggle("selected", isSelected);
      button.setAttribute("aria-pressed", isSelected ? "true" : "false");
    });
    return;
  }

  const layoutStyleButton = e.target.closest(".layout-style-option");
  if (layoutStyleButton) {
    const layoutKey = layoutStyleButton.dataset.layoutStyle;
    const appliedLayout = applyLayoutStyleSelection(layoutKey);
    const activeLayoutLabel = document.getElementById("settings-active-layout-label");
    const activeLayoutMeta = LAYOUT_STYLE_PRESETS.find((preset) => preset.key === appliedLayout);
    if (activeLayoutLabel && activeLayoutMeta) {
      activeLayoutLabel.textContent = activeLayoutMeta.label;
    }
    document.querySelectorAll(".layout-style-option").forEach((button) => {
      const isSelected = button.dataset.layoutStyle === appliedLayout;
      button.classList.toggle("selected", isSelected);
      button.setAttribute("aria-pressed", isSelected ? "true" : "false");
    });
    return;
  }

  const fontPresetButton = e.target.closest(".font-preset-option");
  if (fontPresetButton) {
    const fontKey = fontPresetButton.dataset.uiFont;
    const appliedFont = applyFontSelection(fontKey);
    document.querySelectorAll(".font-preset-option").forEach((btn) => {
      const isSelected = btn.dataset.uiFont === appliedFont;
      btn.classList.toggle("selected", isSelected);
      btn.setAttribute("aria-pressed", isSelected ? "true" : "false");
    });
    return;
  }

  const colorSchemeButton = e.target.closest(".color-scheme-option");
  if (colorSchemeButton) {
    const schemeKey = colorSchemeButton.dataset.colorScheme;
    const appliedScheme = applyColorSchemeSelection(schemeKey);
    const activeSchemeLabel = document.getElementById("settings-active-scheme-label");
    const activeSchemeMeta = COLOR_SCHEME_PRESETS.find((preset) => preset.key === appliedScheme);
    if (activeSchemeLabel && activeSchemeMeta) {
      activeSchemeLabel.textContent = activeSchemeMeta.label;
    }
    document.querySelectorAll(".color-scheme-option").forEach((button) => {
      const isSelected = button.dataset.colorScheme === appliedScheme;
      button.classList.toggle("selected", isSelected);
      button.setAttribute("aria-pressed", isSelected ? "true" : "false");
    });
    return;
  }

  // Settings custom dropdown option selected
  const settingsDropdownOption = e.target.closest('[data-settings-select]');
  if (settingsDropdownOption) {
    const selectId = settingsDropdownOption.dataset.settingsSelect;
    const value = settingsDropdownOption.dataset.value;
    const hiddenSelect = document.getElementById(selectId);
    if (hiddenSelect) {
      hiddenSelect.value = value;
      hiddenSelect.dispatchEvent(new Event('change', { bubbles: true }));
    }
    // Update dropdown label
    const wrapper = settingsDropdownOption.closest('.settings-custom-dropdown');
    if (wrapper) {
      const label = wrapper.querySelector('.settings-dropdown-label');
      if (label) {
        // Use text content minus the check icon text
        label.textContent = settingsDropdownOption.textContent.replace(/^check\s*/, '').trim();
      }
      wrapper.querySelectorAll('.settings-dropdown-option').forEach(function(opt) {
        opt.classList.toggle('selected', opt === settingsDropdownOption);
      });
      wrapper.classList.remove('is-open');
      const btn = wrapper.querySelector('.settings-dropdown-btn');
      if (btn) btn.setAttribute('aria-expanded', 'false');
    }
    return;
  }

  // Settings custom dropdown toggle (open/close)
  const settingsDropdownBtn = e.target.closest('.settings-dropdown-btn');
  if (settingsDropdownBtn) {
    const wrapper = settingsDropdownBtn.closest('.settings-custom-dropdown');
    if (wrapper) {
      // Close all other open dropdowns first
      document.querySelectorAll('.settings-custom-dropdown.is-open').forEach(function(other) {
        if (other !== wrapper) {
          other.classList.remove('is-open');
          const btn = other.querySelector('.settings-dropdown-btn');
          if (btn) btn.setAttribute('aria-expanded', 'false');
        }
      });
      const isOpen = wrapper.classList.toggle('is-open');
      settingsDropdownBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    }
    return;
  }

  const aboutProjectBtn = e.target.closest("#about-project-btn");
  if (aboutProjectBtn) {
    navigateTo("about-project");
    return;
  }

  const aboutProjectBackBtn = e.target.closest("#about-project-back-btn");
  if (aboutProjectBackBtn) {
    navigateTo("pengaturan");
    return;
  }

  const reportBugBtn = e.target.closest("#report-bug-btn");
  if (reportBugBtn) {
    navigateTo("report-bug");
    return;
  }

  const reportBugBackBtn = e.target.closest("#report-bug-back-btn");
  if (reportBugBackBtn) {
    navigateTo("pengaturan");
    return;
  }

  const pujianItem = e.target.closest(".pujian-list li");
  if (pujianItem) {
    if (e.target.closest('.add-to-playlist-btn') || e.target.closest('button')) return;
    
    e.preventDefault();
    openPdfViewer(pujianItem.dataset.id);
    return;
  }

  const accentButton = e.target.closest(".accent-color");
  if (accentButton) {
    const color = accentButton.dataset.color;
    applyAccentSelection(color);

    const customInput = document.getElementById("custom-accent-input");
    if (customInput && color === "custom") {
      customInput.value = customAccentColor;
    }

    accentButton.parentElement.querySelector(".selected")?.classList.remove("selected");
    accentButton.classList.add("selected");

    if (chordUiPrefs.syncThemeWithAccent || chordUiPrefs.syncFillWithAccent) {
      rerenderViewerIfActive();
    }
    return;
  }

  const chordThemeButton = e.target.closest(".chord-theme-color");
  if (chordThemeButton) {
    const theme = chordThemeButton.dataset.chordTheme;
    if (!theme) return;
    chordUiPrefs.theme = theme;
    persistChordUiPrefs();
    chordThemeButton.parentElement.querySelector(".selected")?.classList.remove("selected");
    chordThemeButton.classList.add("selected");
    rerenderViewerIfActive();
    return;
  }

  const chordFillColorButton = e.target.closest(".chord-fill-color");
  if (chordFillColorButton) {
    const fillColor = chordFillColorButton.dataset.chordFillColor;
    if (!fillColor) return;
    chordUiPrefs.fillColor = fillColor;
    persistChordUiPrefs();
    chordFillColorButton.parentElement.querySelector(".selected")?.classList.remove("selected");
    chordFillColorButton.classList.add("selected");
    rerenderViewerIfActive();
  }
}

function applyAccentSelection(color) {
  const nextColor = color || "gold";
  document.body.setAttribute("data-accent", nextColor);
  localStorage.setItem("accent", nextColor);

  if (nextColor === "custom") {
    document.documentElement.style.setProperty("--source-custom", customAccentColor);
    localStorage.setItem(ACCENT_CUSTOM_COLOR_KEY, customAccentColor);
  }
}

function applyColorSchemeSelection(schemeKey, persist = true) {
  const validKeys = new Set(COLOR_SCHEME_PRESETS.map((preset) => preset.key));
  const fallbackScheme = COLOR_SCHEME_PRESETS[0]?.key || "warm";
  const nextScheme = validKeys.has(schemeKey) ? schemeKey : fallbackScheme;

  document.documentElement.setAttribute("data-color-scheme", nextScheme);
  document.body.setAttribute("data-color-scheme", nextScheme);

  if (typeof prefs === "object" && prefs) {
    prefs.colorScheme = nextScheme;
    if (persist) {
      localStorage.setItem("prefs", JSON.stringify(prefs));
    }
  }

  return nextScheme;
}

function isEffectiveDarkTheme() {
  if (document.body.classList.contains("dark-theme")) {
    return true;
  }
  if (document.body.classList.contains("light-theme-forced")) {
    return false;
  }
  return !!(window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);
}

function syncHeaderBranding() {
  const logoElement = document.getElementById("app-header-logo");
  const brandElement = document.querySelector(".app-brand");
  if (!logoElement || !brandElement || typeof HEADER_LOGO_VARIANTS !== "object") {
    return;
  }

  const activeStyle = UI_STYLE_PRESETS.find((preset) => preset.key === document.body.getAttribute("data-ui-style")) || UI_STYLE_PRESETS[0];
  const variantKey = isEffectiveDarkTheme() ? "white" : (activeStyle?.logoVariant || "color");
  const nextLogo = HEADER_LOGO_VARIANTS[variantKey] || HEADER_LOGO_VARIANTS.color;

  logoElement.src = nextLogo.src;
  logoElement.alt = nextLogo.alt;
  brandElement.setAttribute("data-logo-variant", variantKey);
}

function applyUiStyleSelection(styleKey, persist = true) {
  const validKeys = new Set(UI_STYLE_PRESETS.map((preset) => preset.key));
  const fallbackStyle = UI_STYLE_PRESETS[0]?.key || "sanctuary";
  const nextStyle = validKeys.has(styleKey) ? styleKey : fallbackStyle;

  document.body.setAttribute("data-ui-style", nextStyle);
  syncHeaderBranding();

  if (typeof prefs === "object" && prefs) {
    prefs.uiStyle = nextStyle;
    if (persist) {
      localStorage.setItem("prefs", JSON.stringify(prefs));
    }
  }

  return nextStyle;
}

function applyLayoutStyleSelection(layoutKey, persist = true) {
  const validKeys = new Set(LAYOUT_STYLE_PRESETS.map((preset) => preset.key));
  const fallbackLayout = LAYOUT_STYLE_PRESETS[0]?.key || "balanced";
  const nextLayout = validKeys.has(layoutKey) ? layoutKey : fallbackLayout;

  document.documentElement.setAttribute("data-layout-style", nextLayout);
  document.body.setAttribute("data-layout-style", nextLayout);

  if (typeof prefs === "object" && prefs) {
    prefs.layoutStyle = nextLayout;
    if (persist) {
      localStorage.setItem("prefs", JSON.stringify(prefs));
    }
  }

  return nextLayout;
}

function applyFontSelection(fontKey, persist = true) {
  const validKeys = new Set(FONT_PRESETS.map((p) => p.key));
  const nextFont = validKeys.has(fontKey) ? fontKey : "auto";

  if (nextFont === "auto") {
    document.body.removeAttribute("data-ui-font");
  } else {
    document.body.setAttribute("data-ui-font", nextFont);
  }

  if (typeof prefs === "object" && prefs) {
    prefs.uiFont = nextFont;
    if (persist) {
      localStorage.setItem("prefs", JSON.stringify(prefs));
    }
  }
  return nextFont;
}

function handleSearch() {
  clearSearchBtn.style.display = searchInput.value ? "flex" : "none";
  filterPujianList();
}

function clearSearch() {
  searchInput.value = "";
  searchInput.focus();
  handleSearch();
}

function filterPujianList() {
  const query = searchInput.value.trim().toLowerCase();
  const keywords = query.split(/\s+/).filter(Boolean);
  const listElement = document.getElementById("pujian-list");
  if (!listElement) return;

  Array.from(listElement.children).forEach((li) => {
    const nomor = li.dataset.nomor || "";
    const judul = li.dataset.judul || "";
    const isMatch = keywords.every((kw) => nomor.includes(kw) || judul.includes(kw));
    li.style.display = isMatch ? "flex" : "none";
  });
  fitListTitles();
}

function handleSettingsChange(e) {
  const targetId = e.target.id;
  if (targetId === "dark-theme-toggle") {
    const wantDark = e.target.checked;
    document.body.classList.toggle("dark-theme", wantDark);
    // On dark-scheme devices, force light theme when user explicitly disables dark mode
    if (!wantDark) {
      document.body.classList.add("light-theme-forced");
    } else {
      document.body.classList.remove("light-theme-forced");
      // Ensure dark-theme class is set even if previously relying on OS preference
      document.body.classList.add("dark-theme");
    }
    localStorage.setItem("dark-theme", wantDark ? "1" : "0");
    syncHeaderBranding();
  } else if (targetId === "default-two-page-toggle") {
    prefs.defaultTwoPage = e.target.checked;
    if (e.target.checked) {
      prefs.defaultVerticalScroll = false;
      document.getElementById("default-vertical-scroll-toggle").checked = false;
    }
    localStorage.setItem("prefs", JSON.stringify(prefs));
  } else if (targetId === "default-vertical-scroll-toggle") {
    prefs.defaultVerticalScroll = e.target.checked;
    if (e.target.checked) {
      prefs.defaultTwoPage = false;
      document.getElementById("default-two-page-toggle").checked = false;
    }
    localStorage.setItem("prefs", JSON.stringify(prefs));
  } else if (targetId === "prefer-natural-chords-toggle") {
    prefs.preferNaturalChords = e.target.checked;
    localStorage.setItem("prefs", JSON.stringify(prefs));
  } else if (targetId === "preload-enabled-toggle") {
    prefs.preloadEnabled = e.target.checked;
    localStorage.setItem("prefs", JSON.stringify(prefs));
    var countRange = document.getElementById("preload-count-range");
    var cacheMaxRange = document.getElementById("preload-cache-max-range");
    var shuffleToggle = document.getElementById("preload-shuffle-toggle");
    if (countRange) countRange.disabled = !e.target.checked;
    if (cacheMaxRange) cacheMaxRange.disabled = !e.target.checked;
    if (shuffleToggle) shuffleToggle.disabled = !e.target.checked;
  } else if (targetId === "preload-count-range") {
    prefs.preloadCount = Number.parseInt(e.target.value, 10);
    localStorage.setItem("prefs", JSON.stringify(prefs));
    var countLabel = document.getElementById("preload-count-label");
    if (countLabel) {
      countLabel.innerHTML = '<span class="material-symbols-outlined">queue_music</span><span>Jumlah Preload (' + prefs.preloadCount + ' lagu sebelum &amp; sesudah)</span>';
    }
  } else if (targetId === "preload-cache-max-range") {
    prefs.preloadCacheMax = Number.parseInt(e.target.value, 10) || 12;
    localStorage.setItem("prefs", JSON.stringify(prefs));
    var cacheMaxLabel = document.getElementById("preload-cache-max-label");
    if (cacheMaxLabel) {
      cacheMaxLabel.innerHTML = '<span class="material-symbols-outlined">inventory_2</span><span>Maksimum Cache Preload (' + prefs.preloadCacheMax + ' lagu)</span>';
    }
    if (typeof MidiEngine !== 'undefined' && typeof MidiEngine.setPreloadCacheMax === 'function') {
      MidiEngine.setPreloadCacheMax(prefs.preloadCacheMax);
    }
  } else if (targetId === "preload-shuffle-toggle") {
    prefs.preloadShuffle = e.target.checked;
    localStorage.setItem("prefs", JSON.stringify(prefs));
  } else if (targetId === "soundfont-select") {
    var nextSf = (typeof normalizeSoundfontKey === 'function')
      ? normalizeSoundfontKey(e.target.value)
      : e.target.value;
    var requestId = ++soundfontSwitchRequestId;
    var previousInstrument = String((prefs && prefs.midiInstrument) || '');

    prefs.midiSoundfont = nextSf;
    if (!prefs.midiInstrumentBySoundfont || typeof prefs.midiInstrumentBySoundfont !== 'object') {
      prefs.midiInstrumentBySoundfont = {};
    }
    if (typeof resolveSoundfontInstrumentProgram === 'function') {
      prefs.midiInstrument = resolveSoundfontInstrumentProgram(nextSf, prefs.midiInstrumentBySoundfont[nextSf] || '');
    }
    if (e.target.value !== nextSf) e.target.value = nextSf;
    localStorage.setItem("prefs", JSON.stringify(prefs));

    isSoundfontSwitching = true;
    document
      .querySelectorAll(".instrument-selector-wrapper.is-open")
      .forEach(function (wrapper) {
        wrapper.classList.remove("is-open");
        var capBtn = wrapper.querySelector(".instrument-capsule-btn, .tempo-popover-toggle");
        if (capBtn) capBtn.setAttribute("aria-expanded", "false");
      });

    if (typeof MidiEngine !== "undefined" && MidiEngine.changeSoundFont) {
      MidiEngine.changeSoundFont(nextSf)
        .then(function () {
          if (requestId !== soundfontSwitchRequestId) return;
          // Re-sync once the new SoundFont is fully loaded.
          if (typeof rebuildInstrumentSelectors === 'function') {
            rebuildInstrumentSelectors(nextSf);
          }
          isSoundfontSwitching = false;
          if (
            typeof changeInstrument === 'function' &&
            typeof MidiEngine !== 'undefined' &&
            MidiEngine.getCurrentMidiUrl() &&
            String(prefs.midiInstrument || '') !== String(previousInstrument)
          ) {
            return changeInstrument();
          }
        })
        .catch(function (err) {
          if (requestId !== soundfontSwitchRequestId) return;
          isSoundfontSwitching = false;
          console.warn('Gagal ganti SoundFont:', err);
          if (typeof showToast === 'function') {
            showToast('Gagal memuat SoundFont baru', 'error');
          }
        });
    } else {
      if (typeof rebuildInstrumentSelectors === 'function') {
        rebuildInstrumentSelectors(nextSf);
      }
      isSoundfontSwitching = false;
    }
  } else if (targetId === "chord-fill-select") {
    chordUiPrefs.fill = e.target.value;
    persistChordUiPrefs();
    rerenderViewerIfActive();
  } else if (targetId === "chord-sync-theme-toggle") {
    chordUiPrefs.syncThemeWithAccent = e.target.checked;
    persistChordUiPrefs();
    const palette = document.querySelector(".chord-theme-palette");
    if (palette) {
      if (chordUiPrefs.syncThemeWithAccent) palette.classList.add("is-disabled");
      else palette.classList.remove("is-disabled");
    }
    rerenderViewerIfActive();
  } else if (targetId === "chord-sync-fill-toggle") {
    chordUiPrefs.syncFillWithAccent = e.target.checked;
    persistChordUiPrefs();
    const palette = document.querySelector(".chord-fill-palette");
    if (palette) {
      if (chordUiPrefs.syncFillWithAccent) palette.classList.add("is-disabled");
      else palette.classList.remove("is-disabled");
    }
    rerenderViewerIfActive();
  } else if (targetId === "custom-accent-input") {
    customAccentColor = e.target.value || DEFAULT_CUSTOM_ACCENT;
    document.documentElement.style.setProperty("--source-custom", customAccentColor);
    localStorage.setItem(ACCENT_CUSTOM_COLOR_KEY, customAccentColor);

    const currentAccent = document.body.getAttribute("data-accent");
    if (currentAccent !== "custom") {
      applyAccentSelection("custom");
    }

    const customAccentBtn = document.querySelector('.accent-color[data-color="custom"]');
    const accentPalette = customAccentBtn?.parentElement;
    accentPalette?.querySelector(".selected")?.classList.remove("selected");
    customAccentBtn?.classList.add("selected");

    if (chordUiPrefs.syncThemeWithAccent || chordUiPrefs.syncFillWithAccent) {
      rerenderViewerIfActive();
    }
  } else if (targetId === "chord-font-override") {
    chordUiPrefs.fontOverridePercent = Number.parseInt(e.target.value, 10);
    persistChordUiPrefs();
    rerenderViewerIfActive();
    updateChordSettingsLabels();
  } else if (targetId === "chord-fill-opacity") {
    chordUiPrefs.fillOpacityPercent = Number.parseInt(e.target.value, 10);
    persistChordUiPrefs();
    rerenderViewerIfActive();
    updateChordSettingsLabels();
  } else if (targetId === "chord-fill-padding") {
    chordUiPrefs.fillPaddingPercent = Number.parseInt(e.target.value, 10);
    persistChordUiPrefs();
    rerenderViewerIfActive();
    updateChordSettingsLabels();
  }
}

function persistChordUiPrefs() {
  localStorage.setItem(CHORD_UI_STORAGE_KEY, JSON.stringify(chordUiPrefs));
}

function rerenderViewerIfActive() {
  if (!document.body.classList.contains("viewer-active") || !pdfDoc) return;
  renderPage(currentPageNum);
}

function updateChordSettingsLabels() {
  const overrideLabel = document.getElementById("chord-font-override-label");
  if (overrideLabel) {
    const labelText = overrideLabel.querySelector("span:last-child");
    if (labelText) {
      labelText.textContent = `Ukuran Font Chord (${chordUiPrefs.fontOverridePercent}%)`;
    }
  }
  const opacityLabel = document.getElementById("chord-opacity-label");
  if (opacityLabel) {
    const opacityText = opacityLabel.querySelector("span:last-child");
    if (opacityText) {
      opacityText.textContent = `Opacity Latar Chord (${chordUiPrefs.fillOpacityPercent}%)`;
    }
  }
  const paddingLabel = document.getElementById("chord-fill-padding-label");
  if (paddingLabel) {
    const paddingText = paddingLabel.querySelector("span:last-child");
    if (paddingText) {
      paddingText.textContent = `Padding Chord (${chordUiPrefs.fillPaddingPercent}%)`;
    }
  }
}

// --- Toggle Hide Chord ---
function onToggleChordsHidden() {
  chordsHidden = !chordsHidden;
  document.querySelectorAll(".chord-layer").forEach((layer) => {
    layer.classList.toggle("is-hidden", chordsHidden);
  });
  updateHideChordButton();
}

function updateHideChordButton() {
  // Show button only when viewer is active and there are chord pages (either format)
  const hasOldChords = chordConfig && Object.keys(chordConfig.pages).length > 0;
  const hasNewChords = typeof hasNoteAlignedChords === "function" && hasNoteAlignedChords();
  const shouldShow = document.body.classList.contains("viewer-active") && (hasOldChords || hasNewChords);

  hideChordBtns.forEach((btn) => {
    btn.style.display = shouldShow ? "" : "none";
    const icon = btn.querySelector(".material-symbols-outlined");
    if (icon) {
      icon.textContent = chordsHidden ? "music_off" : "music_note";
    }
    btn.setAttribute("aria-label", chordsHidden ? "Tampilkan chord" : "Sembunyikan chord");
  });
}

function applyStoredPreferences() {
  const darkPref = localStorage.getItem("dark-theme");
  if (darkPref === "1") {
    document.body.classList.add("dark-theme");
    document.body.classList.remove("light-theme-forced");
  } else if (darkPref === "0") {
    document.body.classList.remove("dark-theme");
    // Explicitly chose light mode — force it on dark-scheme devices
    document.body.classList.add("light-theme-forced");
  }
  // If darkPref is null (never set), respect OS preference (no classes added)

  const storedAccent = localStorage.getItem("accent") || "gold";
  customAccentColor = localStorage.getItem(ACCENT_CUSTOM_COLOR_KEY) || DEFAULT_CUSTOM_ACCENT;
  document.documentElement.style.setProperty("--source-custom", customAccentColor);
  applyAccentSelection(storedAccent);

  try {
    const storedPrefs = localStorage.getItem("prefs");
    if (storedPrefs) {
      prefs = { ...prefs, ...JSON.parse(storedPrefs) };
    }
    const validColorSchemeKeys = new Set(COLOR_SCHEME_PRESETS.map((item) => item.key));
    const validUiStyleKeys = new Set(UI_STYLE_PRESETS.map((item) => item.key));
    const validLayoutStyleKeys = new Set(LAYOUT_STYLE_PRESETS.map((item) => item.key));
    if (!validColorSchemeKeys.has(prefs.colorScheme)) {
      prefs.colorScheme = COLOR_SCHEME_PRESETS[0]?.key || "warm";
    }
    if (!validUiStyleKeys.has(prefs.uiStyle)) {
      prefs.uiStyle = UI_STYLE_PRESETS[0]?.key || "sanctuary";
    }
    if (!validLayoutStyleKeys.has(prefs.layoutStyle)) {
      prefs.layoutStyle = LAYOUT_STYLE_PRESETS[0]?.key || "balanced";
    }
    applyColorSchemeSelection(prefs.colorScheme, false);
    applyUiStyleSelection(prefs.uiStyle, false);
    applyLayoutStyleSelection(prefs.layoutStyle, false);
    if (FONT_PRESETS && prefs.uiFont) {
      const validFontKeys = new Set(FONT_PRESETS.map((item) => item.key));
      if (!validFontKeys.has(prefs.uiFont)) prefs.uiFont = "auto";
      applyFontSelection(prefs.uiFont, false);
    }
    if (!prefs.midiInstrumentBySoundfont || typeof prefs.midiInstrumentBySoundfont !== 'object') {
      prefs.midiInstrumentBySoundfont = {};
    }
    if (!Number.isFinite(Number(prefs.preloadCacheMax)) || Number(prefs.preloadCacheMax) < 1) {
      prefs.preloadCacheMax = 12;
    }
    // Canonicalize stored soundfont URL/path to a known key.
    if (prefs.midiSoundfont) {
      var normalizedSf = (typeof normalizeSoundfontKey === 'function')
        ? normalizeSoundfontKey(prefs.midiSoundfont)
        : prefs.midiSoundfont;
      if (prefs.midiSoundfont !== normalizedSf) {
        prefs.midiSoundfont = normalizedSf;
      }
      var rememberedInstrument = prefs.midiInstrumentBySoundfont[prefs.midiSoundfont];
      if (rememberedInstrument != null && String(rememberedInstrument) !== '') {
        prefs.midiInstrument = String(rememberedInstrument);
      } else if (prefs.midiInstrument != null && String(prefs.midiInstrument) !== '') {
        prefs.midiInstrument = String(prefs.midiInstrument);
        prefs.midiInstrumentBySoundfont[prefs.midiSoundfont] = prefs.midiInstrument;
      } else {
        prefs.midiInstrument = '';
      }
      prefs.midiInstrumentUserSelected = String(prefs.midiInstrument || '') !== '';
      localStorage.setItem('prefs', JSON.stringify(prefs));
    }
    if (typeof MidiEngine !== 'undefined' && typeof MidiEngine.setPreloadCacheMax === 'function') {
      MidiEngine.setPreloadCacheMax(prefs.preloadCacheMax || 12);
    }
  } catch (error) {
    console.error("Gagal memuat preferensi:", error);
    localStorage.removeItem("prefs");
    applyColorSchemeSelection(COLOR_SCHEME_PRESETS[0]?.key || "warm", false);
    applyUiStyleSelection(UI_STYLE_PRESETS[0]?.key || "sanctuary", false);
    applyLayoutStyleSelection(LAYOUT_STYLE_PRESETS[0]?.key || "balanced", false);
  }

  syncHeaderBranding();

  try {
    const storedChordUi = localStorage.getItem(CHORD_UI_STORAGE_KEY);
    if (storedChordUi) {
      const parsed = JSON.parse(storedChordUi);
      const validThemeKeys = new Set(CHORD_THEME_PRESETS.map((item) => item.key));
      const validFillKeys = new Set(CHORD_FILL_PRESETS.map((item) => item.key));
      chordUiPrefs = {
        ...chordUiPrefs,
        ...parsed,
        theme: validThemeKeys.has(parsed.theme) ? parsed.theme : chordUiPrefs.theme,
        fillColor: validFillKeys.has(parsed.fillColor) ? parsed.fillColor : chordUiPrefs.fillColor,
        fontOverridePercent: Number.isFinite(Number(parsed.fontOverridePercent))
          ? Number(parsed.fontOverridePercent)
          : chordUiPrefs.fontOverridePercent,
        fillOpacityPercent: Number.isFinite(Number(parsed.fillOpacityPercent))
          ? Number(parsed.fillOpacityPercent)
          : chordUiPrefs.fillOpacityPercent,
        syncThemeWithAccent: parsed.syncThemeWithAccent === true,
        syncFillWithAccent: parsed.syncFillWithAccent === true
      };
    }
  } catch (error) {
    console.error("Gagal memuat preferensi tampilan chord:", error);
    localStorage.removeItem(CHORD_UI_STORAGE_KEY);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init, { once: true });
} else {
  init();
}
