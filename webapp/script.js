/**
 * Kidung Rohani App - Fixed and Optimized Script v2
 *
 * Perubahan Utama:
 * - Bug Fix: Struktur HTML untuk switch tema diubah dengan membungkusnya dalam <label>
 * agar seluruh area dapat diklik, memperbaiki bug interaksi.
 * - Efisiensi: Tetap menggunakan event delegation yang optimal.
 */
document.addEventListener('DOMContentLoaded', () => {
  // --- 1. Seleksi Elemen DOM ---
  const mainContent = document.getElementById('main-content');
  const pujianBtn = document.getElementById('pujian-btn');
  const pengaturanBtn = document.getElementById('pengaturan-btn');
  const searchContainer = document.getElementById('search-container');
  const searchInput = document.getElementById('search-input');
  const clearSearchBtn = document.getElementById('clear-search');

  let pujianItems = [];

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

    mainContent.addEventListener('change', handleSettingsChange);
    mainContent.addEventListener('click', handleAccentClick);
  }

  // --- 4. Logika Navigasi ---
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

  // --- 5. Render Tampilan ---
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
    if (items.length === 0) {
      mainContent.innerHTML = '<div class="welcome-text">Tidak ada lagu pujian.</div>';
      return;
    }
    const listHtml = `
      <ul class="pujian-list" id="pujian-list">
        ${items.map(item => `
          <li data-nomor="${item.nomor.toLowerCase()}" data-judul="${item.judul.toLowerCase()}">
            <span class="pujian-nomor">${item.nomor}</span>
            <a href="${item.fileHref}" target="_blank">${item.judul}</a>
          </li>
        `).join('')}
      </ul>`;
    mainContent.innerHTML = listHtml;
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

  // --- 6. Logika Fungsional ---
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
  
  function handleSettingsChange(e) {
    if (e.target.id === 'dark-theme-toggle') {
      document.body.classList.toggle('dark-theme', e.target.checked);
      localStorage.setItem('dark-theme', e.target.checked ? '1' : '0');
    }
  }

  function handleAccentClick(e) {
    const accentButton = e.target.closest('.accent-color');
    if (accentButton) {
      const color = accentButton.dataset.color;
      document.body.setAttribute('data-accent', color);
      localStorage.setItem('accent', color);
      accentButton.parentElement.querySelector('.selected')?.classList.remove('selected');
      accentButton.classList.add('selected');
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
