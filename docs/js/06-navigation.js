// --- 5. Navigasi utama ---
function navigateTo(page) {
  const playlistBtn = document.getElementById("playlist-btn");
  [pujianBtn, pengaturanBtn, playlistBtn].forEach((btn) => {
    if (btn) btn.classList.remove("selected");
  });
  document.querySelector(".app-header").style.display = "flex";

  const miniPlayerContainer = document.getElementById('mini-player');
  if (page === "pengaturan" || page === "report-bug" || page === "about-project") {
    if (miniPlayerContainer) miniPlayerContainer.classList.add('is-hidden');
  }


  if (page === "pujian") {
    pujianBtn.classList.add("selected");
    searchContainer.style.display = "flex";
    renderPujianList();
  } else if (page === "playlist") {
    if (playlistBtn) playlistBtn.classList.add("selected");
    searchContainer.style.display = "none";
    if (typeof renderPlaylistView === "function") renderPlaylistView();
  } else if (page === "pengaturan") {
    pengaturanBtn.classList.add("selected");
    searchContainer.style.display = "none";
    renderSettings();
  } else if (page === "report-bug") {
    pengaturanBtn.classList.add("selected");
    searchContainer.style.display = "none";
    renderReportBugPage();
  } else if (page === "about-project") {
    pengaturanBtn.classList.add("selected");
    searchContainer.style.display = "none";
    renderAboutProjectPage();
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
          fileHref: `assets/pdf/${file}`
        };
      });        displayPujian(pujianItems);
        
        // Auto-load last played song or first song (001) into miniplayer on first boot
        if (typeof currentSongIndex !== 'undefined' && currentSongIndex === -1 && pujianItems.length > 0) {
            let lastSongStr = localStorage.getItem('GysLastPlayedSongIndex');
            let initialSongIndex = 0; // Default to 001
            if (lastSongStr !== null) {
                let parsed = parseInt(lastSongStr, 10);
                if (!isNaN(parsed) && parsed >= 0 && parsed < pujianItems.length) {
                    initialSongIndex = parsed;
                }
            }
            if (typeof openPdfViewer === 'function') {
                openPdfViewer(initialSongIndex, true);
            }
        }
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
        <li data-id="${item.id}" data-nomor="${item.nomor.toLowerCase()}" data-judul="${item.judul.toLowerCase()}" class="pujian-item">
          <span class="pujian-nomor">${item.nomor}</span>
          <a href="${item.fileHref}" class="pujian-title">${item.judul}</a>
          <button class="icon-button add-to-playlist-btn" data-id="${item.id}" aria-label="Tambah ke Playlist" title="Tambah ke Playlist">
            <span class="material-symbols-outlined">playlist_add</span>
          </button>
        </li>
      `
        )
        .join("")}
    </ul>`;
  filterPujianList();
  fitListTitles();
  
  // Sync playlist + icons
  if (typeof updatePlaylistIndicators === 'function') {
    updatePlaylistIndicators();
  }
}

function renderSettingLabel(icon, text) {
  return `
    <span class="setting-label">
      <span class="material-symbols-outlined">${icon}</span>
      <span>${text}</span>
    </span>
  `;
}

