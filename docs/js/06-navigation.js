// --- 5. Navigasi utama ---
function navigateTo(page) {
  const playlistBtn = document.getElementById("playlist-btn");
  [pujianBtn, pengaturanBtn, playlistBtn].forEach((btn) => {
    if (btn) btn.classList.remove("selected");
  });
  document.querySelector(".app-header").style.display = "flex";

  // Remove viewer-active on any non-viewer navigation
  document.body.classList.remove('viewer-active');
  document.body.setAttribute('data-page', page);

  const miniPlayerContainer = document.getElementById('mini-player');
  const appContent = document.getElementById('main-content');
  if (page === "pengaturan" || page === "report-bug" || page === "about-project") {
    if (miniPlayerContainer) {
      miniPlayerContainer.classList.add('is-hidden');
      miniPlayerContainer.classList.remove('mini-player-enter');
    }
    if (appContent) appContent.classList.remove('has-mini-player');
  }


  if (page === "pujian") {
    pujianBtn.classList.add("selected");
    searchContainer.style.display = "flex";
    renderPujianList();
  } else if (page === "playlist") {
    if (playlistBtn) playlistBtn.classList.add("selected");
    searchContainer.style.display = "none";
    if (typeof renderPlaylistView === "function") renderPlaylistView();
  } else if (page === "report-bug") {
    pengaturanBtn.classList.add("selected");
    searchContainer.style.display = "none";
    renderReportBugPage();
    mainContent.scrollTop = 0;
  } else if (page === "about-project") {
    pengaturanBtn.classList.add("selected");
    searchContainer.style.display = "none";
    renderAboutProjectPage();
    mainContent.scrollTop = 0;
  } else if (page === "pengaturan") {
    pengaturanBtn.classList.add("selected");
    searchContainer.style.display = "none";
    renderSettings();
    mainContent.scrollTop = 0;
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

function getUiStyleMeta(styleKey) {
  return UI_STYLE_PRESETS.find((preset) => preset.key === styleKey) || UI_STYLE_PRESETS[0];
}

function getLayoutStyleMeta(layoutKey) {
  return LAYOUT_STYLE_PRESETS.find((preset) => preset.key === layoutKey) || LAYOUT_STYLE_PRESETS[0];
}

function getColorSchemeMeta(schemeKey) {
  return COLOR_SCHEME_PRESETS.find((preset) => preset.key === schemeKey) || COLOR_SCHEME_PRESETS[0];
}

function renderUiStyleOptions(activeStyle) {
  return UI_STYLE_PRESETS.map((preset) => {
    const isSelected = preset.key === activeStyle;
    return `
      <button
        class="ui-style-option ${isSelected ? "selected" : ""}"
        data-ui-style="${preset.key}"
        type="button"
        aria-pressed="${isSelected ? "true" : "false"}"
      >
        <span class="ui-style-preview ui-style-preview--${preset.key}" aria-hidden="true">
          <span class="ui-style-preview-bar"></span>
          <span class="ui-style-preview-search"></span>
          <span class="ui-style-preview-card"></span>
          <span class="ui-style-preview-card is-secondary"></span>
          <span class="ui-style-preview-nav">
            <span></span>
            <span class="is-active"></span>
            <span></span>
          </span>
        </span>
        <span class="ui-style-copy">
          <strong>${preset.label}</strong>
          <span>${preset.description}</span>
        </span>
      </button>
    `;
  }).join("");
}

function renderLayoutStyleOptions(activeLayout) {
  return LAYOUT_STYLE_PRESETS.map((preset) => {
    const isSelected = preset.key === activeLayout;
    return `
      <button
        class="layout-style-option ${isSelected ? "selected" : ""}"
        data-layout-style="${preset.key}"
        type="button"
        aria-pressed="${isSelected ? "true" : "false"}"
      >
        <span class="layout-style-preview layout-style-preview--${preset.key}" aria-hidden="true">
          <span class="layout-style-frame is-header"></span>
          <span class="layout-style-columns">
            <span></span>
            <span></span>
            <span></span>
          </span>
          <span class="layout-style-frame is-footer"></span>
        </span>
        <span class="ui-style-copy">
          <strong>${preset.label}</strong>
          <span>${preset.description}</span>
        </span>
      </button>
    `;
  }).join("");
}

function renderColorSchemeOptions(activeScheme) {
  return COLOR_SCHEME_PRESETS.map((preset) => {
    const isSelected = preset.key === activeScheme;
    return `
      <button
        class="color-scheme-option ${isSelected ? "selected" : ""}"
        data-color-scheme="${preset.key}"
        type="button"
        aria-pressed="${isSelected ? "true" : "false"}"
      >
        <span
          class="color-scheme-preview"
          aria-hidden="true"
          style="--scheme-swatch-1: ${preset.swatches[0]}; --scheme-swatch-2: ${preset.swatches[1]}; --scheme-swatch-3: ${preset.swatches[2]};"
        >
          <span class="color-scheme-swatch is-large"></span>
          <span class="color-scheme-swatch"></span>
          <span class="color-scheme-swatch"></span>
        </span>
        <span class="ui-style-copy">
          <strong>${preset.label}</strong>
          <span>${preset.description}</span>
        </span>
      </button>
    `;
  }).join("");
}

function renderDependencyCreditCards() {
  return APP_DEPENDENCY_CREDITS.map((dependency) => `
    <article class="dependency-card">
      <div class="dependency-card-head">
        <div class="dependency-card-identity">
          <span class="material-symbols-outlined dependency-card-icon">${dependency.icon}</span>
          <div class="dependency-card-copy">
            <h3>${dependency.name}</h3>
            <p>${dependency.provider}</p>
          </div>
        </div>
        <span class="dependency-badge">${dependency.category}</span>
      </div>
      <p class="dependency-card-text">${dependency.purpose}</p>
      <div class="dependency-meta">
        <span><strong>Versi:</strong> ${dependency.version}</span>
        <span><strong>Sumber:</strong> ${dependency.source}</span>
      </div>
    </article>
  `).join("");
}

function renderSettings() {
  const activeAccent = document.body.getAttribute("data-accent") || "gold";
  const activeUiStyle = getUiStyleMeta(prefs.uiStyle);
  const activeColorScheme = getColorSchemeMeta(prefs.colorScheme);
  const activeLayoutStyle = getLayoutStyleMeta(prefs.layoutStyle);
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
    <div class="settings-panel settings-panel-redesign">
      <section class="settings-hero">
        <div class="settings-hero-copy">
          <p class="settings-eyebrow">Appearance Studio</p>
          <h2>Rancang ulang pengalaman Kidung Rohani</h2>
          <p>Gabungkan gaya UI, skema warna shell, layout aplikasi, mode terang atau gelap, aksen utama, dan tampilan chord dari satu studio pengaturan.</p>
        </div>
        <div class="settings-hero-metrics">
          <div class="settings-hero-metric">
            <strong>${UI_STYLE_PRESETS.length}</strong>
            <span>gaya UI</span>
          </div>
          <div class="settings-hero-metric">
            <strong>${COLOR_SCHEME_PRESETS.length}</strong>
            <span>skema warna</span>
          </div>
          <div class="settings-hero-metric">
            <strong id="settings-active-style-label">${activeUiStyle.label}</strong>
            <span>style aktif</span>
          </div>
          <div class="settings-hero-metric">
            <strong>${LAYOUT_STYLE_PRESETS.length}</strong>
            <span>layout app</span>
          </div>
          <div class="settings-hero-metric">
            <strong id="settings-active-layout-label">${activeLayoutStyle.label}</strong>
            <span>layout aktif</span>
          </div>
          <div class="settings-hero-metric">
            <strong id="settings-active-scheme-label">${activeColorScheme.label}</strong>
            <span>skema aktif</span>
          </div>
        </div>
      </section>

      <div class="settings-layout-grid">
        <section class="settings-section settings-section-span">
          <div class="settings-section-heading">
            <h2 class="settings-section-title"><span class="material-symbols-outlined">palette</span> Theme Studio</h2>
            <p class="settings-section-caption">Pilih karakter visual aplikasi lalu padukan dengan skema shell, warna aksen, mode gelap, dan tuning chord.</p>
          </div>
          <div class="settings-card settings-card-studio">
            <div class="appearance-studio">
              <div class="appearance-style-gallery">
                ${renderUiStyleOptions(activeUiStyle.key)}
              </div>
              <div class="appearance-layout-gallery">
                ${renderLayoutStyleOptions(activeLayoutStyle.key)}
              </div>
              <div class="appearance-control-grid">
                <div class="settings-subcard settings-subcard--shell">
                  <div class="settings-inline-toggle">
                    <div class="settings-subcard-title">Mode tampilan, skema & aksen</div>
                    <label class="md-switch">
                      <input type="checkbox" id="dark-theme-toggle" ${document.body.classList.contains("dark-theme") || (!document.body.classList.contains("light-theme-forced") && window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) ? "checked" : ""}>
                      <span class="md-slider"></span>
                    </label>
                  </div>
                  <div class="settings-field">
                    <span class="settings-field-title">Skema warna aplikasi</span>
                    <div class="appearance-color-gallery">
                      ${renderColorSchemeOptions(activeColorScheme.key)}
                    </div>
                  </div>
                  <div class="settings-field">
                    <span class="settings-field-title">Warna aksen utama</span>
                    <div class="accent-palette accent-palette-studio">
                      ${accentPalette}
                    </div>
                  </div>
                  <div class="settings-inline-input">
                    <label for="custom-accent-input" class="settings-field-title">Warna kustom</label>
                    <input type="color" id="custom-accent-input" class="setting-color-input" value="${customAccentColor}" aria-label="Pilih warna custom accent">
                  </div>
                </div>
                <div class="settings-subcard settings-subcard--chord-style">
                  <div class="settings-subcard-title">Tema huruf & fill chord</div>
                  <div class="settings-inline-toggle settings-inline-toggle-wrap">
                    ${renderSettingLabel("sync", "Samakan Huruf Chord ke Tema Utama")}
                    <label class="md-switch">
                      <input type="checkbox" id="chord-sync-theme-toggle" ${chordUiPrefs.syncThemeWithAccent ? "checked" : ""}>
                      <span class="md-slider"></span>
                    </label>
                  </div>
                  <div class="settings-field">
                    <span class="settings-field-title">Tema huruf chord</span>
                    <div class="chord-theme-palette ${chordUiPrefs.syncThemeWithAccent ? "is-disabled" : ""}">
                      ${chordThemePalette}
                    </div>
                  </div>
                  <div class="settings-inline-toggle settings-inline-toggle-wrap">
                    ${renderSettingLabel("tune", "Samakan Fill Chord ke Tema Utama")}
                    <label class="md-switch">
                      <input type="checkbox" id="chord-sync-fill-toggle" ${chordUiPrefs.syncFillWithAccent ? "checked" : ""}>
                      <span class="md-slider"></span>
                    </label>
                  </div>
                  <div class="settings-field">
                    <span class="settings-field-title">Warna fill chord</span>
                    <div class="chord-fill-palette ${chordUiPrefs.syncFillWithAccent ? "is-disabled" : ""}">
                      ${chordFillPalette}
                    </div>
                  </div>
                </div>
                <div class="settings-subcard settings-subcard--tuning">
                  <div class="settings-subcard-title">Tuning chord</div>
                  <div class="setting-item setting-item-inline">
                    ${renderSettingLabel("format_color_fill", "Fill Chord")}
                    <div class="settings-custom-dropdown">
                      <button class="settings-dropdown-btn" type="button" aria-haspopup="listbox">
                        <span class="settings-dropdown-label" id="chord-fill-dropdown-label">${chordUiPrefs.fill === "soft" ? "Soft Rounded" : chordUiPrefs.fill === "solid" ? "Solid Rounded" : "Tanpa Fill"}</span>
                        <span class="material-symbols-outlined settings-dropdown-chevron">expand_more</span>
                      </button>
                      <div class="settings-dropdown-popover" role="listbox">
                        <button class="settings-dropdown-option ${chordUiPrefs.fill === "none" ? "selected" : ""}" type="button" data-settings-select="chord-fill-select" data-value="none"><span class="material-symbols-outlined">check</span>Tanpa Fill</button>
                        <button class="settings-dropdown-option ${chordUiPrefs.fill === "soft" ? "selected" : ""}" type="button" data-settings-select="chord-fill-select" data-value="soft"><span class="material-symbols-outlined">check</span>Soft Rounded</button>
                        <button class="settings-dropdown-option ${chordUiPrefs.fill === "solid" ? "selected" : ""}" type="button" data-settings-select="chord-fill-select" data-value="solid"><span class="material-symbols-outlined">check</span>Solid Rounded</button>
                      </div>
                      <select id="chord-fill-select" style="display:none;">
                        <option value="none" ${chordUiPrefs.fill === "none" ? "selected" : ""}>Tanpa Fill</option>
                        <option value="soft" ${chordUiPrefs.fill === "soft" ? "selected" : ""}>Soft Rounded</option>
                        <option value="solid" ${chordUiPrefs.fill === "solid" ? "selected" : ""}>Solid Rounded</option>
                      </select>
                    </div>
                  </div>
                  <div class="setting-item setting-item-slider compact-slider">
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
                  <div class="setting-item setting-item-slider compact-slider">
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
                  <div class="setting-item setting-item-slider compact-slider">
                    <span id="chord-fill-padding-label" class="setting-label">
                      <span class="material-symbols-outlined">padding</span>
                      <span>Padding Chord (${chordUiPrefs.fillPaddingPercent}%)</span>
                    </span>
                    <input
                      id="chord-fill-padding"
                      class="setting-range"
                      type="range"
                      min="0"
                      max="400"
                      step="10"
                      value="${chordUiPrefs.fillPaddingPercent}"
                    >
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section class="settings-section settings-section-span">
          <div class="settings-card settings-card-studio section-accented-card">
            <div class="section-accented-banner">
              <div class="section-accented-icon-bg">
                <span class="material-symbols-outlined">menu_book</span>
              </div>
              <div class="section-accented-copy">
                <p class="settings-eyebrow">Pengalaman Baca</p>
                <p class="section-accented-caption">Atur perilaku default saat membuka pujian dan cara chord disesuaikan.</p>
              </div>
            </div>
            <div class="section-accented-items">
              <div class="setting-item">
                ${renderSettingLabel("music_off", "Hindari Chord Awal ♯ / ♭")}
                <label class="md-switch">
                  <input type="checkbox" id="prefer-natural-chords-toggle" ${prefs.preferNaturalChords ? "checked" : ""}>
                  <span class="md-slider"></span>
                </label>
              </div>
              <div class="setting-divider"></div>
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
        </section>

        <section class="settings-section settings-section-span">
          <div class="settings-card settings-card-studio section-accented-card">
            <div class="section-accented-banner">
              <div class="section-accented-icon-bg">
                <span class="material-symbols-outlined">library_music</span>
              </div>
              <div class="section-accented-copy">
                <p class="settings-eyebrow">Audio & SoundFont</p>
                <p class="section-accented-caption">Kontrol kualitas instrumen dan strategi preload agar transisi tetap ringan.</p>
              </div>
            </div>
            <div class="section-accented-items">
              <div class="setting-item setting-item-select">
                ${renderSettingLabel("piano", "Pilih SoundFont")}
                <div class="settings-custom-dropdown">
                  <button class="settings-dropdown-btn" type="button" aria-haspopup="listbox">
                    <span class="settings-dropdown-label" id="soundfont-dropdown-label">${prefs.midiSoundfont === "assets/soundfont/TimGM6mb.sf2" ? "TimGM6mb (6 MB, Compact)" : "GeneralUser GS (30 MB, High Quality)"}</span>
                    <span class="material-symbols-outlined settings-dropdown-chevron">expand_more</span>
                  </button>
                  <div class="settings-dropdown-popover" role="listbox">
                    <button class="settings-dropdown-option ${prefs.midiSoundfont !== 'assets/soundfont/TimGM6mb.sf2' ? 'selected' : ''}" type="button" data-settings-select="soundfont-select" data-value="assets/soundfont/GeneralUser-GS.sf2"><span class="material-symbols-outlined">check</span>GeneralUser GS (30 MB, High Quality)</button>
                    <button class="settings-dropdown-option ${prefs.midiSoundfont === 'assets/soundfont/TimGM6mb.sf2' ? 'selected' : ''}" type="button" data-settings-select="soundfont-select" data-value="assets/soundfont/TimGM6mb.sf2"><span class="material-symbols-outlined">check</span>TimGM6mb (6 MB, Compact)</button>
                  </div>
                  <select id="soundfont-select" style="display:none;">
                    <option value="assets/soundfont/GeneralUser-GS.sf2" ${prefs.midiSoundfont === "assets/soundfont/GeneralUser-GS.sf2" ? "selected" : ""}>GeneralUser GS (30 MB, High Quality)</option>
                    <option value="assets/soundfont/TimGM6mb.sf2" ${prefs.midiSoundfont === "assets/soundfont/TimGM6mb.sf2" ? "selected" : ""}>TimGM6mb (6 MB, Compact)</option>
                  </select>
                </div>
              </div>
              <div class="setting-divider"></div>
              <div class="setting-item">
                ${renderSettingLabel("bolt", "Preload PDF & MIDI")}
                <label class="md-switch">
                  <input type="checkbox" id="preload-enabled-toggle" ${prefs.preloadEnabled !== false ? "checked" : ""}>
                  <span class="md-slider"></span>
                </label>
              </div>
              <div class="setting-divider"></div>
              <div class="setting-item setting-item-slider">
                <span id="preload-count-label" class="setting-label">
                  <span class="material-symbols-outlined">queue_music</span>
                  <span>Jumlah Preload (${prefs.preloadCount || 1} lagu sebelum & sesudah)</span>
                </span>
                <input
                  id="preload-count-range"
                  class="setting-range"
                  type="range"
                  min="1"
                  max="5"
                  step="1"
                  value="${prefs.preloadCount || 1}"
                  ${prefs.preloadEnabled === false ? "disabled" : ""}
                >
              </div>
              <div class="setting-divider"></div>
              <div class="setting-item setting-item-slider">
                <span id="preload-cache-max-label" class="setting-label">
                  <span class="material-symbols-outlined">inventory_2</span>
                  <span>Maksimum Cache Preload (${prefs.preloadCacheMax || 12} lagu)</span>
                </span>
                <input
                  id="preload-cache-max-range"
                  class="setting-range"
                  type="range"
                  min="1"
                  max="50"
                  step="1"
                  value="${prefs.preloadCacheMax || 12}"
                  ${prefs.preloadEnabled === false ? "disabled" : ""}
                >
              </div>
              <div class="setting-divider"></div>
              <div class="setting-item">
                ${renderSettingLabel("shuffle", "Preload saat Shuffle")}
                <label class="md-switch">
                  <input type="checkbox" id="preload-shuffle-toggle" ${prefs.preloadShuffle !== false ? "checked" : ""} ${prefs.preloadEnabled === false ? "disabled" : ""}>
                  <span class="md-slider"></span>
                </label>
              </div>
            </div>
          </div>
        </section>

        <section class="settings-section settings-section-span">
          <div class="settings-section-heading">
            <h2 class="settings-section-title"><span class="material-symbols-outlined">info</span> Info & Bantuan</h2>
            <p class="settings-section-caption">Akses ringkas ke latar belakang proyek dan jalur laporan bug.</p>
          </div>
          <div class="settings-link-grid">
            <div class="settings-card help-banner-card" id="about-project-btn" role="button" aria-label="Buka halaman tentang project" tabindex="0">
              <div class="help-banner-content">
                <span class="material-symbols-outlined help-banner-icon">info</span>
                <div class="help-banner-text">
                  <h3>Tentang Project Ini</h3>
                  <p>Latar belakang, informasi, dan tujuan pengembangan aplikasi.</p>
                </div>
              </div>
              <span class="material-symbols-outlined help-banner-arrow">chevron_right</span>
            </div>
            <div class="settings-card help-banner-card" id="report-bug-btn" role="button" aria-label="Buka halaman report bug" tabindex="0">
              <div class="help-banner-content">
                <span class="material-symbols-outlined help-banner-icon">support_agent</span>
                <div class="help-banner-text">
                  <h3>Hubungi Developer</h3>
                  <p>Laporkan bug, error, atau kirim saran untuk iterasi berikutnya.</p>
                </div>
              </div>
              <span class="material-symbols-outlined help-banner-arrow">chevron_right</span>
            </div>
          </div>
        </section>
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
        <div class="report-header-spacer"></div>
      </div>

      <div class="report-hero">
        <div class="report-hero-icon-bg">
          <span class="material-symbols-outlined report-hero-icon">info</span>
        </div>
        <h3>Latar Belakang & Informasi</h3>
        <p>Tujuan, perjalanan pengembangan, kontributor utama, dan kredit dependency yang menopang aplikasi Kidung Rohani.</p>
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

      <div class="report-section">
        <h3 class="section-badge"><span class="material-symbols-outlined">handshake</span> Credits & Dependencies</h3>
        <p class="report-section-caption">Kredit berikut merangkum komponen runtime, engine audio, font, ikon, dan tooling repository yang dipakai aplikasi ini.</p>
        <div class="dependency-section-summary about-dependency-summary">
          <div>
            <div class="settings-subcard-title">Stack aplikasi & kredit aset</div>
            <p class="settings-subcard-text">Seluruh dependency utama ditampilkan khusus di halaman ini agar informasi proyek tetap terpusat.</p>
          </div>
          <span class="dependency-count-badge">${APP_DEPENDENCY_CREDITS.length} entri</span>
        </div>
        <div class="dependency-credit-grid">
          ${renderDependencyCreditCards()}
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
        <div class="report-header-spacer"></div>
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
            <svg class="social-chip-instagram-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" width="18" height="18"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
            <span class="social-chip-platform">Instagram</span>
            <span class="social-chip-handle">@gilbert_then01</span>
          </a>
          <a class="social-chip" href="https://www.instagram.com/gys.pontianak/" target="_blank" rel="noopener noreferrer">
            <svg class="social-chip-instagram-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" width="18" height="18"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
            <span class="social-chip-platform">Instagram</span>
            <span class="social-chip-handle">@gys.pontianak</span>
          </a>
          <a class="social-chip" href="https://www.instagram.com/youthptk_gys/" target="_blank" rel="noopener noreferrer">
            <svg class="social-chip-instagram-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" width="18" height="18"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
            <span class="social-chip-platform">Instagram</span>
            <span class="social-chip-handle">@youthptk_gys</span>
          </a>
        </div>
      </div>
    </div>
  `;
}
