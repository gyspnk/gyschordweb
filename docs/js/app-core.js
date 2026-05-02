/* Auto-merged runtime source. Legacy split snapshot archived under archive/docs-js/legacy. */

/* SOURCE: 01-config.js */
// --- 0. Konfigurasi & Konstanta ---

// Membisukan peringatan spesifik dari PDF.js yang tidak berbahaya
// (Karena kita sudah mendefinisikan font secara manual di CSS, PDF tetap akan merender dengan benar)
const originalWarn = console.warn;
console.warn = function (...args) {
  if (
    args.length > 0 &&
    typeof args[0] === "string" &&
    args[0].includes("Cannot load system font")
  ) {
    return; // Abaikan warning ini
  }
  originalWarn.apply(console, args);
};

/**
 * Kidung Rohani App - PDF Viewer + Chord Overlay Editor
 *
 * Fitur utama:
 * - Zoom tombol, blokir zoom global selain di viewer.
 * - Chord editor hidden activator: judul 10x aktif, 5x nonaktif.
 * - Overlay chord sinkron di mode single/double/vertical + saat zoom.
 * - Konfigurasi chord disimpan ke TXT (format JSON) dan auto-load per nama file PDF.
 */

if (!Map.prototype.getOrInsertComputed) {
  Object.defineProperty(Map.prototype, "getOrInsertComputed", {
    value(key, callback) {
      if (this.has(key)) return this.get(key);
      const value = callback(key);
      this.set(key, value);
      return value;
    },
  });
}

if (!Map.prototype.getOrInsert) {
  Object.defineProperty(Map.prototype, "getOrInsert", {
    value(key, value) {
      if (this.has(key)) return this.get(key);
      this.set(key, value);
      return value;
    },
  });
}

if (!WeakMap.prototype.getOrInsertComputed) {
  Object.defineProperty(WeakMap.prototype, "getOrInsertComputed", {
    value(key, callback) {
      if (this.has(key)) return this.get(key);
      const value = callback(key);
      this.set(key, value);
      return value;
    },
  });
}

if (!WeakMap.prototype.getOrInsert) {
  Object.defineProperty(WeakMap.prototype, "getOrInsert", {
    value(key, value) {
      if (this.has(key)) return this.get(key);
      this.set(key, value);
      return value;
    },
  });
}

const { pdfjsLib } = globalThis;
if (pdfjsLib) {
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    "https://mozilla.github.io/pdf.js/build/pdf.worker.mjs";
  pdfjsLib.verbosity = pdfjsLib.VerbosityLevel.ERRORS;
}

const EDITOR_STORAGE_KEY = "chord-editor-enabled";
const CHORD_UI_STORAGE_KEY = "chord-ui-prefs";
const CHORD_ACCIDENTAL_STORAGE_KEY = "chord-accidental-mode";
const EDITOR_ON_TAPS = 10;
const EDITOR_OFF_TAPS = 5;
const CHORD_COLLAPSE_STORAGE_KEY = "chord-editor-collapsed";
const NOTE_NAMES_SHARP = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];
const NOTE_NAMES_FLAT = ["C", "D♭", "D", "E♭", "E", "F", "G♭", "G", "A♭", "A", "B♭", "B"];
const NOTE_NAMES_SHARP_ASCII = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const NATURAL_NOTE_INDEX = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
};
const NUMBER_TO_NOTE = {
  1: "C",
  2: "D",
  3: "E",
  4: "F",
  5: "G",
  6: "A",
  7: "B",
};
const ACCENT_CUSTOM_COLOR_KEY = "accent-custom-color";
const DEFAULT_CUSTOM_ACCENT = "#4f7cff";
const ACCENT_PRESETS = [
  { key: "gold", label: "Emas", color: "#8d6e3f" },
  { key: "burgundy", label: "Anggur", color: "#6d2c41" },
  { key: "blue", label: "Biru", color: "#1976d2" },
  { key: "red", label: "Merah", color: "#c62828" },
  { key: "green", label: "Hijau", color: "#2e7d32" },
  { key: "yellow", label: "Kuning", color: "#f9a825" },
  { key: "purple", label: "Ungu", color: "#6a1b9a" },
  { key: "pink", label: "Pink", color: "#ad1457" },
  { key: "teal", label: "Teal", color: "#00796b" },
  { key: "orange", label: "Oranye", color: "#e65100" },
  { key: "brown", label: "Coklat", color: "#4e342e" },
  { key: "gray", label: "Abu-abu", color: "#546e7a" },
  { key: "indigo", label: "Nila", color: "#283593" },
  { key: "cyan", label: "Sian", color: "#00838f" },
  { key: "custom", label: "Warna Kustom", color: null },
];
const COLOR_SCHEME_PRESETS = [
  {
    key: "warm",
    label: "Warm Ivory",
    description: "Parchment hangat dan lembut seperti buku kidung tradisional.",
    swatches: ["#faf8f4", "#eee3d2", "#c9ae84"],
  },
  {
    key: "slate",
    label: "Slate Blue",
    description: "Netral dingin abu-biru untuk tampilan lebih modern dan bersih.",
    swatches: ["#f4f7fb", "#dde7f2", "#8ba0b7"],
  },
  {
    key: "sage",
    label: "Sage Mist",
    description: "Hijau lembut dan teduh untuk suasana baca yang tenang.",
    swatches: ["#f4f8f1", "#deead8", "#8aa083"],
  },
  {
    key: "rose",
    label: "Rose Paper",
    description: "Lembar pastel rosé yang lebih hangat tanpa dominasi coklat.",
    swatches: ["#fcf4f3", "#f0d9d8", "#bd8b90"],
  },
  {
    key: "ocean",
    label: "Ocean Mist",
    description: "Kabut biru-hijau yang terang untuk nuansa shell lebih segar.",
    swatches: ["#f1f8fb", "#d7ebf2", "#6aa2b4"],
  },
];
const UI_STYLE_PRESETS = [
  {
    key: "sanctuary",
    label: "Sanctuary",
    description: "Hangat, lembut, dan klasik untuk nuansa hymnal tradisional.",
    logoVariant: "color",
  },
  {
    key: "folio",
    label: "Folio",
    description: "Lebih editorial seperti buku nyanyian cetak dengan bingkai tegas.",
    logoVariant: "black",
  },
  {
    key: "radiant",
    label: "Radiant",
    description: "Modern, berlapis, dan bercahaya untuk latihan atau presentasi.",
    logoVariant: "color",
  },
];
const HEADER_LOGO_VARIANTS = {
  color: {
    src: "assets/logo/tjc_logo_indonesia_color.png",
    alt: "Hymns of Praise logo",
  },
  black: {
    src: "assets/logo/tjc_logo_indonesia_black.png",
    alt: "Hymns of Praise logo, black",
  },
  white: {
    src: "assets/logo/tjc_logo_indonesia_white.png",
    alt: "Hymns of Praise logo, white",
  },
};
const LAYOUT_STYLE_PRESETS = [
  {
    key: "balanced",
    label: "Balanced",
    description: "Lebar dan jarak yang stabil untuk penggunaan harian di semua perangkat.",
  },
  {
    key: "compact",
    label: "Compact",
    description: "Lebih padat dengan chrome yang rapat dan grid studio yang efisien.",
  },
  {
    key: "focused",
    label: "Focused",
    description: "Lebih terpusat dan satu-kolom agar perhatian tertahan pada konten bacaan.",
  },
  {
    key: "spacious",
    label: "Spacious",
    description: "Ruang lebih lega dengan chrome besar untuk tablet, desktop, dan proyeksi.",
  },
];

