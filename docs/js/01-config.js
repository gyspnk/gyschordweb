// --- 0. Konfigurasi & Konstanta ---

// Membisukan peringatan spesifik dari PDF.js yang tidak berbahaya
// (Karena kita sudah mendefinisikan font secara manual di CSS, PDF tetap akan merender dengan benar)
const originalWarn = console.warn;
console.warn = function(...args) {
  if (args.length > 0 && typeof args[0] === 'string' && args[0].includes('Cannot load system font')) {
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
    writable: true,
    configurable: true
  });
}

if (!Map.prototype.getOrInsert) {
  Object.defineProperty(Map.prototype, "getOrInsert", {
    value(key, value) {
      if (this.has(key)) return this.get(key);
      this.set(key, value);
      return value;
    },
    writable: true,
    configurable: true
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
    writable: true,
    configurable: true
  });
}

if (!WeakMap.prototype.getOrInsert) {
  Object.defineProperty(WeakMap.prototype, "getOrInsert", {
    value(key, value) {
      if (this.has(key)) return this.get(key);
      this.set(key, value);
      return value;
    },
    writable: true,
    configurable: true
  });
}

const { pdfjsLib } = globalThis;
pdfjsLib.GlobalWorkerOptions.workerSrc = "https://mozilla.github.io/pdf.js/build/pdf.worker.mjs";
pdfjsLib.verbosity = pdfjsLib.VerbosityLevel.ERRORS;

const CHORD_GRID = { cols: 105, rows: 149 };
  const EDITOR_STORAGE_KEY = "chord-editor-enabled";
  const CHORD_UI_STORAGE_KEY = "chord-ui-prefs";
  const CHORD_ACCIDENTAL_STORAGE_KEY = "chord-accidental-mode";
  const EDITOR_ON_TAPS = 10;
  const EDITOR_OFF_TAPS = 5;
  const CHORD_COLLAPSE_STORAGE_KEY = "chord-editor-collapsed";
  const NOTE_NAMES_SHARP = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];
  const NOTE_NAMES_FLAT = ["C", "D♭", "D", "E♭", "E", "F", "G♭", "G", "A♭", "A", "B♭", "B"];
  const NATURAL_NOTE_INDEX = {
    C: 0,
    D: 2,
    E: 4,
    F: 5,
    G: 7,
    A: 9,
    B: 11
  };
  const NUMBER_TO_NOTE = {
    1: "C",
    2: "D",
    3: "E",
    4: "F",
    5: "G",
    6: "A",
    7: "B"
  };
  const ACCENT_CUSTOM_COLOR_KEY = "accent-custom-color";
  const DEFAULT_CUSTOM_ACCENT = "#4f7cff";
  const ACCENT_PRESETS = [
    { key: "blue", label: "Biru", color: "#1976d2" },
    { key: "red", label: "Merah", color: "#d32f2f" },
    { key: "green", label: "Hijau", color: "#2e7d32" },
    { key: "yellow", label: "Kuning", color: "#fbc02d" },
    { key: "purple", label: "Ungu", color: "#7b1fa2" },
    { key: "pink", label: "Pink", color: "#c2185b" },
    { key: "teal", label: "Teal", color: "#00796b" },
    { key: "orange", label: "Oranye", color: "#f57c00" },
    { key: "brown", label: "Coklat", color: "#5d4037" },
    { key: "gray", label: "Abu-abu", color: "#616161" },
    { key: "indigo", label: "Nila", color: "#303f9f" },
    { key: "cyan", label: "Sian", color: "#0097a7" },
    { key: "custom", label: "Warna Kustom", color: null }
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
    { key: "cyan", label: "Sian", color: "#00646e" }
  ];
  const CHORD_FILL_PRESETS = [
    { key: "blue", label: "Biru", color: "#b8dbff" },
    { key: "red", label: "Merah", color: "#ffc4c4" },
    { key: "green", label: "Hijau", color: "#b8f0bc" },
    { key: "yellow", label: "Kuning", color: "#ffecb3" },
    { key: "purple", label: "Ungu", color: "#e3bdf2" },
    { key: "pink", label: "Pink", color: "#ffbccf" },
    { key: "teal", label: "Teal", color: "#a5ede4" },
    { key: "orange", label: "Oranye", color: "#ffcc99" },
    { key: "brown", label: "Coklat", color: "#d6c1ba" },
    { key: "gray", label: "Abu-abu", color: "#cfcfcf" },
    { key: "indigo", label: "Nila", color: "#c6d0ff" },
    { key: "cyan", label: "Sian", color: "#b5f0f7" }
  ];
  const DOUBLE_TAP_MAX_DELAY = 300;
  const DOUBLE_TAP_MAX_DISTANCE = 34;
  const INDICATOR_DOUBLE_TAP_DELAY = 420;
  const ZOOM_SCROLL_SMOOTH_DURATION_MS = 210;
  const TRANSPOSE_DISSOLVE_OUT_MS = 180;
  const TRANSPOSE_DISSOLVE_IN_MS = 230;
