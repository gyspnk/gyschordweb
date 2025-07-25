// Navigasi sederhana antara Pujian dan Pengaturan
// Debugging tools
console.log('Script loaded: script.js');
// Uncomment the next line to trigger the debugger on load
// debugger;
const mainContent = document.getElementById('main-content');
const pujianBtn = document.getElementById('pujian-btn');
const pengaturanBtn = document.getElementById('pengaturan-btn');

function setSelected(btn) {
  [pujianBtn, pengaturanBtn].forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
}

function renderPujianList() {
  fetch('assets-list.json')
    .then(response => response.json())
    .then(files => {
      if (!Array.isArray(files) || files.length === 0) {
        mainContent.innerHTML = '<div class="welcome-text">Tidak ada file pujian ditemukan.</div>';
        return;
      }
      let listHtml = '<ul class="pujian-list" id="pujian-list">';
      const items = [];
      files.forEach(file => {
        const rawName = decodeURIComponent(file.replace('.pdf',''));
        let nomor = '';
        let judul = rawName;
        const match = rawName.match(/^([0-9A-Za-z]+)_\s?(.*)$/);
        if (match) {
          nomor = match[1];
          judul = match[2] || '';
        }
        const fileHref = 'assets/' + file;
        // Ganti semua '_' di judul dengan '?'
        const judulDisplay = judul.replace(/_/g, '?');
        const judulSearch = judulDisplay.toLowerCase();
        items.push({ nomor, judul, fileHref });
        listHtml += `<li data-nomor="${nomor}" data-judul="${judul.toLowerCase()}" data-judul-search="${judulSearch}"><span class="pujian-nomor">${nomor}</span><a href="${fileHref}" target="_blank">${judulDisplay}</a></li>`;
      });
      listHtml += '</ul>';
      mainContent.innerHTML = listHtml;
      // Search bar kini selalu tampil, tidak perlu diubah display-nya
      const searchInput = document.getElementById('search-input');
      const pujianList = document.getElementById('pujian-list');
      if (searchInput && pujianList) {
        searchInput.value = '';
        searchInput.oninput = function() {
          const q = this.value.trim().toLowerCase();
          const items = Array.from(pujianList.children);
          // Fuzzy search: semua kata kunci (spasi) harus ada di nomor atau judulSearch (urutan bebas)
          const keywords = q.split(/\s+/).filter(Boolean);
          items.forEach(li => {
            const nomor = li.getAttribute('data-nomor') || '';
            const judulSearch = li.getAttribute('data-judul-search') || '';
            // Fuzzy: semua keyword harus ada di salah satu (nomor atau judulSearch)
            const isMatch = keywords.every(kw => nomor.includes(kw) || judulSearch.includes(kw));
            if (q === '' || isMatch) {
              li.style.display = '';
            } else {
              li.style.display = 'none';
            }
            // Reset margin-top
            li.style.marginTop = '';
          });
          // Cari li pertama yang visible, beri margin-top 7em
          const firstVisible = items.find(li => li.style.display !== 'none');
          if (firstVisible) firstVisible.style.marginTop = '7em';
        };
        // Pastikan margin-top benar saat load awal
        setTimeout(() => {
          const items = Array.from(pujianList.children);
          items.forEach(li => li.style.marginTop = '');
          const firstVisible = items.find(li => li.style.display !== 'none');
          if (firstVisible) firstVisible.style.marginTop = '7em';
        }, 0);
      }
    })
    .catch(() => {
      mainContent.innerHTML = '<div class="welcome-text">Gagal memuat daftar pujian.</div>';
    });
}


pujianBtn.addEventListener('click', () => {
  setSelected(pujianBtn);
  // Tampilkan search bar
  const searchContainer = document.getElementById('search-container');
  if (searchContainer) searchContainer.style.display = '';
  renderPujianList();
});


