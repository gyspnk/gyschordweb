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
  originalFamilyChord = null;
  const txtUrl = getChordTxtUrl(song);

  try {
    const response = await fetch(txtUrl, { cache: "no-store" });
    if (!response.ok) {
      updateTransposeVisibility();
      return;
    }

    const payload = await response.text();
    const parsed = JSON.parse(payload);
    chordConfig = sanitizeChordConfig(parsed);
    detectAndSetFamilyChord();
  } catch {
    chordConfig = createDefaultChordConfig();
    originalFamilyChord = null;
  }
  updateTransposeVisibility();
}

function detectAndSetFamilyChord() {
  if (!chordConfig || !chordConfig.pages) return;
  let allChords = [];
  const pageKeys = Object.keys(chordConfig.pages).sort((a, b) => parseInt(a) - parseInt(b));
  
  pageKeys.forEach(key => {
    const entries = chordConfig.pages[key] || [];
    // Sort by row, then col
    const sorted = [...entries].sort((a, b) => a.row === b.row ? a.col - b.col : a.row - b.row);
    sorted.forEach(entry => {
      if (entry.text && entry.text.trim()) {
        allChords.push(entry.text.trim());
      }
    });
  });

  if (allChords.length === 0) return;

  const getRoot = (chordText) => {
    // Matches root note (A-G or 1-7), optional accidental, and optional 'm' or 'min' for minor (excluding 'maj')
    const match = chordText.match(/^([A-Ga-g1-7])([#♯b♭]?)(min|m(?!aj))?/);
    if (!match) return null;
    let r = match[1].toUpperCase();
    let acc = match[2];
    let isMinor = !!match[3];
    if (acc === '♭') acc = 'b';
    if (acc === '♯') acc = '#';
    // Translate number to note if needed
    if (/[1-7]/.test(r)) {
      r = NUMBER_TO_NOTE[r] || 'C';
    }
    return r + acc + (isMinor ? 'm' : '');
  };

  const roots = allChords.map(getRoot).filter(Boolean);
  if (roots.length === 0) return;

  const firstRoot = roots[0];
  const lastRoot = roots[roots.length - 1];

  let detectedRoot = firstRoot;
  if (firstRoot === lastRoot) {
    detectedRoot = firstRoot;
  } else {
    // Frequencies fallback
    const counts = {};
    let max = 0;
    let mostFreq = firstRoot;
    roots.forEach(r => {
      counts[r] = (counts[r] || 0) + 1;
      if (counts[r] > max) {
        max = counts[r];
        mostFreq = r;
      }
    });
    // Bias towards last root if it appears reasonably often
    if (counts[lastRoot] > 1) {
      detectedRoot = lastRoot;
    } else {
      detectedRoot = mostFreq;
    }
  }

  originalFamilyChord = detectedRoot;
  baseTransposeOffset = 0;

  if (originalPdfKey && originalFamilyChord) {
    const pdfSemi = parsePdfKeyToSemitone(originalPdfKey);
    const txtParsed = parseChordToken(originalFamilyChord);
    if (pdfSemi !== null && txtParsed !== null) {
      let diff = pdfSemi - txtParsed.semitone;
      diff = diff % 12;
      if (diff > 6) diff -= 12;
      if (diff < -5) diff += 12;
      baseTransposeOffset = diff;
    }
  }

  if (prefs.preferNaturalChords && originalFamilyChord) {
    const txtParsed = parseChordToken(originalFamilyChord);
    if (txtParsed !== null) {
      const finalBaseSemi = wrapSemitone(txtParsed.semitone + baseTransposeOffset);
      const isBlackKey = [1, 3, 6, 8, 10].includes(finalBaseSemi);
      if (isBlackKey) {
        transposeStep = -1;
      }
    }
  }
}

function parsePdfKeyToSemitone(keyStr) {
  if (!keyStr) return null;
  let k = keyStr.toLowerCase().replace(/m$/, '');
  const map = {
    'c': 0, 'cis': 1, 'des': 1,
    'd': 2, 'dis': 3, 'es': 3, 'eb': 3,
    'e': 4,
    'f': 5, 'fis': 6, 'ges': 6,
    'g': 7, 'gis': 8, 'as': 8, 'ab': 8,
    'a': 9, 'ais': 10, 'bes': 10, 'bb': 10,
    'b': 11, 'h': 11
  };
  
  if (map[k] !== undefined) return map[k];
  
  if (k.includes('#')) {
      const base = {'c':0,'d':2,'f':5,'g':7,'a':9}[k.charAt(0)];
      if (base !== undefined) return wrapSemitone(base + 1);
  }
  if (k.includes('b')) {
      const base = {'c':0,'d':2,'e':4,'g':7,'a':9,'b':11}[k.charAt(0)];
      if (base !== undefined) return wrapSemitone(base - 1);
  }
  return null;
}

function updateTransposeVisibility() {
  const hasChords = originalFamilyChord !== null || Object.values(chordConfig.pages).some(page => page && page.length > 0);
  const hasNoteChords = typeof hasNoteAlignedChords === "function" && hasNoteAlignedChords();
  const hasMidi = typeof midiToggleBtn !== "undefined" && midiToggleBtn && midiToggleBtn.style.display !== "none";
  const showTranspose = hasChords || hasNoteChords || chordEditorEnabled || hasMidi;

  document.querySelectorAll('.transpose-collapse').forEach(el => {
    el.style.display = showTranspose ? '' : 'none';
  });
  if (typeof hideChordBtns !== "undefined") {
    hideChordBtns.forEach(btn => {
      btn.style.display = showTranspose ? '' : 'none';
    });
  }

  updateTransposeUI();
}

function updateFamilyChordUI() {
    const btns = document.querySelectorAll('.family-chord-btn');
    const miniKeyInfo = document.getElementById('mini-key-info');
    const dds = document.querySelectorAll('.family-chord-dropdown');
    
    let isMinor = false;
    let fallbackLabel = '?';
    let currentKeyString = '?';
    
    if (originalFamilyChord) {
      isMinor = originalFamilyChord.endsWith('m');
      const baseLabel = formatChordForDisplay(originalFamilyChord);
      fallbackLabel = baseLabel.replace(/[^A-G#b♭♯]/g, '') + (isMinor ? 'm' : '');
      const parsed = parseChordToken(originalFamilyChord);
      if (parsed) {
        const currentSemi = wrapSemitone(parsed.semitone + transposeStep + baseTransposeOffset);
        const noteSet = accidentalMode === "flat" ? NOTE_NAMES_FLAT : NOTE_NAMES_SHARP;
        currentKeyString = noteSet[currentSemi] + (isMinor ? 'm' : '');
      } else {
        currentKeyString = fallbackLabel;
      }
    } else if (typeof originalPdfKey !== 'undefined' && originalPdfKey) {
      isMinor = originalPdfKey.toLowerCase().endsWith('m');
      fallbackLabel = originalPdfKey;
      const pdfSemi = parsePdfKeyToSemitone(originalPdfKey);
      if (pdfSemi !== null) {
        const currentSemi = wrapSemitone(pdfSemi + transposeStep);
        const noteSet = accidentalMode === "flat" ? NOTE_NAMES_FLAT : NOTE_NAMES_SHARP;
        currentKeyString = noteSet[currentSemi] + (isMinor ? 'm' : '');
      } else {
        currentKeyString = fallbackLabel;
      }
    } else {
      currentKeyString = '-';
    }

    if (miniKeyInfo) miniKeyInfo.textContent = currentKeyString;

    btns.forEach(btn => {
      btn.textContent = currentKeyString !== '-' && currentKeyString !== '?' ? currentKeyString : fallbackLabel;
    });

  const allNotes = accidentalMode === "flat" ? NOTE_NAMES_FLAT : NOTE_NAMES_SHARP;
  dds.forEach(dd => {
    dd.innerHTML = '';
    allNotes.forEach((note, index) => {
      if (note === '') return; // Skip empty indices if any, but array is 12 notes
      const optNote = note + (isMinor ? 'm' : '');
      const opt = document.createElement('button');
      opt.className = 'family-chord-option';
      opt.textContent = optNote;
      if (btnText(btns[0]) === optNote) {
         opt.classList.add('selected');
      }
      opt.onclick = () => {
         if (_midiSfPlayerLoading) return;
         if (!originalFamilyChord) return;
         const parsedObj = parseChordToken(originalFamilyChord);
         if (!parsedObj) return;
         const origSemi = parsedObj.semitone;
         let targetSemi = index;
         
         // Calculate transpose step relative to base offset
         let diff = targetSemi - origSemi - baseTransposeOffset;
         
         diff = diff % 12;
         if (diff > 6) diff -= 12;
         if (diff < -5) diff += 12;
         
         transposeStep = diff;
         updateTransposeUI();
         refreshVisibleChordMarkers();
         
         dd.classList.remove('is-open');
      };
      dd.appendChild(opt);
    });
  });
}

function btnText(btn) {
  return btn ? btn.textContent : '';
}

function getChordTxtUrl(song) {
  // song.fileHref is 'assets/pdf/filename.pdf'
  // we want 'assets/chord/filename.txt'
  let url = song.fileHref;
  // safely replace 'assets/pdf/' with 'assets/chord/' and '.pdf' with '.txt'
  url = url.replace(/\/pdf\//i, '/chord/');
  url = url.replace(/\.pdf$/i, ".txt");
  return url;
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
  marker.style.setProperty("--chord-fill-padding-scale", `${chordUiPrefs.fillPaddingPercent / 100}`);

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

  // Skip if clicking within a note-aligned layer (handled by onNoteAlignedChordClick)
  const noteAlignedLayer = event.target.closest(".note-aligned-layer");
  if (noteAlignedLayer) return;

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

  // REVERSE the offset so that saving to file keeps it relative to original file base instead of matching PDF visual
  semitone = semitone - transposeStep - baseTransposeOffset;

  const normalizedRoot = NOTE_NAMES_SHARP[wrapSemitone(semitone)];
  return `${normalizedRoot}${suffix}`;
}

function formatChordForDisplay(encodedToken) {
  const token = String(encodedToken || "").trim();
  const parsed = parseChordToken(token);
  if (!parsed) return token;

  const noteSet = accidentalMode === "flat" ? NOTE_NAMES_FLAT : NOTE_NAMES_SHARP;
  const transposed = wrapSemitone(parsed.semitone + transposeStep + baseTransposeOffset);
  
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
  // Block if a MIDI transition is in progress
  if (_midiSfPlayerLoading) return;
  const next = transposeStep + step;
  transposeStep = next > 11 || next < -11 ? 0 : next;
  updateTransposeUI();
  refreshVisibleChordMarkers();
}

function resetTranspose() {
  if (_midiSfPlayerLoading) return;
  if (transposeStep !== 0) {
    transposeStep = 0;
    updateTransposeUI();
    refreshVisibleChordMarkers();
  }
}

function updateTransposeUI(options = {}) {
  const { animateAccidental = false } = options;
  const sign = transposeStep > 0 ? "+" : "";
  transposeIndicators.forEach((indicator) => {
    indicator.textContent = 'Transpose ' + sign + transposeStep;
  });

  const miniTransposeVal = document.getElementById('mini-transpose-value');
  if (miniTransposeVal) {
    miniTransposeVal.textContent = sign + transposeStep;
  }

  if (typeof updateFamilyChordUI === 'function') {
    updateFamilyChordUI();
  }

  // Gapless transpose swap — single SoundFontPlayer reloads only new pitches
  if (typeof swapTranspose === 'function') {
    swapTranspose(transposeStep);
  }

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

  // Also refresh note-aligned chord markers on transpose
  if (typeof refreshNoteChordMarkers === "function") {
    refreshNoteChordMarkers();
  }
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
  // Update label based on whether we're using note-aligned or grid mode
  const label = chordEditorToolbar?.querySelector(".chord-editor-label");
  if (label) {
    const hasNotes = pageNotesCache && Object.values(pageNotesCache).some(c => c && c.notes && c.notes.length > 0);
    label.textContent = hasNotes ? "Chord Editor (Note-Aligned)" : "Chord Editor 105x149";
  }
  updateTransposeVisibility();
}

function onToggleChordEditorCollapse(event) {
  if (event) event.stopPropagation();
  chordEditorCollapsed = !chordEditorCollapsed;
  localStorage.setItem(CHORD_COLLAPSE_STORAGE_KEY, chordEditorCollapsed ? "1" : "0");
  updateChordEditorUI();
}

