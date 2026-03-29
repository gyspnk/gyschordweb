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

document.addEventListener("DOMContentLoaded", () => {
  const CHORD_GRID = { cols: 42, rows: 60 };
  const EDITOR_STORAGE_KEY = "chord-editor-enabled";
  const CHORD_UI_STORAGE_KEY = "chord-ui-prefs";
  const EDITOR_ON_TAPS = 10;
  const EDITOR_OFF_TAPS = 5;
  const NOTE_BY_NUMBER = {
    1: "C",
    2: "D",
    3: "E",
    4: "F",
    5: "G",
    6: "A",
    7: "B"
  };

  const LETTER_TO_NUMBER = {
    C: "1",
    D: "2",
    E: "3",
    F: "4",
    G: "5",
    A: "6",
    B: "7"
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
  const chordSaveBtn = document.getElementById("chord-save-btn");
  const transposeDownBtn = document.getElementById("transpose-down-btn");
  const transposeUpBtn = document.getElementById("transpose-up-btn");
  const transposeIndicator = document.getElementById("transpose-indicator");

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

  let chordEditorEnabled = localStorage.getItem(EDITOR_STORAGE_KEY) === "1";
  let chordConfig = createDefaultChordConfig();
  let titleTapCount = 0;
  let titleTapTimer = null;
  let transposeStep = 0;

  // --- 3. Init ---
  function init() {
    applyStoredPreferences();
    setupEventListeners();
    setupRippleEffect();
    updateChordEditorUI();
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
    transposeDownBtn.addEventListener("click", () => onTranspose(-1));
    transposeUpBtn.addEventListener("click", () => onTranspose(1));
    canvasWrapper.addEventListener("click", onChordLayerClick);

    pdfViewerTitle.addEventListener("click", handleTitleActivatorTap);

    if (screen.orientation) {
      screen.orientation.addEventListener("change", handleOrientationChange);
    } else {
      window.addEventListener("orientationchange", handleOrientationChange);
    }

    window.addEventListener("wheel", handleGlobalScroll, { passive: false });
    window.addEventListener("keydown", handleGlobalKeydown, { passive: false });
    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchmove", handleTouchMove, { passive: false });
    window.addEventListener("touchend", handleTouchEnd, { passive: true });
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
            <a href="${item.fileHref}">${item.judul}</a>
          </li>
        `
          )
          .join("")}
      </ul>`;
    filterPujianList();
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
          <span id="chord-font-base-label">Ukuran Font Default (${chordUiPrefs.baseFontRem.toFixed(2)}rem)</span>
          <input
            id="chord-font-base"
            class="setting-range"
            type="range"
            min="0.60"
            max="1.40"
            step="0.02"
            value="${chordUiPrefs.baseFontRem.toFixed(2)}"
          >
        </div>
        <div class="setting-item setting-item-slider">
          <span id="chord-font-override-label">Override Ukuran (${chordUiPrefs.fontOverridePercent}%)</span>
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

    if (!document.body.classList.contains("viewer-active")) {
      document.body.classList.add("viewer-active");
    }

    currentScale = "page-fit";
    chordConfig = createDefaultChordConfig();

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
      await renderPage(currentPageNum);
      updateSongNavButtons();
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
    setTimeout(() => {
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
    }, 0);
  }

  async function renderPage(num) {
    if (!pdfDoc) return;
    canvasWrapper.innerHTML = "";

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
        canvasWrapper.classList.add("vertical-scroll");
        for (let i = 1; i <= pdfDoc.numPages; i += 1) {
          const pageContainer = await renderSinglePageTask(i, currentScale);
          canvasWrapper.appendChild(pageContainer);
        }
      } else {
        canvasWrapper.classList.remove("vertical-scroll");

        const page1 = await renderSinglePageTask(num, currentScale);
        canvasWrapper.appendChild(page1);

        if (currentViewMode === "double" && num < pdfDoc.numPages) {
          const page2 = await renderSinglePageTask(num + 1, currentScale);
          canvasWrapper.appendChild(page2);
        }
      }
    } catch (error) {
      console.error("Gagal merender halaman:", error);
    } finally {
      viewerLoader.style.display = "none";
      updatePageIndicator(num);
      updatePageNavButtons();
      updateZoomIndicator();
      updateCenteringAndOverflow();
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
    if (!pdfDoc) return;
    if (currentScale === "page-fit") {
      currentScale = initialScale;
    }

    const scaleStep = 0.25;
    const oldScale = currentScale;
    let newScale = oldScale;

    if (direction === "in") {
      newScale = oldScale + scaleStep;
    } else {
      newScale = Math.max(initialScale, oldScale - scaleStep);
    }

    if (newScale === oldScale) return;

    const container = pdfViewerContent;
    const scrollX = container.scrollLeft + container.clientWidth / 2;
    const scrollY = container.scrollTop + container.clientHeight / 2;
    const zoomRatio = newScale / oldScale;

    const newScrollLeft = scrollX * zoomRatio - container.clientWidth / 2;
    const newScrollTop = scrollY * zoomRatio - container.clientHeight / 2;

    currentScale = newScale;
    await animateViewChange(() => renderPage(currentPageNum), 75);

    container.scrollTop = newScrollTop;
    container.scrollLeft = newScrollLeft;
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

    pageNavigationPortrait.style.display = singlePage || isVertical ? "none" : "flex";
    pageNavigationLandscape.style.display = singlePage || isVertical ? "none" : "flex";

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
    const txtUrl = getChordTxtUrl(song);
    chordConfig = createDefaultChordConfig();

    try {
      const response = await fetch(txtUrl, { cache: "no-store" });
      if (!response.ok) return;

      const payload = await response.text();
      const parsed = JSON.parse(payload);
      chordConfig = sanitizeChordConfig(parsed);
    } catch (error) {
      console.info("Tidak ada konfigurasi chord atau format belum valid:", error);
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
      "Masukkan chord (contoh: C#, Fdim, 1add9).\nKosongkan untuk hapus chord di sel ini.",
      promptDefault
    );

    if (userInput === null) return;

    const encoded = encodeChordToken(userInput);
    if (encoded === null) {
      alert("Format chord tidak valid. Gunakan root A-G atau 1-7, lalu optional #/b dan tag (dim, add9, dst).");
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

    const rootUpper = rootRaw.toUpperCase();
    const root = /[1-7]/.test(rootRaw) ? rootRaw : LETTER_TO_NUMBER[rootUpper];
    if (!root) return null;

    const accidental = accidentalRaw === "♭" ? "b" : accidentalRaw;
    return `${root}${accidental}${suffix}`;
  }

  function formatChordForDisplay(encodedToken) {
    const token = String(encodedToken || "").trim();
    const m = token.match(/^([1-7])([#b]?)(.*)$/);
    if (!m) return token;

    let root = Number.parseInt(m[1], 10);
    const accidental = m[2];
    const suffix = m[3] || "";

    root = wrapScaleNumber(root + transposeStep);

    if (accidental === "#") {
      const nextRoot = wrapScaleNumber(root + 1);
      return `${NOTE_BY_NUMBER[nextRoot]}♭${suffix}`;
    }

    if (accidental === "b") {
      return `${NOTE_BY_NUMBER[root]}♭${suffix}`;
    }

    return `${NOTE_BY_NUMBER[root]}${suffix}`;
  }

  function wrapScaleNumber(value) {
    return ((value - 1) % 7 + 7) % 7 + 1;
  }

  function onTranspose(step) {
    transposeStep += step;
    updateTransposeUI();
    renderPage(currentPageNum);
  }

  function updateTransposeUI() {
    const sign = transposeStep > 0 ? "+" : "";
    transposeIndicator.textContent = `Transpose ${sign}${transposeStep}`;
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
  }

  // --- 8. Tambahan UI ---
  function handleOrientationChange() {
    checkOrientation();
    setTimeout(() => {
      currentScale = "page-fit";
      animateViewChange(() => renderPage(currentPageNum));
    }, 200);
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
    if (event.touches.length === 2) {
      initialPinchDistance = getPinchDistance(event);
    }
  }

  function handleTouchMove(event) {
    if (event.touches.length !== 2) return;

    event.preventDefault();
    if (!document.body.classList.contains("viewer-active") || initialPinchDistance <= 0) return;

    const newDistance = getPinchDistance(event);
    if (Math.abs(newDistance - initialPinchDistance) > 15) {
      showToast("Gunakan tombol untuk zoom", "zoom_in");
      initialPinchDistance = 0;
    }
  }

  function handleTouchEnd() {
    initialPinchDistance = 0;
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
    } else if (targetId === "chord-font-base") {
      chordUiPrefs.baseFontRem = Number.parseFloat(e.target.value);
      persistChordUiPrefs();
      rerenderViewerIfActive();
      updateChordSettingsLabels();
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
    const baseLabel = document.getElementById("chord-font-base-label");
    const overrideLabel = document.getElementById("chord-font-override-label");
    if (baseLabel) {
      baseLabel.textContent = `Ukuran Font Default (${chordUiPrefs.baseFontRem.toFixed(2)}rem)`;
    }
    if (overrideLabel) {
      overrideLabel.textContent = `Override Ukuran (${chordUiPrefs.fontOverridePercent}%)`;
    }
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