pengaturanBtn.addEventListener('click', () => {
  setSelected(pengaturanBtn);
  // Sembunyikan search bar
  const searchContainer = document.getElementById('search-container');
  if (searchContainer) searchContainer.style.display = 'none';
  mainContent.innerHTML = `
    <div class="settings-panel">
      <h2>Pengaturan Tampilan</h2>
      <div style="margin-bottom:1.2em">
        <label style="display:flex;align-items:center;gap:0.7em;cursor:pointer;">
          <span style="font-size:1.1em;">Tema Gelap</span>
          <span class="md-switch">
            <input type="checkbox" id="dark-theme-toggle">
            <span class="md-slider"></span>
          </span>
        </label>
      </div>
      <div>
        <div style="margin-bottom:0.5em;">Aksen warna:</div>
        <div class="accent-palette">
          <button class="accent-color" data-color="biru" title="Biru"></button>
          <button class="accent-color" data-color="merah" title="Merah"></button>
          <button class="accent-color" data-color="hijau" title="Hijau"></button>
          <button class="accent-color" data-color="kuning" title="Kuning"></button>
          <button class="accent-color" data-color="ungu" title="Ungu"></button>
          <button class="accent-color" data-color="pink" title="Pink"></button>
          <button class="accent-color" data-color="birutua" title="Biru Tua"></button>
          <button class="accent-color" data-color="teal" title="Teal"></button>
          <button class="accent-color" data-color="oranye" title="Oranye"></button>
          <button class="accent-color" data-color="coklat" title="Coklat"></button>
          <button class="accent-color" data-color="abu" title="Abu-abu"></button>
        </div>
      </div>
    </div>
  `;
  // Inisialisasi toggle dan palette
  const darkToggle = document.getElementById('dark-theme-toggle');
  if (darkToggle) {
    darkToggle.checked = document.body.classList.contains('dark-theme');
    darkToggle.addEventListener('change', function() {
      document.body.classList.toggle('dark-theme', this.checked);
      localStorage.setItem('dark-theme', this.checked ? '1' : '0');
    });
  }
  // Palette aksen
  const accentBtns = document.querySelectorAll('.accent-color');
  const currentAccent = document.body.getAttribute('data-accent') || 'biru';
  accentBtns.forEach(btn => {
    if (btn.dataset.color === currentAccent) btn.classList.add('selected');
    btn.addEventListener('click', function() {
      accentBtns.forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      document.body.setAttribute('data-accent', btn.dataset.color);
      localStorage.setItem('accent', btn.dataset.color);
    });
  });
});