function renderSettings() {
  const activeAccent = document.body.getAttribute("data-accent") || "gold";
  const accentPalette = ACCENT_PRESETS
    .map((preset) => {
      const color = preset.key === "custom" ? customAccentColor : preset.color;
      const customClass = preset.key === "custom" ? "accent-color-custom" : "";
      return `
        <button
          class="accent-color ${customClass} ${activeAccent === preset.key ? "selected" : ""}"
          data-color="${preset.key}"
          title="${preset.label}"
          aria-label="Warna aksen ${preset.label}"
          type="button"
          style="--swatch-color: ${color};"
        ></button>
      `;
    })
    .join("");

  const chordThemePalette = CHORD_THEME_PRESETS
    .map(
      (theme) => `
        <button
          class="chord-theme-color ${chordUiPrefs.theme === theme.key ? "selected" : ""}"
          data-chord-theme="${theme.key}"
          title="${theme.label}"
          aria-label="Tema chord ${theme.label}"
          type="button"
          style="--swatch-color: ${theme.color};"
        ></button>
      `
    )
    .join("");

  const chordFillPalette = CHORD_FILL_PRESETS
    .map(
      (fill) => `
        <button
          class="chord-fill-color ${chordUiPrefs.fillColor === fill.key ? "selected" : ""}"
          data-chord-fill-color="${fill.key}"
          title="${fill.label}"
          aria-label="Warna fill chord ${fill.label}"
          type="button"
          style="--swatch-color: ${fill.color};"
        ></button>
      `
    )
    .join("");

  mainContent.innerHTML = `
    <div class="settings-panel">
      <div class="settings-section">
        <h2 class="settings-section-title"><span class="material-symbols-outlined">settings</span> Umum</h2>
        <div class="settings-card">
          <div class="setting-item">
            ${renderSettingLabel("music_off", "Hindari Chord Awal ♯ / ♭")}
            <label class="md-switch">
              <input type="checkbox" id="prefer-natural-chords-toggle" ${prefs.preferNaturalChords ? "checked" : ""}>
              <span class="md-slider"></span>
            </label>
          </div>
        </div>
      </div>

      <div class="settings-section">
        <h2 class="settings-section-title"><span class="material-symbols-outlined">info</span> Info</h2>
        <div class="settings-card help-banner-card" id="about-project-btn" role="button" aria-label="Buka halaman tentang project" tabindex="0">
          <div class="help-banner-content">
            <span class="material-symbols-outlined help-banner-icon">info</span>
            <div class="help-banner-text">
              <h3>Tentang Project Ini</h3>
              <p>Latar belakang, informasi & tujuan</p>
            </div>
          </div>
          <span class="material-symbols-outlined help-banner-arrow">chevron_right</span>
        </div>
      </div>

      <div class="settings-section">
        <h2 class="settings-section-title"><span class="material-symbols-outlined">palette</span> Tampilan</h2>
        <div class="settings-card">
          <div class="setting-item">
            ${renderSettingLabel("dark_mode", "Tema Gelap")}
            <label class="md-switch">
              <input type="checkbox" id="dark-theme-toggle" ${document.body.classList.contains("dark-theme") ? "checked" : ""}>
              <span class="md-slider"></span>
            </label>
          </div>
          <div class="setting-divider"></div>
          <div class="setting-item">
            ${renderSettingLabel("format_paint", "Warna Aksen")}
            <div class="accent-palette">
              ${accentPalette}
            </div>
          </div>
          <div class="setting-divider"></div>
          <div class="setting-item">
            ${renderSettingLabel("colors", "Custom Accent")}
            <input type="color" id="custom-accent-input" class="setting-color-input" value="${customAccentColor}" aria-label="Pilih warna custom accent">
          </div>
        </div>
      </div>

      <div class="settings-section">
        <h2 class="settings-section-title"><span class="material-symbols-outlined">menu_book</span> Viewer Default</h2>
        <div class="settings-card">
          <div class="setting-item">
            ${renderSettingLabel("auto_stories", "Mode Dua Halaman")}
            <label class="md-switch">
              <input type="checkbox" id="default-two-page-toggle" ${prefs.defaultTwoPage ? "checked" : ""}>
              <span class="md-slider"></span>
            </label>
          </div>
          <div class="setting-divider"></div>
          <div class="setting-item">
            ${renderSettingLabel("swap_vert", "Scroll Vertikal")}
            <label class="md-switch">
              <input type="checkbox" id="default-vertical-scroll-toggle" ${prefs.defaultVerticalScroll ? "checked" : ""}>
              <span class="md-slider"></span>
            </label>
          </div>
        </div>
      </div>

      <div class="settings-section">
        <h2 class="settings-section-title"><span class="material-symbols-outlined">music_note</span> Tampilan Chord</h2>
        <div class="settings-card">
          <div class="setting-item">
            ${renderSettingLabel("text_format", "Tema Huruf Chord")}
            <div class="chord-theme-palette ${chordUiPrefs.syncThemeWithAccent ? "is-disabled" : ""}">
              ${chordThemePalette}
            </div>
          </div>
          <div class="setting-divider"></div>
          <div class="setting-item">
            ${renderSettingLabel("sync", "Samakan Huruf Chord ke Tema Utama")}
            <label class="md-switch">
              <input type="checkbox" id="chord-sync-theme-toggle" ${chordUiPrefs.syncThemeWithAccent ? "checked" : ""}>
              <span class="md-slider"></span>
            </label>
          </div>
          <div class="setting-divider"></div>
          <div class="setting-item">
            ${renderSettingLabel("format_color_fill", "Fill Chord")}
            <select id="chord-fill-select" class="setting-select">
              <option value="none" ${chordUiPrefs.fill === "none" ? "selected" : ""}>Tanpa Fill</option>
              <option value="soft" ${chordUiPrefs.fill === "soft" ? "selected" : ""}>Soft Rounded</option>
              <option value="solid" ${chordUiPrefs.fill === "solid" ? "selected" : ""}>Solid Rounded</option>
            </select>
          </div>
          <div class="setting-divider"></div>
          <div class="setting-item">
            ${renderSettingLabel("colorize", "Warna Fill Chord")}
            <div class="chord-fill-palette ${chordUiPrefs.syncFillWithAccent ? "is-disabled" : ""}">
              ${chordFillPalette}
            </div>
          </div>
          <div class="setting-divider"></div>
          <div class="setting-item">
            ${renderSettingLabel("tune", "Samakan Fill Chord ke Tema Utama")}
            <label class="md-switch">
              <input type="checkbox" id="chord-sync-fill-toggle" ${chordUiPrefs.syncFillWithAccent ? "checked" : ""}>
              <span class="md-slider"></span>
            </label>
          </div>
          <div class="setting-divider"></div>
          <div class="setting-item setting-item-slider">
            <span id="chord-opacity-label" class="setting-label">
              <span class="material-symbols-outlined">opacity</span>
              <span>Opacity Latar Chord (${chordUiPrefs.fillOpacityPercent}%)</span>
            </span>
            <input
              id="chord-fill-opacity"
              class="setting-range"
              type="range"
              min="0"
              max="100"
              step="5"
              value="${chordUiPrefs.fillOpacityPercent}"
            >
          </div>
          <div class="setting-divider"></div>
          <div class="setting-item setting-item-slider">
            <span id="chord-font-override-label" class="setting-label">
              <span class="material-symbols-outlined">format_size</span>
              <span>Ukuran Font Chord (${chordUiPrefs.fontOverridePercent}%)</span>
            </span>
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
        </div>
      </div>

      <div class="settings-section">
        <h2 class="settings-section-title"><span class="material-symbols-outlined">piano</span> MIDI & Audio</h2>
        <div class="settings-card">
          <div class="setting-item">
            ${renderSettingLabel("graphic_eq", "Soundfont")}
            <select id="soundfont-select" class="setting-select">
              <option value="https://storage.googleapis.com/magentadata/js/soundfonts/sgm_plus" ${prefs.midiSoundfont === "https://storage.googleapis.com/magentadata/js/soundfonts/sgm_plus" ? "selected" : ""}>SGM Plus (Default)</option>
              <option value="https://storage.googleapis.com/magentadata/js/soundfonts/salamander" ${prefs.midiSoundfont === "https://storage.googleapis.com/magentadata/js/soundfonts/salamander" ? "selected" : ""}>Salamander Piano</option>
            </select>
          </div>
        </div>
      </div>

      <div class="settings-section">
        <h2 class="settings-section-title"><span class="material-symbols-outlined">help</span> Bantuan</h2>
        <div class="settings-card help-banner-card" id="report-bug-btn" role="button" aria-label="Buka halaman report bug" tabindex="0">
          <div class="help-banner-content">
            <span class="material-symbols-outlined help-banner-icon">support_agent</span>
            <div class="help-banner-text">
              <h3>Hubungi Developer</h3>
              <p>Laporkan bug, error, atau beri saran</p>
            </div>
          </div>
          <span class="material-symbols-outlined help-banner-arrow">chevron_right</span>
        </div>
      </div>
    </div>`;
}

