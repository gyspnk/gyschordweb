// Navigasi sederhana antara Pujian dan Pengaturan
const mainContent = document.getElementById('main-content');
const pujianBtn = document.getElementById('pujian-btn');
const pengaturanBtn = document.getElementById('pengaturan-btn');

function setSelected(btn) {
  [pujianBtn, pengaturanBtn].forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
}

function renderPujianList() {
  fetch('assets/')
    .then(response => response.text())
    .then(html => {
      // Parse file list from directory listing (works for Python HTTP server)
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const links = Array.from(doc.querySelectorAll('a'));
      const pdfLinks = links.filter(link => link.getAttribute('href').endsWith('.pdf'));
      if (pdfLinks.length === 0) {
        mainContent.innerHTML = '<div class="welcome-text">Tidak dapat menampilkan daftar file. Pastikan Python HTTP server dijalankan tanpa opsi --no-dir atau gunakan ekstensi Live Server/HTTP-server yang mendukung directory listing.</div>';
        return;
      }
          let listHtml = '<h2>Daftar Pujian (PDF)</h2>';
          listHtml += '<ul class="pujian-list" id="pujian-list">';
          const items = [];
          pdfLinks.forEach(link => {
            const rawName = decodeURIComponent(link.textContent.replace('.pdf',''));
            let nomor = '';
            let judul = rawName;
            const match = rawName.match(/^([0-9A-Za-z]+)_\s?(.*)$/);
            if (match) {
              nomor = match[1];
              judul = match[2] || '';
            }
            const fileHref = 'assets/' + link.getAttribute('href');
            items.push({ nomor, judul, fileHref });
            listHtml += `<li data-nomor="${nomor}" data-judul="${judul.toLowerCase()}"><span class="pujian-nomor">${nomor}</span><a href="${fileHref}" target="_blank">${judul}</a></li>`;
          });
          listHtml += '</ul>';
          mainContent.innerHTML = listHtml;
          // Tampilkan search box
          const searchContainer = document.getElementById('search-container');
          if (searchContainer) searchContainer.style.display = '';
          const searchInput = document.getElementById('search-input');
          const pujianList = document.getElementById('pujian-list');
          if (searchInput && pujianList) {
            searchInput.value = '';
            searchInput.oninput = function() {
              const q = this.value.trim().toLowerCase();
              Array.from(pujianList.children).forEach(li => {
                const nomor = li.getAttribute('data-nomor') || '';
                const judul = li.getAttribute('data-judul') || '';
                if (q === '' || nomor.includes(q) || judul.includes(q)) {
                  li.style.display = '';
                } else {
                  li.style.display = 'none';
                }
              });
            };
          }
    })
    .catch(() => {
      mainContent.innerHTML = '<div class="welcome-text">Gagal memuat daftar pujian.</div>';
    });
}

pujianBtn.addEventListener('click', () => {
  setSelected(pujianBtn);
  renderPujianList();
});

pengaturanBtn.addEventListener('click', () => {
  setSelected(pengaturanBtn);
  mainContent.innerHTML = '<div class="welcome-text">Pengaturan aplikasi akan ditampilkan di sini.</div>';
});

// Default pilih Pujian
document.addEventListener('DOMContentLoaded', () => {
  setSelected(pujianBtn);
  renderPujianList();
});