// Default pilih Pujian
document.addEventListener('DOMContentLoaded', () => {
  setSelected(pujianBtn);
  renderPujianList();

  // Fitur tombol clear search
  const searchInput = document.getElementById('search-input');
  const clearBtn = document.getElementById('clear-search');
  const searchContainer = document.getElementById('search-container');
  if (searchInput && clearBtn) {
    function toggleClearBtn() {
      clearBtn.style.display = searchInput.value ? 'flex' : 'none';
    }
    searchInput.addEventListener('input', toggleClearBtn);
    clearBtn.addEventListener('click', function() {
      searchInput.value = '';
      searchInput.dispatchEvent(new Event('input'));
      searchInput.focus();
      toggleClearBtn();
    });
    toggleClearBtn();
  }
  // Pastikan search bar tampil saat load awal
  if (searchContainer) searchContainer.style.display = '';

  // Terapkan preferensi tema & aksen dari localStorage
  if (localStorage.getItem('dark-theme') === '1') {
    document.body.classList.add('dark-theme');
  }
  const accent = localStorage.getItem('accent');
  if (accent) {
    document.body.setAttribute('data-accent', accent);
  } else {
    document.body.setAttribute('data-accent', 'biru');
  }

  // === Custom Scrollbar Implementation ===
  // Wait for .app-content to exist
  setTimeout(() => {
    const appContent = document.querySelector('.app-content');
    if (!appContent) return;

    // Check if we should show custom scrollbar based on screen size
    function shouldShowCustomScrollbar() {
      const isLandscapeMobile = window.matchMedia('(max-width: 640px) and (orientation: landscape)').matches;
      return !isLandscapeMobile;
    }

    // Hide native scrollbar (for all browsers) only if custom scrollbar is enabled
    if (shouldShowCustomScrollbar()) {
      appContent.style.overflow = 'hidden';
    }

    // Create custom scrollbar elements

    // Pakai offset em agar konsisten dengan CSS
    let customScrollbar = document.createElement('div');
    customScrollbar.className = 'custom-scrollbar';
    let customThumb = document.createElement('div');
    customThumb.className = 'custom-scrollbar-thumb';
    customScrollbar.appendChild(customThumb);
    // Tempatkan scrollbar sejajar dengan .app-content (bukan fixed 8em)
    customScrollbar.style.position = 'absolute';
    // Ambil posisi top dan height .app-content relatif ke parent, lalu beri offset jarak kecil (0.5em)
    const appContentRect = appContent.getBoundingClientRect();
    const parentRect = appContent.parentElement.getBoundingClientRect();
    // Konversi 0.5em ke px (ambil dari computed style root)
    const emPx = parseFloat(getComputedStyle(document.documentElement).fontSize) * 0.5;
    const offsetTop = appContentRect.top - parentRect.top + emPx;
    const offsetBottom = parentRect.bottom - appContentRect.bottom + emPx;
    customScrollbar.style.top = offsetTop + 'px';
    customScrollbar.style.bottom = offsetBottom + 'px';
    customScrollbar.style.right = '0';
    customScrollbar.style.height = 'auto';
    customScrollbar.style.zIndex = '10';
    appContent.parentElement.appendChild(customScrollbar);

    // Update scrollbar visibility based on screen size
    function updateScrollbarVisibility() {
      if (shouldShowCustomScrollbar()) {
        customScrollbar.style.display = 'block';
        appContent.style.overflow = 'hidden';
        appContent.style.scrollbarWidth = 'none';
        appContent.style.msOverflowStyle = 'none';
      } else {
        customScrollbar.style.display = 'none';
        appContent.style.overflow = 'auto';
        appContent.style.scrollbarWidth = 'thin';
        appContent.style.msOverflowStyle = 'auto';
      }
    }

    // Listen for orientation/resize changes
    window.addEventListener('resize', updateScrollbarVisibility);
    window.addEventListener('orientationchange', () => {
      setTimeout(updateScrollbarVisibility, 100);
    });
    
    // Initial visibility check
    updateScrollbarVisibility();

    // Position and size the scrollbar
    function updateScrollbar() {
      // Hitung tinggi container scrollbar (dari CSS: top 8em, bottom 5em)
      const scrollbarRect = customScrollbar.getBoundingClientRect();
      const containerHeight = scrollbarRect.height;
      const content = appContent;
      const scrollHeight = content.scrollHeight;
      const clientHeight = content.clientHeight;
      const scrollTop = content.scrollTop;
      // Thumb height proporsional, minimal 40px, tidak boleh lebih dari container
      let thumbHeight = Math.max(40, Math.round(containerHeight * (clientHeight / scrollHeight)));
      thumbHeight = Math.min(thumbHeight, containerHeight);
      const maxThumbTop = containerHeight - thumbHeight;
      const maxScrollTop = scrollHeight - clientHeight;
      const thumbTop = maxScrollTop > 0 ? (scrollTop / maxScrollTop) * maxThumbTop : 0;
      customThumb.style.height = thumbHeight + 'px';
      customThumb.style.top = thumbTop + 'px';
      // Show/hide scrollbar if needed
      customScrollbar.style.display = (scrollHeight > clientHeight + 2) ? 'block' : 'none';
    }

    // Sync thumb on scroll
    appContent.addEventListener('scroll', updateScrollbar);
    window.addEventListener('resize', updateScrollbar);
    // Initial update
    updateScrollbar();

    // Drag logic - support both mouse and touch
    let isDragging = false;
    let dragStartY = 0;
    let dragStartScroll = 0;
    
    function startDrag(clientY) {
      isDragging = true;
      dragStartY = clientY;
      dragStartScroll = appContent.scrollTop;
      document.body.classList.add('scrollbar-dragging');
    }
    
    function updateDrag(clientY) {
      if (!isDragging) return;
      const content = appContent;
      const scrollHeight = content.scrollHeight;
      const clientHeight = content.clientHeight;
      const ratio = clientHeight / scrollHeight;
      const thumbHeight = Math.max(32, clientHeight * ratio);
      const maxThumbTop = clientHeight - thumbHeight;
      const maxScrollTop = scrollHeight - clientHeight;
      const deltaY = clientY - dragStartY;
      let newThumbTop = (dragStartScroll / maxScrollTop) * maxThumbTop + deltaY;
      newThumbTop = Math.max(0, Math.min(maxThumbTop, newThumbTop));
      const newScrollTop = (newThumbTop / maxThumbTop) * maxScrollTop;
      appContent.scrollTop = newScrollTop;
    }
    
    function endDrag() {
      if (isDragging) {
        isDragging = false;
        document.body.classList.remove('scrollbar-dragging');
      }
    }
    
    // Mouse events
    customThumb.addEventListener('mousedown', function(e) {
      startDrag(e.clientY);
      e.preventDefault();
    });
    
    document.addEventListener('mousemove', function(e) {
      updateDrag(e.clientY);
    });
    
    document.addEventListener('mouseup', endDrag);
    
    // Touch events for mobile
    customThumb.addEventListener('touchstart', function(e) {
      startDrag(e.touches[0].clientY);
      e.preventDefault();
    }, { passive: false });
    
    document.addEventListener('touchmove', function(e) {
      if (isDragging) {
        updateDrag(e.touches[0].clientY);
        e.preventDefault();
      }
    }, { passive: false });
    
    document.addEventListener('touchend', endDrag);

    // Click on scrollbar track
    customScrollbar.addEventListener('mousedown', function(e) {
      if (e.target !== customThumb) {
        const rect = customScrollbar.getBoundingClientRect();
        const clickY = e.clientY - rect.top;
        const thumbHeight = customThumb.offsetHeight;
        const clientHeight = appContent.clientHeight;
        const scrollHeight = appContent.scrollHeight;
        const maxThumbTop = clientHeight - thumbHeight;
        const maxScrollTop = scrollHeight - clientHeight;
        let newThumbTop = clickY - thumbHeight / 2;
        newThumbTop = Math.max(0, Math.min(maxThumbTop, newThumbTop));
        const newScrollTop = (newThumbTop / maxThumbTop) * maxScrollTop;
        appContent.scrollTop = newScrollTop;
      }
    });




    // --- Scroll wheel with acceleration/inertia ---
    let scrollVelocity = 0;
    let scrollAnimating = false;
    let isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    
    function animateScroll() {
      if (Math.abs(scrollVelocity) < 0.5) {
        scrollVelocity = 0;
        scrollAnimating = false;
        return;
      }
      appContent.scrollTop += scrollVelocity;
      scrollVelocity *= 0.85; // friction
      requestAnimationFrame(animateScroll);
    }
    
    // Only apply custom wheel behavior on non-touch devices
    if (!isTouchDevice) {
      appContent.addEventListener('wheel', function(e) {
        if (e.deltaY !== 0) {
          scrollVelocity += e.deltaY * 0.65; // reduced acceleration factor for smoother feel
          if (!scrollAnimating) {
            scrollAnimating = true;
            requestAnimationFrame(animateScroll);
          }
          e.preventDefault();
        }
      }, { passive: false });
    }
    
    // For touch devices, allow native scrolling but still update custom scrollbar
    if (isTouchDevice) {
      appContent.addEventListener('scroll', updateScrollbar, { passive: true });
    }

    // Theme-aware styling (update on theme/accent change)
    function updateScrollbarTheme() {
      const isDark = document.body.classList.contains('dark-theme');
      // Use CSS variable --accent for thumb color
      let accentColor = getComputedStyle(document.body).getPropertyValue('--accent').trim();
      if (!accentColor) accentColor = '#2196f3';
      customThumb.style.background = accentColor;
      customThumb.style.boxShadow = isDark ? '0 1px 10px 0 rgba(0,0,0,0.22)' : '0 1px 10px 0 rgba(0,0,0,0.13)';
      // Track: more distinct for both themes
      if (isDark) {
        customScrollbar.style.background = 'rgba(24,26,32,0.96)';
      } else {
        customScrollbar.style.background = 'linear-gradient(180deg, #e3eaf2 0%, #dbe3f5 100%)';
      }
    }
    updateScrollbarTheme();
    // Listen for theme/accent changes
    const observer = new MutationObserver(updateScrollbarTheme);
    observer.observe(document.body, { attributes: true, attributeFilter: ['class', 'data-accent'] });

    // Recalculate on content changes
    const resizeObs = new ResizeObserver(updateScrollbar);
    resizeObs.observe(appContent);
    // If list is re-rendered, update scrollbar
    new MutationObserver(updateScrollbar).observe(appContent, { childList: true, subtree: true });
  }, 0);
})