function renderAboutProjectPage() {
  mainContent.innerHTML = `
    <div class="report-page">
      <div class="report-header-nav">
        <button id="about-project-back-btn" class="report-back-btn" type="button" aria-label="Kembali ke pengaturan">
          <span class="material-symbols-outlined">arrow_back</span>
          <span>Kembali</span>
        </button>
        <h2>Tentang Project Ini</h2>
        <div style="width: 48px;"></div>
      </div>

      <div class="report-hero">
        <div class="report-hero-icon-bg">
          <span class="material-symbols-outlined report-hero-icon">info</span>
        </div>
        <h3>Latar Belakang & Informasi</h3>
        <p>Tujuan dan perjalanan pengembangan project Kidung Rohani</p>
      </div>

      <div class="settings-card about-project-card" style="padding: 1.5rem; display: flex; flex-direction: column; text-align: left;">
        <p style="margin-bottom: 1rem; line-height: 1.6; font-size: 1rem;">Di dalam nama Tuhan Yesus.. semoga project ini dapat bermanfaat bagi para pemusik di Gereja Yesus Sejati Indonesia agar bisa menjadi referensi ataupun sebagai tool untuk membantu menunjang pelayanan dalam bidang musik.</p>
        <p style="margin-bottom: 1rem; line-height: 1.6; font-size: 1rem;">Terima kasih kepada Tuhan Yesus yang sudah memberi saya kesempatan serta mengizinkan saya untuk menyelesaikan project ini... terima kasih juga kepada rekan - rekan yang sudah mendukung sehingga project ini dapat terlaksana dengan lancar.</p>
        
        <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--md-sys-color-outline-variant); line-height: 1.6; font-size: 1rem;">
          <p style="margin-bottom: 1rem;">Project ini dimulai dari tahun 2025, saya terpikir untuk membuat aplikasi ini dikarenakan saya merasa sebagai seorang pemusik pemula, saya masih sering kesulitan mencari chord, apalagi saat ada perpindahan nada dasarnya. Sehingga memotivasi saya untuk membuat suatu alat yang bisa memudahkan saya dan rekan - rekan sekalian dalam belajar musik di Kidung Rohani maupun dalam pelayanan...</p>
          <p style="margin-bottom: 1rem;">Project ini sempat berhenti beberapa bulan karena ada kesibukan pribadi hingga baru dapat diselesaikan di bulan April 2026... Puji Tuhan saya dapat melanjutkan project ini hingga sampai saat tahap ini.</p>
          <p style="margin-bottom: 1rem;">Akhir kata.. kiranya semua yang telah dilakukan di project ini hanya untuk kemuliaan nama Tuhan saja... terima kasih, Tuhan Yesus Memberkati kita semua.. Amin...</p>
        </div>
      </div>
    </div>
  `;
}

