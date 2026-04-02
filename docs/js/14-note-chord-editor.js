// --- 14. Note-Aligned Chord Editor ---
// Detects number notation (1-7, dots, rests) from PDF text content
// and allows chord placement above detected notes.

/**
 * Extract music notation notes from a PDF page using pdf.js text content.
 * Returns an array of note objects with their positions.
 */
async function extractPageNotes(page) {
  const textContent = await page.getTextContent();
  const viewport = page.getViewport({ scale: 1 });
  const pageWidth = viewport.width;
  const pageHeight = viewport.height;

  const items = textContent.items
    .map(item => ({
      str: item.str.trim(),
      x: item.transform[4],
      y: item.transform[5],
      w: item.width,
      fontSize: Math.abs(item.transform[3])
    }))
    .filter(item => item.str.length > 0);

  // Find items containing note characters (1-7, 0, .) to determine dominant font size.
  // Some PDFs return multi-char items like "1 . . 1" instead of individual chars.
  const noteCharPattern = /^[0-7.\s]+$/;
  const candidateItems = items.filter(item =>
    noteCharPattern.test(item.str) && /[1-7]/.test(item.str)
  );
  if (candidateItems.length === 0) return { notes: [], pageWidth, pageHeight };

  // Find the most common fontSize among candidate items
  const fontSizeCounts = {};
  candidateItems.forEach(item => {
    const key = Math.round(item.fontSize * 10) / 10;
    fontSizeCounts[key] = (fontSizeCounts[key] || 0) + 1;
  });
  const dominantFontSize = parseFloat(
    Object.entries(fontSizeCounts).sort((a, b) => b[1] - a[1])[0][0]
  );
  const fontSizeTolerance = 1.5;

  // Filter note-like items at the dominant font size
  const singleNotePattern = /^[0-7.]$/;
  const multiNotePattern = /^[0-7.\s]+$/;
  const rawNoteItems = items.filter(item =>
    multiNotePattern.test(item.str) &&
    Math.abs(item.fontSize - dominantFontSize) < fontSizeTolerance
  );

  // Split multi-char items into individual note characters with interpolated positions.
  // Single-char items pass through unchanged.
  const noteItems = [];
  for (const item of rawNoteItems) {
    if (singleNotePattern.test(item.str)) {
      noteItems.push(item);
    } else {
      // Multi-char item like "1 . . 1" — extract individual note chars
      const chars = item.str.split('');
      const totalChars = chars.length;
      if (totalChars <= 1) { noteItems.push(item); continue; }
      // Calculate width per character slot (including spaces)
      const slotWidth = item.w / totalChars;
      for (let i = 0; i < totalChars; i++) {
        const ch = chars[i];
        if (/[0-7.]/.test(ch)) {
          const charX = item.x + i * slotWidth;
          const charW = slotWidth;
          noteItems.push({
            str: ch,
            x: charX,
            y: item.y,
            w: charW,
            fontSize: item.fontSize
          });
        }
      }
    }
  }

  // Group by y-coordinate (items at the same vertical position form a "note row")
  const yTolerance = 2.0; // PDF units
  const rows = [];
  // Sort by y descending (higher y = higher on page in PDF coords)
  const sorted = [...noteItems].sort((a, b) => b.y - a.y);

  for (const item of sorted) {
    const existingRow = rows.find(r => Math.abs(r.y - item.y) < yTolerance);
    if (existingRow) {
      existingRow.items.push(item);
    } else {
      rows.push({ y: item.y, items: [item] });
    }
  }

  // Filter rows that have at least 2 digit items (to avoid picking up stray numbers)
  const musicRows = rows.filter(row => {
    const digits = row.items.filter(i => /^[1-7]$/.test(i.str));
    return digits.length >= 2;
  });

  // Create flat array of notes with sequential indices
  const notes = [];
  for (const row of musicRows) {
    const sortedItems = [...row.items].sort((a, b) => a.x - b.x);
    for (const item of sortedItems) {
      notes.push({
        idx: notes.length,
        str: item.str,
        x: item.x,
        y: item.y,
        w: item.w,
        xPct: ((item.x + item.w / 2) / pageWidth) * 100,
        yPct: ((1 - item.y / pageHeight) * 100),
        rowY: row.y,
        isNote: /^[1-7]$/.test(item.str),
        isDot: item.str === '.',
        isRest: item.str === '0'
      });
    }
  }

  return { notes, pageWidth, pageHeight };
}

/**
 * Create default note-aligned chord config.
 */
