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

  // --- MIDI Audio Transition Constants ---
  const MIDI_TARGET_VOLUME = -3;        // Standard volume in dB (combined with Tone.Destination -6dB)
  const MIDI_SILENT_VOLUME = -60;       // "Silent" volume in dB
  const MIDI_FADE_IN_MS = 300;          // Fade-in duration for play
  const MIDI_FADE_OUT_MS = 300;         // Fade-out duration for pause
  const MIDI_CROSSFADE_OUT_MS = 280;    // Crossfade out duration for transpose/instrument/seek
  const MIDI_CROSSFADE_IN_MS = 320;     // Crossfade in duration for transpose/instrument/seek
  const MIDI_LOAD_TIMEOUT_MS = 15000;     // Fallback timeout for sequence load event
  const MIDI_END_THRESHOLD_S = 0.5;     // Threshold in seconds for detecting song end
  const MIDI_TRANSPOSE_DEBOUNCE_MS = 100; // Debounce rapid transpose MIDI updates

  /**
   * MidiTimeAuthority — Single source of truth for playback position.
   * Uses wall-clock (performance.now()) to advance time when playing,
   * so we never depend on the unreliable html-midi-player currentTime
   * during transitions.
   */
  const MidiTimeAuthority = {
    _time: 0,
    _timestamp: 0,        // performance.now() when _time was last set
    _playing: false,
    _duration: 0,
    _seekCooldownUntil: 0, // Blocks drift correction after seeks

    /** Snapshot the current time (e.g. before a transition or seek) */
    setTime(t, dur, noCooldown) {
      this._time = Math.max(0, t || 0);
      this._timestamp = performance.now();
      if (dur !== undefined && dur > 0) this._duration = dur;
      // Only set cooldown for explicit user seeks/transitions, not routine syncs
      if (!noCooldown) {
        this._seekCooldownUntil = performance.now() + 1200;
      }
    },

    /** Get the current time, advancing by wall-clock if playing */
    getTime() {
      if (!this._playing) return this._time;
      const elapsed = (performance.now() - this._timestamp) / 1000;
      const t = this._time + elapsed;
      return this._duration > 0 ? Math.min(t, this._duration) : t;
    },

    /** Mark playback as playing/paused */
    setPlaying(playing) {
      if (playing === this._playing) return;
      if (playing) {
        // Resuming: anchor the current time to now
        this._timestamp = performance.now();
      } else {
        // Pausing: freeze the time at the current computed value
        this._time = this.getTime();
        this._timestamp = performance.now();
      }
      this._playing = playing;
    },

    /** 
     * Correct drift by syncing to the player's reported time (only when stable).
     * Uses gradual blending to prevent visible jumps on the seekbar.
     */
    sync(playerTime) {
      if (!this._playing) return;
      // Skip drift correction during seek cooldown
      if (performance.now() < this._seekCooldownUntil) return;
      const authorityTime = this.getTime();
      const diff = playerTime - authorityTime;
      const absDiff = Math.abs(diff);
      
      // Only sync if the difference is noticeable (>0.8s)
      // but not absurdly large (which would indicate a stale player read)
      if (absDiff > 0.8 && absDiff < 5) {
        // Gradual blend: move 40% toward player time to prevent visible jumps
        const blended = authorityTime + diff * 0.4;
        this._time = blended;
        this._timestamp = performance.now();
      }
    },

    /** Get duration */
    getDuration() { return this._duration; },

    /** Set duration */
    setDuration(d) { if (d > 0) this._duration = d; },

    /** Full reset */
    reset() {
      this._time = 0;
      this._timestamp = performance.now();
      this._playing = false;
      this._duration = 0;
      this._seekCooldownUntil = 0;
    }
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
   * Get Tone.js volume destination node.
   * @returns {object|null} The Tone.js volume node or null
   */
  function getToneVolNode() {
    if (!window.Tone) return null;
    return (window.Tone.Destination ||
      (window.Tone.getDestination ? window.Tone.getDestination() : null) ||
      window.Tone.Master) || null;
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
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  /**
   * Smoothly fade Tone.js master volume to a target value.
   * @param {number} targetVol - Target volume in dB
   * @param {number} durationMs - Fade duration in milliseconds
   * @returns {Promise<void>} Resolves after fade completes
   */
  async function fadeMidiVolume(targetVol, durationMs) {
    const volNode = getToneVolNode();
    if (!volNode || !volNode.volume || !window.Tone) return;
    const t = window.Tone.now();
    volNode.volume.cancelScheduledValues(t);
    volNode.volume.setValueAtTime(volNode.volume.value, t);
    volNode.volume.linearRampToValueAtTime(targetVol, t + durationMs / 1000);
    await new Promise(r => setTimeout(r, durationMs + 30));
  }

  /**
   * Reset all MIDI state to defaults. Called when closing viewer or switching songs.
   */
  function resetMidiState() {
    MidiTimeAuthority.reset();
    window._midiSavedTime = null;
    _midiOriginalSeq = null;
    _midiPoolPreloaded = false;
    _midiPoolPreloading = false;
    window.isMidiSwitching = false;
    window.isMidiFading = false;
    activeMidiPlayer = MIDI_PLAYER_POOL[0] || null;
  }
