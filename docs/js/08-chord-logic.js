// --- 7. Chord Overlay Logic ---
function createDefaultChordConfig() {
  return {
    version: 1,
    grid: { ...CHORD_GRID },
    pages: {}
  };
}

function sanitizeChordConfig(rawConfig) {
  const safe = createDefaultChordConfig();
  if (!rawConfig || typeof rawConfig !== "object") return safe;

  if (rawConfig.grid && Number.isFinite(rawConfig.grid.cols) && Number.isFinite(rawConfig.grid.rows)) {
    safe.grid.cols = Math.max(1, Math.round(rawConfig.grid.cols));
    safe.grid.rows = Math.max(1, Math.round(rawConfig.grid.rows));
  }

  if (rawConfig.pages && typeof rawConfig.pages === "object") {
    Object.entries(rawConfig.pages).forEach(([pageKey, entries]) => {
      if (!Array.isArray(entries)) return;

      const validEntries = entries
        .map((entry) => ({
          row: Math.max(1, Math.min(safe.grid.rows, Number.parseInt(entry.row, 10) || 1)),
          col: Math.max(1, Math.min(safe.grid.cols, Number.parseInt(entry.col, 10) || 1)),
          text: typeof entry.text === "string" ? entry.text.trim() : ""
        }))
        .filter((entry) => entry.text.length > 0);

      if (validEntries.length > 0) {
        safe.pages[pageKey] = validEntries;
      }
    });
  }

  return safe;
}

async function loadChordConfigurationForSong(song) {
  chordConfig = createDefaultChordConfig();
  const txtUrl = getChordTxtUrl(song);

  try {
    const response = await fetch(txtUrl, { cache: "no-store" });
    if (!response.ok) return;

    const payload = await response.text();
    const parsed = JSON.parse(payload);
    chordConfig = sanitizeChordConfig(parsed);
  } catch {
    chordConfig = createDefaultChordConfig();
  }
}

function getChordTxtUrl(song) {
  return song.fileHref.replace(/\.pdf$/i, ".txt");
}

function getChordTxtFilename(song) {
  return decodeURIComponent(song.fileHref.split("/").pop() || "chord.txt").replace(/\.pdf$/i, ".txt");
}

function createChordLayer(pageNum) {
  const layer = document.createElement("div");
  layer.className = `chord-layer ${chordEditorEnabled ? "editor-mode show-grid" : "viewer-mode"}`;
  if (chordsHidden) layer.classList.add("is-hidden");
  layer.dataset.pageNum = String(pageNum);
  layer.style.setProperty("--grid-cols", String(chordConfig.grid.cols));
  layer.style.setProperty("--grid-rows", String(chordConfig.grid.rows));

  const entries = Array.isArray(chordConfig.pages[String(pageNum)]) ? chordConfig.pages[String(pageNum)] : [];

  if (chordEditorEnabled) {
    const activeRows = new Set();
    const activeCols = new Set();
    entries.forEach((entry) => {
      if (entry.text && entry.text.trim()) {
        activeRows.add(entry.row);
        activeCols.add(entry.col);
      }
    });

    activeRows.forEach((row) => {
      const rowHighlight = document.createElement("div");
      rowHighlight.className = "chord-highlight-row";
      rowHighlight.style.setProperty("--row", String(row));
      layer.appendChild(rowHighlight);
    });

    activeCols.forEach((col) => {
      const colHighlight = document.createElement("div");
      colHighlight.className = "chord-highlight-col";
      colHighlight.style.setProperty("--col", String(col));
      layer.appendChild(colHighlight);
    });
  }

  entries.forEach((entry) => {
    layer.appendChild(createChordMarkerElement(entry));
  });

  return layer;
}

function createChordMarkerElement(entry) {
  const marker = document.createElement("span");
  marker.className = "chord-marker";
  marker.classList.add(`chord-theme-${chordUiPrefs.theme}`);
  marker.classList.add(`chord-fill-${chordUiPrefs.fill}`);
  marker.classList.add(`chord-fill-color-${chordUiPrefs.fillColor}`);
  if (chordUiPrefs.syncThemeWithAccent) {
    marker.classList.add("chord-theme-accent");
  }
  if (chordUiPrefs.syncFillWithAccent) {
    marker.classList.add("chord-fill-color-accent");
  }
  marker.dataset.row = String(entry.row);
  marker.dataset.col = String(entry.col);
  marker.dataset.raw = entry.text;
  marker.textContent = formatChordForDisplay(entry.text);
  marker.style.setProperty("--chord-font-size", `${getChordFontSizeRem()}rem`);
  marker.style.setProperty("--chord-fill-opacity", `${chordUiPrefs.fillOpacityPercent}%`);

  const xPercent = ((entry.col - 0.5) / chordConfig.grid.cols) * 100;
  const yPercent = ((entry.row - 0.5) / chordConfig.grid.rows) * 100;
  marker.style.left = `${xPercent}%`;
  marker.style.top = `${yPercent}%`;

  return marker;
}