function createDefaultNoteChordConfig() {
  return {
    version: 2,
    type: "note-aligned",
    pages: {}
  };
}

/**
 * Sanitize a loaded note-aligned chord config.
 */
function sanitizeNoteChordConfig(rawConfig) {
  const safe = createDefaultNoteChordConfig();
  if (!rawConfig || typeof rawConfig !== "object") return safe;
  if (rawConfig.version !== 2 || rawConfig.type !== "note-aligned") return safe;

  if (rawConfig.pages && typeof rawConfig.pages === "object") {
    Object.entries(rawConfig.pages).forEach(([pageKey, entries]) => {
      if (!Array.isArray(entries)) return;
      const validEntries = entries
        .map(entry => ({
          noteIdx: Number.isFinite(entry.noteIdx) ? Math.round(entry.noteIdx) : null,
          chord: typeof entry.chord === "string" ? entry.chord.trim() : ""
        }))
        .filter(entry => entry.noteIdx !== null && entry.chord.length > 0);

      if (validEntries.length > 0) {
        safe.pages[pageKey] = validEntries;
      }
    });
  }
  return safe;
}

/**
 * Get chord-v2 URL for a song.
 */
function getNoteChordUrl(song) {
  let url = song.fileHref;
  url = url.replace(/\/pdf\//i, '/chord/');
  url = url.replace(/\.pdf$/i, ".chord.json");
  return url;
}

/**
 * Get chord-v2 filename for download.
 */
function getNoteChordFilename(song) {
  return decodeURIComponent(song.fileHref.split("/").pop() || "chord.json")
    .replace(/\.pdf$/i, ".chord.json");
}

/**
 * Load note-aligned chord configuration for the current song.
 */
async function loadNoteChordConfiguration(song) {
  noteChordConfig = createDefaultNoteChordConfig();
  const url = getNoteChordUrl(song);

  try {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) return;
    const payload = await response.text();
    const parsed = JSON.parse(payload);
    if (parsed.version === 2 && parsed.type === "note-aligned") {
      noteChordConfig = sanitizeNoteChordConfig(parsed);
    }
  } catch {
    noteChordConfig = createDefaultNoteChordConfig();
  }
}

/**
 * Create the note-aligned chord overlay layer for a page.
 */
function createNoteAlignedChordLayer(pageNum, notes) {
  const layer = document.createElement("div");
  layer.className = `chord-layer note-aligned-layer ${chordEditorEnabled ? "editor-mode" : "viewer-mode"}`;
  if (chordsHidden) layer.classList.add("is-hidden");
  layer.dataset.pageNum = String(pageNum);

  const pageKey = String(pageNum);
  const chordEntries = noteChordConfig?.pages?.[pageKey] || [];

  // Chord vertical offset above note (percentage of page height)
  const chordYOffset = NOTE_CHORD_Y_OFFSET_PCT;

  if (chordEditorEnabled) {
    // Create note target indicators for clicking
    // First: "before first note" sentinel
    if (notes.length > 0) {
      const first = notes[0];
      // Find if there are multiple rows; if so, place intro sentinel at first row
      const introX = Math.max(1, first.xPct - 2.5);
      const introTarget = createNoteTarget(NOTE_IDX_BEFORE, introX, first.yPct, "▸", "Intro / sebelum lagu");
      layer.appendChild(introTarget);
    }

    // Note targets
    notes.forEach(note => {
      const label = note.isNote ? note.str : (note.isDot ? "·" : note.str);
      const target = createNoteTarget(note.idx, note.xPct, note.yPct, label);
      layer.appendChild(target);
    });

    // Last: "after last note" sentinel
    if (notes.length > 0) {
      const last = notes[notes.length - 1];
      const outroX = Math.min(99, last.xPct + 2.5);
      const outroTarget = createNoteTarget(NOTE_IDX_AFTER, outroX, last.yPct, "◂", "Outro / setelah lagu");
      layer.appendChild(outroTarget);
    }
  }

  // Place chord markers above notes
  chordEntries.forEach(entry => {
    let pos = null;
    if (entry.noteIdx === NOTE_IDX_BEFORE && notes.length > 0) {
      const first = notes[0];
      pos = { xPct: Math.max(1, first.xPct - 2.5), yPct: first.yPct };
    } else if (entry.noteIdx >= notes.length && notes.length > 0) {
      const last = notes[notes.length - 1];
      pos = { xPct: Math.min(99, last.xPct + 2.5), yPct: last.yPct };
    } else if (entry.noteIdx >= 0 && entry.noteIdx < notes.length) {
      pos = { xPct: notes[entry.noteIdx].xPct, yPct: notes[entry.noteIdx].yPct };
    }

    if (pos) {
      const marker = createNoteChordMarker(entry, pos, chordYOffset);
      layer.appendChild(marker);
    }
  });

  return layer;
}

