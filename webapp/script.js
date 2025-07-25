/**
 * Kidung Rohani App - Final (Stable Zoom)
 *
 * Perubahan:
 * - REVERT: Semua implementasi smooth zoom (termasuk requestAnimationFrame) telah dihapus total.
 * - Fungsionalitas zoom dikembalikan ke metode direct re-render yang instan, stabil, dan selalu tajam.
 * - Semua perbaikan bug sebelumnya tetap dipertahankan.
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
  
  const prevSongBtn = document.getElementById('song-prev');
  const nextSongBtn = document.getElementById('song-next');
  const viewModeBtn = document.getElementById('view-mode');
  const scrollModeBtn = document.getElementById('scroll-mode');
  
  const prevPageBtnPortrait = document.getElementById('pdf-prev-portrait');
  const nextPageBtnPortrait = document.getElementById('pdf-next-portrait');
  const zoomInBtnPortrait = document.getElementById('zoom-in-portrait');
  const zoomOutBtnPortrait = document.getElementById('zoom-out-portrait');
  const pageNumElPortrait = document.getElementById('page-num-portrait');
  const pageCountElPortrait = document.getElementById('page-count-portrait');
  const zoomLevelIndicatorPortrait = document.getElementById('zoom-level-indicator-portrait');

  const prevPageBtnLandscape = document.getElementById('pdf-prev-landscape');
  const nextPageBtnLandscape = document.getElementById('pdf-next-landscape');
  const zoomInBtnLandscape = document.getElementById('zoom-in-landscape');
  const zoomOutBtnLandscape = document.getElementById('zoom-out-landscape');
  const pageNumElLandscape = document.getElementById('page-num-landscape');
  const pageCountElLandscape = document.getElementById('page-count-landscape');
  const zoomLevelIndicatorLandscape = document.getElementById('zoom-level-indicator-landscape');
  
  const viewerLoader = pdfViewerOverlay.querySelector('.loader');
  const orientationWarning = document.getElementById('orientation-warning');

  // --- 2. State Management ---
  let pujianItems = [];
  let pdfDoc = null;
  let currentPageNum = 1;
  let currentSongIndex = -1;
  let currentScale = 'page-fit';
  let initialScale = 1.0;
  
  let currentViewMode = 'single';
  let currentScrollMode = 'horizontal';
  
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
    
    prevSongBtn.addEventListener('click', onPrevSong);
    nextSongBtn.addEventListener('click', onNextSong);
    viewModeBtn.addEventListener('click', onToggleViewMode);
    scrollModeBtn.addEventListener('click', onToggleScrollMode);

    [prevPageBtnPortrait, prevPageBtnLandscape].forEach(btn => btn.addEventListener('click', onPrevPage));
    [nextPageBtnPortrait, nextPageBtnLandscape].forEach(btn => btn.addEventListener('click', onNextPage));
    [zoomInBtnPortrait, zoomInBtnLandscape].forEach(btn => btn.addEventListener('click', () => onZoom('in')));
    [zoomOutBtnPortrait, zoomOutBtnLandscape].forEach(btn => btn.addEventListener('click', () => onZoom('out')));

    if (screen.orientation) {
        screen.orientation.addEventListener('change', checkOrientation);
    } else {
        window.addEventListener('orientationchange', checkOrientation);
    }

    window.addEventListener('wheel', handleGlobalScroll, { passive: false });
  }

  // --- 5. Logika Navigasi & Render Utama ---
  function navigateTo(page) {
    [pujianBtn, pengaturanBtn].forEach(btn => btn.classList.remove('selected'));
    document.querySelector('.app-header').style.display = 'block';
    
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
            .then(response => response.ok ? response.json() : Promise.reject('Gagal memuat daftar pujian'))
            .then(files => {
                if (!Array.isArray(files)) throw new Error('Format data tidak valid');
                pujianItems = files.map((file, index) => {
                    const rawName = decodeURIComponent(file.replace('.pdf', ''));
                    const match = rawName.match(/^([0-9A-Za-z]+)[_.\s]*(.*)$/);
                    return {
                        id: index,
                        nomor: match ? match[1] : '?',
                        judul: match ? match[2].replace(/_/g, ' ') : rawName.replace(/_/g, ' '),
                        fileHref: `assets/${file}`
                    };
                });
                displayPujian(pujianItems);
            })
            .catch(error => {
                console.error('Error memuat daftar pujian:', error);
                mainContent.innerHTML = '<p class="welcome-text">Gagal memuat daftar pujian.</p>';
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
        <h2>Tampilan</h2>
        <div class="setting-item">
          <span>Tema Gelap</span>
          <label class="md-switch">
            <input type="checkbox" id="dark-theme-toggle" ${document.body.classList.contains('dark-theme') ? 'checked' : ''}>
            <span class="md-slider"></span>
          </label>
        </div>
        <div class="setting-item">
          <span>Warna Aksen</span>
          <div class="accent-palette">
            ${['biru', 'merah', 'hijau', 'kuning', 'ungu', 'pink', 'birutua', 'teal', 'oranye', 'coklat', 'abu', 'indigo', 'cyan', 'lime', 'deep-orange'].map(color => `
              <button class="accent-color ${document.body.getAttribute('data-accent') === color ? 'selected' : ''}" data-color="${color}" title="${color.charAt(0).toUpperCase() + color.slice(1)}"></button>
            `).join('')}
          </div>
        </div>
        <h2>Viewer Default</h2>
        <div class="setting-item">
          <span>Mode Dua Halaman</span>
          <label class="md-switch">
            <input type="checkbox" id="default-two-page-toggle" ${prefs.defaultTwoPage ? 'checked' : ''}>
            <span class="md-slider"></span>
          </label>
        </div>
        <div class="setting-item">
          <span>Scroll Vertikal</span>
          <label class="md-switch">
            <input type="checkbox" id="default-vertical-scroll-toggle" ${prefs.defaultVerticalScroll ? 'checked' : ''}>
            <span class="md-slider"></span>
          </label>
        </div>
      </div>`;
  }

  // --- 6. Logika PDF Viewer ---
  async function openPdfViewer(songId, withTransition = true) {
    currentSongIndex = parseInt(songId, 10);
    const song = pujianItems[currentSongIndex];
    if (!song) return;

    const updateContent = () => {
        pdfViewerTitle.textContent = song.judul;
        pdfViewerNumber.textContent = `No. ${song.nomor}`;
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
    currentScale = 'page-fit';
    
    const options = { url: song.fileHref, standardFontDataUrl: `https://mozilla.github.io/pdf.js/standard_fonts/` };

    try {
        const doc = await pdfjsLib.getDocument(options).promise;
        pdfDoc = doc;
        [pageCountElPortrait, pageCountElLandscape].forEach(el => el.textContent = pdfDoc.numPages);
        
        currentPageNum = 1;
        
        currentViewMode = (pdfDoc.numPages > 1 && prefs.defaultTwoPage) ? 'double' : 'single';
        currentScrollMode = (pdfDoc.numPages > 1 && prefs.defaultVerticalScroll) ? 'vertical' : 'horizontal';
        
        updateViewerUI();
        await renderPage(currentPageNum);
        updateSongNavButtons();
    } catch (reason) {
        console.error(`Gagal memuat PDF: ${reason}`);
        alert('Gagal memuat PDF.');
        closePdfViewer();
    }
  }

  async function renderPage(num) {
    if (!pdfDoc) return;
    viewerLoader.style.display = 'block';
    canvasWrapper.innerHTML = ''; 

    try {
        const page = await pdfDoc.getPage(num);
        const dpr = window.devicePixelRatio || 1;
        
        if (currentScale === 'page-fit') {
            const viewport = page.getViewport({ scale: 1 });
            const scale = (pdfViewerContent.clientHeight - 32) / viewport.height;
            initialScale = scale;
            currentScale = scale;
        }
        
        const finalRenderScale = currentScale * dpr;
        const viewport = page.getViewport({ scale: finalRenderScale });

        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        canvas.style.width = `${viewport.width / dpr}px`;
        canvas.style.height = `${viewport.height / dpr}px`;
        
        await page.render({ canvasContext: context, viewport }).promise;
        canvasWrapper.appendChild(canvas);
        
        if (currentViewMode === 'double' && num < pdfDoc.numPages) {
            const page2 = await pdfDoc.getPage(num + 1);
            const viewport2 = page2.getViewport({ scale: finalRenderScale });
            const canvas2 = document.createElement('canvas');
            canvas2.height = viewport2.height;
            canvas2.width = viewport2.width;
            canvas2.style.width = `${viewport2.width / dpr}px`;
            canvas2.style.height = `${viewport2.height / dpr}px`;
            await page2.render({ canvasContext: canvas2.getContext('2d'), viewport: viewport2 }).promise;
            canvasWrapper.appendChild(canvas2);
        }

    } catch (error) {
        console.error("Gagal merender halaman:", error);
    } finally {
        viewerLoader.style.display = 'none';
    }

    updatePageIndicator(num);
    updatePageNavButtons();
    updateZoomIndicator();
  }
  
  function onPrevPage() {
    if (currentPageNum <= 1) return;
    const step = currentViewMode === 'double' ? 2 : 1;
    currentPageNum = Math.max(1, currentPageNum - step);
    animateNavigation(() => renderPage(currentPageNum));
  }

  function onNextPage() {
    if (currentPageNum >= pdfDoc.numPages) return;
    const step = currentViewMode === 'double' ? 2 : 1;
    currentPageNum += step;
    animateNavigation(() => renderPage(currentPageNum));
  }
  
  // REVERT: Logika zoom kembali ke metode instan yang stabil
  function onZoom(direction) {
    if (currentViewMode === 'double' || currentScrollMode === 'vertical') return;

    if (currentScale === 'page-fit') {
        currentScale = initialScale;
    }

    const scaleStep = 0.2;
    if (direction === 'in') {
        currentScale += scaleStep;
    } else {
        const newScale = currentScale - scaleStep;
        currentScale = Math.max(initialScale, newScale);
    }
    
    renderPage(currentPageNum);
  }


  function onToggleViewMode() {
    if (pdfDoc.numPages <= 1) return;
    currentViewMode = currentViewMode === 'single' ? 'double' : 'single';
    if (currentViewMode === 'double') {
        currentScrollMode = 'horizontal'; 
    }
    currentScale = 'page-fit';
    updateViewerUI();
    renderPage(currentPageNum);
  }

  function onToggleScrollMode() {
    if (pdfDoc.numPages <= 1) return;
    currentScrollMode = currentScrollMode === 'horizontal' ? 'vertical' : 'horizontal';
    if (currentScrollMode === 'vertical') {
        currentViewMode = 'single';
    }
    currentScale = 'page-fit';
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
      currentScale = 'page-fit';
  }

  function updateViewerUI() {
    const multiPage = pdfDoc && pdfDoc.numPages > 1;
    viewModeBtn.style.display = multiPage ? 'flex' : 'none';
    scrollModeBtn.style.display = multiPage ? 'flex' : 'none';
    
    const isTwoPage = currentViewMode === 'double';
    const isVertical = currentScrollMode === 'vertical';
    
    viewModeBtn.classList.toggle('active', isTwoPage);
    scrollModeBtn.classList.toggle('active', isVertical);
    
    checkOrientation();
  }

  function checkOrientation() {
    const isPortrait = window.innerHeight > window.innerWidth;
    orientationWarning.classList.toggle('visible', currentViewMode === 'double' && isPortrait);
  }
  
  function updatePageIndicator(num) {
    let text = num;
    if (currentViewMode === 'double' && num + 1 <= pdfDoc.numPages) {
        text = `${num}-${num + 1}`;
    }
    [pageNumElPortrait, pageNumElLandscape].forEach(el => el.textContent = text);
  }
  
  function updateZoomIndicator() {
      const zoomPercent = currentScale === 'page-fit' ? 100 : Math.round((currentScale / initialScale) * 100);
      [zoomLevelIndicatorPortrait, zoomLevelIndicatorLandscape].forEach(el => el.textContent = `${zoomPercent}%`);
  }

  function updatePageNavButtons() {
    const prevDisabled = currentPageNum <= 1;
    const step = currentViewMode === 'double' ? 2 : 1;
    const nextDisabled = currentPageNum + step > pdfDoc.numPages;

    [prevPageBtnPortrait, prevPageBtnLandscape].forEach(btn => btn.disabled = prevDisabled);
    [nextPageBtnPortrait, nextPageBtnLandscape].forEach(btn => btn.disabled = nextDisabled);
  }
  
  function updateSongNavButtons() {
    prevSongBtn.disabled = currentSongIndex <= 0;
    nextSongBtn.disabled = currentSongIndex >= pujianItems.length - 1;
  }

  function closePdfViewer() {
    document.body.classList.remove('viewer-active');
    pdfDoc = null;
    currentSongIndex = -1;
  }

  function handleGlobalScroll(event) {
    if (event.ctrlKey && document.body.classList.contains('viewer-active')) {
      event.preventDefault();
      onZoom(event.deltaY < 0 ? 'in' : 'out');
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
  
  function handleSearch() { 
    clearSearchBtn.style.display = searchInput.value ? 'flex' : 'none'; 
    filterPujianList(); 
  }
  function clearSearch() { 
    searchInput.value = ''; 
    searchInput.focus(); 
    handleSearch(); 
  }

  function filterPujianList() {
    const query = searchInput.value.trim().toLowerCase();
    const keywords = query.split(/\s+/).filter(Boolean);
    const listElement = document.getElementById('pujian-list');
    if (!listElement) return;

    let found = false;
    Array.from(listElement.children).forEach(li => {
      const nomor = li.dataset.nomor || '';
      const judul = li.dataset.judul || '';
      const isMatch = keywords.every(kw => nomor.includes(kw) || judul.includes(kw));
      li.style.display = isMatch ? 'flex' : 'none';
      if(isMatch) found = true;
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
  
  function applyStoredPreferences() {
    if (localStorage.getItem('dark-theme') === '1') {
      document.body.classList.add('dark-theme');
    }
    const storedAccent = localStorage.getItem('accent') || 'biru';
    document.body.setAttribute('data-accent', storedAccent);

    try {
        const storedPrefs = localStorage.getItem('prefs');
        if (storedPrefs) {
            prefs = { ...prefs, ...JSON.parse(storedPrefs) };
        }
    } catch (e) {
        console.error("Gagal memuat preferensi:", e);
        localStorage.removeItem('prefs');
    }
  }

  init();
});