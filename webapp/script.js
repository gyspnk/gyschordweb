/**
 * Kidung Rohani App - Versi Stabil
 *
 * Fungsionalitas:
 * - Zoom melalui tombol dan scroll-wheel berfungsi dengan baik.
 * - Transisi fade saat navigasi halaman dan lagu aktif.
 * - Tata letak stabil di berbagai perangkat.
 * - FUNGSI PINCH-TO-ZOOM SECARA GLOBAL DIMATIKAN.
 * - Peringatan "Gunakan Tombol untuk Zoom" muncul saat mencoba pinch-zoom di viewer.
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
  const pdfViewerHeader = document.querySelector('.pdf-viewer-header');
  const songTitleWrapper = document.querySelector('.song-title-wrapper');
  const pdfViewerTitle = document.getElementById('pdf-viewer-title');
  const pdfViewerNumber = document.getElementById('pdf-viewer-number');
  let canvasWrapper = document.querySelector('.canvas-wrapper');
  const pdfViewerCloseBtn = document.getElementById('pdf-viewer-close');

  const pageNavigationPortrait = document.querySelector('.pdf-viewer-footer .page-navigation');
  const pageNavigationLandscape = document.querySelector('.landscape-controls .page-navigation-landscape');
  
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
  const zoomToast = document.getElementById('zoom-toast');

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
  
  // State untuk deteksi pinch
  let initialPinchDistance = 0;
  let toastTimeout = null;

  // --- 3. Inisialisasi ---
  function init() {
    applyStoredPreferences();
    setupEventListeners();
    setupRippleEffect();
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
        screen.orientation.addEventListener('change', handleOrientationChange);
    } else {
        window.addEventListener('orientationchange', handleOrientationChange);
    }

    window.addEventListener('wheel', handleGlobalScroll, { passive: false });

    // Event listener untuk deteksi pinch-zoom
    pdfViewerOverlay.addEventListener('touchstart', handleTouchStart, { passive: true });
    pdfViewerOverlay.addEventListener('touchmove', handleTouchMove, { passive: false }); 
    pdfViewerOverlay.addEventListener('touchend', handleTouchEnd, { passive: true });
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
  async function openPdfViewer(songId) {
    currentSongIndex = parseInt(songId, 10);
    const song = pujianItems[currentSongIndex];
    if (!song) return;
    
    viewerLoader.style.display = 'block';

    songTitleWrapper.classList.add('is-navigating');
    canvasWrapper.classList.add('is-navigating');
    await new Promise(resolve => setTimeout(resolve, 200));

    pdfViewerTitle.textContent = song.judul;
    pdfViewerNumber.textContent = `No. ${song.nomor}`;
    songTitleWrapper.classList.remove('is-navigating');

    if (!document.body.classList.contains('viewer-active')) {
        document.body.classList.add('viewer-active');
    }

    currentScale = 'page-fit';
    
    const options = { url: song.fileHref, standardFontDataUrl: `https://mozilla.github.io/pdf.js/standard_fonts/` };

    try {
        pdfDoc = await pdfjsLib.getDocument(options).promise;
        [pageCountElPortrait, pageCountElLandscape].forEach(el => el.textContent = pdfDoc.numPages);
        
        currentPageNum = 1;
        currentViewMode = (pdfDoc.numPages > 1 && prefs.defaultTwoPage) ? 'double' : 'single';
        currentScrollMode = (prefs.defaultVerticalScroll) ? 'vertical' : 'horizontal';
        
        updateViewerUI();
        await renderPage(currentPageNum);
        updateSongNavButtons();
        canvasWrapper.classList.remove('is-navigating');
    } catch (reason) {
        viewerLoader.style.display = 'none';
        console.error(`Gagal memuat PDF: ${reason}`);
        alert('Gagal memuat PDF.');
        closePdfViewer();
    }
  }

  async function animateViewChange(renderFunction, duration = 150) {
      canvasWrapper.classList.add('is-navigating');
      await new Promise(resolve => setTimeout(resolve, duration));
      if (renderFunction) await renderFunction();
      canvasWrapper.classList.remove('is-navigating');
  }

  function updateCenteringAndOverflow() {
      setTimeout(() => {
          if (canvasWrapper.scrollHeight > pdfViewerContent.clientHeight) {
              pdfViewerContent.classList.remove('vertically-centered');
          } else {
              pdfViewerContent.classList.add('vertically-centered');
          }
          if (canvasWrapper.scrollWidth > pdfViewerContent.clientWidth) {
              pdfViewerContent.classList.add('is-overflowing');
          } else {
              pdfViewerContent.classList.remove('is-overflowing');
          }
      }, 0); 
  }

  async function renderPage(num) {
    if (!pdfDoc) return;
    canvasWrapper.innerHTML = '';

    const renderSinglePageTask = async (pageNumToRender, scaleToUse) => {
        const page = await pdfDoc.getPage(pageNumToRender);
        const dpr = window.devicePixelRatio || 1;
        const finalRenderScale = scaleToUse * dpr;
        const viewport = page.getViewport({ scale: finalRenderScale });
        const canvas = document.createElement('canvas');
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        canvas.style.width = `${viewport.width / dpr}px`;
        canvas.style.height = `${viewport.height / dpr}px`;
        await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
        return canvas;
    };
    
    if (currentScale === 'page-fit') {
        const page1 = await pdfDoc.getPage(1);
        const viewport1 = page1.getViewport({ scale: 1 });
        let containerWidth = pdfViewerContent.clientWidth - 32;
        if (currentViewMode === 'double' && pdfDoc.numPages > 1) {
            containerWidth = (containerWidth - 16) / 2;
        }
        const scaleX = containerWidth / viewport1.width;
        const scaleY = (pdfViewerContent.clientHeight - 32) / viewport1.height;
        initialScale = Math.min(scaleX, scaleY);
        currentScale = initialScale;
    }

    try {
        if (currentScrollMode === 'vertical') {
            canvasWrapper.classList.add('vertical-scroll');
            for (let i = 1; i <= pdfDoc.numPages; i++) {
                const canvas = await renderSinglePageTask(i, currentScale);
                canvasWrapper.appendChild(canvas);
            }
        } else {
            canvasWrapper.classList.remove('vertical-scroll');
            const canvas1 = await renderSinglePageTask(num, currentScale);
            canvasWrapper.appendChild(canvas1);
            if (currentViewMode === 'double' && num < pdfDoc.numPages) {
                const canvas2 = await renderSinglePageTask(num + 1, currentScale);
                canvasWrapper.appendChild(canvas2);
            }
        }
    } catch (error) {
        console.error("Gagal merender halaman:", error);
    } finally {
        viewerLoader.style.display = 'none';
        updatePageIndicator(num);
        updatePageNavButtons();
        updateZoomIndicator();
        updateCenteringAndOverflow();
    }
  }
  
  function onPrevPage() {
    if (currentPageNum <= 1) return;
    const step = currentViewMode === 'double' ? 2 : 1;
    currentPageNum = Math.max(1, currentPageNum - step);
    animateViewChange(() => renderPage(currentPageNum));
  }

  function onNextPage() {
    if (currentPageNum >= pdfDoc.numPages) return;
    const step = currentViewMode === 'double' ? 2 : 1;
    currentPageNum += step;
    animateViewChange(() => renderPage(currentPageNum));
  }
  
  async function onZoom(direction) {
    if (currentScale === 'page-fit') {
        currentScale = initialScale;
    }

    const scaleStep = 0.25;
    const oldScale = currentScale;
    let newScale;

    if (direction === 'in') {
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
    if (pdfDoc.numPages <= 1) return;
    currentViewMode = currentViewMode === 'single' ? 'double' : 'single';
    currentScrollMode = 'horizontal';
    currentScale = 'page-fit';
    updateViewerUI();
    animateViewChange(() => renderPage(currentPageNum));
  }

  function onToggleScrollMode() {
    if (pdfDoc.numPages <= 1) return;
    currentScrollMode = currentScrollMode === 'horizontal' ? 'vertical' : 'horizontal';
    if (currentScrollMode === 'vertical') {
        currentViewMode = 'single';
    }
    currentScale = 'page-fit';
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
    viewModeBtn.style.display = multiPage ? 'flex' : 'none';
    scrollModeBtn.style.display = multiPage ? 'flex' : 'none';
    
    viewModeBtn.classList.toggle('active', currentViewMode === 'double');
    scrollModeBtn.classList.toggle('active', currentScrollMode === 'vertical');

    const isVertical = currentScrollMode === 'vertical';
    pageNavigationPortrait.style.visibility = isVertical ? 'hidden' : 'visible';
    pageNavigationLandscape.style.visibility = isVertical ? 'hidden' : 'visible';
    
    checkOrientation();
  }

  // --- 7. Logika Tambahan ---

  function handleOrientationChange() {
    checkOrientation();
    setTimeout(() => {
      currentScale = 'page-fit';
      animateViewChange(() => renderPage(currentPageNum));
    }, 200);
  }

  function setupRippleEffect() {
    const createRipple = (event) => {
        const element = event.currentTarget;
        
        if (!element.classList.contains('ripple-effect')) {
            element.classList.add('ripple-effect');
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

    document.body.addEventListener('click', (e) => {
        const rippleTarget = e.target.closest('.nav-btn, .icon-button, .pujian-list li, .accent-color');
        if (rippleTarget) {
            createRipple({ currentTarget: rippleTarget, clientX: e.clientX, clientY: e.clientY });
        }
    });
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
      const zoomPercent = typeof currentScale === 'number' ? Math.round((currentScale / initialScale) * 100) : 100;
      [zoomLevelIndicatorPortrait, zoomLevelIndicatorLandscape].forEach(el => {
        if(el) el.textContent = `${zoomPercent}%`
      });
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

  // --- 8. Logika Pinch & Toast ---
  function showZoomToast() {
    if (toastTimeout) clearTimeout(toastTimeout);
    zoomToast.classList.add('show');
    toastTimeout = setTimeout(() => {
        zoomToast.classList.remove('show');
    }, 2500);
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
      // Secara aktif memblokir zoom bawaan browser
      if (event.touches.length === 2) {
          event.preventDefault();
      }

      // Logika untuk menampilkan toast
      if (event.touches.length === 2 && initialPinchDistance > 0) {
          const newDistance = getPinchDistance(event);
          if (Math.abs(newDistance - initialPinchDistance) > 15) { // Threshold
              showZoomToast();
              initialPinchDistance = 0; // Reset untuk mencegah trigger berulang
          }
      }
  }

  function handleTouchEnd(event) {
      initialPinchDistance = 0;
  }
  
  // --- 9. Handlers & Helper Lainnya ---
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