const FONT_PRESETS = [
  {
    key: "auto",
    label: "Otomatis",
    description: "Mengikuti gaya UI yang aktif.",
    displayFont: "",
    bodyFont: "",
  },
  {
    key: "hymnal",
    label: "Hymnal Serif",
    description: "Playfair Display + Roboto.",
    displayFont: "'Playfair Display', serif",
    bodyFont: "'Roboto', sans-serif",
  },
  {
    key: "editorial",
    label: "Editorial",
    description: "Goudy + Abadi — bergaya buku nyanyian.",
    displayFont: "'GoudyOldStyleBT-Roman', serif",
    bodyFont: "'AbadiMT-CondensedLight', sans-serif",
  },
  {
    key: "sans",
    label: "Sans Modern",
    description: "Font sistem bersih dan modern.",
    displayFont: "system-ui, sans-serif",
    bodyFont: "system-ui, sans-serif",
  },
];
const APP_DEPENDENCY_CREDITS = [
  {
    name: "PDF.js",
    icon: "picture_as_pdf",
    category: "Viewer",
    provider: "Mozilla",
    version: "Module + worker build",
    purpose: "Mesin render partitur PDF, worker, dan standard font untuk viewer utama.",
    source: "mozilla.github.io/pdf.js",
  },
  {
    name: "js-synthesizer",
    icon: "library_music",
    category: "MIDI",
    provider: "jsDelivr CDN",
    version: "1.11.0",
    purpose: "Bridge JavaScript untuk memproses render MIDI offline di Web Worker.",
    source: "cdn.jsdelivr.net/npm/js-synthesizer@1.11.0",
  },
  {
    name: "FluidSynth WASM",
    icon: "memory",
    category: "MIDI",
    provider: "FluidSynth",
    version: "2.4.6",
    purpose: "Engine synthesizer GM yang dipakai worker untuk mengubah MIDI menjadi audio.",
    source: "libfluidsynth-2.4.6.js via js-synthesizer externals",
  },
  {
    name: "GeneralUser GS SoundFont",
    icon: "piano",
    category: "SoundFont",
    provider: "Bundled asset",
    version: "2.0.3",
    purpose: "SoundFont utama berukuran besar untuk playback MIDI dengan detail instrumen lebih kaya.",
    source: "docs/assets/soundfont/GeneralUser-GS.sf2",
  },
  {
    name: "TimGM6mb SoundFont",
    icon: "piano",
    category: "SoundFont",
    provider: "Bundled asset",
    version: "Compact set",
    purpose: "Alternatif SoundFont ringan untuk perangkat dengan memori dan bandwidth lebih terbatas.",
    source: "docs/assets/soundfont/TimGM6mb.sf2",
  },
  {
    name: "Google Fonts",
    icon: "font_download",
    category: "Typography",
    provider: "Google Fonts",
    version: "Roboto + Playfair Display",
    purpose: "Tipografi utama untuk body text, heading, dan sistem tema shell aplikasi.",
    source: "fonts.googleapis.com",
  },
  {
    name: "Material Symbols Outlined",
    icon: "format_shapes",
    category: "Icons",
    provider: "Google Fonts",
    version: "Outlined variable font",
    purpose: "Paket ikon yang dipakai di navigasi, kontrol viewer, dan panel pengaturan.",
    source: "fonts.googleapis.com",
  },
  {
    name: "Bundled Theme Fonts",
    icon: "book_2",
    category: "Typography",
    provider: "Local assets",
    version: "GoudyOldStyleBT-Roman + AbadiMT-CondensedLight",
    purpose: "Font lokal untuk style Folio dan sinkronisasi render PDF tanpa warning font system.",
    source: "docs/assets/fonts",
  },
  {
    name: "Puppeteer",
    icon: "science",
    category: "Tooling",
    provider: "Repository dependency",
    version: "24.40.0",
    purpose: "Dipakai untuk otomatisasi dan validasi pengembangan repository, bukan runtime pengguna akhir.",
    source: "package.json",
  },
];
const CHORD_THEME_PRESETS = [
  { key: "blue", label: "Biru", color: "#0b4c99" },
  { key: "red", label: "Merah", color: "#9c1616" },
  { key: "green", label: "Hijau", color: "#1b5a20" },
  { key: "yellow", label: "Kuning", color: "#b38200" },
  { key: "purple", label: "Ungu", color: "#59117a" },
  { key: "pink", label: "Pink", color: "#960e44" },
  { key: "teal", label: "Teal", color: "#004d43" },
  { key: "orange", label: "Oranye", color: "#b35600" },
  { key: "brown", label: "Coklat", color: "#3e2923" },
  { key: "gray", label: "Abu-abu", color: "#383838" },
  { key: "indigo", label: "Nila", color: "#1e2870" },
  { key: "cyan", label: "Sian", color: "#00646e" },
];
const CHORD_FILL_PRESETS = [
  { key: "blue", label: "Biru", color: "#b8dbff" },
  { key: "red", label: "Merah", color: "#ffc4c4" },
  { key: "green", label: "Hijau", color: "#b8f0bc" },
  { key: "yellow", label: "Kuning", color: "#ffecb3" },
  { key: "purple", label: "Ungu", color: "#e3bdf2" },
  { key: "pink", label: "Pink", color: "#ffbccf" },
  { key: "teal", label: "Teal", color: "#b7efe8" },
  { key: "orange", label: "Oranye", color: "#ffd2a8" },
  { key: "brown", label: "Coklat", color: "#d7c2b4" },
  { key: "gray", label: "Abu-abu", color: "#d0d7de" },
  { key: "indigo", label: "Nila", color: "#c7d2fe" },
  { key: "cyan", label: "Sian", color: "#b2ebf2" },
];

const DOUBLE_TAP_MAX_DISTANCE = 34;
const INDICATOR_DOUBLE_TAP_DELAY = 420;
const ZOOM_SCROLL_SMOOTH_DURATION_MS = 210;
const TRANSPOSE_DISSOLVE_OUT_MS = 180;
const TRANSPOSE_DISSOLVE_IN_MS = 230;

// --- MIDI Audio Transition Constants ---
const MIDI_SF2_URL = 'assets/soundfont/GeneralUser-GS.sf2'; // GeneralUser GS 2.0.3 (128 GM + 13 drum kits, high quality)
const MIDI_GLOBAL_TRANSPOSE_OFFSET = 0;

// Instrument lists are populated at runtime from the active .sf2 preset data.
// Keep only keyed buckets here so the UI never falls back to a curated hardcoded list.
const SOUNDFONT_INSTRUMENTS = {
  'assets/soundfont/GeneralUser-GS.sf2': [],
  'assets/soundfont/TimGM6mb.sf2': [],
};

/**
 * Normalize soundfont URL/path into a key present in SOUNDFONT_INSTRUMENTS.
 * Accepts relative paths, absolute URLs, and path variants (e.g. ./assets/...).
 * Falls back to MIDI_SF2_URL when no known match is found.
 * @param {string} sfUrl
 * @returns {string}
 */
