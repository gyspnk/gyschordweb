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
    writable: true,
    configurable: true,
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
    configurable: true,
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
    configurable: true,
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
    configurable: true,
  });
}

const { pdfjsLib } = globalThis;
pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://mozilla.github.io/pdf.js/build/pdf.worker.mjs";
pdfjsLib.verbosity = pdfjsLib.VerbosityLevel.ERRORS;

const CHORD_GRID = { cols: 105, rows: 149 };
const EDITOR_STORAGE_KEY = "chord-editor-enabled";
const CHORD_UI_STORAGE_KEY = "chord-ui-prefs";
const CHORD_ACCIDENTAL_STORAGE_KEY = "chord-accidental-mode";
const EDITOR_ON_TAPS = 10;
const EDITOR_OFF_TAPS = 5;
const CHORD_COLLAPSE_STORAGE_KEY = "chord-editor-collapsed";
const NOTE_NAMES_SHARP = [
  "C",
  "C♯",
  "D",
  "D♯",
  "E",
  "F",
  "F♯",
  "G",
  "G♯",
  "A",
  "A♯",
  "B",
];
const NOTE_NAMES_FLAT = [
  "C",
  "D♭",
  "D",
  "E♭",
  "E",
  "F",
  "G♭",
  "G",
  "A♭",
  "A",
  "B♭",
  "B",
];
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
  { key: "teal", label: "Teal", color: "#a5ede4" },
  { key: "orange", label: "Oranye", color: "#ffcc99" },
  { key: "brown", label: "Coklat", color: "#d6c1ba" },
  { key: "gray", label: "Abu-abu", color: "#cfcfcf" },
  { key: "indigo", label: "Nila", color: "#c6d0ff" },
  { key: "cyan", label: "Sian", color: "#b5f0f7" },
];
const DOUBLE_TAP_MAX_DELAY = 300;
const DOUBLE_TAP_MAX_DISTANCE = 34;
const INDICATOR_DOUBLE_TAP_DELAY = 420;
const ZOOM_SCROLL_SMOOTH_DURATION_MS = 210;
const TRANSPOSE_DISSOLVE_OUT_MS = 180;
const TRANSPOSE_DISSOLVE_IN_MS = 230;

// --- MIDI Audio Transition Constants ---
const MIDI_TARGET_VOLUME = -3; // Standard volume in dB (combined with Tone.Destination -6dB)
const MIDI_SILENT_VOLUME = -60; // "Silent" volume in dB
const MIDI_FADE_IN_MS = 120; // Fade-in duration for play (prevent clicks)
const MIDI_FADE_OUT_MS = 1200; // Fade-out duration for pause
const MIDI_CROSSFADE_OUT_MS = 200; // Crossfade out duration for transpose/instrument/seek
const MIDI_CROSSFADE_IN_MS = 200; // Crossfade in duration (symmetric for seamless feel)
const MIDI_LOAD_TIMEOUT_MS = 15000; // Fallback timeout for sequence load event
const MIDI_END_THRESHOLD_S = 0.8; // Threshold in seconds for detecting song end
const MIDI_TRANSPOSE_DEBOUNCE_MS = 80; // Debounce rapid transpose MIDI updates
const MIDI_PRELOAD_NEXT_S = 3; // Seconds before end to preload next song
const MIDI_SOUNDFONT_URL = 'https://storage.googleapis.com/magentadata/js/soundfonts/sgm_plus';
const MIDI_MICRO_RAMP_S = 0.025; // 25ms micro-ramp for click-free instant volume changes
const MIDI_TAIL_LINGER_MS = 3000; // How long retired players linger to let SoundFont release/reverb tails finish

// --- Note-Aligned Chord Editor Constants ---
const NOTE_CHORD_Y_OFFSET_PCT = 2.5; // Chord vertical offset above note (% of page height)
const NOTE_IDX_BEFORE = -1; // Sentinel: chord before first note (intro)
const NOTE_IDX_AFTER = 99999; // Sentinel: chord after last note (outro)

/**
 * MidiTimeAuthority — Single source of truth for playback position.
 * Uses wall-clock (performance.now()) to advance time when playing,
 * so we never depend on unreliable player currentTime during transitions.
 */
