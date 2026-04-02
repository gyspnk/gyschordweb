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
    checkLayoutCollisions();
    syncTransposeCollapseState();
    fitViewerTitle();
    fitListTitles();
  }, 100);
}

function checkLayoutCollisions() {
  if (!document.body.classList.contains('viewer-active')) return;

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

    if (header.clientWidth < (fixedWidth + buffer)) {
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

    if (footer.clientWidth < (footerRequiredWidth + buffer)) {
      layoutFits = false;
    }
  }

  document.body.classList.remove('measure-layout');

  // Only use expanded layout in landscape — in portrait, landscape-controls are hidden
  // so there's nowhere to show the inline MIDI or transpose controls.
  if (layoutFits && window.matchMedia('(orientation: landscape)').matches) {
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
  const isPortrait = window.innerHeight > window.innerWidth;
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
  // re-decoding and re-rendering — avoids main-thread jank that dips the audio.
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



