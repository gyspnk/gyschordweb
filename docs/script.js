/**
 * Kidung Rohani App - PDF Viewer + Chord Overlay Editor
 *
 * Fitur utama:
 * - Zoom tombol, blokir zoom global selain di viewer.
 * - Chord editor hidden activator: judul 10x aktif, 5x nonaktif.
 * - Overlay chord sinkron di mode single/double/vertical + saat zoom.
 * - Konfigurasi chord disimpan ke TXT (format JSON) dan auto-load per nama file PDF.
 */

if (!Map.prototype.getOrInsertComputed) {
  Object.defineProperty(Map.prototype, "getOrInsertComputed", {
    value(key, callback) {
      if (this.has(key)) return this.get(key);
      const value = callback(key);
      this.set(key, value);
      return value;
    },
    writable: true,
    configurable: true
  });
}

if (!Map.prototype.getOrInsert) {
  Object.defineProperty(Map.prototype, "getOrInsert", {
    value(key, value) {
      if (this.has(key)) return this.get(key);
      this.set(key, value);
      return value;
    },
    writable: true,
    configurable: true
  });
}

if (!WeakMap.prototype.getOrInsertComputed) {
  Object.defineProperty(WeakMap.prototype, "getOrInsertComputed", {
    value(key, callback) {
      if (this.has(key)) return this.get(key);
      const value = callback(key);
      this.set(key, value);
      return value;
    },
    writable: true,
    configurable: true
  });
}

if (!WeakMap.prototype.getOrInsert) {
  Object.defineProperty(WeakMap.prototype, "getOrInsert", {
    value(key, value) {
      if (this.has(key)) return this.get(key);
      this.set(key, value);
      return value;
    },
    writable: true,
    configurable: true
  });
}

const { pdfjsLib } = globalThis;
pdfjsLib.GlobalWorkerOptions.workerSrc = "https://mozilla.github.io/pdf.js/build/pdf.worker.mjs";
pdfjsLib.verbosity = pdfjsLib.VerbosityLevel.ERRORS;