function normalizeSoundfontKey(sfUrl) {
  var raw = String(sfUrl || '').trim();
  var keys = Object.keys(SOUNDFONT_INSTRUMENTS || {});
  if (!keys.length) return MIDI_SF2_URL;
  if (!raw) return MIDI_SF2_URL;

  // Exact key match first
  if (SOUNDFONT_INSTRUMENTS[raw]) return raw;

  var normalized = raw
    .replace(/\\/g, '/')
    .replace(/^\.?\//, '')
    .replace(/^.*\/assets\//i, 'assets/');

  if (SOUNDFONT_INSTRUMENTS[normalized]) return normalized;

  // Filename-based fallback for absolute URLs and uncommon prefixes
  var lower = normalized.toLowerCase();
  if (lower.indexOf('generaluser-gs.sf2') !== -1) {
    return 'assets/soundfont/GeneralUser-GS.sf2';
  }
  if (lower.indexOf('timgm6mb.sf2') !== -1) {
    return 'assets/soundfont/TimGM6mb.sf2';
  }

  return MIDI_SF2_URL;
}

/**
 * Resolve the preset list for a soundfont.
 * @param {string} sfUrl
 * @returns {Array}
 */
function getSoundfontInstrumentList(sfUrl) {
  var sfKey = normalizeSoundfontKey(sfUrl || MIDI_SF2_URL);
  var list = SOUNDFONT_INSTRUMENTS[sfKey];
  return Array.isArray(list) ? list : [];
}

/**
 * Resolve the active preset program for a soundfont.
 * Prefers an explicitly requested program, then remembered per-soundfont state,
 * then the first preset in the loaded soundfont list.
 * @param {string} sfUrl
 * @param {string|number} preferredProgram
 * @returns {string}
 */
function resolveSoundfontInstrumentProgram(sfUrl, preferredProgram) {
  var list = getSoundfontInstrumentList(sfUrl);
  if (!list.length) {
    return preferredProgram != null ? String(preferredProgram) : '';
  }

  var targets = [];
  if (preferredProgram != null && String(preferredProgram) !== '') {
    targets.push(String(preferredProgram));
  }

  if (typeof prefs !== 'undefined' && prefs && prefs.midiInstrumentBySoundfont) {
    var remembered = prefs.midiInstrumentBySoundfont[normalizeSoundfontKey(sfUrl || MIDI_SF2_URL)];
    if (remembered != null && String(remembered) !== '') {
      targets.push(String(remembered));
    }
  }

  for (var i = 0; i < targets.length; i++) {
    var hit = list.find(function (item) { return String(item[0]) === targets[i]; });
    if (hit) return String(hit[0]);
  }

  return String(list[0][0]);
}

/**
 * Resolve an instrument display name from the active soundfont list.
 * Falls back to the first entry for that soundfont when program is unavailable.
 * @param {string|number} program
 * @param {string} sfUrl
 * @returns {string}
 */
function getSoundfontInstrumentLabel(program, sfUrl) {
  var list = getSoundfontInstrumentList(sfUrl);
  if (!list.length) return 'Memuat Instrumen...';

  var target = resolveSoundfontInstrumentProgram(sfUrl, program);
  var hit = list.find(function (item) { return String(item[0]) === target; });
  return (hit || list[0])[1];
}

/**
 * Build instrument option markup strictly from the active soundfont map.
 * @param {string} sfUrl
 * @param {string|number} selectedProgram
 * @returns {{ html: string, list: Array, activeProgram: string, activeLabel: string }}
 */
function buildSoundfontInstrumentOptionsHtml(sfUrl, selectedProgram) {
  var sfKey = normalizeSoundfontKey(sfUrl || MIDI_SF2_URL);
  var list = getSoundfontInstrumentList(sfKey);
  if (!Array.isArray(list) || !list.length) {
    return { html: '', list: [], activeProgram: '', activeLabel: 'Memuat Instrumen...' };
  }

  var currentVal = resolveSoundfontInstrumentProgram(sfKey, selectedProgram);
  var activeItem = list.find(function (item) {
    return String(item[0]) === currentVal;
  }) || list[0];
  var activeProgram = String(activeItem[0]);

  var html = list.map(function (item) {
    var prog = item[0];
    var name = item[1];
    var icon = getMidiInstrumentIcon(prog, name);
    var isSelected = String(prog) === activeProgram;
    var classes = 'cis-option' + (isSelected ? ' cis-default selected' : '');
    return '<button type="button" class="' + classes + '" data-val="' + prog + '" title="' + name + '">' +
      '<span class="material-symbols-outlined cis-menu-icon">' + icon + '</span> ' + name + '</button>';
  }).join('\n');

  return {
    html: html,
    list: list,
    activeProgram: activeProgram,
    activeLabel: activeItem[1]
  };
}

const MIDI_END_THRESHOLD_S = 0.8; // Threshold in seconds for detecting song end
const MIDI_PRELOAD_NEXT_S = 3; // Seconds before end to preload next song
const MIDI_TEMPO_FALLBACK_BPM = 76;
const MIDI_TEMPO_MIN_BPM = 30;
const MIDI_TEMPO_MAX_BPM = 220;

// --- Note-Aligned Chord Editor Constants ---
const NOTE_CHORD_Y_OFFSET_PCT = 2.5; // Chord vertical offset above note (% of page height)
const NOTE_IDX_BEFORE = -1; // Sentinel: chord before first note (intro)
const NOTE_IDX_AFTER = 99999; // Sentinel: chord after last note (outro)

/**
 * MidiTimeAuthority — Thin proxy to MidiEngine for backward compatibility.
 * Provides read-only access to playback position/state.
 * Write methods are no-ops — MidiEngine manages timing internally.
 */
const MidiTimeAuthority = {
  get _playing() { return !window.isMidiSwitching && typeof MidiEngine !== 'undefined' && MidiEngine.isPlaying(); },

  setTime(t) { if (!window.isMidiSwitching && typeof MidiEngine !== 'undefined') MidiEngine.seek(t); },
  seek(t) { if (!window.isMidiSwitching && typeof MidiEngine !== 'undefined') MidiEngine.seek(t); },
  getTime() { return !window.isMidiSwitching && typeof MidiEngine !== 'undefined' ? MidiEngine.getTime() : 0; },
  setPlaying() {}, // no-op
  setDuration() {}, // no-op
  getDuration() { return !window.isMidiSwitching && typeof MidiEngine !== 'undefined' ? MidiEngine.getDuration() : 0; },
  sync() {}, // no-op
  reset() { if (typeof MidiEngine !== 'undefined') MidiEngine.reset(); },
  _seekCooldownUntil: 0,
};

/**
 * Returns the Material Symbols icon name for a given MIDI program number.
 * @param {number|string} programNumber - MIDI program number (0-127) or "-1" for default
 * @returns {string} Material Symbols icon name
 */
function getMidiInstrumentIcon(programNumber) {
  const valNum = parseInt(programNumber, 10);
  if (isNaN(valNum) || valNum < 0) return "music_note";
  if (valNum <= 7) return "piano";
  if (valNum <= 15) return "notifications_active";
  if (valNum <= 23) return "piano";
  if (valNum <= 31) return "library_music";
  if (valNum <= 39) return "library_music";
  if (valNum <= 47) return "graphic_eq";
  if (valNum <= 55) return "graphic_eq";
  if (valNum <= 63) return "campaign";
  if (valNum <= 71) return "styler";
  if (valNum <= 79) return "media_link";
  return "music_note";
}

/**
 * Shared time formatter for MIDI display.
 * @param {number} seconds
 * @returns {string} e.g. "1:05"
 */
function formatMidiTime(seconds) {
  const isecs = Math.floor(seconds || 0);
  const m = Math.floor(isecs / 60);
  const s = isecs % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function getMidiTempoDisplayRate() {
  if (typeof MidiEngine !== "undefined" && typeof MidiEngine.getTempoRate === "function") {
    const rate = Number(MidiEngine.getTempoRate());
    if (Number.isFinite(rate) && rate > 0) return rate;
  }

  const base = Number(currentSongDefaultTempoBpm);
  const current = Number(currentTempoBpm);
  if (Number.isFinite(base) && base > 0 && Number.isFinite(current) && current > 0) {
    const fallbackRate = current / base;
    if (Number.isFinite(fallbackRate) && fallbackRate > 0) return fallbackRate;
  }

  return 1;
}

function toMidiDisplaySeconds(sourceSeconds) {
  const source = Number(sourceSeconds);
  if (!Number.isFinite(source) || source <= 0) return 0;
  return source / getMidiTempoDisplayRate();
}

function applyInstrumentLabelPresentation(titleText) {
  const fallbackTitle =
    (typeof customInstrumentSelect !== "undefined" && customInstrumentSelect && customInstrumentSelect.title) ||
    document.getElementById("mini-instrument-select")?.title ||
    "Memuat Instrumen...";
  const resolvedTitle = String(titleText || fallbackTitle || "Memuat Instrumen...").trim() || "Memuat Instrumen...";
  const labelLength = resolvedTitle.length;

  document.querySelectorAll("#cis-label, #mini-cis-label").forEach((el) => {
    el.textContent = resolvedTitle;
    el.classList.remove(
      "instrument-label-long",
      "instrument-label-very-long",
      "instrument-label-ultra-long",
    );

    if (labelLength >= 34) {
      el.classList.add("instrument-label-ultra-long");
    } else if (labelLength >= 26) {
      el.classList.add("instrument-label-very-long");
    } else if (labelLength >= 18) {
      el.classList.add("instrument-label-long");
    }

    if (typeof autoFitTextSingleLine === "function" && el.offsetParent !== null) {
      autoFitTextSingleLine(el, { maxPx: 13, minPx: 9 });
    }
  });

  return resolvedTitle;
}
window.applyInstrumentLabelPresentation = applyInstrumentLabelPresentation;

function clampMidiTempoBpm(value, fallback = MIDI_TEMPO_FALLBACK_BPM) {
  const fallbackNum = Number(fallback);
  const safeFallback = Number.isFinite(fallbackNum) ? fallbackNum : MIDI_TEMPO_FALLBACK_BPM;
  const parsed = Number(value);
  const candidate = Number.isFinite(parsed) ? parsed : safeFallback;
  const rounded = Math.round(candidate);
  return Math.max(MIDI_TEMPO_MIN_BPM, Math.min(MIDI_TEMPO_MAX_BPM, rounded));
}

function syncTempoControlsUI() {
  currentSongDefaultTempoBpm = clampMidiTempoBpm(currentSongDefaultTempoBpm, MIDI_TEMPO_FALLBACK_BPM);
  currentTempoBpm = clampMidiTempoBpm(currentTempoBpm, currentSongDefaultTempoBpm);

  [customTempoSlider, miniTempoSlider].filter(Boolean).forEach((slider) => {
    slider.min = String(MIDI_TEMPO_MIN_BPM);
    slider.max = String(MIDI_TEMPO_MAX_BPM);
    slider.value = String(currentTempoBpm);
  });

  [customTempoInput, miniTempoInput].filter(Boolean).forEach((input) => {
    input.min = String(MIDI_TEMPO_MIN_BPM);
    input.max = String(MIDI_TEMPO_MAX_BPM);
    if (document.activeElement !== input && input.dataset.tempoEditing !== "1") {
      input.value = String(currentTempoBpm);
    }
  });

  const labelText = `${currentTempoBpm} BPM`;

  if (miniTempoToggleValue) {
    miniTempoToggleValue.textContent = String(currentTempoBpm);
  } else {
    const miniTempoLabel = document.getElementById("mini-tempo-toggle-label");
    if (miniTempoLabel) miniTempoLabel.textContent = labelText;
  }

  if (customTempoToggleValue) {
    customTempoToggleValue.textContent = String(currentTempoBpm);
  } else {
    const customTempoLabel = document.getElementById("custom-tempo-toggle-label");
    if (customTempoLabel) customTempoLabel.textContent = labelText;
  }

  const ratioPct = Math.round((currentTempoBpm / currentSongDefaultTempoBpm) * 100);
  [customTempoToggleBtn, miniTempoToggleBtn].filter(Boolean).forEach((btn) => {
    btn.title = `Tempo ${labelText} (${ratioPct}% dari default ${currentSongDefaultTempoBpm} BPM)`;
    btn.setAttribute("aria-label", `Tempo saat ini ${labelText}`);
  });
}

function setCurrentSongTempo(defaultBpm, options = {}) {
  const shouldResetCurrent = options.resetCurrent !== false;
  // During a song switch the engine may still hold the previous MIDI buffer.
  // Never re-render/apply tempo to that stale buffer; the foreground load will
  // render the selected song with the updated tempo state.
  const shouldSkipApply = options.skipApply === true || window.isMidiSwitching === true;
  currentSongDefaultTempoBpm = clampMidiTempoBpm(defaultBpm, currentSongDefaultTempoBpm);
  if (shouldResetCurrent) {
    currentTempoBpm = currentSongDefaultTempoBpm;
  } else {
    currentTempoBpm = clampMidiTempoBpm(currentTempoBpm, currentSongDefaultTempoBpm);
  }

  if (typeof MidiEngine !== "undefined") {
    if (typeof MidiEngine.setTempoBaseBpm === "function") {
      MidiEngine.setTempoBaseBpm(currentSongDefaultTempoBpm, {
        keepCurrentTempo: !shouldResetCurrent,
        skipApply: true,
      });
    }
    if (typeof MidiEngine.setTempoBpm === "function") {
      MidiEngine.setTempoBpm(currentTempoBpm, {
        skipApply: shouldSkipApply,
      });
    }
  }

  syncTempoControlsUI();
  return currentSongDefaultTempoBpm;
}

function setMidiTempoBpm(nextBpm) {
  currentTempoBpm = clampMidiTempoBpm(nextBpm, currentTempoBpm);

  if (typeof MidiEngine !== "undefined" && typeof MidiEngine.setTempoBpm === "function") {
    MidiEngine.setTempoBpm(currentTempoBpm);
  }

  syncTempoControlsUI();
  return currentTempoBpm;
}

function commitMidiTempoInputValue(inputEl) {
  if (!inputEl) return;
  inputEl.dataset.tempoEditing = "0";

  const raw = String(inputEl.value || "").trim();
  if (!raw) {
    syncTempoControlsUI();
    return;
  }

  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    syncTempoControlsUI();
    return;
  }

  setMidiTempoBpm(parsed);
}

window.setCurrentSongTempo = setCurrentSongTempo;
window.setMidiTempoBpm = setMidiTempoBpm;
window.getCurrentSongTempoBpm = function getCurrentSongTempoBpm() {
  return currentTempoBpm;
};
window.getCurrentSongDefaultTempoBpm = function getCurrentSongDefaultTempoBpm() {
  return currentSongDefaultTempoBpm;
};

/**
 * Reset all MIDI state to defaults. Called when closing viewer or switching songs.
 */
function resetMidiState(options) {
  if (typeof MidiEngine !== 'undefined' && !(options && options.keepEngineState)) {
    MidiEngine.reset();
  }
  window._midiSavedTime = null;

  // Clear midi-available so expanded-layout won't show empty player
  // Skip removal during song switching to prevent portrait flicker
  var mc = document.getElementById('midi-collapse');
  if (mc && !(options && options.keepAvailable)) mc.classList.remove('midi-available');

  // Reset play UI to avoid stale playing state
  var midiEl = document.getElementById('custom-midi-player');
  if (midiEl) midiEl.classList.remove('playing');
  var playIcon = document.getElementById('custom-play-icon');
  if (playIcon) playIcon.textContent = 'play_arrow';
}
;

/* SOURCE: 02-dom.js */
// --- 1. DOM ---
const mainContent = document.getElementById("main-content");
const pujianBtn = document.getElementById("pujian-btn");
const pengaturanBtn = document.getElementById("pengaturan-btn");
const searchContainer = document.getElementById("search-container");
const searchInput = document.getElementById("search-input");
const clearSearchBtn = document.getElementById("clear-search");

const pdfViewerOverlay = document.getElementById("pdf-viewer-overlay");
const pdfViewerContent = document.querySelector(".pdf-viewer-content");
const pdfViewerFooter = document.querySelector(".pdf-viewer-footer");
const songTitleWrapper = document.querySelector(".song-title-wrapper");
const pdfViewerTitle = document.getElementById("pdf-viewer-title");
const pdfViewerNumber = document.getElementById("pdf-viewer-number");
let canvasWrapper = document.querySelector(".canvas-wrapper");
const pdfViewerCloseBtn = document.getElementById("pdf-viewer-close");
const midiToggleBtn = document.getElementById("midi-toggle-btn");
const midiPanel = document.getElementById("midi-panel");

// --- MIDI state (managed by MidiEngine) ---
let _midiLoadGeneration = 0; // Incremented on each song change to cancel stale loads
let _openPdfViewerGeneration = 0; // Incremented on each openPdfViewer call to cancel concurrent stale calls

// Preload progress bar refs
const midiPreloadBar = document.getElementById('midi-preload-bar');
const midiPreloadFill = document.getElementById('midi-preload-fill');
const customInstrumentSelect = document.getElementById("custom-instrument-select");
const cisLabel = document.getElementById("cis-label");
const cisMenu = document.getElementById("cis-menu");
const customPlayBtn = document.getElementById("custom-play-btn");
const customPlayIcon = document.getElementById("custom-play-icon");
const customTimeDisplay = document.getElementById("custom-time-display");
const customSeekbar = document.getElementById("custom-seekbar");
const customTempoToggleBtn = document.getElementById("custom-tempo-toggle-btn");
const customTempoToggleValue = document.getElementById("custom-tempo-toggle-value");
const customTempoSlider = document.getElementById("custom-tempo-slider");
const customTempoInput = document.getElementById("custom-tempo-input");
const miniTempoToggleBtn = document.getElementById("mini-tempo-toggle-btn");
const miniTempoToggleValue = document.getElementById("mini-tempo-toggle-value");
const miniTempoSlider = document.getElementById("mini-tempo-slider");
const miniTempoInput = document.getElementById("mini-tempo-input");

const pageNavigationPortrait = document.querySelector(".pdf-viewer-footer .page-navigation");
const pageNavigationLandscape = document.querySelector(".landscape-controls .page-navigation-landscape");

const prevSongBtn = document.getElementById("song-prev");
const nextSongBtn = document.getElementById("song-next");

const viewModeBtnPortrait = document.getElementById("view-mode-portrait");
const scrollModeBtnPortrait = document.getElementById("scroll-mode-portrait");
const viewModeBtnLandscape = document.getElementById("view-mode-landscape");
const scrollModeBtnLandscape = document.getElementById("scroll-mode-landscape");

const prevPageBtnPortrait = document.getElementById("pdf-prev-portrait");
const nextPageBtnPortrait = document.getElementById("pdf-next-portrait");
const zoomInBtnPortrait = document.getElementById("zoom-in-portrait");
const zoomOutBtnPortrait = document.getElementById("zoom-out-portrait");
const pageNumElPortrait = document.getElementById("page-num-portrait");
const pageCountElPortrait = document.getElementById("page-count-portrait");
const zoomLevelIndicatorPortrait = document.getElementById("zoom-level-indicator-portrait");

const prevPageBtnLandscape = document.getElementById("pdf-prev-landscape");
const nextPageBtnLandscape = document.getElementById("pdf-next-landscape");
const zoomInBtnLandscape = document.getElementById("zoom-in-landscape");
const zoomOutBtnLandscape = document.getElementById("zoom-out-landscape");
const pageNumElLandscape = document.getElementById("page-num-landscape");
const pageCountElLandscape = document.getElementById("page-count-landscape");
const zoomLevelIndicatorLandscape = document.getElementById("zoom-level-indicator-landscape");

const viewerLoader = document.getElementById("viewer-loader");
const viewerLoaderProgress = document.getElementById("viewer-loader-progress");
const orientationWarning = document.getElementById("orientation-warning");
const zoomToast = document.getElementById("zoom-toast");
const zoomToastIcon = zoomToast.querySelector(".material-symbols-outlined");

const generalToast = document.getElementById("general-toast");
const generalToastIcon = generalToast.querySelector(".material-symbols-outlined");

const chordEditorToolbar = document.getElementById("chord-editor-toolbar");
const chordEditorToggleBtn = document.getElementById("chord-editor-toggle-btn");
const chordSaveBtn = document.getElementById("chord-save-btn");
const transposeCollapses = Array.from(document.querySelectorAll(".transpose-collapse"));
const transposeToggleBtns = Array.from(document.querySelectorAll(".transpose-toggle-btn"));
const transposeDownBtns = Array.from(document.querySelectorAll(".transpose-down-btn"));
const transposeUpBtns = Array.from(document.querySelectorAll(".transpose-up-btn"));
const transposeResetBtns = Array.from(document.querySelectorAll(".transpose-reset-btn"));
const transposeIndicators = Array.from(document.querySelectorAll(".transpose-indicator"));
const accidentalSwitchBtns = Array.from(document.querySelectorAll(".transpose-accidental-btn"));
const hideChordBtns = Array.from(document.querySelectorAll(".hide-chord-btn"));
;

/* SOURCE: 03-state.js */
// --- 2. State ---
let pujianItems = [];
let pdfDoc = null;
let activePdfLoadingTask = null;
let activePdfLoadingGeneration = 0;
let currentPageNum = 1;
let currentSongIndex = -1;
let currentScale = "page-fit";
let initialScale = 1.0;

let currentViewMode = "single";
let currentScrollMode = "horizontal";

let prefs = {
  uiStyle: "sanctuary",
  colorScheme: "warm",
  layoutStyle: "balanced",
  uiFont: "auto",
  defaultTwoPage: false,
  defaultVerticalScroll: false,
  preferNaturalChords: true,
  midiSoundfont: "assets/soundfont/GeneralUser-GS.sf2",
  midiInstrument: "",
  midiInstrumentBySoundfont: {},
  midiInstrumentUserSelected: false,
  preloadEnabled: true,
  preloadCount: 1,
  preloadCacheMax: 12,
  preloadShuffle: true
};

let chordUiPrefs = {
  theme: "blue",
  fill: "soft",
  fillColor: "blue",
  fontOverridePercent: 100,
  fillOpacityPercent: 70,
  fillPaddingPercent: 100,
  syncThemeWithAccent: false,
  syncFillWithAccent: false
};
let customAccentColor = DEFAULT_CUSTOM_ACCENT;

let initialPinchDistance = 0;
let toastTimeout = null;
let zoomToastTimeout = null;

let chordEditorEnabled = false;
let chordConfig = null;
let originalFamilyChord = null;
let originalPdfKey = null;
let baseTransposeOffset = 0;
let titleTapCount = 0;
let titleTapTimer = null;
let transposeStep = 0;
let currentSongDefaultTempoBpm = MIDI_TEMPO_FALLBACK_BPM;
let currentTempoBpm = MIDI_TEMPO_FALLBACK_BPM;
let accidentalMode = localStorage.getItem(CHORD_ACCIDENTAL_STORAGE_KEY) === "flat" ? "flat" : "sharp";
let swipeStartPoint = null;
let isMouseDragging = false;
let mouseDragStartX = 0;
let mouseDragStartY = 0;
let mouseDragScrollLeft = 0;
let mouseDragScrollTop = 0;
let lastSwipeHandledAt = 0;
let pinchState = null;
let wheelState = null;
let wheelRenderTimeout = null;
let isFinalizingWheelZoom = false;
let renderRequestId = 0;
let isSoundfontSwitching = false;
let soundfontSwitchRequestId = 0;
let zoomInProgress = false;
let zoomDeferInsert = false;
let chordEditorCollapsed = localStorage.getItem(CHORD_COLLAPSE_STORAGE_KEY) === "1";
let chordsHidden = false;
let lastViewerTapAt = 0;
let lastViewerTapPoint = null;
let lastIndicatorTapAt = 0;
let lastIndicatorTapEl = null;
const chordDissolveTimers = new WeakMap();

// Shuffle predetermination: the next song is decided when the current one loads,
// so we can show it in the UI and preload its audio in the background.
let shuffleNextGlobalIdx = -1;      // Predetermined next global index (shuffle-all)
let shuffleNextPlaylistIdx = -1;    // Predetermined next playlist-song index (shuffle-playlist)

// Shuffle history: tracks previously played songs so "previous" navigates back through history
let shuffleHistory = [];             // Stack of { globalIdx, playlistIdx? } for shuffle-all/playlist
const SHUFFLE_HISTORY_MAX = 50;      // Max history entries to keep

// --- Note-Aligned Chord Editor State ---
let noteChordConfig = null; // { version: 2, type: "note-aligned", pages: {} }
let pageNotesCache = {}; // Map pageNum -> { notes: [...], pageWidth, pageHeight }
;

/* SOURCE: 05-events.js */
// --- 4. Event Listeners ---

function setupEventListeners() {
  pujianBtn.addEventListener("click", () => navigateTo("pujian"));

  pengaturanBtn.addEventListener("click", () => navigateTo("pengaturan"));

  searchInput.addEventListener("input", handleSearch);

  clearSearchBtn.addEventListener("click", clearSearch);

  mainContent.addEventListener("click", handleMainContentClick);

  mainContent.addEventListener("change", handleSettingsChange);

  mainContent.addEventListener("input", handleSettingsChange);

  pdfViewerCloseBtn.addEventListener("click", closePdfViewer);

  if (midiToggleBtn) {
    midiToggleBtn.addEventListener("click", () => {
      const isExpanded = midiToggleBtn.getAttribute("aria-expanded") === "true";

      // Re-enable CSS transitions (removed during programmatic navigation)
      // so the open/close animation only plays on user-initiated toggle clicks.
      if (typeof midiPanel !== "undefined" && midiPanel) {
        midiPanel.classList.remove('no-transition');
        void midiPanel.offsetHeight; // commit transition-property before state change
      }

      midiToggleBtn.setAttribute("aria-expanded", !isExpanded);
    });
  }

  // Custom MIDI Controls Logic

  if (customPlayBtn) {
    // Apply logic to ALL instrument capsule buttons (main player and mini player)
    document.querySelectorAll(".instrument-capsule-btn").forEach((btnNode) => {
      btnNode.addEventListener("click", (e) => {
        // prevent closing immediately if clicking inside menu but not on option
        if (
          e.target.closest(".cis-menu-popover") &&
          !e.target.closest(".cis-option")
        )
          return;

        if (isSoundfontSwitching) {
          if (typeof showToast === "function") {
            showToast("Sedang memuat daftar instrumen SoundFont...", "hourglass_empty");
          }
          return;
        }

        const currentDropdownObj = e.target.closest(
          ".instrument-selector-wrapper",
        );
        const uiWrapper = currentDropdownObj;
        if (uiWrapper) {
          // Always regenerate from active soundfont before opening,
          // so static HTML can never override dynamic map content.
          if (typeof rebuildInstrumentSelectors === 'function') {
            rebuildInstrumentSelectors((prefs && prefs.midiSoundfont) || MIDI_SF2_URL);
          }

          // ensure autonext menu is closed if it's open
          const autoBtn = document.getElementById("autonext-btn");
          const autonextWrapper = autoBtn
            ? autoBtn.closest(".instrument-selector-wrapper")
            : null;
          if (autonextWrapper && autonextWrapper !== uiWrapper) {
            autonextWrapper.classList.remove("is-open");
            if (autoBtn) autoBtn.setAttribute("aria-expanded", "false");
          }

          // Also close other open instrument selectors
          document
            .querySelectorAll(".instrument-selector-wrapper.is-open")
            .forEach((openWrapper) => {
              if (openWrapper !== uiWrapper) {
                openWrapper.classList.remove("is-open");
                const capBtn = openWrapper.querySelector(
                  ".instrument-capsule-btn, .tempo-popover-toggle",
                );
                if (capBtn) capBtn.setAttribute("aria-expanded", "false");
              }
            });

          uiWrapper.classList.toggle("is-open");

          if (currentDropdownObj) {
            const capBtn = currentDropdownObj.querySelector(
              ".instrument-capsule-btn",
            );
            if (capBtn)
              capBtn.setAttribute(
                "aria-expanded",
                uiWrapper.classList.contains("is-open") ? "true" : "false",
              );
          }
        }
      });
    });

    // Close dropdown on outside click
    document.addEventListener("click", (e) => {
      document
        .querySelectorAll(".instrument-selector-wrapper.is-open")
        .forEach((uiWrapper) => {
          if (!uiWrapper.contains(e.target)) {
            uiWrapper.classList.remove("is-open");
            const capBtn = uiWrapper.querySelector(
              ".instrument-capsule-btn, .tempo-popover-toggle",
            );
            if (capBtn) capBtn.setAttribute("aria-expanded", "false");
          }
        });
      // Close settings custom dropdowns on outside click
      document.querySelectorAll(".settings-custom-dropdown.is-open").forEach(function(wrapper) {
        if (!wrapper.contains(e.target)) {
          wrapper.classList.remove("is-open");
          const btn = wrapper.querySelector(".settings-dropdown-btn");
          if (btn) btn.setAttribute("aria-expanded", "false");
        }
      });
    });

    // Option select — delegated so dynamically rebuilt lists work
    document.addEventListener("click", (e) => {
      const btn = e.target.closest(".cis-option");
      if (!btn) return;

      // Block instrument switching while engine is actively rendering/loading.
      if (isSoundfontSwitching || (typeof MidiEngine !== 'undefined' && MidiEngine.isLoading())) {
        if (typeof showToast === "function") {
          showToast("Sedang memuat audio MIDI / SoundFont, harap tunggu...", "hourglass_empty");
        }
        return;
      }

      const val = btn.getAttribute("data-val");
      if (val == null) return;

      // Auto-close menu after selection for all wrappers
      const uiWrapper = e.target.closest(".instrument-selector-wrapper");
      if (uiWrapper) {
        uiWrapper.classList.remove("is-open");
        const capBtn = uiWrapper.querySelector(
          ".instrument-capsule-btn, .tempo-popover-toggle",
        );
        if (capBtn) capBtn.setAttribute("aria-expanded", "false");
      }

      // Also close any other stuck wrappers
      document
        .querySelectorAll(".instrument-selector-wrapper.is-open")
        .forEach((openWrapper) => {
          openWrapper.classList.remove("is-open");
          const capBtn = openWrapper.querySelector(
            ".instrument-capsule-btn, .tempo-popover-toggle",
          );
          if (capBtn) capBtn.setAttribute("aria-expanded", "false");
        });

      // Remove active states
      if (
        typeof customInstrumentSelect !== "undefined" &&
        customInstrumentSelect
      )
        customInstrumentSelect.classList.remove("active");

      // Update UI styling for instrument selector options only
      document.querySelectorAll(".instrument-selector-wrapper .cis-option").forEach((o) => {
        if (o.getAttribute("data-val") === val) {
          o.classList.add("selected");
        } else {
          o.classList.remove("selected");
        }
      });

      const miniInstrumentSelect = document.getElementById(
        "mini-instrument-select",
      );
      if (
        typeof customInstrumentSelect !== "undefined" &&
        customInstrumentSelect
      )
        customInstrumentSelect.dataset.value = val;
      if (miniInstrumentSelect) miniInstrumentSelect.dataset.value = val;

      const titleText = btn.getAttribute("title") || btn.textContent.trim() || "Memuat Instrumen...";
      if (
        typeof customInstrumentSelect !== "undefined" &&
        customInstrumentSelect
      )
        customInstrumentSelect.title = titleText;
      if (
        typeof customInstrumentSelect !== "undefined" &&
        customInstrumentSelect
      )
        customInstrumentSelect.setAttribute("aria-label", titleText);
      if (miniInstrumentSelect) {
        miniInstrumentSelect.title = titleText;
        miniInstrumentSelect.setAttribute("aria-label", titleText);
      }

      document.querySelectorAll("#cis-icon, #mini-cis-icon").forEach((el) => {
        if (typeof getMidiInstrumentIcon === "function")
          el.textContent = getMidiInstrumentIcon(val, titleText);
      });

      if (typeof applyInstrumentLabelPresentation === "function") {
        applyInstrumentLabelPresentation(titleText);
      }

      if (typeof prefs !== "undefined") {
        const activeSf = (typeof normalizeSoundfontKey === "function")
          ? normalizeSoundfontKey((prefs && prefs.midiSoundfont) || MIDI_SF2_URL)
          : ((prefs && prefs.midiSoundfont) || MIDI_SF2_URL);
        if (!prefs.midiInstrumentBySoundfont || typeof prefs.midiInstrumentBySoundfont !== "object") {
          prefs.midiInstrumentBySoundfont = {};
        }
        prefs.midiInstrument = val;
        prefs.midiInstrumentBySoundfont[activeSf] = String(val);
        prefs.midiInstrumentUserSelected = true;
        localStorage.setItem("prefs", JSON.stringify(prefs));
      }

      // Re-preload all pool players
      if (typeof changeInstrument === "function") {
        changeInstrument();
      }
    });

    [customTempoToggleBtn, miniTempoToggleBtn].filter(Boolean).forEach((btnNode) => {
      btnNode.addEventListener("click", (e) => {
        e.stopPropagation();
        const uiWrapper = btnNode.closest(".instrument-selector-wrapper");
        if (!uiWrapper) return;

        const willOpen = !uiWrapper.classList.contains("is-open");
        document
          .querySelectorAll(".instrument-selector-wrapper.is-open")
          .forEach((openWrapper) => {
            if (openWrapper !== uiWrapper) {
              openWrapper.classList.remove("is-open");
              const triggerBtn = openWrapper.querySelector(
                ".instrument-capsule-btn, .tempo-popover-toggle",
              );
              if (triggerBtn) triggerBtn.setAttribute("aria-expanded", "false");
            }
          });

        uiWrapper.classList.toggle("is-open", willOpen);
        btnNode.setAttribute("aria-expanded", willOpen ? "true" : "false");
      });
    });

    [customTempoSlider, miniTempoSlider].filter(Boolean).forEach((slider) => {
      slider.addEventListener("change", (e) => {
        setMidiTempoBpm(e.target.value);
      });
    });

    [customTempoInput, miniTempoInput].filter(Boolean).forEach((input) => {
      input.addEventListener("input", () => {
        input.dataset.tempoEditing = "1";
      });

      input.addEventListener("change", () => {
        commitMidiTempoInputValue(input);
      });

      input.addEventListener("blur", () => {
        commitMidiTempoInputValue(input);
      });

      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          commitMidiTempoInputValue(input);
          input.blur();
        } else if (e.key === "Escape") {
          e.preventDefault();
          input.dataset.tempoEditing = "0";
          syncTempoControlsUI();
          input.blur();
        }
      });
    });

    syncTempoControlsUI();

    // Play/Pause — named function so mini player can call directly (real user gesture)
    async function toggleMidiPlayback() {
      if (typeof MidiEngine === 'undefined') return;
      if (window.isMidiSwitching) {
        if (typeof showToast === "function") {
          showToast("Sedang mengganti lagu MIDI, harap tunggu...", "hourglass_empty");
        }
        return;
      }
      if (MidiEngine.isLoading()) {
        if (typeof showToast === "function")
          showToast("Sedang memuat audio MIDI, harap tunggu...", "hourglass_empty");
        return;
      }

      // Resume AudioContext on user gesture
      MidiEngine.resumeContext();

      if (!MidiEngine.getCurrentMidiUrl()) return;

      try {
        const shouldPlay = !MidiEngine.isPlaying();

        if (shouldPlay) {
          if (typeof window._verifyPlaylistModeForCurrentSong === "function") {
            window._verifyPlaylistModeForCurrentSong();
          }

          // If at end, restart from beginning
          const dur = MidiEngine.getDuration();
          if (dur > 0 && MidiEngine.getTime() >= dur - MIDI_END_THRESHOLD_S) {
            MidiEngine.seek(0);
          }

          MidiEngine.play();

          // Update UI immediately
          customPlayIcon.textContent = "pause";
          document.getElementById("custom-midi-player").classList.add("playing");
          var _miniPlayIcon = document.getElementById("mini-play-icon");
          if (_miniPlayIcon) _miniPlayIcon.textContent = "pause";
          window._midiSavedTime = null;
        } else {
          MidiEngine.pause();

          window._midiSavedTime = MidiEngine.getTime();

          // Update UI immediately
          customPlayIcon.textContent = "play_arrow";
          document.getElementById("custom-midi-player").classList.remove("playing");
          var _miniPlayIcon2 = document.getElementById("mini-play-icon");
          if (_miniPlayIcon2) _miniPlayIcon2.textContent = "play_arrow";
        }
      } catch (err) {
        console.error("Gagal start/stop MIDI:", err);
        customPlayIcon.textContent = "play_arrow";
        document.getElementById("custom-midi-player").classList.remove("playing");
      }
      // Sync mini-player state immediately (don't wait for 1-second interval)
      if (typeof syncMiniPlayerUI === 'function') syncMiniPlayerUI();
    }
    window.toggleMidiPlayback = toggleMidiPlayback;
    customPlayBtn.addEventListener("click", toggleMidiPlayback);

    // Seekbar sync using requestAnimationFrame for smooth updates
    let isDraggingSeekbar = false;
    window._midiLastSeekValue = -1;

    // Song end is now handled by MidiEngine's onSongEnd callback (wired in 04-init.js).
    // Listen for the custom event dispatched from that callback:
    window.addEventListener('midi-song-end', function () {
      if (window.isMidiSwitching) return;

      syncSeekbarUI(0, MidiEngine.getDuration());
      customPlayIcon.textContent = "play_arrow";
      document.getElementById("custom-midi-player").classList.remove("playing");
      window._midiLastSeekValue = 0;
      window._midiSavedTime = null;

      const endMode = PlaylistManager.getAutoNextMode();

      // Loop intercept — repeat one: restart from 0
      if (endMode === "one") {
        MidiEngine.seek(0);
        MidiEngine.play();
        customPlayIcon.textContent = "pause";
        document.getElementById("custom-midi-player").classList.add("playing");
        return;
      }

      // Auto next intercept — only for active auto-next modes (never for 'off')
      if (endMode !== 'off' && typeof window._playlistCheckAutoNext === "function") {
        window._autoAdvanceFromEnd = true;
        window._playlistCheckAutoNext();
      }
    });

    let _seekbarRafId = null;
    let _seekbarIdleTimer = null;
    function scheduleSeekbarLoop(delayMs) {
      if (_seekbarRafId || _seekbarIdleTimer) return;
      const delay = Math.max(0, delayMs || 0);
      if (delay > 0) {
        _seekbarIdleTimer = setTimeout(function () {
          _seekbarIdleTimer = null;
          _seekbarRafId = requestAnimationFrame(seekbarAnimationLoop);
        }, delay);
      } else {
        _seekbarRafId = requestAnimationFrame(seekbarAnimationLoop);
      }
    }

    function seekbarAnimationLoop() {
      _seekbarRafId = null;

      // Sync loading bar on both MIDI player and mini player (always, even when skipping seekbar)
      var engineLoading = typeof MidiEngine !== 'undefined' && MidiEngine.isLoading();
      var midiUiLoading = engineLoading || window.isMidiSwitching;
      var inViewer = document.body.classList.contains("viewer-active");
      var midiPlayerLoading = document.getElementById('midi-player-loading');
      // In the PDF viewer the external preload bar is the single source of truth.
      // Keeping this internal loading bar visible there creates a duplicate bar.
      if (midiPlayerLoading) midiPlayerLoading.style.display = (midiUiLoading && !inViewer) ? '' : 'none';
      var miniPlayerLoading = document.getElementById('mini-player-loading');
      if (miniPlayerLoading) miniPlayerLoading.style.display = (midiUiLoading && !inViewer) ? '' : 'none';

      if (engineLoading || window.isMidiSwitching) {
        window._midiLastSeekValue = 0;
        syncSeekbarUI(0, 0);
        scheduleSeekbarLoop(100);
        return;
      }
      if (isDraggingSeekbar) {
        scheduleSeekbarLoop(50);
        return;
      }
      const isPlayingNow = typeof MidiEngine !== 'undefined' && MidiEngine.isPlaying();
      if (!inViewer && !isPlayingNow) {
        scheduleSeekbarLoop(500);
        return;
      }

      const dur = (typeof MidiEngine !== 'undefined' ? MidiEngine.getDuration() : 0) || window._midiKnownDuration || 0;
      const curr = typeof MidiEngine !== 'undefined' ? MidiEngine.getTime() : 0;

      // Only update DOM if value changed significantly
      if (Math.abs(curr - window._midiLastSeekValue) >= 0.05 || customSeekbar.max != dur) {
        window._midiLastSeekValue = curr;
        syncSeekbarUI(curr, dur);
      }
      scheduleSeekbarLoop(isPlayingNow ? 100 : 500);
    }
    scheduleSeekbarLoop(0);

    // Prevent timeupdate from fighting with user interaction
    const seekbars = [
      customSeekbar,
      document.getElementById("mini-seekbar"),
    ].filter(Boolean);
    seekbars.forEach((bar) => {
      bar.addEventListener("input", (e) => {
        if (window.isMidiSwitching || (typeof MidiEngine !== 'undefined' && MidiEngine.isLoading())) {
          isDraggingSeekbar = false;
          window._midiLastSeekValue = 0;
          syncSeekbarUI(0, 0);
          return;
        }
        isDraggingSeekbar = true;
        const dur = (typeof MidiEngine !== 'undefined' ? MidiEngine.getDuration() : 0) || window._midiKnownDuration || 0;
        const val = parseFloat(e.target.value);
        syncSeekbarUI(val, dur);
      });

      bar.addEventListener("change", (e) => {
        isDraggingSeekbar = false;
        if (window.isMidiSwitching || (typeof MidiEngine !== 'undefined' && MidiEngine.isLoading())) {
          window._midiLastSeekValue = 0;
          syncSeekbarUI(0, 0);
          return;
        }
        const val = parseFloat(e.target.value);
        const dur = (typeof MidiEngine !== 'undefined' ? MidiEngine.getDuration() : 0) || window._midiKnownDuration || 0;

        if (typeof MidiEngine !== 'undefined' && MidiEngine.getCurrentMidiUrl()) {
          MidiEngine.seek(val);
        }
        syncSeekbarUI(val, dur);
        window._midiLastSeekValue = val;
        window._midiSavedTime = null;
      });
    });
  }

  syncTempoControlsUI();

  prevSongBtn.addEventListener("click", onPrevSong);

  nextSongBtn.addEventListener("click", onNextSong);

  [viewModeBtnPortrait, viewModeBtnLandscape].forEach((btn) =>
    btn.addEventListener("click", onToggleViewMode),
  );

  [scrollModeBtnPortrait, scrollModeBtnLandscape].forEach((btn) =>
    btn.addEventListener("click", onToggleScrollMode),
  );

  [prevPageBtnPortrait, prevPageBtnLandscape].forEach((btn) =>
    btn.addEventListener("click", onPrevPage),
  );

  [nextPageBtnPortrait, nextPageBtnLandscape].forEach((btn) =>
    btn.addEventListener("click", onNextPage),
  );

  [zoomInBtnPortrait, zoomInBtnLandscape].forEach((btn) =>
    btn.addEventListener("click", () => onZoom("in")),
  );

  [zoomOutBtnPortrait, zoomOutBtnLandscape].forEach((btn) =>
    btn.addEventListener("click", () => onZoom("out")),
  );

  [zoomLevelIndicatorPortrait, zoomLevelIndicatorLandscape]

    .filter(Boolean)

    .forEach((indicator) => {
      indicator.addEventListener("touchend", onZoomIndicatorTouchEnd, {
        passive: false,
      });

      indicator.addEventListener("dblclick", onZoomIndicatorDoubleClick);
    });

  chordSaveBtn.addEventListener("click", () => {
    // Chord data is now stored only in note-aligned JSON (*.chord.json).
    // Do not fall back to the legacy grid/TXT saver.
    if (typeof saveNoteChordConfigurationFile === "function") {
      saveNoteChordConfigurationFile();
    }
  });

  // Load chord file button
  const chordLoadBtn = document.getElementById("chord-load-btn");
  if (chordLoadBtn) {
    chordLoadBtn.addEventListener("click", () => {
      if (typeof loadNoteChordFromFile === "function") {
        loadNoteChordFromFile();
      }
    });
  }

  if (chordEditorToggleBtn) {
    chordEditorToggleBtn.addEventListener("click", onToggleChordEditorCollapse);
  }

  transposeDownBtns.forEach((btn) =>
    btn.addEventListener("click", () => onTranspose(-1)),
  );

  transposeUpBtns.forEach((btn) =>
    btn.addEventListener("click", () => onTranspose(1)),
  );

  transposeResetBtns.forEach((btn) =>
    btn.addEventListener("click", resetTranspose),
  );

  accidentalSwitchBtns.forEach((btn) =>
    btn.addEventListener("click", onToggleAccidentalMode),
  );

  document
    .querySelectorAll(".family-chord-btn")
    .forEach((btn) =>
      btn.addEventListener("click", onToggleFamilyChordDropdown),
    );

  if (transposeToggleBtns.length) {
    transposeToggleBtns.forEach((btn) =>
      btn.addEventListener("click", onToggleTransposeCollapse),
    );
  }

  canvasWrapper.addEventListener("click", onChordLayerClick);

  document.addEventListener("click", onGlobalDocumentClick);

  hideChordBtns.forEach((btn) =>
    btn.addEventListener("click", onToggleChordsHidden),
  );

  songTitleWrapper.addEventListener("click", handleTitleActivatorTap);

  if (screen.orientation) {
    screen.orientation.addEventListener("change", handleOrientationChange);
  } else {
    window.addEventListener("orientationchange", handleOrientationChange);
  }

  // Extra matchMedia listener for orientation — more reliable on some Android/iOS browsers
  if (window.matchMedia) {
    const orientationMql = window.matchMedia("(orientation: portrait)");
    const onOrientationMqlChange = () => {
      if (typeof checkOrientation === "function") checkOrientation();
    };
    if (orientationMql.addEventListener) {
      orientationMql.addEventListener("change", onOrientationMqlChange);
    } else if (orientationMql.addListener) {
      orientationMql.addListener(onOrientationMqlChange);
    }
  }

  window.addEventListener("wheel", handleGlobalScroll, { passive: false });

  window.addEventListener("keydown", handleGlobalKeydown, { passive: false });

  // Scope pinch handlers to the viewer only to avoid conflicts with global/browser gestures.

  pdfViewerContent.addEventListener("touchstart", handleTouchStart, {
    passive: true,
  });

  pdfViewerContent.addEventListener("touchmove", handleTouchMove, {
    passive: false,
  });

  pdfViewerContent.addEventListener("touchend", handleTouchEnd, {
    passive: true,
  });

  pdfViewerContent.addEventListener("touchstart", handleViewerTouchStart, {
    passive: true,
  });

  pdfViewerContent.addEventListener("touchend", handleViewerTouchEnd, {
    passive: true,
  });

  pdfViewerContent.addEventListener("mousedown", handleViewerPointerStart);

  pdfViewerContent.addEventListener("mousemove", handleViewerPointerMove);

  pdfViewerContent.addEventListener("mouseup", handleViewerPointerEnd);

  pdfViewerContent.addEventListener("mouseleave", handleViewerPointerEnd);

  window.addEventListener("resize", onLayoutResize);
}
;

