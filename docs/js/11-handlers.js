// --- 10. Handlers lainnya ---
function handleMainContentClick(e) {
  const uiStyleButton = e.target.closest(".ui-style-option");
  if (uiStyleButton) {
    const styleKey = uiStyleButton.dataset.uiStyle;
    const appliedStyle = applyUiStyleSelection(styleKey);
    const activeStyleLabel = document.getElementById("settings-active-style-label");
    const activeStyleMeta = UI_STYLE_PRESETS.find((preset) => preset.key === appliedStyle);
    if (activeStyleLabel && activeStyleMeta) {
      activeStyleLabel.textContent = activeStyleMeta.label;
    }
    document.querySelectorAll(".ui-style-option").forEach((button) => {
      const isSelected = button.dataset.uiStyle === appliedStyle;
      button.classList.toggle("selected", isSelected);
      button.setAttribute("aria-pressed", isSelected ? "true" : "false");
    });
    return;
  }

  const layoutStyleButton = e.target.closest(".layout-style-option");
  if (layoutStyleButton) {
    const layoutKey = layoutStyleButton.dataset.layoutStyle;
    const appliedLayout = applyLayoutStyleSelection(layoutKey);
    const activeLayoutLabel = document.getElementById("settings-active-layout-label");
    const activeLayoutMeta = LAYOUT_STYLE_PRESETS.find((preset) => preset.key === appliedLayout);
    if (activeLayoutLabel && activeLayoutMeta) {
      activeLayoutLabel.textContent = activeLayoutMeta.label;
    }
    document.querySelectorAll(".layout-style-option").forEach((button) => {
      const isSelected = button.dataset.layoutStyle === appliedLayout;
      button.classList.toggle("selected", isSelected);
      button.setAttribute("aria-pressed", isSelected ? "true" : "false");
    });
    return;
  }

  const colorSchemeButton = e.target.closest(".color-scheme-option");
  if (colorSchemeButton) {
    const schemeKey = colorSchemeButton.dataset.colorScheme;
    const appliedScheme = applyColorSchemeSelection(schemeKey);
    const activeSchemeLabel = document.getElementById("settings-active-scheme-label");
    const activeSchemeMeta = COLOR_SCHEME_PRESETS.find((preset) => preset.key === appliedScheme);
    if (activeSchemeLabel && activeSchemeMeta) {
      activeSchemeLabel.textContent = activeSchemeMeta.label;
    }
    document.querySelectorAll(".color-scheme-option").forEach((button) => {
      const isSelected = button.dataset.colorScheme === appliedScheme;
      button.classList.toggle("selected", isSelected);
      button.setAttribute("aria-pressed", isSelected ? "true" : "false");
    });
    return;
  }

  // Settings custom dropdown option selected
  const settingsDropdownOption = e.target.closest('[data-settings-select]');
  if (settingsDropdownOption) {
    const selectId = settingsDropdownOption.dataset.settingsSelect;
    const value = settingsDropdownOption.dataset.value;
    const hiddenSelect = document.getElementById(selectId);
    if (hiddenSelect) {
      hiddenSelect.value = value;
      hiddenSelect.dispatchEvent(new Event('change', { bubbles: true }));
    }
    // Update dropdown label
    const wrapper = settingsDropdownOption.closest('.settings-custom-dropdown');
    if (wrapper) {
      const label = wrapper.querySelector('.settings-dropdown-label');
      if (label) {
        // Use text content minus the check icon text
        label.textContent = settingsDropdownOption.textContent.replace(/^check\s*/, '').trim();
      }
      wrapper.querySelectorAll('.settings-dropdown-option').forEach(function(opt) {
        opt.classList.toggle('selected', opt === settingsDropdownOption);
      });
      wrapper.classList.remove('is-open');
      const btn = wrapper.querySelector('.settings-dropdown-btn');
      if (btn) btn.setAttribute('aria-expanded', 'false');
    }
    return;
  }

  // Settings custom dropdown toggle (open/close)
  const settingsDropdownBtn = e.target.closest('.settings-dropdown-btn');
  if (settingsDropdownBtn) {
    const wrapper = settingsDropdownBtn.closest('.settings-custom-dropdown');
    if (wrapper) {
      // Close all other open dropdowns first
      document.querySelectorAll('.settings-custom-dropdown.is-open').forEach(function(other) {
        if (other !== wrapper) {
          other.classList.remove('is-open');
          const btn = other.querySelector('.settings-dropdown-btn');
          if (btn) btn.setAttribute('aria-expanded', 'false');
        }
      });
      const isOpen = wrapper.classList.toggle('is-open');
      settingsDropdownBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    }
    return;
  }

  const aboutProjectBtn = e.target.closest("#about-project-btn");
  if (aboutProjectBtn) {
    navigateTo("about-project");
    return;
  }

  const aboutProjectBackBtn = e.target.closest("#about-project-back-btn");
  if (aboutProjectBackBtn) {
    navigateTo("pengaturan");
    return;
  }

  const reportBugBtn = e.target.closest("#report-bug-btn");
  if (reportBugBtn) {
    navigateTo("report-bug");
    return;
  }

  const reportBugBackBtn = e.target.closest("#report-bug-back-btn");
  if (reportBugBackBtn) {
    navigateTo("pengaturan");
    return;
  }

  const pujianItem = e.target.closest(".pujian-list li");
  if (pujianItem) {
    if (e.target.closest('.add-to-playlist-btn') || e.target.closest('button')) return;
    
    e.preventDefault();
    openPdfViewer(pujianItem.dataset.id);
    return;
  }

  const accentButton = e.target.closest(".accent-color");
  if (accentButton) {
    const color = accentButton.dataset.color;
    applyAccentSelection(color);

    const customInput = document.getElementById("custom-accent-input");
    if (customInput && color === "custom") {
      customInput.value = customAccentColor;
    }

    accentButton.parentElement.querySelector(".selected")?.classList.remove("selected");
    accentButton.classList.add("selected");

    if (chordUiPrefs.syncThemeWithAccent || chordUiPrefs.syncFillWithAccent) {
      rerenderViewerIfActive();
    }
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

function applyAccentSelection(color) {
  const nextColor = color || "gold";
  document.body.setAttribute("data-accent", nextColor);
  localStorage.setItem("accent", nextColor);

  if (nextColor === "custom") {
    document.documentElement.style.setProperty("--source-custom", customAccentColor);
    localStorage.setItem(ACCENT_CUSTOM_COLOR_KEY, customAccentColor);
  }
}

function applyColorSchemeSelection(schemeKey, persist = true) {
  const validKeys = new Set(COLOR_SCHEME_PRESETS.map((preset) => preset.key));
  const fallbackScheme = COLOR_SCHEME_PRESETS[0]?.key || "warm";
  const nextScheme = validKeys.has(schemeKey) ? schemeKey : fallbackScheme;

  document.documentElement.setAttribute("data-color-scheme", nextScheme);
  document.body.setAttribute("data-color-scheme", nextScheme);

  if (typeof prefs === "object" && prefs) {
    prefs.colorScheme = nextScheme;
    if (persist) {
      localStorage.setItem("prefs", JSON.stringify(prefs));
    }
  }

  return nextScheme;
}

function isEffectiveDarkTheme() {
  if (document.body.classList.contains("dark-theme")) {
    return true;
  }
  if (document.body.classList.contains("light-theme-forced")) {
    return false;
  }
  return !!(window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);
}

function syncHeaderBranding() {
  const logoElement = document.getElementById("app-header-logo");
  const brandElement = document.querySelector(".app-brand");
  if (!logoElement || !brandElement || typeof HEADER_LOGO_VARIANTS !== "object") {
    return;
  }

  const activeStyle = UI_STYLE_PRESETS.find((preset) => preset.key === document.body.getAttribute("data-ui-style")) || UI_STYLE_PRESETS[0];
  const variantKey = isEffectiveDarkTheme() ? "white" : (activeStyle?.logoVariant || "color");
  const nextLogo = HEADER_LOGO_VARIANTS[variantKey] || HEADER_LOGO_VARIANTS.color;

  logoElement.src = nextLogo.src;
  logoElement.alt = nextLogo.alt;
  brandElement.setAttribute("data-logo-variant", variantKey);
}

function applyUiStyleSelection(styleKey, persist = true) {
  const validKeys = new Set(UI_STYLE_PRESETS.map((preset) => preset.key));
  const fallbackStyle = UI_STYLE_PRESETS[0]?.key || "sanctuary";
  const nextStyle = validKeys.has(styleKey) ? styleKey : fallbackStyle;

  document.body.setAttribute("data-ui-style", nextStyle);
  syncHeaderBranding();

  if (typeof prefs === "object" && prefs) {
    prefs.uiStyle = nextStyle;
    if (persist) {
      localStorage.setItem("prefs", JSON.stringify(prefs));
    }
  }

  return nextStyle;
}

function applyLayoutStyleSelection(layoutKey, persist = true) {
  const validKeys = new Set(LAYOUT_STYLE_PRESETS.map((preset) => preset.key));
  const fallbackLayout = LAYOUT_STYLE_PRESETS[0]?.key || "balanced";
  const nextLayout = validKeys.has(layoutKey) ? layoutKey : fallbackLayout;

  document.documentElement.setAttribute("data-layout-style", nextLayout);
  document.body.setAttribute("data-layout-style", nextLayout);

  if (typeof prefs === "object" && prefs) {
    prefs.layoutStyle = nextLayout;
    if (persist) {
      localStorage.setItem("prefs", JSON.stringify(prefs));
    }
  }

  return nextLayout;
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
  fitListTitles();
}

function handleSettingsChange(e) {
  const targetId = e.target.id;
  if (targetId === "dark-theme-toggle") {
    const wantDark = e.target.checked;
    document.body.classList.toggle("dark-theme", wantDark);
    // On dark-scheme devices, force light theme when user explicitly disables dark mode
    if (!wantDark) {
      document.body.classList.add("light-theme-forced");
    } else {
      document.body.classList.remove("light-theme-forced");
      // Ensure dark-theme class is set even if previously relying on OS preference
      document.body.classList.add("dark-theme");
    }
    localStorage.setItem("dark-theme", wantDark ? "1" : "0");
    syncHeaderBranding();
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
  } else if (targetId === "prefer-natural-chords-toggle") {
    prefs.preferNaturalChords = e.target.checked;
    localStorage.setItem("prefs", JSON.stringify(prefs));
  } else if (targetId === "preload-enabled-toggle") {
    prefs.preloadEnabled = e.target.checked;
    localStorage.setItem("prefs", JSON.stringify(prefs));
    var countRange = document.getElementById("preload-count-range");
    var cacheMaxRange = document.getElementById("preload-cache-max-range");
    var shuffleToggle = document.getElementById("preload-shuffle-toggle");
    if (countRange) countRange.disabled = !e.target.checked;
    if (cacheMaxRange) cacheMaxRange.disabled = !e.target.checked;
    if (shuffleToggle) shuffleToggle.disabled = !e.target.checked;
  } else if (targetId === "preload-count-range") {
    prefs.preloadCount = Number.parseInt(e.target.value, 10);
    localStorage.setItem("prefs", JSON.stringify(prefs));
    var countLabel = document.getElementById("preload-count-label");
    if (countLabel) {
      countLabel.innerHTML = '<span class="material-symbols-outlined">queue_music</span><span>Jumlah Preload (' + prefs.preloadCount + ' lagu sebelum &amp; sesudah)</span>';
    }
  } else if (targetId === "preload-cache-max-range") {
    prefs.preloadCacheMax = Number.parseInt(e.target.value, 10) || 12;
    localStorage.setItem("prefs", JSON.stringify(prefs));
    var cacheMaxLabel = document.getElementById("preload-cache-max-label");
    if (cacheMaxLabel) {
      cacheMaxLabel.innerHTML = '<span class="material-symbols-outlined">inventory_2</span><span>Maksimum Cache Preload (' + prefs.preloadCacheMax + ' lagu)</span>';
    }
    if (typeof MidiEngine !== 'undefined' && typeof MidiEngine.setPreloadCacheMax === 'function') {
      MidiEngine.setPreloadCacheMax(prefs.preloadCacheMax);
    }
  } else if (targetId === "preload-shuffle-toggle") {
    prefs.preloadShuffle = e.target.checked;
    localStorage.setItem("prefs", JSON.stringify(prefs));
  } else if (targetId === "soundfont-select") {
    var nextSf = (typeof normalizeSoundfontKey === 'function')
      ? normalizeSoundfontKey(e.target.value)
      : e.target.value;
    var requestId = ++soundfontSwitchRequestId;
    var previousInstrument = String((prefs && prefs.midiInstrument) || '');

    prefs.midiSoundfont = nextSf;
    if (!prefs.midiInstrumentBySoundfont || typeof prefs.midiInstrumentBySoundfont !== 'object') {
      prefs.midiInstrumentBySoundfont = {};
    }
    if (typeof resolveSoundfontInstrumentProgram === 'function') {
      prefs.midiInstrument = resolveSoundfontInstrumentProgram(nextSf, prefs.midiInstrumentBySoundfont[nextSf] || '');
    }
    if (e.target.value !== nextSf) e.target.value = nextSf;
    localStorage.setItem("prefs", JSON.stringify(prefs));

    isSoundfontSwitching = true;
    document
      .querySelectorAll(".instrument-selector-wrapper.is-open")
      .forEach(function (wrapper) {
        wrapper.classList.remove("is-open");
        var capBtn = wrapper.querySelector(".instrument-capsule-btn");
        if (capBtn) capBtn.setAttribute("aria-expanded", "false");
      });

    if (typeof MidiEngine !== "undefined" && MidiEngine.changeSoundFont) {
      MidiEngine.changeSoundFont(nextSf)
        .then(function () {
          if (requestId !== soundfontSwitchRequestId) return;
          // Re-sync once the new SoundFont is fully loaded.
          if (typeof rebuildInstrumentSelectors === 'function') {
            rebuildInstrumentSelectors(nextSf);
          }
          isSoundfontSwitching = false;
          if (
            typeof changeInstrument === 'function' &&
            typeof MidiEngine !== 'undefined' &&
            MidiEngine.getCurrentMidiUrl() &&
            String(prefs.midiInstrument || '') !== String(previousInstrument)
          ) {
            return changeInstrument();
          }
        })
        .catch(function (err) {
          if (requestId !== soundfontSwitchRequestId) return;
          isSoundfontSwitching = false;
          console.warn('Gagal ganti SoundFont:', err);
          if (typeof showToast === 'function') {
            showToast('Gagal memuat SoundFont baru', 'error');
          }
        });
    } else {
      if (typeof rebuildInstrumentSelectors === 'function') {
        rebuildInstrumentSelectors(nextSf);
      }
      isSoundfontSwitching = false;
    }
  } else if (targetId === "chord-fill-select") {
    chordUiPrefs.fill = e.target.value;
    persistChordUiPrefs();
    rerenderViewerIfActive();
  } else if (targetId === "chord-sync-theme-toggle") {
    chordUiPrefs.syncThemeWithAccent = e.target.checked;
    persistChordUiPrefs();
    const palette = document.querySelector(".chord-theme-palette");
    if (palette) {
      if (chordUiPrefs.syncThemeWithAccent) palette.classList.add("is-disabled");
      else palette.classList.remove("is-disabled");
    }
    rerenderViewerIfActive();
  } else if (targetId === "chord-sync-fill-toggle") {
    chordUiPrefs.syncFillWithAccent = e.target.checked;
    persistChordUiPrefs();
    const palette = document.querySelector(".chord-fill-palette");
    if (palette) {
      if (chordUiPrefs.syncFillWithAccent) palette.classList.add("is-disabled");
      else palette.classList.remove("is-disabled");
    }
    rerenderViewerIfActive();
  } else if (targetId === "custom-accent-input") {
    customAccentColor = e.target.value || DEFAULT_CUSTOM_ACCENT;
    document.documentElement.style.setProperty("--source-custom", customAccentColor);
    localStorage.setItem(ACCENT_CUSTOM_COLOR_KEY, customAccentColor);

    const currentAccent = document.body.getAttribute("data-accent");
    if (currentAccent !== "custom") {
      applyAccentSelection("custom");
    }

    const customAccentBtn = document.querySelector('.accent-color[data-color="custom"]');
    const accentPalette = customAccentBtn?.parentElement;
    accentPalette?.querySelector(".selected")?.classList.remove("selected");
    customAccentBtn?.classList.add("selected");

    if (chordUiPrefs.syncThemeWithAccent || chordUiPrefs.syncFillWithAccent) {
      rerenderViewerIfActive();
    }
  } else if (targetId === "chord-font-override") {
    chordUiPrefs.fontOverridePercent = Number.parseInt(e.target.value, 10);
    persistChordUiPrefs();
    rerenderViewerIfActive();
    updateChordSettingsLabels();
  } else if (targetId === "chord-fill-opacity") {
    chordUiPrefs.fillOpacityPercent = Number.parseInt(e.target.value, 10);
    persistChordUiPrefs();
    rerenderViewerIfActive();
    updateChordSettingsLabels();
  } else if (targetId === "chord-fill-padding") {
    chordUiPrefs.fillPaddingPercent = Number.parseInt(e.target.value, 10);
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
  const overrideLabel = document.getElementById("chord-font-override-label");
  if (overrideLabel) {
    const labelText = overrideLabel.querySelector("span:last-child");
    if (labelText) {
      labelText.textContent = `Ukuran Font Chord (${chordUiPrefs.fontOverridePercent}%)`;
    }
  }
  const opacityLabel = document.getElementById("chord-opacity-label");
  if (opacityLabel) {
    const opacityText = opacityLabel.querySelector("span:last-child");
    if (opacityText) {
      opacityText.textContent = `Opacity Latar Chord (${chordUiPrefs.fillOpacityPercent}%)`;
    }
  }
  const paddingLabel = document.getElementById("chord-fill-padding-label");
  if (paddingLabel) {
    const paddingText = paddingLabel.querySelector("span:last-child");
    if (paddingText) {
      paddingText.textContent = `Padding Chord (${chordUiPrefs.fillPaddingPercent}%)`;
    }
  }
}

// --- Toggle Hide Chord ---
function onToggleChordsHidden() {
  chordsHidden = !chordsHidden;
  document.querySelectorAll(".chord-layer").forEach((layer) => {
    layer.classList.toggle("is-hidden", chordsHidden);
  });
  updateHideChordButton();
}

function updateHideChordButton() {
  // Show button only when viewer is active and there are chord pages (either format)
  const hasOldChords = chordConfig && Object.keys(chordConfig.pages).length > 0;
  const hasNewChords = typeof hasNoteAlignedChords === "function" && hasNoteAlignedChords();
  const shouldShow = document.body.classList.contains("viewer-active") && (hasOldChords || hasNewChords);

  hideChordBtns.forEach((btn) => {
    btn.style.display = shouldShow ? "" : "none";
    const icon = btn.querySelector(".material-symbols-outlined");
    if (icon) {
      icon.textContent = chordsHidden ? "music_off" : "music_note";
    }
    btn.setAttribute("aria-label", chordsHidden ? "Tampilkan chord" : "Sembunyikan chord");
  });
}

function applyStoredPreferences() {
  const darkPref = localStorage.getItem("dark-theme");
  if (darkPref === "1") {
    document.body.classList.add("dark-theme");
    document.body.classList.remove("light-theme-forced");
  } else if (darkPref === "0") {
    document.body.classList.remove("dark-theme");
    // Explicitly chose light mode — force it on dark-scheme devices
    document.body.classList.add("light-theme-forced");
  }
  // If darkPref is null (never set), respect OS preference (no classes added)

  const storedAccent = localStorage.getItem("accent") || "gold";
  customAccentColor = localStorage.getItem(ACCENT_CUSTOM_COLOR_KEY) || DEFAULT_CUSTOM_ACCENT;
  document.documentElement.style.setProperty("--source-custom", customAccentColor);
  applyAccentSelection(storedAccent);

  try {
    const storedPrefs = localStorage.getItem("prefs");
    if (storedPrefs) {
      prefs = { ...prefs, ...JSON.parse(storedPrefs) };
    }
    const validColorSchemeKeys = new Set(COLOR_SCHEME_PRESETS.map((item) => item.key));
    const validUiStyleKeys = new Set(UI_STYLE_PRESETS.map((item) => item.key));
    const validLayoutStyleKeys = new Set(LAYOUT_STYLE_PRESETS.map((item) => item.key));
    if (!validColorSchemeKeys.has(prefs.colorScheme)) {
      prefs.colorScheme = COLOR_SCHEME_PRESETS[0]?.key || "warm";
    }
    if (!validUiStyleKeys.has(prefs.uiStyle)) {
      prefs.uiStyle = UI_STYLE_PRESETS[0]?.key || "sanctuary";
    }
    if (!validLayoutStyleKeys.has(prefs.layoutStyle)) {
      prefs.layoutStyle = LAYOUT_STYLE_PRESETS[0]?.key || "balanced";
    }
    applyColorSchemeSelection(prefs.colorScheme, false);
    applyUiStyleSelection(prefs.uiStyle, false);
    applyLayoutStyleSelection(prefs.layoutStyle, false);
    if (!prefs.midiInstrumentBySoundfont || typeof prefs.midiInstrumentBySoundfont !== 'object') {
      prefs.midiInstrumentBySoundfont = {};
    }
    if (!Number.isFinite(Number(prefs.preloadCacheMax)) || Number(prefs.preloadCacheMax) < 1) {
      prefs.preloadCacheMax = 12;
    }
    // Canonicalize stored soundfont URL/path to a known key.
    if (prefs.midiSoundfont) {
      var normalizedSf = (typeof normalizeSoundfontKey === 'function')
        ? normalizeSoundfontKey(prefs.midiSoundfont)
        : prefs.midiSoundfont;
      if (prefs.midiSoundfont !== normalizedSf) {
        prefs.midiSoundfont = normalizedSf;
      }
      var rememberedInstrument = prefs.midiInstrumentBySoundfont[prefs.midiSoundfont];
      if (rememberedInstrument != null && String(rememberedInstrument) !== '') {
        prefs.midiInstrument = String(rememberedInstrument);
      } else if (prefs.midiInstrument != null && String(prefs.midiInstrument) !== '') {
        prefs.midiInstrument = String(prefs.midiInstrument);
        prefs.midiInstrumentBySoundfont[prefs.midiSoundfont] = prefs.midiInstrument;
      } else {
        prefs.midiInstrument = '';
      }
      prefs.midiInstrumentUserSelected = String(prefs.midiInstrument || '') !== '';
      localStorage.setItem('prefs', JSON.stringify(prefs));
    }
    if (typeof MidiEngine !== 'undefined' && typeof MidiEngine.setPreloadCacheMax === 'function') {
      MidiEngine.setPreloadCacheMax(prefs.preloadCacheMax || 12);
    }
  } catch (error) {
    console.error("Gagal memuat preferensi:", error);
    localStorage.removeItem("prefs");
    applyColorSchemeSelection(COLOR_SCHEME_PRESETS[0]?.key || "warm", false);
    applyUiStyleSelection(UI_STYLE_PRESETS[0]?.key || "sanctuary", false);
    applyLayoutStyleSelection(LAYOUT_STYLE_PRESETS[0]?.key || "balanced", false);
  }

  syncHeaderBranding();

  try {
    const storedChordUi = localStorage.getItem(CHORD_UI_STORAGE_KEY);
    if (storedChordUi) {
      const parsed = JSON.parse(storedChordUi);
      const validThemeKeys = new Set(CHORD_THEME_PRESETS.map((item) => item.key));
      const validFillKeys = new Set(CHORD_FILL_PRESETS.map((item) => item.key));
      chordUiPrefs = {
        ...chordUiPrefs,
        ...parsed,
        theme: validThemeKeys.has(parsed.theme) ? parsed.theme : chordUiPrefs.theme,
        fillColor: validFillKeys.has(parsed.fillColor) ? parsed.fillColor : chordUiPrefs.fillColor,
        fontOverridePercent: Number.isFinite(Number(parsed.fontOverridePercent))
          ? Number(parsed.fontOverridePercent)
          : chordUiPrefs.fontOverridePercent,
        fillOpacityPercent: Number.isFinite(Number(parsed.fillOpacityPercent))
          ? Number(parsed.fillOpacityPercent)
          : chordUiPrefs.fillOpacityPercent,
        syncThemeWithAccent: parsed.syncThemeWithAccent === true,
        syncFillWithAccent: parsed.syncFillWithAccent === true
      };
    }
  } catch (error) {
    console.error("Gagal memuat preferensi tampilan chord:", error);
    localStorage.removeItem(CHORD_UI_STORAGE_KEY);
  }
}

document.addEventListener("DOMContentLoaded", init);