function renderReportBugPage() {
  mainContent.innerHTML = `
    <div class="report-page">
      <div class="report-header-nav">
        <button id="report-bug-back-btn" class="report-back-btn" type="button" aria-label="Kembali ke pengaturan">
          <span class="material-symbols-outlined">arrow_back</span>
          <span>Kembali</span>
        </button>
        <h2>Hubungi Developer</h2>
        <div style="width: 48px;"></div> <!-- Spacer for flex centering -->
      </div>

      <div class="report-hero">
        <div class="report-hero-icon-bg">
          <span class="material-symbols-outlined report-hero-icon">bug_report</span>
        </div>
        <h3>Pusat Bantuan & Saran</h3>
        <p>Jika menemukan bug, error, atau sekadar ingin memberikan masukan pengembangan, jangan ragu untuk menghubungi kontak di bawah ini.</p>
      </div>

      <div class="report-identity-card">
        <div class="dev-profile-pic">
          <span class="material-symbols-outlined">code</span>
        </div>
        <div class="dev-info">
          <p class="dev-name">Gilbert Then</p>
          <p class="dev-org">Gereja Yesus Sejati Pontianak</p>
        </div>
      </div>

      <div class="report-section" style="margin-top:-1rem; opacity:0.6;">
        <h3 class="section-badge" style="font-size:0.8rem; margin-bottom:0.5rem;"><span class="material-symbols-outlined" style="font-size: 1rem;">group</span> Kontributor (Nonprofit)</h3>
        <p style="font-size:0.8rem; margin:0;">Input Chord: Clement JJ</p>
        <p style="font-size:0.8rem; margin:0;">Hak Cipta: Tuhan Yesus Kristus</p>
      </div>

      <div class="report-section">
        <h3 class="section-badge"><span class="material-symbols-outlined">forum</span> Kontak Langsung</h3>
        <div class="report-action-grid">
          <a class="report-contact-link primary-link" href="https://wa.me/6289676328279" target="_blank" rel="noopener noreferrer">
            <div class="link-icon-wrapper">
              <span class="material-symbols-outlined link-icon">chat</span>
            </div>
            <div class="link-content">
              <span class="link-title">WhatsApp</span>
              <span class="link-subtitle">089676328279</span>
            </div>
          </a>
          <a class="report-contact-link secondary-link" href="https://mail.google.com/mail/?view=cm&fs=1&to=thengilbert@gmail.com" target="_blank" rel="noopener noreferrer">
            <div class="link-icon-wrapper">
              <span class="material-symbols-outlined link-icon">mail</span>
            </div>
            <div class="link-content">
              <span class="link-title">Email</span>
              <span class="link-subtitle">thengilbert@gmail.com</span>
            </div>
          </a>
        </div>
      </div>

      <div class="report-section">
        <h3 class="section-badge"><span class="material-symbols-outlined">photo_camera</span> Media Sosial</h3>
        <div class="report-social-grid">
          <a class="social-chip" href="https://www.instagram.com/gilbert_then01/" target="_blank" rel="noopener noreferrer">
            <span class="material-symbols-outlined">link</span>
            <span>@gilbert_then01</span>
          </a>
          <a class="social-chip" href="https://www.instagram.com/gys.pontianak/" target="_blank" rel="noopener noreferrer">
            <span class="material-symbols-outlined">link</span>
            <span>@gys.pontianak</span>
          </a>
          <a class="social-chip" href="https://www.instagram.com/youthptk_gys/" target="_blank" rel="noopener noreferrer">
            <span class="material-symbols-outlined">link</span>
            <span>@youthptk_gys</span>
          </a>
        </div>
      </div>
    </div>
  `;
}
