/**
 * Kidung Rohani App - PDF.js Integration (Fixed)
 *
 * Perubahan Utama:
 * - Bug Fix: Menambahkan kembali fungsi handleSearch, clearSearch, filterPujianList,
 * dan logika renderSettings yang hilang, yang menyebabkan error ReferenceError.
 * - PDF.js: Menggunakan pustaka PDF.js untuk merender PDF ke <canvas>.
 * - Custom Controls: Menambahkan logika untuk tombol navigasi halaman.
 */

// Inisialisasi worker untuk PDF.js
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
  
  // Elemen PDF Viewer
  const pdfViewerOverlay = document.getElementById('pdf-viewer-overlay');
  const pdfViewerTitle = document.getElementById('pdf-viewer-title');
  const pdfCanvas = document.getElementById('pdf-canvas');
  const pdfViewerCloseBtn = document.getElementById('pdf-viewer-close');
  const prevPageBtn = document.getElementById('pdf-prev');
  const nextPageBtn = document.getElementById('pdf-next');
  const pageNumEl = document.getElementById('page-num');
  const pageCountEl = document.getElementById('page-count');
  const viewerLoader = pdfViewerOverlay.querySelector('.loader');

  let pujianItems = [];
  let pdfDoc = null;
  let currentPageNum = 1;
  let pageRendering = false;
  let pageNumPending = null;

  // --- 2. Inisialisasi Aplikasi ---
  function init() {
    setupEventListeners();
    applyStoredPreferences();
    navigateTo('pujian');
  }

  // --- 3. Pengaturan Event Listeners ---
  function setupEventListeners() {
    pujianBtn.addEventListener('click', () => navigateTo('pujian'));
    pengaturanBtn.addEventListener('click', () => navigateTo('pengaturan'));
    searchInput.addEventListener('input', handleSearch);
    clearSearchBtn.addEventListener('click', clearSearch);
    
    // Event delegation untuk semua klik di mainContent
    mainContent.addEventListener('click', handleMainContentClick);
    mainContent.addEventListener('change', handleSettingsChange);
    
    // Listeners untuk PDF Viewer
    pdfViewerCloseBtn.addEventListener('click', closePdfViewer);
    prevPageBtn.addEventListener('click', onPrevPage);
    nextPageBtn.addEventListener('click', onNextPage);
  }

  // --- 4. Logika Navigasi & Render Utama ---
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
          pujianItems = files.map(file => {
            const rawName = decodeURIComponent(file.replace('.pdf', ''));
            const match = rawName.match(/^([0-9A-Za-z]+)[_.\s]*(.*)$/);
            return {
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
          <li data-nomor="${item.nomor.toLowerCase()}" data-judul="${item.judul.toLowerCase()}">
            <span class="pujian-nomor">${item.nomor}</span>
            <a href="${item.fileHref}">${item.judul}</a>
          </li>
        `).join('')}
      </ul>`;
    filterPujianList();
  }

  function renderSettings() {
    const isDark = document.body.classList.contains('dark-theme');
    const currentAccent = document.body.getAttribute('data-accent') || 'biru';
    const colors = ['biru', 'merah', 'hijau', 'kuning', 'ungu', 'pink', 'birutua', 'teal', 'oranye', 'coklat', 'abu', 'indigo', 'cyan', 'lime', 'deep-orange'];
    mainContent.innerHTML = `
      <div class="settings-panel">
        <h2>Pengaturan Tampilan</h2>
        <label class="setting-item" for="dark-theme-toggle">
          <span>Tema Gelap</span>
          <span class="md-switch">
            <input type="checkbox" id="dark-theme-toggle" ${isDark ? 'checked' : ''}>
            <span class="md-slider"></span>
          </span>
        </label>
        <div class="setting-item">
          <label>Warna Aksen</label>
          <div class="accent-palette">
            ${colors.map(color => `
              <button class="accent-color ${color === currentAccent ? 'selected' : ''}" data-color="${color}" title="${color.charAt(0).toUpperCase() + color.slice(1)}"></button>
            `).join('')}
          </div>
        </div>
      </div>`;
  }

  // --- 5. Logika PDF Viewer ---
  function openPdfViewer(url, title) {
    pdfViewerTitle.textContent = title;
    document.body.classList.add('viewer-active');
    viewerLoader.style.display = 'block';

    const loadingTask = pdfjsLib.getDocument(url);
    loadingTask.promise.then(doc => {
      pdfDoc = doc;
      pageCountEl.textContent = pdfDoc.numPages;
      currentPageNum = 1;
      renderPage(currentPageNum);
    }, reason => {
      console.error(`Error during PDF loading: ${reason}`);
      alert('Gagal memuat PDF.');
      closePdfViewer();
    });
  }

  function renderPage(num) {
    pageRendering = true;
    viewerLoader.style.display = 'block';

    pdfDoc.getPage(num).then(page => {
      const viewport = page.getViewport({ scale: 2.0 });
      const canvasContext = pdfCanvas.getContext('2d');
      pdfCanvas.height = viewport.height;
      pdfCanvas.width = viewport.width;

      const renderContext = { canvasContext, viewport };
      const renderTask = page.render(renderContext);

      renderTask.promise.then(() => {
        pageRendering = false;
        viewerLoader.style.display = 'none';
        if (pageNumPending !== null) {
          renderPage(pageNumPending);
          pageNumPending = null;
        }
      });
    });

    pageNumEl.textContent = num;
    updateNavButtons();
  }

  function queueRenderPage(num) {
    if (pageRendering) {
      pageNumPending = num;
    } else {
      renderPage(num);
    }
  }

  function onPrevPage() {
    if (currentPageNum <= 1) return;
    currentPageNum--;
    queueRenderPage(currentPageNum);
  }

  function onNextPage() {
    if (currentPageNum >= pdfDoc.numPages) return;
    currentPageNum++;
    queueRenderPage(currentPageNum);
  }
  
  function updateNavButtons() {
    prevPageBtn.disabled = (currentPageNum <= 1);
    nextPageBtn.disabled = (currentPageNum >= pdfDoc.numPages);
  }

  function closePdfViewer() {
    document.body.classList.remove('viewer-active');
    pdfDoc = null;
  }

  // --- 6. Event Handlers & Logika Lainnya ---
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
    Array.from(listElement.children).forEach(li => {
      const nomor = li.dataset.nomor || '';
      const judul = li.dataset.judul || '';
      const isMatch = keywords.every(kw => nomor.includes(kw) || judul.includes(kw));
      li.style.display = isMatch ? 'flex' : 'none';
    });
  }

  function handleMainContentClick(e) {
    const pujianItem = e.target.closest('.pujian-list li');
    if (pujianItem) {
      e.preventDefault();
      const link = pujianItem.querySelector('a');
      if (link) openPdfViewer(link.href, link.textContent);
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
  
  function handleSettingsChange(e) {
    if (e.target.id === 'dark-theme-toggle') {
      document.body.classList.toggle('dark-theme', e.target.checked);
      localStorage.setItem('dark-theme', e.target.checked ? '1' : '0');
    }
  }

  // --- 7. Manajemen Preferensi ---
  function applyStoredPreferences() {
    if (localStorage.getItem('dark-theme') === '1') {
      document.body.classList.add('dark-theme');
    }
    const storedAccent = localStorage.getItem('accent') || 'biru';
    document.body.setAttribute('data-accent', storedAccent);
  }

  init();
});