/**
 * Create a clickable note target element for the editor.
 */
function createNoteTarget(noteIdx, xPct, yPct, label, title) {
  const el = document.createElement("div");
  el.className = "note-target";
  if (noteIdx === NOTE_IDX_BEFORE || noteIdx === NOTE_IDX_AFTER) {
    el.classList.add("note-target-sentinel");
  }
  el.dataset.noteIdx = String(noteIdx);
  el.style.left = `${xPct}%`;
  el.style.top = `${yPct}%`;
  el.textContent = label;
  if (title) el.title = title;

  // Check if this note already has a chord
  const layer = el.closest?.(".chord-layer");
  const pageNum = layer?.dataset?.pageNum;
  // Highlight will be done after appending to layer

  return el;
}

/**
 * Create a chord marker element positioned above a note.
 */
function createNoteChordMarker(entry, pos, yOffset) {
  const marker = document.createElement("span");
  marker.className = "chord-marker note-chord-marker";
  marker.classList.add(`chord-theme-${chordUiPrefs.theme}`);
  marker.classList.add(`chord-fill-${chordUiPrefs.fill}`);
  marker.classList.add(`chord-fill-color-${chordUiPrefs.fillColor}`);
  if (chordUiPrefs.syncThemeWithAccent) {
    marker.classList.add("chord-theme-accent");
  }
  if (chordUiPrefs.syncFillWithAccent) {
    marker.classList.add("chord-fill-color-accent");
  }
  marker.dataset.noteIdx = String(entry.noteIdx);
  marker.dataset.raw = entry.chord;
  marker.textContent = formatChordForDisplay(entry.chord);
  marker.style.setProperty("--chord-font-size", `${getChordFontSizeRem()}rem`);
  marker.style.setProperty("--chord-fill-opacity", `${chordUiPrefs.fillOpacityPercent}%`);
  marker.style.setProperty("--chord-fill-padding-scale", `${chordUiPrefs.fillPaddingPercent / 100}`);

  // Position: x same as note, y above the note
  marker.style.left = `${pos.xPct}%`;
  marker.style.top = `${pos.yPct - yOffset}%`;

  return marker;
}

/**
 * Handle click on the note-aligned chord layer.
 */
function onNoteAlignedChordClick(event) {
  if (!chordEditorEnabled || !pdfDoc || !document.body.classList.contains("viewer-active")) return;

  // Check if clicking on an existing chord marker
  const marker = event.target.closest(".note-chord-marker");
  if (marker) {
    event.preventDefault();
    event.stopPropagation();

    const layer = marker.closest(".chord-layer");
    const pageNum = parseInt(layer?.dataset.pageNum || "0", 10);
    const noteIdx = parseInt(marker.dataset.noteIdx, 10);
    const existing = marker.dataset.raw || "";
    promptAndSetNoteChord(pageNum, noteIdx, existing);
    return;
  }

  // Check if clicking on a note target
  const target = event.target.closest(".note-target");
  if (target) {
    event.preventDefault();
    event.stopPropagation();

    const layer = target.closest(".chord-layer");
    const pageNum = parseInt(layer?.dataset.pageNum || "0", 10);
    const noteIdx = parseInt(target.dataset.noteIdx, 10);
    const existing = getNoteChordAt(pageNum, noteIdx);
    promptAndSetNoteChord(pageNum, noteIdx, existing);
    return;
  }
}

/**
 * Prompt user for chord input and set it.
 */
function promptAndSetNoteChord(pageNum, noteIdx, existingText) {
  const promptDefault = existingText ? formatChordForDisplay(existingText) : "";
  const userInput = window.prompt(
    "Masukkan chord (contoh: C, C♯, B♭, Fdim, Aadd9).\nKosongkan untuk hapus chord.",
    promptDefault
  );

  if (userInput === null) return;

  const encoded = encodeChordToken(userInput);
  if (encoded === null) {
    alert("Format chord tidak valid. Gunakan root A-G lalu optional #/b dan tag (dim, add9, dst).");
    return;
  }

  setNoteChordAt(pageNum, noteIdx, encoded);
  renderPage(currentPageNum);
}

/**
 * Get chord text at a specific note index on a page.
 */
