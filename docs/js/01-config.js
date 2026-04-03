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
  get _playing() { return typeof MidiEngine !== 'undefined' && MidiEngine.isPlaying(); },

  setTime(t) { if (typeof MidiEngine !== 'undefined') MidiEngine.seek(t); },
  getTime() { return typeof MidiEngine !== 'undefined' ? MidiEngine.getTime() : 0; },
  setPlaying() {}, // no-op
  setDuration() {}, // no-op
  getDuration() { return typeof MidiEngine !== 'undefined' ? MidiEngine.getDuration() : 0; },
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