/* SOURCE: 06-navigation.js */
// --- 5. Navigasi utama ---
function navigateTo(page) {
  // Suppress MIDI panel animation during page navigation
  const midiPanelEl = document.getElementById('midi-panel');
  if (midiPanelEl) {
    midiPanelEl.classList.add('no-midi-transition');
    requestAnimationFrame(() => requestAnimationFrame(() => midiPanelEl.classList.remove('no-midi-transition')));
  }

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
  const shouldResetMainContentScroll = ["pujian", "playlist", "report-bug", "about-project", "pengaturan"].includes(page);
  const resetMainContentScroll = () => {
    if (!mainContent) return;
    mainContent.scrollTop = 0;
    if (typeof mainContent.scrollTo === "function") {
      mainContent.scrollTo({ top: 0, left: 0, behavior: "auto" });
    }
  };
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
  } else if (page === "about-project") {
    pengaturanBtn.classList.add("selected");
    searchContainer.style.display = "none";
    renderAboutProjectPage();
  } else if (page === "pengaturan") {
    pengaturanBtn.classList.add("selected");
    searchContainer.style.display = "none";
    renderSettings();
  }

  if (shouldResetMainContentScroll) {
    resetMainContentScroll();
    requestAnimationFrame(resetMainContentScroll);
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

function renderFontPresetOptions(activeFont) {
  return FONT_PRESETS.map((preset) => {
    const isSelected = preset.key === activeFont;
    const styleAttr = preset.displayFont ? `style="font-family: ${preset.displayFont};"` : '';
    return `
      <button
        class="font-preset-option ${isSelected ? "selected" : ""}"
        data-ui-font="${preset.key}"
        type="button"
        aria-pressed="${isSelected ? "true" : "false"}"
        ${styleAttr}
      >
        <strong class="font-preset-label">${preset.label}</strong>
        <span class="font-preset-preview" ${styleAttr}>Kidung Rohani</span>
      </button>
    `;
  }).join("");
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

  const activeFontLabel = (function() {
    const fp = FONT_PRESETS.find(p => p.key === (prefs.uiFont || "auto"));
    return fp ? fp.label : "Otomatis";
  })();
  const activeChordThemeLabel = (function() {
    const ct = CHORD_THEME_PRESETS.find(p => p.key === chordUiPrefs.theme);
    return ct ? ct.label : chordUiPrefs.theme;
  })();
  const activeChordFill = chordUiPrefs.fill === "soft" ? "Soft" : chordUiPrefs.fill === "solid" ? "Solid" : "None";

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
            <strong id="settings-active-style-label">${activeUiStyle.label}</strong>
            <span>gaya UI</span>
          </div>
          <div class="settings-hero-metric">
            <strong id="settings-active-scheme-label">${activeColorScheme.label}</strong>
            <span>skema warna</span>
          </div>
          <div class="settings-hero-metric">
            <strong id="settings-active-layout-label">${activeLayoutStyle.label}</strong>
            <span>layout</span>
          </div>
          <div class="settings-hero-metric">
            <strong id="settings-active-font-label">${activeFontLabel}</strong>
            <span>font</span>
          </div>
          <div class="settings-hero-metric">
            <strong>${activeChordThemeLabel}</strong>
            <span>tema chord</span>
          </div>
          <div class="settings-hero-metric">
            <strong>${activeChordFill}</strong>
            <span>fill chord</span>
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
                    <label class="md-switch md-switch--theme">
                      <input type="checkbox" id="dark-theme-toggle" ${document.body.classList.contains("dark-theme") || (!document.body.classList.contains("light-theme-forced") && window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) ? "checked" : ""}>
                      <span class="md-slider"></span>
                    </label>
                  </div>
                  <div class="settings-field">
                    <span class="settings-field-title">Skema warna aplikasi</span>
                    <div class="appearance-color-gallery appearance-color-gallery--inline">
                      ${renderColorSchemeOptions(activeColorScheme.key)}
                    </div>
                  </div>
                  <div class="shell-accent-row">
                    <div class="settings-field shell-accent-field">
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
                <div class="settings-subcard settings-subcard--font">
                  <div class="settings-subcard-title">Font &amp; Tipografi</div>
                  <div class="settings-field">
                    <span class="settings-field-title">Font antarmuka</span>
                    <div class="font-preset-gallery">
                      ${renderFontPresetOptions(prefs.uiFont || "auto")}
                    </div>
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