function getChordFontSizeRem() {
  // Skala dasar yang sangat adaptif. Menghitung fisik scale PDF ke dimensi CSS layar saat ini.
  // Memastikan chord ikut membesar/mengecil mengikuti teks PDF di ukuran layar berapapun (1080p, 4K, maupun HP).
  const pdfScale = (typeof currentScale === "number" && Number.isFinite(currentScale)) ? currentScale : 1;

  // Angka 0.55 adalah konstanta aproksimasi (diturunkan lebih jauh agar ukuran default 100% lebih wajar/kecil di desktop)
  const adaptiveBase = 0.55 * pdfScale;

  const size = adaptiveBase * (chordUiPrefs.fontOverridePercent / 100);
  return Math.min(20.0, Math.max(0.2, size));
}

function onChordLayerClick(event) {
  if (!chordEditorEnabled || !pdfDoc || !document.body.classList.contains("viewer-active")) return;

  const marker = event.target.closest(".chord-marker");
  if (marker) {
    event.preventDefault();
    event.stopPropagation();

    const layer = marker.closest(".chord-layer");
    const pageNum = Number.parseInt(layer?.dataset.pageNum || "0", 10);
    const row = Number.parseInt(marker.dataset.row, 10);
    const col = Number.parseInt(marker.dataset.col, 10);
    const existing = marker.dataset.raw || "";

    promptAndSetChord(pageNum, row, col, existing);
    return;
  }

  const layer = event.target.closest(".chord-layer.editor-mode");
  if (!layer) return;

  const pageNum = Number.parseInt(layer.dataset.pageNum || "0", 10);
  if (!pageNum) return;

  const rect = layer.getBoundingClientRect();
  const relativeX = event.clientX - rect.left;
  const relativeY = event.clientY - rect.top;

  const col = Math.max(1, Math.min(chordConfig.grid.cols, Math.floor((relativeX / rect.width) * chordConfig.grid.cols) + 1));
  const row = Math.max(1, Math.min(chordConfig.grid.rows, Math.floor((relativeY / rect.height) * chordConfig.grid.rows) + 1));

  const existing = getChordAt(pageNum, row, col);
  promptAndSetChord(pageNum, row, col, existing);
}

function promptAndSetChord(pageNum, row, col, existingText = "") {
  const promptDefault = existingText ? formatChordForDisplay(existingText) : "";
  const userInput = window.prompt(
    "Masukkan chord (contoh: C, C♯, B♭, Fdim, Aadd9).\nKosongkan untuk hapus chord di sel ini.",
    promptDefault
  );

  if (userInput === null) return;

  const encoded = encodeChordToken(userInput);
  if (encoded === null) {
    alert("Format chord tidak valid. Gunakan root A-G lalu optional #/b dan tag (dim, add9, dst).");
    return;
  }

  setChordAt(pageNum, row, col, encoded);
  renderPage(currentPageNum);
}