function getNoteChordAt(pageNum, noteIdx) {
  const pageKey = String(pageNum);
  const entries = noteChordConfig?.pages?.[pageKey];
  if (!Array.isArray(entries)) return "";
  const found = entries.find(e => e.noteIdx === noteIdx);
  return found ? found.chord : "";
}

/**
 * Set chord text at a specific note index on a page.
 */
function setNoteChordAt(pageNum, noteIdx, chordText) {
  const pageKey = String(pageNum);
  const entries = Array.isArray(noteChordConfig.pages[pageKey])
    ? noteChordConfig.pages[pageKey]
    : [];

  const idx = entries.findIndex(e => e.noteIdx === noteIdx);

  if (!chordText) {
    if (idx >= 0) entries.splice(idx, 1);
    if (entries.length === 0) {
      delete noteChordConfig.pages[pageKey];
    } else {
      noteChordConfig.pages[pageKey] = entries;
    }
    return;
  }

  if (idx >= 0) {
    entries[idx].chord = chordText;
  } else {
    entries.push({ noteIdx, chord: chordText });
  }

  entries.sort((a, b) => a.noteIdx - b.noteIdx);
  noteChordConfig.pages[pageKey] = entries;
}

/**
 * Save (download) the note-aligned chord configuration.
 */
function saveNoteChordConfigurationFile() {
  if (currentSongIndex < 0 || !pujianItems[currentSongIndex]) return;

  const song = pujianItems[currentSongIndex];
  const filename = getNoteChordFilename(song);
  const dataText = JSON.stringify(noteChordConfig, null, 2);

  const blob = new Blob([dataText], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(url);
  showToast(`Chord tersimpan: ${filename}`, "download");
}

/**
 * Load a chord file from user's file system into the editor.
 */
function loadNoteChordFromFile() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".json,.chord.json";
  input.style.display = "none";

  input.addEventListener("change", () => {
    const file = input.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        if (parsed.version === 2 && parsed.type === "note-aligned") {
          noteChordConfig = sanitizeNoteChordConfig(parsed);
          detectNoteAlignedFamilyChord();
          renderPage(currentPageNum);
          showToast(`Chord dimuat: ${file.name}`, "upload_file");
        } else if (parsed.version === 1) {
          // Legacy grid format - notify user
          showToast("Format chord lama (grid). Gunakan format note-aligned (v2).", "warning");
        } else {
          showToast("Format file tidak dikenali.", "error");
        }
      } catch {
        showToast("Gagal membaca file chord.", "error");
      }
    };
    reader.readAsText(file);
    input.remove();
  });

  document.body.appendChild(input);
  input.click();
}

/**
 * Refresh note-chord markers after transpose/accidental changes.
 * Reuses the dissolve animation from the grid chord system.
 */
function refreshNoteChordMarkers() {
  document.querySelectorAll(".note-chord-marker").forEach(marker => {
    const existingTimer = chordDissolveTimers.get(marker);
    if (existingTimer) clearTimeout(existingTimer);

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

/**
 * Detect family chord from note-aligned chord config.
 * Works the same as the grid version but reads from noteChordConfig.
 */
function detectNoteAlignedFamilyChord() {
  if (!noteChordConfig || !noteChordConfig.pages) return;
  let allChords = [];
  const pageKeys = Object.keys(noteChordConfig.pages).sort((a, b) => parseInt(a) - parseInt(b));

  pageKeys.forEach(key => {
    const entries = noteChordConfig.pages[key] || [];
    const sorted = [...entries].sort((a, b) => a.noteIdx - b.noteIdx);
    sorted.forEach(entry => {
      if (entry.chord && entry.chord.trim()) {
        allChords.push(entry.chord.trim());
      }
    });
  });

  if (allChords.length === 0) return;

  const getRoot = (chordText) => {
    const match = chordText.match(/^([A-Ga-g1-7])([#♯b♭]?)(min|m(?!aj))?/);
    if (!match) return null;
    let r = match[1].toUpperCase();
    let acc = match[2];
    let isMinor = !!match[3];
    if (acc === '♭') acc = 'b';
    if (acc === '♯') acc = '#';
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
  if (firstRoot !== lastRoot) {
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
    detectedRoot = counts[lastRoot] > 1 ? lastRoot : mostFreq;
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

/**
 * Check if note-aligned chord config has any chords.
 */
function hasNoteAlignedChords() {
  if (!noteChordConfig || !noteChordConfig.pages) return false;
  return Object.values(noteChordConfig.pages).some(page => page && page.length > 0);
}