const MidiTimeAuthority = {
  _time: 0,
  _timestamp: 0,
  _playing: false,
  _duration: 0,
  _seekCooldownUntil: 0,

  setTime(t, dur, noCooldown) {
    this._time = Math.max(0, t || 0);
    this._timestamp = performance.now();
    if (dur !== undefined && dur > 0) this._duration = dur;
    if (!noCooldown) {
      this._seekCooldownUntil = performance.now() + 300;
    }
  },

  getTime() {
    if (!this._playing) return this._time;
    const elapsed = (performance.now() - this._timestamp) / 1000;
    const t = this._time + elapsed;
    return this._duration > 0 ? Math.min(t, this._duration) : t;
  },

  setPlaying(playing) {
    if (playing === this._playing) return;
    if (playing) {
      this._timestamp = performance.now();
    } else {
      this._time = this.getTime();
      this._timestamp = performance.now();
    }
    this._playing = playing;
  },

  /**
   * Correct drift by syncing to the player's reported time (only when stable).
   * Uses tighter threshold for smoother seekbar.
   */
  sync(playerTime) {
    if (!this._playing) return;
    if (performance.now() < this._seekCooldownUntil) return;
    const authorityTime = this.getTime();
    const diff = playerTime - authorityTime;
    const absDiff = Math.abs(diff);

    if (absDiff > 0.15 && absDiff < 5) {
      // Blend 40% toward player time — gentle correction
      const blended = authorityTime + diff * 0.4;
      this._time = blended;
      this._timestamp = performance.now();
    }
  },

  getDuration() { return this._duration; },
  setDuration(d) { if (d > 0) this._duration = d; },

  reset() {
    this._time = 0;
    this._timestamp = performance.now();
    this._playing = false;
    this._duration = 0;
    this._seekCooldownUntil = 0;
  },
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
  return (
    window.Tone.Destination ||
    (window.Tone.getDestination ? window.Tone.getDestination() : null) ||
    window.Tone.Master ||
    null
  );
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
 * Smoothly fade Tone.js master volume to a target value.
 * Uses exponential ramp for natural-sounding fades and avoids clicks
 * by anchoring the current value before scheduling.
 * @param {number} targetVol - Target volume in dB
 * @param {number} durationMs - Fade duration in milliseconds
 * @returns {Promise<void>} Resolves after fade completes
 */
async function fadeMidiVolume(targetVol, durationMs) {
  const volNode = getToneVolNode();
  if (!volNode || !volNode.volume || !window.Tone) return;
  const t = window.Tone.now();

  // Cancel any previously scheduled ramps to avoid conflicts
  volNode.volume.cancelScheduledValues(t);
  // Anchor current value so the ramp starts from the correct level
  volNode.volume.setValueAtTime(volNode.volume.value, t);

  if (durationMs > 0) {
    // Use linearRamp for dB-space (already perceptually logarithmic)
    // Add a micro-offset to avoid zero-duration ramp bugs in some browsers
    volNode.volume.linearRampToValueAtTime(targetVol, t + durationMs / 1000 + 0.001);
  } else {
    volNode.volume.value = targetVol;
  }

  // Wait for ramp to complete plus a small safety margin
  await new Promise((r) => setTimeout(r, durationMs + 50));

  // Snap to target to avoid floating-point drift
  try {
    volNode.volume.cancelScheduledValues(window.Tone.now());
    volNode.volume.value = targetVol;
  } catch (_e) {}
}

/**
 * Retire an old SoundFontPlayer so its SoundFont release/reverb tails can
 * ring out naturally instead of being abruptly cut off.
 *
 * The player is kept alive for `lingerMs` (default MIDI_TAIL_LINGER_MS) after
 * being detached from `_midiSfPlayer`. After the linger period, `.stop()` is
 * called to free resources.
 *
 * @param {object} player - The SoundFontPlayer instance to retire (may be null)
 * @param {number} [lingerMs] - How long to let it ring (default MIDI_TAIL_LINGER_MS)
 */
function retirePlayer(player, lingerMs) {
  if (!player) return;
  const delay = lingerMs != null ? lingerMs : MIDI_TAIL_LINGER_MS;
  // Fire-and-forget: the closure prevents GC while the timer is alive
  setTimeout(() => {
    try { if (player.isPlaying()) player.stop(); } catch (_e) {}
  }, delay);
}

/**
 * Reset all MIDI state to defaults. Called when closing viewer or switching songs.
 */
function resetMidiState() {
  MidiTimeAuthority.reset();
  window._midiSavedTime = null;
  // NOTE: _midiKnownDuration is intentionally NOT reset here.
  // It is preserved during song-to-song transitions so the mini player
  // doesn't flicker (disappear/reappear). It gets overwritten once the
  // new song's MIDI loads. Only set to 0 when explicitly closing the viewer.
  _midiOriginalSeq = null;
  _midiCurrentTransposedSeq = null;
  // NOTE: isMidiSwitching is intentionally NOT reset here.
  // Callers manage this flag to avoid race conditions with syncMiniPlayerUI.
  window.isMidiFading = false;

  // Clear midi-available so expanded-layout won't show empty player
  var mc = document.getElementById('midi-collapse');
  if (mc) mc.classList.remove('midi-available');

  // Reset play UI to avoid stale playing state
  var midiEl = document.getElementById('custom-midi-player');
  if (midiEl) midiEl.classList.remove('playing');
  var playIcon = document.getElementById('custom-play-icon');
  if (playIcon) playIcon.textContent = 'play_arrow';
}

/**
 * Create a transposed copy of a NoteSequence.
 * Efficiently clones and shifts pitch values in-place.
 * @param {object} seq - Original NoteSequence
 * @param {number} step - Semitones to shift
 * @param {number} instrument - MIDI program number (-1 = keep original)
 * @returns {object} Transposed NoteSequence
 */
function transposeNoteSequence(seq, step, instrument) {
  if (!seq || !seq.notes) return seq;
  const instrInt = parseInt(instrument, 10);
  const applyInstr = !isNaN(instrInt) && instrInt >= 0;

  // Use structuredClone for efficient deep copy
  const clone = typeof structuredClone === 'function'
    ? structuredClone(seq)
    : JSON.parse(JSON.stringify(seq));

  const notes = clone.notes;
  for (let i = 0; i < notes.length; i++) {
    const note = notes[i];
    if (!note.isDrum) {
      if (applyInstr) note.program = instrInt;
      if (step !== 0) {
        note.pitch = Math.max(0, Math.min(127, note.pitch + step));
      }
    }
  }
  return clone;
}
