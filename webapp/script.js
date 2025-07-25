/**
 * Kidung Rohani App - Final Version
 *
 * Fitur:
 * - High-DPI PDF Rendering for crisp text on mobile.
 * - Swipe navigation for pages in single-view mode.
 * - Redesigned viewer layout for mobile (controls in footer).
 * - Smooth zoom animation.
 * - Settings toggles without icons.
 * - All previous features and bug fixes included.
 */

const { pdfjsLib } = globalThis;
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://mozilla.github.io/pdf.js/build/pdf.worker.mjs`;

document.addEventListener('DOMContentLoaded', () => {
  // --- 1. Seleksi Elemen DOM ---
  const mainContent = document.getElementById('main-content');
  const pujianBtn = document.getElementById('pujian-btn');
  const pengaturanBtn = document.getElementById('pengaturan-btn');
  const searchContainer = document.getElementById('search-container');
  const searchInput = document.getElementById('search-input');
  const clearSearchBtn = document.getElementById('clear-search');
  
  const pdfViewerOverlay = document.getElementById('pdf-viewer-overlay');
  const pdfViewerContent = document.querySelector('.pdf-viewer-content');
  const pdfViewerTitle = document.getElementById('pdf-viewer-title');
  const pdfViewerNumber = document.getElementById('pdf-viewer-number');
  const canvasWrapper = document.querySelector('.canvas-wrapper');
  const pdfViewerCloseBtn = document.getElementById('pdf-viewer-close');
  const prevPageBtn = document.getElementById('pdf-prev');
  const nextPageBtn = document.getElementById('pdf-next');
  const prevSongBtn = document.getElementById('song-prev');
  const nextSongBtn = document.getElementById('song-next');
  const zoomInBtn = document.getElementById('zoom-in');
  const zoomOutBtn = document.getElementById('zoom-out');
  const viewModeBtn = document.getElementById('view-mode');
  const scrollModeBtn = document.getElementById('scroll-mode');
  const pageNumEl = document.getElementById('page-num');
  const pageCountEl = document.getElementById('page-count');
  const viewerLoader = pdfViewerOverlay.querySelector('.loader');
  const orientationWarning = document.getElementById('orientation-warning');
  const zoomLevelIndicator = document.getElementById('zoom-level-indicator');

  // --- 2. State Management ---
  let pujianItems = [];
  let pdfDoc = null;
  let currentPageNum = 1;
  let currentSongIndex = -1;
  let currentScale = 'page-fit';
  let initialScale = 1.0;
  let currentViewMode = 'single';
  let currentScrollMode = 'horizontal';
  let pageRendering = false;
  let pageNumPending = null;
  let touchStartX = 0;
  let touchEndX = 0;
  
  let prefs = {
    defaultTwoPage: false,
    defaultVerticalScroll: false,
  };

  // --- 3. Inisialisasi ---
  function init() {
    applyStoredPreferences();
    setupEventListeners();
    navigateTo('pujian');
  }

  // --- 4. Event Listeners ---
  function setupEventListeners() {
    pujianBtn.addEventListener('click', () => navigateTo('pujian'));
    pengaturanBtn.addEventListener('click', () => navigateTo('pengaturan'));
    searchInput.addEventListener('input', handleSearch);
    clearSearchBtn.addEventListener('click', clearSearch);
    mainContent.addEventListener('click', handleMainContentClick);
    mainContent.addEventListener('change', handleSettingsChange);
    
    pdfViewerCloseBtn.addEventListener('click', closePdfViewer);
    prevPageBtn.addEventListener('click', onPrevPage);
    nextPageBtn.addEventListener('click', onNextPage);
    prevSongBtn.addEventListener('click', onPrevSong);
    nextSongBtn.addEventListener('click', onNextSong);
    zoomInBtn.addEventListener('click', () => onZoom('in'));
    zoomOutBtn.addEventListener('click', () => onZoom('out'));
    viewModeBtn.addEventListener('click', onToggleViewMode);
    scrollModeBtn.addEventListener('click', onToggleScrollMode);

    if (screen.orientation) {
        screen.orientation.addEventListener('change', checkOrientation);
    } else {
        window.addEventListener('orientationchange', checkOrientation);
    }

    window.addEventListener('wheel', handleGlobalScroll, { passive: false });
    pdfViewerContent.addEventListener('touchstart', handleTouchStart, { passive: true });
    pdfViewerContent.addEventListener('touchend', handleTouchEnd, { passive: true });
  }

  // --- 5. Logika Navigasi & Render Utama ---
  function navigateTo(page) {
    [pujianBtn, pengaturanBtn].forEach(btn => btn.classList.remove('selected'));
    if (page === 'pujian') {
      pujianBtn.classList.add('selected');
      searchContainer.style.display = 'flex';
      renderPujianList();
    } else if (page === 'pengaturan') {
      pengaturanBtn.classList.add('selected');
      searchContainer.style.display = 'none';
      renderSettings();
    }
  }

  function renderPujianList() {
    if (pujianItems.length > 0) {
        displayPujian(pujianItems);
    } else {
        fetch('assets-list.json')
            .then(response => response.ok ? response.json() : Promise.reject('Failed to load'))
            .then(files => {
                if (!Array.isArray(files)) throw new Error('Invalid data format');
                pujianItems = files.map((file, index) => {
                    const rawName = decodeURIComponent(file.replace('.pdf', ''));
                    const match = rawName.match(/^([0-9A-Za-z]+)[_.\s]*(.*)$/);
                    return {
                        id: index,
                        nomor: match ? match[1] : '',
                        judul: match ? match[2].replace(/_/g, ' ') : rawName.replace(/_/g, ' '),
                        fileHref: `assets/${file}`
                    };
                });
                displayPujian(pujianItems);
            })
            .catch(error => {
                console.error('Gagal memuat daftar pujian:', error);
                mainContent.innerHTML = '<div class="welcome-text">Gagal memuat daftar pujian.</div>';
            });
    }
  }

  function displayPujian(items) {
    mainContent.innerHTML = `
      <ul class="pujian-list" id="pujian-list">
        ${items.map(item => `
          <li data-id="${item.id}" data-nomor="${item.nomor.toLowerCase()}" data-judul="${item.judul.toLowerCase()}">
            <span class="pujian-nomor">${item.nomor}</span>
            <a href="${item.fileHref}">${item.judul}</a>
          </li>
        `).join('')}
      </ul>`;
    filterPujianList();
  }
  
  function renderSettings() {
    mainContent.innerHTML = `
      <div class="settings-panel">
        <h2>Pengaturan Tampilan</h2>
        <label class="setting-item" for="dark-theme-toggle">
          <span>Tema Gelap</span>
          <span class="md-switch">
            <input type="checkbox" id="dark-theme-toggle" ${document.body.classList.contains('dark-theme') ? 'checked' : ''}>
            <span class="md-slider"></span>
          </span>
        </label>
        <div class="setting-item">
          <label>Warna Aksen</label>
          <div class="accent-palette">
            ${['biru', 'merah', 'hijau', 'kuning', 'ungu', 'pink', 'birutua', 'teal', 'oranye', 'coklat', 'abu', 'indigo', 'cyan', 'lime', 'deep-orange'].map(color => `
              <button class="accent-color ${document.body.getAttribute('data-accent') === color ? 'selected' : ''}" data-color="${color}" title="${color.charAt(0).toUpperCase() + color.slice(1)}"></button>
            `).join('')}
          </div>
        </div>
        <h2>Pengaturan Viewer</h2>
        <label class="setting-item" for="default-two-page-toggle">
          <span>Mode Dua Halaman (default)</span>
          <span class="md-switch simple-toggle">
            <input type="checkbox" id="default-two-page-toggle" ${prefs.defaultTwoPage ? 'checked' : ''}>
            <span class="md-slider"></span>
          </span>
        </label>
        <label class="setting-item" for="default-vertical-scroll-toggle">
          <span>Scroll Vertikal (default)</span>
          <span class="md-switch simple-toggle">
            <input type="checkbox" id="default-vertical-scroll-toggle" ${prefs.defaultVerticalScroll ? 'checked' : ''}>
            <span class="md-slider"></span>
          </span>
        </label>
      </div>`;
  }

  // --- 6. Logika PDF Viewer ---
  async function openPdfViewer(songId, withTransition = true) {
    currentSongIndex = parseInt(songId, 10);
    const song = pujianItems[currentSongIndex];
    if (!song) return;

    const updateContent = () => {
        pdfViewerTitle.textContent = song.judul;
        pdfViewerNumber.textContent = `Nomor ${song.nomor}`;
    };

    if (withTransition) {
        await animateNavigation(updateContent);
    } else {
        updateContent();
    }
    
    if (!document.body.classList.contains('viewer-active')) {
        document.body.classList.add('viewer-active');
    }

    viewerLoader.style.display = 'block';
    canvasWrapper.innerHTML = '';
    
    const options = { url: song.fileHref, standardFontDataUrl: `https://mozilla.github.io/pdf.js/standard_fonts/` };

    try {
        const doc = await pdfjsLib.getDocument(options).promise;
        pdfDoc = doc;
        pageCountEl.textContent = pdfDoc.numPages;
        currentPageNum = 1;
        currentScale = 'page-fit';
        
        currentViewMode = (pdfDoc.numPages > 1 && prefs.defaultTwoPage) ? 'double' : 'single';
        currentScrollMode = (pdfDoc.numPages > 1 && prefs.defaultVerticalScroll) ? 'vertical' : 'horizontal';
        updateViewerUI();

        await renderPage(currentPageNum);
        updateSongNavButtons();
    } catch (reason) {
        console.error(`Error during PDF loading: ${reason}`);
        alert('Gagal memuat PDF.');
        closePdfViewer();
    }
  }

  async function renderPage(num) {
    if (pageRendering) {
        pageNumPending = num;
        return;
    }
    pageRendering = true;
    viewerLoader.style.display = 'block';

    const renderSinglePage = async (pageNum) => {
        const page = await pdfDoc.getPage(pageNum);
        const parent = pdfViewerOverlay.querySelector('.pdf-viewer-content');
        const dpr = window.devicePixelRatio || 1;
        
        if (currentScale === 'page-fit') {
            const viewport = page.getViewport({ scale: 1 });
            const scale = (parent.clientHeight - 32) / viewport.height;
            initialScale = scale;
            currentScale = scale;
        }
        
        const viewport = page.getViewport({ scale: currentScale * dpr });
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        canvas.style.width = `${viewport.width / dpr}px`;
        canvas.style.height = `${viewport.height / dpr}px`;

        await page.render({ canvasContext: context, viewport }).promise;
        return canvas;
    };

    try {
        canvasWrapper.innerHTML = '';
        if (currentScrollMode === 'vertical') {
            canvasWrapper.classList.add('vertical-scroll');
            for (let i = 1; i <= pdfDoc.numPages; i++) {
                const canvas = await renderSinglePage(i);
                canvasWrapper.appendChild(canvas);
            }
        } else {
            canvasWrapper.classList.remove('vertical-scroll');
            const canvas1 = await renderSinglePage(num);
            canvasWrapper.appendChild(canvas1);
            if (currentViewMode === 'double' && num < pdfDoc.numPages) {
                const canvas2 = await renderSinglePage(num + 1);
                canvasWrapper.appendChild(canvas2);
            }
        }
    } catch (error) {
        console.error("Failed to render page:", error);
    } finally {
        pageRendering = false;
        viewerLoader.style.display = 'none';
        if (pageNumPending !== null) {
            const pending = pageNumPending;
            pageNumPending = null;
            await renderPage(pending);
        }
    }

    pageNumEl.textContent = num;
    updatePageNavButtons();
    updateZoomIndicator();
  }

  function onPrevPage() {
    const step = currentViewMode === 'double' ? 2 : 1;
    if (currentPageNum <= 1) return;
    currentPageNum -= step;
    if (currentPageNum < 1) currentPageNum = 1;
    animateNavigation(() => renderPage(currentPageNum));
  }

  function onNextPage() {
    const step = currentViewMode === 'double' ? 2 : 1;
    if (currentPageNum + step > pdfDoc.numPages) return;
    currentPageNum += step;
    animateNavigation(() => renderPage(currentPageNum));
  }

  function onZoom(direction) {
    if (currentViewMode === 'double') return;
    if (currentScale === 'page-fit') currentScale = initialScale;
    
    if (direction === 'in') {
        currentScale += 0.2;
    } else if (direction === 'out') {
        const newScale = currentScale - 0.2;
        currentScale = Math.max(initialScale, newScale);
    }
    renderPage(currentPageNum);
  }

  function onToggleViewMode() {
    currentViewMode = currentViewMode === 'single' ? 'double' : 'single';
    if (currentViewMode === 'double') currentScrollMode = 'horizontal'; // Force horizontal on two-page
    updateViewerUI();
    renderPage(currentPageNum);
  }

  function onToggleScrollMode() {
    currentScrollMode = currentScrollMode === 'horizontal' ? 'vertical' : 'horizontal';
    if (currentScrollMode === 'vertical') currentViewMode = 'single'; // Force single page on vertical scroll
    updateViewerUI();
    renderPage(currentPageNum);
  }

  async function onPrevSong() {
    if (currentSongIndex > 0) {
        await openPdfViewer(currentSongIndex - 1, true);
    }
  }

  async function onNextSong() {
    if (currentSongIndex < pujianItems.length - 1) {
        await openPdfViewer(currentSongIndex + 1, true);
    }
  }
  
  async function animateNavigation(updateContentCallback) {
      canvasWrapper.classList.add('is-navigating');
      await new Promise(resolve => setTimeout(resolve, 150));
      if(updateContentCallback) await updateContentCallback();
      canvasWrapper.classList.remove('is-navigating');
  }

  function updateViewerUI() {
    const multiPage = pdfDoc && pdfDoc.numPages > 1;
    viewModeBtn.style.display = multiPage ? 'flex' : 'none';
    scrollModeBtn.style.display = multiPage ? 'flex' : 'none';
    
    const isTwoPage = currentViewMode === 'double';
    zoomInBtn.style.display = isTwoPage ? 'none' : 'flex';
    zoomOutBtn.style.display = isTwoPage ? 'none' : 'flex';
    zoomLevelIndicator.style.display = isTwoPage ? 'none' : 'flex';

    viewModeBtn.querySelector('.material-symbols-outlined').textContent = isTwoPage ? 'menu_book' : 'book';
    scrollModeBtn.querySelector('.material-symbols-outlined').textContent = currentScrollMode === 'horizontal' ? 'swap_vert' : 'swap_horiz';
    
    prevPageBtn.parentElement.style.display = currentScrollMode === 'vertical' ? 'none' : 'flex';

    checkOrientation();
  }

  function checkOrientation() {
    const isPortrait = window.innerHeight > window.innerWidth;
    if (currentViewMode === 'double' && isPortrait) {
        orientationWarning.classList.add('visible');
    } else {
        orientationWarning.classList.remove('visible');
    }
  }
  
  function updateZoomIndicator() {
      const zoomPercent = Math.round((currentScale / initialScale) * 100);
      zoomLevelIndicator.textContent = `${zoomPercent}%`;
  }

  function updatePageNavButtons() {
    prevPageBtn.disabled = (currentPageNum <= 1);
    const step = currentViewMode === 'double' ? 2 : 1;
    nextPageBtn.disabled = (currentPageNum + step > pdfDoc.numPages);
  }
  
  function updateSongNavButtons() {
    prevSongBtn.disabled = (currentSongIndex <= 0);
    nextSongBtn.disabled = (currentSongIndex >= pujianItems.length - 1);
  }

  function closePdfViewer() {
    document.body.classList.remove('viewer-active');
    pdfDoc = null;
    currentSongIndex = -1;
  }

  // --- 7. Event Handlers & Logika Lainnya ---
  function handleGlobalScroll(event) {
    if (event.ctrlKey) {
      event.preventDefault();
      if (document.body.classList.contains('viewer-active')) {
        if (event.deltaY < 0) {
          onZoom('in');
        } else {
          onZoom('out');
        }
      }
    }
  }
  
  function handleTouchStart(event) {
      if (currentViewMode === 'single' && currentScrollMode === 'horizontal') {
          touchStartX = event.changedTouches[0].screenX;
      }
  }

  function handleTouchEnd(event) {
      if (currentViewMode === 'single' && currentScrollMode === 'horizontal') {
          touchEndX = event.changedTouches[0].screenX;
          handleSwipe();
      }
  }

  function handleSwipe() {
      const swipeThreshold = 50; // Jarak minimum swipe
      if (touchEndX < touchStartX - swipeThreshold) {
          onNextPage();
      }
      if (touchEndX > touchStartX + swipeThreshold) {
          onPrevPage();
      }
  }

  function handleMainContentClick(e) {
    const pujianItem = e.target.closest('.pujian-list li');
    if (pujianItem) {
      e.preventDefault();
      openPdfViewer(pujianItem.dataset.id);
      return;
    }

    const accentButton = e.target.closest('.accent-color');
    if (accentButton) {
      const color = accentButton.dataset.color;
      document.body.setAttribute('data-accent', color);
      localStorage.setItem('accent', color);
      accentButton.parentElement.querySelector('.selected')?.classList.remove('selected');
      accentButton.classList.add('selected');
    }
  }
  
  function handleSearch() { clearSearchBtn.style.display = searchInput.value ? 'flex' : 'none'; filterPujianList(); }
  function clearSearch() { searchInput.value = ''; searchInput.focus(); handleSearch(); }
  function filterPujianList() {
    const query = searchInput.value.trim().toLowerCase();
    const keywords = query.split(/\s+/).filter(Boolean);
    const listElement = document.getElementById('pujian-list');
    if (!listElement) return;
    Array.from(listElement.children).forEach(li => {
      const nomor = li.dataset.nomor || '';
      const judul = li.dataset.judul || '';
      const isMatch = keywords.every(kw => nomor.includes(kw) || judul.includes(kw));
      li.style.display = isMatch ? 'flex' : 'none';
    });
  }
  function handleSettingsChange(e) {
    const targetId = e.target.id;
    if (targetId === 'dark-theme-toggle') {
      document.body.classList.toggle('dark-theme', e.target.checked);
      localStorage.setItem('dark-theme', e.target.checked ? '1' : '0');
    } else if (targetId === 'default-two-page-toggle') {
      prefs.defaultTwoPage = e.target.checked;
      if (e.target.checked) {
          prefs.defaultVerticalScroll = false;
          document.getElementById('default-vertical-scroll-toggle').checked = false;
      }
      localStorage.setItem('prefs', JSON.stringify(prefs));
    } else if (targetId === 'default-vertical-scroll-toggle') {
      prefs.defaultVerticalScroll = e.target.checked;
      if (e.target.checked) {
          prefs.defaultTwoPage = false;
          document.getElementById('default-two-page-toggle').checked = false;
      }
      localStorage.setItem('prefs', JSON.stringify(prefs));
    }
  }
  
  // --- 8. Manajemen Preferensi ---
  function applyStoredPreferences() {
    if (localStorage.getItem('dark-theme') === '1') {
      document.body.classList.add('dark-theme');
    }
    const storedAccent = localStorage.getItem('accent') || 'biru';
    document.body.setAttribute('data-accent', storedAccent);

    const storedPrefs = localStorage.getItem('prefs');
    if (storedPrefs) {
        prefs = JSON.parse(storedPrefs);
    }
  }

  init();
});