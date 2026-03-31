// --- 10. Handlers lainnya ---
function handleMainContentClick(e) {
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
  const nextColor = color || "blue";
  document.body.setAttribute("data-accent", nextColor);
  localStorage.setItem("accent", nextColor);

  if (nextColor === "custom") {
    document.documentElement.style.setProperty("--source-custom", customAccentColor);
    localStorage.setItem(ACCENT_CUSTOM_COLOR_KEY, customAccentColor);
  }
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
    document.body.classList.toggle("dark-theme", e.target.checked);
    localStorage.setItem("dark-theme", e.target.checked ? "1" : "0");
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
  // Show button only when viewer is active and there are chord pages
  const hasChords = chordConfig && Object.keys(chordConfig.pages).length > 0;
  const shouldShow = document.body.classList.contains("viewer-active") && hasChords;

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
  if (localStorage.getItem("dark-theme") === "1") {
    document.body.classList.add("dark-theme");
  }

  const storedAccent = localStorage.getItem("accent") || "blue";
  customAccentColor = localStorage.getItem(ACCENT_CUSTOM_COLOR_KEY) || DEFAULT_CUSTOM_ACCENT;
  document.documentElement.style.setProperty("--source-custom", customAccentColor);
  applyAccentSelection(storedAccent);

  try {
    const storedPrefs = localStorage.getItem("prefs");
    if (storedPrefs) {
      prefs = { ...prefs, ...JSON.parse(storedPrefs) };
    }
  } catch (error) {
    console.error("Gagal memuat preferensi:", error);
    localStorage.removeItem("prefs");
  }

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
