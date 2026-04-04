// --- 2. State ---
let pujianItems = [];
let pdfDoc = null;
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
