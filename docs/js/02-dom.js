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

// --- Single MIDI SoundFontPlayer (replaces 12-element pool) ---
let _midiSfPlayer = null; // core.SoundFontPlayer instance
let _midiSfPlayerReady = false; // Whether samples are loaded
let _midiSfPlayerLoading = false; // Loading in progress
let _midiLoadGeneration = 0; // Incremented on each song change to cancel stale loads
let _openPdfViewerGeneration = 0; // Incremented on each openPdfViewer call to cancel concurrent stale calls
// Global original sequence (unmodified from MIDI file)
let _midiOriginalSeq = null;
// Current transposed/instrumented sequence being played
let _midiCurrentTransposedSeq = null;

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