function encodeChordToken(input) {
  const raw = String(input || "").trim();
  if (!raw) return "";

  const match = raw.match(/^([A-Ga-g1-7])([#♯b♭]?)(.*)$/);
  if (!match) return null;

  const rootRaw = match[1];
  const accidentalRaw = match[2] || "";
  const suffix = (match[3] || "").trim();

  const rootLetter = /[1-7]/.test(rootRaw) ? NUMBER_TO_NOTE[rootRaw] : rootRaw.toUpperCase();
  const naturalIndex = NATURAL_NOTE_INDEX[rootLetter];
  if (!Number.isInteger(naturalIndex)) return null;

  const accidental = accidentalRaw === "♭" ? "b" : accidentalRaw === "♯" ? "#" : accidentalRaw;
  let semitone = naturalIndex;
  if (accidental === "#") semitone += 1;
  if (accidental === "b") semitone -= 1;

  const normalizedRoot = NOTE_NAMES_SHARP[wrapSemitone(semitone)];
  return `${normalizedRoot}${suffix}`;
}

function formatChordForDisplay(encodedToken) {
  const token = String(encodedToken || "").trim();
  const parsed = parseChordToken(token);
  if (!parsed) return token;

  const noteSet = accidentalMode === "flat" ? NOTE_NAMES_FLAT : NOTE_NAMES_SHARP;
  const transposed = wrapSemitone(parsed.semitone + transposeStep);
  
  // Replace 'b' with '♭' and '#' with '♯' in suffix for common chord extensions and slash chords
  let displaySuffix = parsed.suffix;
  if (accidentalMode === "flat") {
    displaySuffix = displaySuffix
      .replace(/b(\d+)/g, "♭$1") // Matches b5, b9, b13, etc.
      .replace(/\/([A-G])b/gi, "/$1♭"); // Matches slash chords like /Bb or /db
  } else {
    displaySuffix = displaySuffix
      .replace(/#(\d+)/g, "♯$1") // Matches #5, #9, #11, etc.
      .replace(/\/([A-G])#/gi, "/$1♯"); // Matches slash chords like /F# or /f#
  }
  
  // Globally replace any remaining standalone sharp/flat in suffix just in case it didn't match the specific patterns
  displaySuffix = displaySuffix.replace(/#/g, "♯").replace(/♭/g, "♭"); // `♭` replacement already mostly handled, but we explicitly replace `#` with `♯`

  return `${noteSet[transposed]}${displaySuffix}`;
}

function parseChordToken(token) {
  const newFormat = token.match(/^([A-Ga-g])([#♯b♭]?)(.*)$/);
  if (newFormat) {
    const root = newFormat[1].toUpperCase();
    const accidentalRaw = newFormat[2] || "";
    const suffix = newFormat[3] || "";
    
    const accidental = accidentalRaw === "♭" ? "b" : accidentalRaw === "♯" ? "#" : accidentalRaw;

    let semitone = NATURAL_NOTE_INDEX[root];
    if (!Number.isInteger(semitone)) return null;
    if (accidental === "#") semitone += 1;
    if (accidental === "b") semitone -= 1;

    return { semitone: wrapSemitone(semitone), suffix };
  }

  const legacyFormat = token.match(/^([1-7])([#♯b♭]?)(.*)$/);
  if (!legacyFormat) return null;

  const legacyRoot = NUMBER_TO_NOTE[legacyFormat[1]];
  let semitone = NATURAL_NOTE_INDEX[legacyRoot];
  const accidentalRaw = legacyFormat[2] || "";
  const suffix = legacyFormat[3] || "";
  
  const accidental = accidentalRaw === "♭" ? "b" : accidentalRaw === "♯" ? "#" : accidentalRaw;

  if (accidental === "#") semitone += 1;
  if (accidental === "b") semitone -= 1;
  return { semitone: wrapSemitone(semitone), suffix };
}

function wrapSemitone(value) {
  return ((value % 12) + 12) % 12;
}

function onTranspose(step) {
  const next = transposeStep + step;
  transposeStep = next > 11 || next < -11 ? 0 : next;
  updateTransposeUI();
  refreshVisibleChordMarkers();
}

function updateTransposeUI(options = {}) {
  const { animateAccidental = false } = options;
  const sign = transposeStep > 0 ? "+" : "";
  transposeIndicators.forEach((indicator) => {
    indicator.textContent = `Transpose ${sign}${transposeStep}`;
  });

  accidentalSwitchBtns.forEach((btn) => {
    btn.classList.toggle("active", accidentalMode === "flat");
    const label = btn.querySelector(".accidental-label");
    if (label) {
      const newText = accidentalMode === "flat" ? "♭" : "♯";
      if (animateAccidental && label.textContent !== newText) {
        label.style.animation = "none";
        void label.offsetWidth; // Trigger reflow
        label.style.animation = "flipAccidental 0.3s ease-in-out forwards";
        if (label.dataset.flipTimer) clearTimeout(Number(label.dataset.flipTimer));
        label.dataset.flipTimer = setTimeout(() => {
          label.textContent = newText;
        }, 150);
      } else {
        label.textContent = newText;
      }
    }
    btn.setAttribute("aria-label", `Switcher accidental (${accidentalMode === "flat" ? "flat" : "sharp"})`);
  });
}

function onToggleAccidentalMode() {
  accidentalMode = accidentalMode === "sharp" ? "flat" : "sharp";
  localStorage.setItem(CHORD_ACCIDENTAL_STORAGE_KEY, accidentalMode);
  updateTransposeUI({ animateAccidental: true });
  refreshVisibleChordMarkers();
}

function refreshVisibleChordMarkers() {
  document.querySelectorAll(".chord-marker").forEach((marker) => {
    const existingTimer = chordDissolveTimers.get(marker);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    marker.classList.remove("is-dissolving", "is-dissolving-out", "is-dissolving-in");
    void marker.offsetWidth;
    marker.classList.add("is-dissolving-out");

    const timeoutId = setTimeout(() => {
      marker.textContent = formatChordForDisplay(marker.dataset.raw || "");
      marker.classList.remove("is-dissolving-out");
      marker.classList.add("is-dissolving-in");

      const cleanupId = setTimeout(() => {
        marker.classList.remove("is-dissolving-in");
        chordDissolveTimers.delete(marker);
      }, TRANSPOSE_DISSOLVE_IN_MS);

      chordDissolveTimers.set(marker, cleanupId);
    }, TRANSPOSE_DISSOLVE_OUT_MS);

    chordDissolveTimers.set(marker, timeoutId);
  });
}

function getChordAt(pageNum, row, col) {
  const pageKey = String(pageNum);
  const entries = chordConfig.pages[pageKey];
  if (!Array.isArray(entries)) return "";

  const found = entries.find((entry) => entry.row === row && entry.col === col);
  return found ? found.text : "";
}

function setChordAt(pageNum, row, col, encodedText) {
  const pageKey = String(pageNum);
  const entries = Array.isArray(chordConfig.pages[pageKey]) ? chordConfig.pages[pageKey] : [];
  const idx = entries.findIndex((entry) => entry.row === row && entry.col === col);

  if (!encodedText) {
    if (idx >= 0) entries.splice(idx, 1);
    if (entries.length === 0) {
      delete chordConfig.pages[pageKey];
    } else {
      chordConfig.pages[pageKey] = entries;
    }
    return;
  }

  if (idx >= 0) {
    entries[idx].text = encodedText;
  } else {
    entries.push({ row, col, text: encodedText });
  }

  entries.sort((a, b) => (a.row - b.row) || (a.col - b.col));
  chordConfig.pages[pageKey] = entries;
}

function saveChordConfigurationFile() {
  if (currentSongIndex < 0 || !pujianItems[currentSongIndex]) return;

  const song = pujianItems[currentSongIndex];
  const filename = getChordTxtFilename(song);
  const dataText = JSON.stringify(chordConfig, null, 2);

  const blob = new Blob([dataText], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(url);
  showToast(`Konfigurasi chord tersimpan: ${filename}`, "download");
}

function handleTitleActivatorTap() {
  if (!document.body.classList.contains("viewer-active")) return;

  titleTapCount += 1;
  if (titleTapTimer) clearTimeout(titleTapTimer);
  titleTapTimer = setTimeout(() => {
    titleTapCount = 0;
  }, 1800);

  const required = chordEditorEnabled ? EDITOR_OFF_TAPS : EDITOR_ON_TAPS;
  if (titleTapCount < required) return;

  titleTapCount = 0;
  chordEditorEnabled = !chordEditorEnabled;
  localStorage.setItem(EDITOR_STORAGE_KEY, chordEditorEnabled ? "1" : "0");
  updateChordEditorUI();
  renderPage(currentPageNum);

  showToast(chordEditorEnabled ? "Mode edit chord aktif" : "Mode edit chord nonaktif", chordEditorEnabled ? "edit" : "visibility");
}

function updateChordEditorUI() {
  chordEditorToolbar.hidden = !chordEditorEnabled;
  chordSaveBtn.hidden = !chordEditorEnabled;
  document.body.classList.toggle("chord-editor-enabled", chordEditorEnabled);
  if (chordEditorToolbar) {
    chordEditorToolbar.classList.toggle("is-collapsed", chordEditorCollapsed);
  }
}

function onToggleChordEditorCollapse(event) {
  if (event) event.stopPropagation();
  chordEditorCollapsed = !chordEditorCollapsed;
  localStorage.setItem(CHORD_COLLAPSE_STORAGE_KEY, chordEditorCollapsed ? "1" : "0");
  updateChordEditorUI();
}