document.addEventListener("DOMContentLoaded", () => {
  const CHORD_GRID = { cols: 105, rows: 149 };
  const EDITOR_STORAGE_KEY = "chord-editor-enabled";
  const CHORD_UI_STORAGE_KEY = "chord-ui-prefs";
  const CHORD_ACCIDENTAL_STORAGE_KEY = "chord-accidental-mode";
  const EDITOR_ON_TAPS = 10;
  const EDITOR_OFF_TAPS = 5;
  const CHORD_COLLAPSE_STORAGE_KEY = "chord-editor-collapsed";
  const NOTE_NAMES_SHARP = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const NOTE_NAMES_FLAT = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
  const NATURAL_NOTE_INDEX = {
    C: 0,
    D: 2,
    E: 4,
    F: 5,
    G: 7,
    A: 9,
    B: 11
  };
  const NUMBER_TO_NOTE = {
    1: "C",
    2: "D",
    3: "E",
    4: "F",
    5: "G",
    6: "A",
    7: "B"
  };

  // --- 1. DOM ---
  const mainContent = document.getElementById("main-content");
  const pujianBtn = document.getElementById("pujian-btn");
  const pengaturanBtn = document.getElementById("pengaturan-btn");
  const searchContainer = document.getElementById("search-container");
  const searchInput = document.getElementById("search-input");
  const clearSearchBtn = document.getElementById("clear-search");

  const pdfViewerOverlay = document.getElementById("pdf-viewer-overlay");
  const pdfViewerContent = document.querySelector(".pdf-viewer-content");
  const pdfViewerFooter = document.querySelector(".pdf-viewer-footer");
  const songTitleWrapper = document.querySelector(".song-title-wrapper");
  const pdfViewerTitle = document.getElementById("pdf-viewer-title");
  const pdfViewerNumber = document.getElementById("pdf-viewer-number");
  let canvasWrapper = document.querySelector(".canvas-wrapper");
  const pdfViewerCloseBtn = document.getElementById("pdf-viewer-close");

  const pageNavigationPortrait = document.querySelector(".pdf-viewer-footer .page-navigation");
  const pageNavigationLandscape = document.querySelector(".landscape-controls .page-navigation-landscape");

  const prevSongBtn = document.getElementById("song-prev");
  const nextSongBtn = document.getElementById("song-next");

  const viewModeBtnPortrait = document.getElementById("view-mode-portrait");
  const scrollModeBtnPortrait = document.getElementById("scroll-mode-portrait");
  const viewModeBtnLandscape = document.getElementById("view-mode-landscape");
  const scrollModeBtnLandscape = document.getElementById("scroll-mode-landscape");

  const prevPageBtnPortrait = document.getElementById("pdf-prev-portrait");
  const nextPageBtnPortrait = document.getElementById("pdf-next-portrait");
  const zoomInBtnPortrait = document.getElementById("zoom-in-portrait");
  const zoomOutBtnPortrait = document.getElementById("zoom-out-portrait");
  const pageNumElPortrait = document.getElementById("page-num-portrait");
  const pageCountElPortrait = document.getElementById("page-count-portrait");
  const zoomLevelIndicatorPortrait = document.getElementById("zoom-level-indicator-portrait");

  const prevPageBtnLandscape = document.getElementById("pdf-prev-landscape");
  const nextPageBtnLandscape = document.getElementById("pdf-next-landscape");
  const zoomInBtnLandscape = document.getElementById("zoom-in-landscape");
  const zoomOutBtnLandscape = document.getElementById("zoom-out-landscape");
  const pageNumElLandscape = document.getElementById("page-num-landscape");
  const pageCountElLandscape = document.getElementById("page-count-landscape");
  const zoomLevelIndicatorLandscape = document.getElementById("zoom-level-indicator-landscape");

  const viewerLoader = pdfViewerOverlay.querySelector(".loader");
  const orientationWarning = document.getElementById("orientation-warning");
  const zoomToast = document.getElementById("zoom-toast");
  const zoomToastIcon = zoomToast.querySelector(".material-symbols-outlined");

  const chordEditorToolbar = document.getElementById("chord-editor-toolbar");
  const chordEditorToggleBtn = document.getElementById("chord-editor-toggle-btn");
  const chordSaveBtn = document.getElementById("chord-save-btn");
  const transposeCollapse = document.getElementById("transpose-collapse");
  const transposeToggleBtn = document.getElementById("transpose-toggle-btn");
  const transposeDownBtns = Array.from(document.querySelectorAll(".transpose-down-btn"));
  const transposeUpBtns = Array.from(document.querySelectorAll(".transpose-up-btn"));
  const transposeIndicators = Array.from(document.querySelectorAll(".transpose-indicator"));
  const accidentalSwitchBtns = Array.from(document.querySelectorAll(".transpose-accidental-btn"));

  // --- 2. State ---
  let pujianItems = [];
  let pdfDoc = null;
  let currentPageNum = 1;
  let currentSongIndex = -1;
  let currentScale = "page-fit";
  let initialScale = 1.0;

  let currentViewMode = "single";
  let currentScrollMode = "horizontal";

  let prefs = {
    defaultTwoPage: false,
    defaultVerticalScroll: false
  };

  let chordUiPrefs = {
    theme: "default",
    fill: "soft",
    fillColor: "sky",
    baseFontRem: 0.72,
    fontOverridePercent: 100
  };

  let initialPinchDistance = 0;
  let toastTimeout = null;

  let chordEditorEnabled = false;
  let chordConfig = createDefaultChordConfig();
  let titleTapCount = 0;
  let titleTapTimer = null;
  let transposeStep = 0;
  let accidentalMode = localStorage.getItem(CHORD_ACCIDENTAL_STORAGE_KEY) === "flat" ? "flat" : "sharp";
  let swipeStartPoint = null;
  let lastSwipeHandledAt = 0;
  let pinchState = null;
  let renderRequestId = 0;
  let zoomInProgress = false;
  let zoomDeferInsert = false;
  let chordEditorCollapsed = localStorage.getItem(CHORD_COLLAPSE_STORAGE_KEY) === "1";
  let chordsHidden = false;

  // --- 3. Init ---
  function init() {
    applyStoredPreferences();
    setupEventListeners();
    setupRippleEffect();
    updateChordEditorUI();
    updateTransposeUI();
    syncTransposeCollapseState();
    updateHideChordButton();
    navigateTo("pujian");
  }

  // --- 4. Event Listeners ---
  function setupEventListeners() {
    pujianBtn.addEventListener("click", () => navigateTo("pujian"));
    pengaturanBtn.addEventListener("click", () => navigateTo("pengaturan"));
    searchInput.addEventListener("input", handleSearch);
    clearSearchBtn.addEventListener("click", clearSearch);
    mainContent.addEventListener("click", handleMainContentClick);
    mainContent.addEventListener("change", handleSettingsChange);
    mainContent.addEventListener("input", handleSettingsChange);

    pdfViewerCloseBtn.addEventListener("click", closePdfViewer);

    prevSongBtn.addEventListener("click", onPrevSong);
    nextSongBtn.addEventListener("click", onNextSong);

    [viewModeBtnPortrait, viewModeBtnLandscape].forEach((btn) => btn.addEventListener("click", onToggleViewMode));
    [scrollModeBtnPortrait, scrollModeBtnLandscape].forEach((btn) => btn.addEventListener("click", onToggleScrollMode));

    [prevPageBtnPortrait, prevPageBtnLandscape].forEach((btn) => btn.addEventListener("click", onPrevPage));
    [nextPageBtnPortrait, nextPageBtnLandscape].forEach((btn) => btn.addEventListener("click", onNextPage));
    [zoomInBtnPortrait, zoomInBtnLandscape].forEach((btn) => btn.addEventListener("click", () => onZoom("in")));
    [zoomOutBtnPortrait, zoomOutBtnLandscape].forEach((btn) => btn.addEventListener("click", () => onZoom("out")));

    chordSaveBtn.addEventListener("click", saveChordConfigurationFile);
    if (chordEditorToggleBtn) {
      chordEditorToggleBtn.addEventListener("click", onToggleChordEditorCollapse);
    }
    transposeDownBtns.forEach((btn) => btn.addEventListener("click", () => onTranspose(-1)));
    transposeUpBtns.forEach((btn) => btn.addEventListener("click", () => onTranspose(1)));
    accidentalSwitchBtns.forEach((btn) => btn.addEventListener("click", onToggleAccidentalMode));
    if (transposeToggleBtn) {
      transposeToggleBtn.addEventListener("click", onToggleTransposeCollapse);
    }
    canvasWrapper.addEventListener("click", onChordLayerClick);
    document.addEventListener("click", onGlobalDocumentClick);

    const hideChordBtn = document.getElementById("hide-chord-btn");
    if (hideChordBtn) {
      hideChordBtn.addEventListener("click", onToggleChordsHidden);
    }

    pdfViewerTitle.addEventListener("click", handleTitleActivatorTap);

    if (screen.orientation) {
      screen.orientation.addEventListener("change", handleOrientationChange);
    } else {
      window.addEventListener("orientationchange", handleOrientationChange);
    }

    window.addEventListener("wheel", handleGlobalScroll, { passive: false });
    window.addEventListener("keydown", handleGlobalKeydown, { passive: false });

    // Scope pinch handlers to the viewer only to avoid conflicts with global/browser gestures.
    pdfViewerContent.addEventListener("touchstart", handleTouchStart, { passive: true });
    pdfViewerContent.addEventListener("touchmove", handleTouchMove, { passive: false });
    pdfViewerContent.addEventListener("touchend", handleTouchEnd, { passive: true });

    pdfViewerContent.addEventListener("touchstart", handleViewerTouchStart, { passive: true });
    pdfViewerContent.addEventListener("touchend", handleViewerTouchEnd, { passive: true });
    pdfViewerContent.addEventListener("mousedown", handleViewerPointerStart);
    pdfViewerContent.addEventListener("mouseup", handleViewerPointerEnd);

    window.addEventListener("resize", onLayoutResize);
  }

  // --- 5. Navigasi utama ---
  function navigateTo(page) {
    [pujianBtn, pengaturanBtn].forEach((btn) => btn.classList.remove("selected"));
    document.querySelector(".app-header").style.display = "flex";

    if (page === "pujian") {
      pujianBtn.classList.add("selected");
      searchContainer.style.display = "flex";
      renderPujianList();
    } else if (page === "pengaturan") {
      pengaturanBtn.classList.add("selected");
      searchContainer.style.display = "none";
      renderSettings();
    }
  }

  function renderPujianList() {
    if (pujianItems.length > 0) {
      displayPujian(pujianItems);
      return;
    }

    fetch("assets-list.json")
      .then((response) => (response.ok ? response.json() : Promise.reject("Gagal memuat daftar pujian")))
      .then((files) => {
        if (!Array.isArray(files)) {
          throw new Error("Format data tidak valid");
        }
        pujianItems = files.map((file, index) => {
          const rawName = decodeURIComponent(file.replace(".pdf", ""));
          const match = rawName.match(/^([0-9A-Za-z]+)[_.\s]*(.*)$/);
          return {
            id: index,
            nomor: match ? match[1] : "?",
            judul: match ? match[2].replace(/_/g, " ") : rawName.replace(/_/g, " "),
            fileHref: `assets/${file}`
          };
        });
        displayPujian(pujianItems);
      })
      .catch((error) => {
        console.error("Error memuat daftar pujian:", error);
        mainContent.innerHTML = '<p class="welcome-text">Gagal memuat daftar pujian.</p>';
      });
  }

  function displayPujian(items) {
    mainContent.innerHTML = `
      <ul class="pujian-list" id="pujian-list">
        ${items
          .map(
            (item) => `
          <li data-id="${item.id}" data-nomor="${item.nomor.toLowerCase()}" data-judul="${item.judul.toLowerCase()}">
            <span class="pujian-nomor">${item.nomor}</span>
            <a href="${item.fileHref}" class="pujian-title">${item.judul}</a>
          </li>
        `
          )
          .join("")}
      </ul>`;
    filterPujianList();
    fitListTitles();
  }

  function renderSettings() {
    mainContent.innerHTML = `
      <div class="settings-panel">
        <h2>Tampilan</h2>
        <div class="setting-item">
          <span>Tema Gelap</span>
          <label class="md-switch">
            <input type="checkbox" id="dark-theme-toggle" ${document.body.classList.contains("dark-theme") ? "checked" : ""}>
            <span class="md-slider"></span>
          </label>
        </div>
        <div class="setting-item">
          <span>Warna Aksen</span>
          <div class="accent-palette">
            ${[
              "biru",
              "merah",
              "hijau",
              "kuning",
              "ungu",
              "pink",
              "birutua",
              "teal",
              "oranye",
              "coklat",
              "abu",
              "indigo",
              "cyan",
              "lime",
              "deep-orange"
            ]
              .map(
                (color) => `
              <button class="accent-color ${document.body.getAttribute("data-accent") === color ? "selected" : ""}" data-color="${color}" title="${
                  color.charAt(0).toUpperCase() + color.slice(1)
                }"></button>
            `
              )
              .join("")}
          </div>
        </div>
        <h2>Viewer Default</h2>
        <div class="setting-item">
          <span>Mode Dua Halaman</span>
          <label class="md-switch">
            <input type="checkbox" id="default-two-page-toggle" ${prefs.defaultTwoPage ? "checked" : ""}>
            <span class="md-slider"></span>
          </label>
        </div>
        <div class="setting-item">
          <span>Scroll Vertikal</span>
          <label class="md-switch">
            <input type="checkbox" id="default-vertical-scroll-toggle" ${prefs.defaultVerticalScroll ? "checked" : ""}>
            <span class="md-slider"></span>
          </label>
        </div>
        <h2>Tampilan Chord</h2>
        <div class="setting-item">
          <span>Tema Huruf Chord</span>
          <div class="chord-theme-palette">
            ${[
              { key: "default", label: "Biru" },
              { key: "warm", label: "Warm" },
              { key: "ocean", label: "Ocean" },
              { key: "mono", label: "Mono" },
              { key: "emerald", label: "Emerald" },
              { key: "plum", label: "Plum" }
            ]
              .map(
                (theme) => `
              <button
                class="chord-theme-color ${chordUiPrefs.theme === theme.key ? "selected" : ""}"
                data-chord-theme="${theme.key}"
                title="${theme.label}"
                aria-label="Tema chord ${theme.label}"
                type="button"
              ></button>
            `
              )
              .join("")}
          </div>
        </div>
        <div class="setting-item">
          <span>Fill Chord</span>
          <select id="chord-fill-select" class="setting-select">
            <option value="none" ${chordUiPrefs.fill === "none" ? "selected" : ""}>Tanpa Fill</option>
            <option value="soft" ${chordUiPrefs.fill === "soft" ? "selected" : ""}>Soft Rounded</option>
            <option value="solid" ${chordUiPrefs.fill === "solid" ? "selected" : ""}>Solid Rounded</option>
          </select>
        </div>
        <div class="setting-item">
          <span>Warna Fill Chord</span>
          <div class="chord-fill-palette">
            ${[
              { key: "sky", label: "Sky" },
              { key: "mint", label: "Mint" },
              { key: "rose", label: "Rose" },
              { key: "amber", label: "Amber" },
              { key: "lavender", label: "Lavender" },
              { key: "slate", label: "Slate" }
            ]
              .map(
                (fill) => `
              <button
                class="chord-fill-color ${chordUiPrefs.fillColor === fill.key ? "selected" : ""}"
                data-chord-fill-color="${fill.key}"
                title="${fill.label}"
                aria-label="Warna fill chord ${fill.label}"
                type="button"
              ></button>
            `
              )
              .join("")}
          </div>
        </div>
        <div class="setting-item setting-item-slider">
          <span id="chord-font-override-label">Ukuran Font Chord (${chordUiPrefs.fontOverridePercent}%)</span>
          <input
            id="chord-font-override"
            class="setting-range"
            type="range"
            min="80"
            max="180"
            step="5"
            value="${chordUiPrefs.fontOverridePercent}"
          >
        </div>
      </div>`;
  }

  // --- 6. PDF Viewer ---
  async function openPdfViewer(songId) {
    currentSongIndex = parseInt(songId, 10);
    const song = pujianItems[currentSongIndex];
    if (!song) return;

    viewerLoader.style.display = "block";

    songTitleWrapper.classList.add("is-navigating");
    canvasWrapper.classList.add("is-navigating");
    await new Promise((resolve) => setTimeout(resolve, 200));

    pdfViewerTitle.textContent = song.judul;
    pdfViewerNumber.textContent = `No. ${song.nomor}`;
    songTitleWrapper.classList.remove("is-navigating");
    fitViewerTitle();

    if (!document.body.classList.contains("viewer-active")) {
      document.body.classList.add("viewer-active");
    }

    currentScale = "page-fit";
    chordConfig = createDefaultChordConfig();

    // Reset transpose saat ganti lagu
    transposeStep = 0;
    updateTransposeUI();

    // Default: chord editor nonaktif setiap buka lagu
    chordEditorEnabled = false;
    updateChordEditorUI();

    const options = {
      url: song.fileHref,
      standardFontDataUrl: "https://mozilla.github.io/pdf.js/standard_fonts/"
    };

    try {
      pdfDoc = await pdfjsLib.getDocument(options).promise;
      [pageCountElPortrait, pageCountElLandscape].forEach((el) => {
        el.textContent = pdfDoc.numPages;
      });

      await loadChordConfigurationForSong(song);

      currentPageNum = 1;
      currentViewMode = pdfDoc.numPages > 1 && prefs.defaultTwoPage ? "double" : "single";
      currentScrollMode = prefs.defaultVerticalScroll ? "vertical" : "horizontal";

      updateViewerUI();
      updateHideChordButton();
      await renderPage(currentPageNum);
      updateSongNavButtons();
      fitViewerTitle();
      canvasWrapper.classList.remove("is-navigating");
    } catch (reason) {
      viewerLoader.style.display = "none";
      console.error(`Gagal memuat PDF: ${reason}`);
      alert("Gagal memuat PDF.");
      closePdfViewer();
    }
  }

  async function animateViewChange(renderFunction, duration = 150) {
    canvasWrapper.classList.add("is-navigating");
    await new Promise((resolve) => setTimeout(resolve, duration));
    if (renderFunction) await renderFunction();
    canvasWrapper.classList.remove("is-navigating");
  }

  function updateCenteringAndOverflow() {
    if (canvasWrapper.scrollHeight > pdfViewerContent.clientHeight) {
      pdfViewerContent.classList.remove("vertically-centered");
    } else {
      pdfViewerContent.classList.add("vertically-centered");
    }

    if (canvasWrapper.scrollWidth > pdfViewerContent.clientWidth) {
      pdfViewerContent.classList.add("is-overflowing");
    } else {
      pdfViewerContent.classList.remove("is-overflowing");
    }
  }

  async function renderPage(num) {
    if (!pdfDoc) return;
    const requestId = ++renderRequestId;
    const oldWrapper = canvasWrapper;
    const nextWrapper = document.createElement("div");
    nextWrapper.className = oldWrapper.className
      .replace(/\s*is-navigating/g, "")
      .replace(/\s*pinch-preview/g, "")
      .replace(/\s*zoom-animating/g, "")
      .replace(/\s*zoom-staging/g, "")
      .replace(/\s*zoom-staging-overlay/g, "")
      .replace(/\s*zoom-fading-in-soft/g, "")
      .replace(/\s*zoom-old-fading-out/g, "")
      .replace(/\s*zoom-crossfade-in/g, "")
      .replace(/\s*zoom-hold-fixed/g, "");

    const renderSinglePageTask = async (pageNumToRender, scaleToUse) => {
      const page = await pdfDoc.getPage(pageNumToRender);
      const dpr = window.devicePixelRatio || 1;
      const finalRenderScale = scaleToUse * dpr;
      const viewport = page.getViewport({ scale: finalRenderScale });

      const cssWidth = viewport.width / dpr;
      const cssHeight = viewport.height / dpr;

      const pageContainer = document.createElement("div");
      pageContainer.className = "pdf-page-container";
      pageContainer.dataset.pageNum = String(pageNumToRender);
      pageContainer.style.width = `${cssWidth}px`;
      pageContainer.style.height = `${cssHeight}px`;

      const canvas = document.createElement("canvas");
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      canvas.style.width = `${cssWidth}px`;
      canvas.style.height = `${cssHeight}px`;

      await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;

      const chordLayer = createChordLayer(pageNumToRender);
      pageContainer.appendChild(canvas);
      pageContainer.appendChild(chordLayer);

      return pageContainer;
    };

    if (currentScale === "page-fit") {
      const page1 = await pdfDoc.getPage(1);
      const viewport1 = page1.getViewport({ scale: 1 });
      let containerWidth = pdfViewerContent.clientWidth - 32;

      if (currentViewMode === "double" && pdfDoc.numPages > 1) {
        containerWidth = (containerWidth - 16) / 2;
      }

      const scaleX = containerWidth / viewport1.width;
      const scaleY = (pdfViewerContent.clientHeight - 32) / viewport1.height;
      initialScale = Math.min(scaleX, scaleY);
      currentScale = initialScale;
    }

    try {
      if (currentScrollMode === "vertical") {
        nextWrapper.classList.add("vertical-scroll");
        for (let i = 1; i <= pdfDoc.numPages; i += 1) {
          const pageContainer = await renderSinglePageTask(i, currentScale);
          nextWrapper.appendChild(pageContainer);
        }
      } else {
        nextWrapper.classList.remove("vertical-scroll");

        const page1 = await renderSinglePageTask(num, currentScale);
        nextWrapper.appendChild(page1);

        if (currentViewMode === "double" && num < pdfDoc.numPages) {
          const page2 = await renderSinglePageTask(num + 1, currentScale);
          nextWrapper.appendChild(page2);
        }
      }

      if (requestId !== renderRequestId) return;

      if (zoomDeferInsert) {
        // During zoom: DON'T insert into DOM. Keep wrapper detached.
        // The caller (applyScaleAndRerender) will handle insertion.
      } else {
        oldWrapper.replaceWith(nextWrapper);
      }

      canvasWrapper = nextWrapper;
      canvasWrapper.addEventListener("click", onChordLayerClick);
    } catch (error) {
      console.error("Gagal merender halaman:", error);
    } finally {
      viewerLoader.style.display = "none";
      updatePageIndicator(num);
      updatePageNavButtons();
      updateZoomIndicator();
      if (!zoomDeferInsert) {
        updateCenteringAndOverflow();
      }
    }
  }

  function onPrevPage() {
    if (currentPageNum <= 1) return;
    const step = currentViewMode === "double" ? 2 : 1;
    currentPageNum = Math.max(1, currentPageNum - step);
    animateViewChange(() => renderPage(currentPageNum));
  }

  function onNextPage() {
    if (currentPageNum >= pdfDoc.numPages) return;
    const step = currentViewMode === "double" ? 2 : 1;
    currentPageNum += step;
    animateViewChange(() => renderPage(currentPageNum));
  }

  async function onZoom(direction) {
    // Prevent zoom spam - only allow one zoom operation at a time
    if (!pdfDoc || zoomInProgress) return;
    
    try {
      zoomInProgress = true;
      
      if (currentScale === "page-fit") {
        currentScale = initialScale;
      }

      const percentStep = 25;
      const oldScale = currentScale;
      const currentPercent = (oldScale / initialScale) * 100;
      const minPercent = 100;
      const maxPercent = 800;

      let nextPercent = currentPercent;
      if (direction === "in") {
        nextPercent = Math.min(maxPercent, currentPercent + percentStep);
      } else {
        nextPercent = Math.max(minPercent, currentPercent - percentStep);
      }

      const newScale = initialScale * (nextPercent / 100);

      if (newScale === oldScale) return;

      const container = pdfViewerContent;
      const rect = container.getBoundingClientRect();
      const anchorClientX = rect.left + container.clientWidth / 2;
      const anchorClientY = rect.top + container.clientHeight / 2;

      await applyScaleAndRerender({
        oldScale,
        newScale,
        anchorClientX,
        anchorClientY,
        animatePreview: true
      });
    } finally {
      zoomInProgress = false;
    }
  }

  async function applyScaleAndRerender({ oldScale, newScale, anchorClientX, anchorClientY, animatePreview = false }) {
    const container = pdfViewerContent;
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;
    const rect = container.getBoundingClientRect();
    const localX = anchorClientX - rect.left;
    const localY = anchorClientY - rect.top;

    const zoomRatio = newScale / oldScale;
    const activeWrapper = canvasWrapper;

    // Compute anchor position relative to wrapper origin in document coordinates.
    const activeRect = activeWrapper.getBoundingClientRect();
    const wrapperBaseX = container.scrollLeft + (activeRect.left - rect.left);
    const wrapperBaseY = container.scrollTop + (activeRect.top - rect.top);
    const anchorWrapperX = container.scrollLeft + localX - wrapperBaseX;
    const anchorWrapperY = container.scrollTop + localY - wrapperBaseY;

    // --- Phase 1: Smooth CSS scale preview ---
    // This transform gives instant visual feedback while new content renders.
    if (animatePreview) {
      activeWrapper.classList.add("zoom-animating");
      activeWrapper.style.transformOrigin = `${anchorWrapperX}px ${anchorWrapperY}px`;
      activeWrapper.style.transform = `scale(${zoomRatio})`;
      await new Promise((resolve) => setTimeout(resolve, 150));
    }

    currentScale = newScale;
    updateZoomIndicator();

    // --- Phase 2: Render new content into a DETACHED element ---
    // The old wrapper (with CSS scale transform) stays visible in the DOM.
    // The new wrapper is rendered completely off-DOM, so no layout interference.
    zoomDeferInsert = true;
    try {
      await renderPage(currentPageNum);
    } finally {
      zoomDeferInsert = false;
    }
    const newWrapper = canvasWrapper; // renderPage sets this to the new detached wrapper

    if (newWrapper === activeWrapper || !newWrapper) {
      // Stale request — clean up preview
      activeWrapper.classList.remove("zoom-animating");
      activeWrapper.style.transform = "";
      activeWrapper.style.transformOrigin = "";
      updateCenteringAndOverflow();
      return;
    }

    // --- Phase 3: Atomic swap ---
    // All DOM mutations below are synchronous. The browser will NOT paint until
    // this synchronous block finishes, so the user sees a single-frame swap.

    // Remove CSS preview classes/styles from old wrapper (it's about to be replaced).
    activeWrapper.classList.remove("zoom-animating");
    activeWrapper.style.transform = "";
    activeWrapper.style.transformOrigin = "";

    // Swap: remove old, insert new.
    activeWrapper.replaceWith(newWrapper);

    // Update centering/overflow classes BEFORE measuring (affects layout).
    updateCenteringAndOverflow();

    // Force layout so we can measure the new wrapper's position.
    const freshRect = container.getBoundingClientRect();
    const newWrapperRect = newWrapper.getBoundingClientRect();
    const newBaseX = container.scrollLeft + (newWrapperRect.left - freshRect.left);
    const newBaseY = container.scrollTop + (newWrapperRect.top - freshRect.top);

    // Compute target scroll to keep the anchor point stable.
    const targetScrollX = newBaseX + anchorWrapperX * zoomRatio - localX;
    const targetScrollY = newBaseY + anchorWrapperY * zoomRatio - localY;

    const maxScrollX = Math.max(0, container.scrollWidth - containerWidth);
    const maxScrollY = Math.max(0, container.scrollHeight - containerHeight);
    container.scrollLeft = Math.min(Math.max(0, targetScrollX), maxScrollX);
    container.scrollTop = Math.min(Math.max(0, targetScrollY), maxScrollY);

    // All synchronous — browser paints this as one frame. Done.
    updateCenteringAndOverflow();
  }


  function onToggleViewMode() {
    if (!pdfDoc || pdfDoc.numPages <= 1) return;
    currentViewMode = currentViewMode === "single" ? "double" : "single";
    currentScrollMode = "horizontal";
    currentScale = "page-fit";
    updateViewerUI();
    animateViewChange(() => renderPage(currentPageNum));
  }

  function onToggleScrollMode() {
    if (!pdfDoc || pdfDoc.numPages <= 1) return;
    currentScrollMode = currentScrollMode === "horizontal" ? "vertical" : "horizontal";
    if (currentScrollMode === "vertical") {
      currentViewMode = "single";
    }
    currentScale = "page-fit";
    updateViewerUI();
    animateViewChange(() => renderPage(currentPageNum));
  }

  async function onPrevSong() {
    if (currentSongIndex > 0) {
      await openPdfViewer(currentSongIndex - 1);
    }
  }

  async function onNextSong() {
    if (currentSongIndex < pujianItems.length - 1) {
      await openPdfViewer(currentSongIndex + 1);
    }
  }

  function updateViewerUI() {
    const multiPage = pdfDoc && pdfDoc.numPages > 1;
    const singlePage = !pdfDoc || pdfDoc.numPages <= 1;
    const isVertical = currentScrollMode === "vertical";
    const hasPageNav = !(singlePage || isVertical);

    const viewButtons = [viewModeBtnPortrait, viewModeBtnLandscape];
    const scrollButtons = [scrollModeBtnPortrait, scrollModeBtnLandscape];

    viewButtons.forEach((btn) => {
      btn.style.display = multiPage ? "flex" : "none";
      btn.classList.toggle("active", currentViewMode === "double");
    });

    scrollButtons.forEach((btn) => {
      btn.style.display = multiPage ? "flex" : "none";
      btn.classList.toggle("active", currentScrollMode === "vertical");
    });

    pageNavigationPortrait.style.display = hasPageNav ? "flex" : "none";
    pageNavigationLandscape.style.display = hasPageNav ? "flex" : "none";
    if (pdfViewerFooter) {
      pdfViewerFooter.classList.toggle("has-page-nav", hasPageNav);
      pdfViewerFooter.classList.toggle("no-page-nav", !hasPageNav);
      pdfViewerFooter.classList.toggle("no-view-controls", !multiPage);
    }

    checkOrientation();
    updateChordEditorUI();
    updateTransposeUI();
  }

  // --- 7. Chord Overlay Logic ---
  function createDefaultChordConfig() {
    return {
      version: 1,
      grid: { ...CHORD_GRID },
      pages: {}
    };
  }

  function sanitizeChordConfig(rawConfig) {
    const safe = createDefaultChordConfig();
    if (!rawConfig || typeof rawConfig !== "object") return safe;

    if (rawConfig.grid && Number.isFinite(rawConfig.grid.cols) && Number.isFinite(rawConfig.grid.rows)) {
      safe.grid.cols = Math.max(1, Math.round(rawConfig.grid.cols));
      safe.grid.rows = Math.max(1, Math.round(rawConfig.grid.rows));
    }

    if (rawConfig.pages && typeof rawConfig.pages === "object") {
      Object.entries(rawConfig.pages).forEach(([pageKey, entries]) => {
        if (!Array.isArray(entries)) return;

        const validEntries = entries
          .map((entry) => ({
            row: Math.max(1, Math.min(safe.grid.rows, Number.parseInt(entry.row, 10) || 1)),
            col: Math.max(1, Math.min(safe.grid.cols, Number.parseInt(entry.col, 10) || 1)),
            text: typeof entry.text === "string" ? entry.text.trim() : ""
          }))
          .filter((entry) => entry.text.length > 0);

        if (validEntries.length > 0) {
          safe.pages[pageKey] = validEntries;
        }
      });
    }

    return safe;
  }

  async function loadChordConfigurationForSong(song) {
    chordConfig = createDefaultChordConfig();
    const txtUrl = getChordTxtUrl(song);

    try {
      const response = await fetch(txtUrl, { cache: "no-store" });
      if (!response.ok) return;

      const payload = await response.text();
      const parsed = JSON.parse(payload);
      chordConfig = sanitizeChordConfig(parsed);
    } catch {
      chordConfig = createDefaultChordConfig();
    }
  }

  function getChordTxtUrl(song) {
    return song.fileHref.replace(/\.pdf$/i, ".txt");
  }

  function getChordTxtFilename(song) {
    return decodeURIComponent(song.fileHref.split("/").pop() || "chord.txt").replace(/\.pdf$/i, ".txt");
  }

  function createChordLayer(pageNum) {
    const layer = document.createElement("div");
    layer.className = `chord-layer ${chordEditorEnabled ? "editor-mode show-grid" : "viewer-mode"}`;
    if (chordsHidden) layer.classList.add("is-hidden");
    layer.dataset.pageNum = String(pageNum);
    layer.style.setProperty("--grid-cols", String(chordConfig.grid.cols));
    layer.style.setProperty("--grid-rows", String(chordConfig.grid.rows));

    const entries = Array.isArray(chordConfig.pages[String(pageNum)]) ? chordConfig.pages[String(pageNum)] : [];
    entries.forEach((entry) => {
      layer.appendChild(createChordMarkerElement(entry));
    });

    return layer;
  }

  function createChordMarkerElement(entry) {
    const marker = document.createElement("span");
    marker.className = "chord-marker";
    marker.classList.add(`chord-theme-${chordUiPrefs.theme}`);
    marker.classList.add(`chord-fill-${chordUiPrefs.fill}`);
    marker.classList.add(`chord-fill-color-${chordUiPrefs.fillColor}`);
    marker.dataset.row = String(entry.row);
    marker.dataset.col = String(entry.col);
    marker.dataset.raw = entry.text;
    marker.textContent = formatChordForDisplay(entry.text);
    marker.style.setProperty("--chord-font-size", `${getChordFontSizeRem()}rem`);

    const xPercent = ((entry.col - 0.5) / chordConfig.grid.cols) * 100;
    const yPercent = ((entry.row - 0.5) / chordConfig.grid.rows) * 100;
    marker.style.left = `${xPercent}%`;
    marker.style.top = `${yPercent}%`;

    return marker;
  }

  function getChordFontSizeRem() {
    const ratio = getZoomRatio();
    const size = chordUiPrefs.baseFontRem * ratio * (chordUiPrefs.fontOverridePercent / 100);
    return Math.min(2.1, Math.max(0.6, size));
  }

  function getZoomRatio() {
    if (typeof currentScale !== "number" || !Number.isFinite(currentScale)) return 1;
    if (!Number.isFinite(initialScale) || initialScale <= 0) return 1;
    return currentScale / initialScale;
  }

  function onChordLayerClick(event) {
    if (!chordEditorEnabled || !pdfDoc || !document.body.classList.contains("viewer-active")) return;

    const marker = event.target.closest(".chord-marker");
    if (marker) {
      event.preventDefault();
      event.stopPropagation();

      const layer = marker.closest(".chord-layer");
      const pageNum = Number.parseInt(layer?.dataset.pageNum || "0", 10);
      const row = Number.parseInt(marker.dataset.row, 10);
      const col = Number.parseInt(marker.dataset.col, 10);
      const existing = marker.dataset.raw || "";

      promptAndSetChord(pageNum, row, col, existing);
      return;
    }

    const layer = event.target.closest(".chord-layer.editor-mode");
    if (!layer) return;

    const pageNum = Number.parseInt(layer.dataset.pageNum || "0", 10);
    if (!pageNum) return;

    const rect = layer.getBoundingClientRect();
    const relativeX = event.clientX - rect.left;
    const relativeY = event.clientY - rect.top;

    const col = Math.max(1, Math.min(chordConfig.grid.cols, Math.floor((relativeX / rect.width) * chordConfig.grid.cols) + 1));
    const row = Math.max(1, Math.min(chordConfig.grid.rows, Math.floor((relativeY / rect.height) * chordConfig.grid.rows) + 1));

    const existing = getChordAt(pageNum, row, col);
    promptAndSetChord(pageNum, row, col, existing);
  }

  function promptAndSetChord(pageNum, row, col, existingText = "") {
    const promptDefault = existingText || "";
    const userInput = window.prompt(
      "Masukkan chord (contoh: C, C#, Bb, Fdim, Aadd9).\nKosongkan untuk hapus chord di sel ini.",
      promptDefault
    );

    if (userInput === null) return;

    const encoded = encodeChordToken(userInput);
    if (encoded === null) {
      alert("Format chord tidak valid. Gunakan root A-G lalu optional #/b dan tag (dim, add9, dst).");
      return;
    }

    setChordAt(pageNum, row, col, encoded);
    renderPage(currentPageNum);
  }

  function encodeChordToken(input) {
    const raw = String(input || "").trim();
    if (!raw) return "";

    const match = raw.match(/^([A-Ga-g1-7])([#b♭]?)(.*)$/);
    if (!match) return null;

    const rootRaw = match[1];
    const accidentalRaw = match[2] || "";
    const suffix = (match[3] || "").trim();

    const rootLetter = /[1-7]/.test(rootRaw) ? NUMBER_TO_NOTE[rootRaw] : rootRaw.toUpperCase();
    const naturalIndex = NATURAL_NOTE_INDEX[rootLetter];
    if (!Number.isInteger(naturalIndex)) return null;

    const accidental = accidentalRaw === "♭" ? "b" : accidentalRaw;
    let semitone = naturalIndex;
    if (accidental === "#") semitone += 1;
    if (accidental === "b") semitone -= 1;

    const normalizedRoot = NOTE_NAMES_SHARP[wrapSemitone(semitone)];
    return `${normalizedRoot}${suffix}`;
  }

  function formatChordForDisplay(encodedToken) {
    const token = String(encodedToken || "").trim();
    const parsed = parseChordToken(token);
    if (!parsed) return token;

    const noteSet = accidentalMode === "flat" ? NOTE_NAMES_FLAT : NOTE_NAMES_SHARP;
    const transposed = wrapSemitone(parsed.semitone + transposeStep);
    return `${noteSet[transposed]}${parsed.suffix}`;
  }

  function parseChordToken(token) {
    const newFormat = token.match(/^([A-Ga-g])([#b]?)(.*)$/);
    if (newFormat) {
      const root = newFormat[1].toUpperCase();
      const accidental = newFormat[2] || "";
      const suffix = newFormat[3] || "";

      let semitone = NATURAL_NOTE_INDEX[root];
      if (!Number.isInteger(semitone)) return null;
      if (accidental === "#") semitone += 1;
      if (accidental === "b") semitone -= 1;

      return { semitone: wrapSemitone(semitone), suffix };
    }

    const legacyFormat = token.match(/^([1-7])([#b]?)(.*)$/);
    if (!legacyFormat) return null;

    const legacyRoot = NUMBER_TO_NOTE[legacyFormat[1]];
    let semitone = NATURAL_NOTE_INDEX[legacyRoot];
    const accidental = legacyFormat[2] || "";
    const suffix = legacyFormat[3] || "";

    if (accidental === "#") semitone += 1;
    if (accidental === "b") semitone -= 1;
    return { semitone: wrapSemitone(semitone), suffix };
  }

  function wrapSemitone(value) {
    return ((value % 12) + 12) % 12;
  }

  function onTranspose(step) {
    const next = transposeStep + step;
    transposeStep = next > 11 || next < -11 ? 0 : next;
    updateTransposeUI();
    refreshVisibleChordMarkers();
  }

  function updateTransposeUI() {
    const sign = transposeStep > 0 ? "+" : "";
    transposeIndicators.forEach((indicator) => {
      indicator.textContent = `Transpose ${sign}${transposeStep}`;
    });

    accidentalSwitchBtns.forEach((btn) => {
      btn.classList.toggle("active", accidentalMode === "flat");
      const label = btn.querySelector(".accidental-label");
      if (label) {
        label.textContent = accidentalMode === "flat" ? "♭" : "#";
      }
      btn.setAttribute("aria-label", `Switcher accidental (${accidentalMode === "flat" ? "flat" : "sharp"})`);
    });
  }

  function onToggleAccidentalMode() {
    accidentalMode = accidentalMode === "sharp" ? "flat" : "sharp";
    localStorage.setItem(CHORD_ACCIDENTAL_STORAGE_KEY, accidentalMode);
    updateTransposeUI();
    refreshVisibleChordMarkers();
  }

  function refreshVisibleChordMarkers() {
    document.querySelectorAll(".chord-marker").forEach((marker) => {
      marker.classList.remove("is-dissolving");
      void marker.offsetWidth;
      marker.classList.add("is-dissolving");
      marker.textContent = formatChordForDisplay(marker.dataset.raw || "");

      setTimeout(() => {
        marker.classList.remove("is-dissolving");
      }, 130);
    });
  }

  function getChordAt(pageNum, row, col) {
    const pageKey = String(pageNum);
    const entries = chordConfig.pages[pageKey];
    if (!Array.isArray(entries)) return "";

    const found = entries.find((entry) => entry.row === row && entry.col === col);
    return found ? found.text : "";
  }

  function setChordAt(pageNum, row, col, encodedText) {
    const pageKey = String(pageNum);
    const entries = Array.isArray(chordConfig.pages[pageKey]) ? chordConfig.pages[pageKey] : [];
    const idx = entries.findIndex((entry) => entry.row === row && entry.col === col);

    if (!encodedText) {
      if (idx >= 0) entries.splice(idx, 1);
      if (entries.length === 0) {
        delete chordConfig.pages[pageKey];
      } else {
        chordConfig.pages[pageKey] = entries;
      }
      return;
    }

    if (idx >= 0) {
      entries[idx].text = encodedText;
    } else {
      entries.push({ row, col, text: encodedText });
    }

    entries.sort((a, b) => (a.row - b.row) || (a.col - b.col));
    chordConfig.pages[pageKey] = entries;
  }

  function saveChordConfigurationFile() {
    if (currentSongIndex < 0 || !pujianItems[currentSongIndex]) return;

    const song = pujianItems[currentSongIndex];
    const filename = getChordTxtFilename(song);
    const dataText = JSON.stringify(chordConfig, null, 2);

    const blob = new Blob([dataText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);
    showToast(`Konfigurasi chord tersimpan: ${filename}`, "download");
  }

  function handleTitleActivatorTap() {
    if (!document.body.classList.contains("viewer-active")) return;

    titleTapCount += 1;
    if (titleTapTimer) clearTimeout(titleTapTimer);
    titleTapTimer = setTimeout(() => {
      titleTapCount = 0;
    }, 1800);

    const required = chordEditorEnabled ? EDITOR_OFF_TAPS : EDITOR_ON_TAPS;
    if (titleTapCount < required) return;

    titleTapCount = 0;
    chordEditorEnabled = !chordEditorEnabled;
    localStorage.setItem(EDITOR_STORAGE_KEY, chordEditorEnabled ? "1" : "0");
    updateChordEditorUI();
    renderPage(currentPageNum);

    showToast(chordEditorEnabled ? "Mode edit chord aktif" : "Mode edit chord nonaktif", chordEditorEnabled ? "edit" : "visibility");
  }

  function updateChordEditorUI() {
    chordEditorToolbar.hidden = !chordEditorEnabled;
    chordSaveBtn.hidden = !chordEditorEnabled;
    document.body.classList.toggle("chord-editor-enabled", chordEditorEnabled);
    if (chordEditorToolbar) {
      chordEditorToolbar.classList.toggle("is-collapsed", chordEditorCollapsed);
    }
  }

  function onToggleChordEditorCollapse(event) {
    if (event) event.stopPropagation();
    chordEditorCollapsed = !chordEditorCollapsed;
    localStorage.setItem(CHORD_COLLAPSE_STORAGE_KEY, chordEditorCollapsed ? "1" : "0");
    updateChordEditorUI();
  }

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

  function onLayoutResize() {
    syncTransposeCollapseState();
    fitViewerTitle();
    fitListTitles();
  }

  function onToggleTransposeCollapse(event) {
    event.preventDefault();
    event.stopPropagation();

    if (!isSmallPortraitLayout()) return;

    const shouldOpen = !transposeCollapse?.classList.contains("is-open");
    transposeCollapse?.classList.toggle("is-open", shouldOpen);
    if (transposeToggleBtn) {
      transposeToggleBtn.setAttribute("aria-expanded", shouldOpen ? "true" : "false");
    }
  }

  function closeTransposeCollapse() {
    transposeCollapse?.classList.remove("is-open");
    if (transposeToggleBtn) {
      transposeToggleBtn.setAttribute("aria-expanded", "false");
    }
  }

  function syncTransposeCollapseState() {
    if (!isSmallPortraitLayout()) {
      closeTransposeCollapse();
    }
  }

  function isSmallPortraitLayout() {
    return window.matchMedia("(max-width: 640px) and (orientation: portrait)").matches;
  }

  function onGlobalDocumentClick(event) {
    if (!transposeCollapse?.classList.contains("is-open")) return;
    if (transposeCollapse.contains(event.target)) return;
    closeTransposeCollapse();
  }

  function fitViewerTitle() {
    autoFitTextSingleLine(pdfViewerTitle, {
      maxPx: 18,
      minPx: 10
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

    let size = Math.min(maxPx, Number.parseFloat(window.getComputedStyle(element).fontSize) || maxPx);
    element.style.fontSize = `${size}px`;

    while (size > minPx && element.scrollWidth > element.clientWidth + 1) {
      size -= 0.5;
      element.style.fontSize = `${size}px`;
    }
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
      const rippleTarget = e.target.closest(".nav-btn, .icon-button, .pujian-list li, .accent-color");
      if (rippleTarget) {
        createRipple({ currentTarget: rippleTarget, clientX: e.clientX, clientY: e.clientY });
      }
    });

    document.body.addEventListener(
      "touchstart",
      (e) => {
        const touch = e.touches && e.touches[0];
        if (!touch) return;

        const rippleTarget = e.target.closest(".nav-btn, .icon-button, .pujian-list li, .accent-color");
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

  function closePdfViewer() {
    document.body.classList.remove("viewer-active");
    pdfDoc = null;
    currentSongIndex = -1;
    titleTapCount = 0;
    chordsHidden = false;
    closeTransposeCollapse();
    updateHideChordButton();
  }

  // --- 9. Zoom & gesture guards ---
  function showToast(message, icon = "info") {
    if (toastTimeout) clearTimeout(toastTimeout);
    if (zoomToastIcon) zoomToastIcon.textContent = icon;

    const existingTextNode = Array.from(zoomToast.childNodes).find((n) => n.nodeType === Node.TEXT_NODE);
    if (existingTextNode) {
      existingTextNode.textContent = ` ${message}`;
    } else {
      zoomToast.appendChild(document.createTextNode(` ${message}`));
    }

    zoomToast.classList.add("show");
    toastTimeout = setTimeout(() => {
      zoomToast.classList.remove("show");
    }, 2500);
  }

  function handleGlobalScroll(event) {
    if (!event.ctrlKey) return;

    event.preventDefault();
    if (document.body.classList.contains("viewer-active")) {
      onZoom(event.deltaY < 0 ? "in" : "out");
    }
  }

  function handleGlobalKeydown(event) {
    if (!(event.ctrlKey && (event.key === "+" || event.key === "-" || event.key === "="))) return;

    event.preventDefault();
    if (!document.body.classList.contains("viewer-active")) return;

    if (event.key === "+" || event.key === "=") {
      onZoom("in");
    } else if (event.key === "-") {
      onZoom("out");
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

    const baseScale = typeof currentScale === "number" ? currentScale : initialScale;
    currentScale = baseScale;
    initialPinchDistance = getPinchDistance(event);
    swipeStartPoint = null;

    const t1 = event.touches[0];
    const t2 = event.touches[1];
    const centerX = (t1.clientX + t2.clientX) / 2;
    const centerY = (t1.clientY + t2.clientY) / 2;
    const rect = pdfViewerContent.getBoundingClientRect();
    const activeRect = canvasWrapper.getBoundingClientRect();

    // Anchor position in wrapper-local coordinates (unscaled)
    const anchorInWrapperX = (centerX - activeRect.left);
    const anchorInWrapperY = (centerY - activeRect.top);

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
      anchorViewportY: centerY - rect.top
    };

    canvasWrapper.classList.add("pinch-preview");
    updateZoomIndicator();
  }

  function handleTouchMove(event) {
    if (event.touches.length !== 2 || !pinchState || initialPinchDistance <= 0) return;
    event.preventDefault();

    const distance = getPinchDistance(event);
    const factor = distance / initialPinchDistance;
    // Minimum 100%, maximum 800%
    const minScale = initialScale;
    const maxScale = initialScale * 8;
    const nextScale = Math.min(maxScale, Math.max(minScale, pinchState.baseScale * factor));

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
    const wrapperBaseX = pinchState.initScrollLeft + (canvasWrapper.getBoundingClientRect().left - rect.left) - pdfViewerContent.scrollLeft + pdfViewerContent.scrollLeft;
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
    const maxScrollX = Math.max(0, pdfViewerContent.scrollWidth - pdfViewerContent.clientWidth);
    const maxScrollY = Math.max(0, pdfViewerContent.scrollHeight - pdfViewerContent.clientHeight);
    pdfViewerContent.scrollLeft = Math.min(Math.max(0, targetScrollX), maxScrollX);
    pdfViewerContent.scrollTop = Math.min(Math.max(0, targetScrollY), maxScrollY);

    currentScale = nextScale;
    updateZoomIndicator();
  }

  async function handleTouchEnd(event) {
    initialPinchDistance = 0;

    if (!pinchState) return;
    if (event.touches && event.touches.length >= 2) return;

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

    currentScale = finalScale;
    updateZoomIndicator();

    // Render new content into a DETACHED element
    zoomDeferInsert = true;
    try {
      await renderPage(currentPageNum);
    } finally {
      zoomDeferInsert = false;
    }
    const newWrapper = canvasWrapper;

    if (newWrapper === activeWrapper || !newWrapper) {
      activeWrapper.classList.remove("pinch-preview");
      activeWrapper.style.transform = "";
      activeWrapper.style.transformOrigin = "";
      updateCenteringAndOverflow();
      return;
    }

    // Atomic swap: remove CSS preview, insert freshly rendered wrapper
    activeWrapper.classList.remove("pinch-preview");
    activeWrapper.style.transform = "";
    activeWrapper.style.transformOrigin = "";
    activeWrapper.replaceWith(newWrapper);

    updateCenteringAndOverflow();

    // Restore scroll position based on the anchor point
    // The anchor was at anchorInWrapperX/Y in old wrapper coords.
    // In new wrapper it's at anchorInWrapperX * ratio, anchorInWrapperY * ratio.
    // We want the anchor to appear at the same viewport position as during preview.
    const containerRect = pdfViewerContent.getBoundingClientRect();
    const newWrapperRect = newWrapper.getBoundingClientRect();
    const newWrapperDocX = pdfViewerContent.scrollLeft + (newWrapperRect.left - containerRect.left);
    const newWrapperDocY = pdfViewerContent.scrollTop + (newWrapperRect.top - containerRect.top);

    // Anchor position in new wrapper = old anchor * ratio
    const newAnchorInWrapperX = savedPinchState.anchorInWrapperX * ratio;
    const newAnchorInWrapperY = savedPinchState.anchorInWrapperY * ratio;

    // Place anchor at same viewport position as finger
    const targetViewportX = savedPinchState.centerClientX - containerRect.left;
    const targetViewportY = savedPinchState.centerClientY - containerRect.top;

    const targetScrollX = newWrapperDocX + newAnchorInWrapperX - targetViewportX;
    const targetScrollY = newWrapperDocY + newAnchorInWrapperY - targetViewportY;

    const maxScrollX = Math.max(0, pdfViewerContent.scrollWidth - pdfViewerContent.clientWidth);
    const maxScrollY = Math.max(0, pdfViewerContent.scrollHeight - pdfViewerContent.clientHeight);
    pdfViewerContent.scrollLeft = Math.min(Math.max(0, targetScrollX), maxScrollX);
    pdfViewerContent.scrollTop = Math.min(Math.max(0, targetScrollY), maxScrollY);

    updateCenteringAndOverflow();
  }

  function handleViewerTouchStart(event) {
    if (!document.body.classList.contains("viewer-active") || event.touches.length !== 1) return;

    const touch = event.touches[0];
    const isFromControl = event.target.closest("button, input, select, label, .chord-layer.editor-mode, .chord-marker");

    if (isFromControl) {
      swipeStartPoint = null;
      return;
    }

    swipeStartPoint = {
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now()
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

    const elapsed = Date.now() - swipeStartPoint.time;
    const dx = touch.clientX - swipeStartPoint.x;
    const dy = touch.clientY - swipeStartPoint.y;
    swipeStartPoint = null;

    processSwipeGesture(dx, dy, elapsed);
  }

  function handleViewerPointerStart(event) {
    if (!document.body.classList.contains("viewer-active")) return;
    if (event.button !== 0) return;

    const isFromControl = event.target.closest("button, input, select, label, .chord-layer.editor-mode, .chord-marker");
    if (isFromControl) {
      swipeStartPoint = null;
      return;
    }

    swipeStartPoint = {
      x: event.clientX,
      y: event.clientY,
      time: Date.now()
    };
  }

  function handleViewerPointerEnd(event) {
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
    return Boolean(pdfDoc) && pdfDoc.numPages > 1 && currentViewMode === "single" && currentScrollMode === "horizontal";
  }

  function isViewerZoomedIn() {
    if (!Number.isFinite(initialScale) || initialScale <= 0) return false;
    if (typeof currentScale !== "number" || !Number.isFinite(currentScale)) return false;
    return currentScale > initialScale * 1.001;
  }

  // --- 10. Handlers lainnya ---
  function handleMainContentClick(e) {
    const pujianItem = e.target.closest(".pujian-list li");
    if (pujianItem) {
      e.preventDefault();
      openPdfViewer(pujianItem.dataset.id);
      return;
    }

    const accentButton = e.target.closest(".accent-color");
    if (accentButton) {
      const color = accentButton.dataset.color;
      document.body.setAttribute("data-accent", color);
      localStorage.setItem("accent", color);
      accentButton.parentElement.querySelector(".selected")?.classList.remove("selected");
      accentButton.classList.add("selected");
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
      document.body.classList.toggle("dark-theme", e.target.checked);
      localStorage.setItem("dark-theme", e.target.checked ? "1" : "0");
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
    } else if (targetId === "chord-fill-select") {
      chordUiPrefs.fill = e.target.value;
      persistChordUiPrefs();
      rerenderViewerIfActive();
    } else if (targetId === "chord-font-override") {
      chordUiPrefs.fontOverridePercent = Number.parseInt(e.target.value, 10);
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
      overrideLabel.textContent = `Ukuran Font Chord (${chordUiPrefs.fontOverridePercent}%)`;
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
    const btn = document.getElementById("hide-chord-btn");
    if (!btn) return;

    // Show button only when viewer is active and there are chord pages
    const hasChords = chordConfig && Object.keys(chordConfig.pages).length > 0;
    btn.style.display = (document.body.classList.contains("viewer-active") && hasChords) ? "flex" : "none";

    const icon = btn.querySelector(".material-symbols-outlined");
    if (icon) {
      icon.textContent = chordsHidden ? "music_off" : "music_note";
    }
    btn.setAttribute("aria-label", chordsHidden ? "Tampilkan chord" : "Sembunyikan chord");
  }

  function applyStoredPreferences() {
    if (localStorage.getItem("dark-theme") === "1") {
      document.body.classList.add("dark-theme");
    }

    const storedAccent = localStorage.getItem("accent") || "biru";
    document.body.setAttribute("data-accent", storedAccent);

    try {
      const storedPrefs = localStorage.getItem("prefs");
      if (storedPrefs) {
        prefs = { ...prefs, ...JSON.parse(storedPrefs) };
      }
    } catch (error) {
      console.error("Gagal memuat preferensi:", error);
      localStorage.removeItem("prefs");
    }

    try {
      const storedChordUi = localStorage.getItem(CHORD_UI_STORAGE_KEY);
      if (storedChordUi) {
        const parsed = JSON.parse(storedChordUi);
        chordUiPrefs = {
          ...chordUiPrefs,
          ...parsed,
          baseFontRem: Number.isFinite(Number(parsed.baseFontRem)) ? Number(parsed.baseFontRem) : chordUiPrefs.baseFontRem,
          fontOverridePercent: Number.isFinite(Number(parsed.fontOverridePercent))
            ? Number(parsed.fontOverridePercent)
            : chordUiPrefs.fontOverridePercent
        };
      }
    } catch (error) {
      console.error("Gagal memuat preferensi tampilan chord:", error);
      localStorage.removeItem(CHORD_UI_STORAGE_KEY);
    }
  }

  init();
});
