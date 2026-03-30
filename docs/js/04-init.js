// --- 3. Init ---
async function init() {
  // Memicu preload font agar PDF.js tidak mengeluarkan warning "Cannot load system font"
  // karena font belum ditarik oleh rel=stylesheet ke dalam DOM.
  try {
    await document.fonts.load('16px "GoudyOldStyleBT-Roman"');
    await document.fonts.load('16px "AbadiMT-CondensedLight"');
    console.log("Font eksternal PDF siap.");
  } catch (err) {
    console.warn("Gagal pre-load font PDF:", err);
  }

  chordConfig = createDefaultChordConfig();
  applyStoredPreferences();
  setupEventListeners();
  setupRippleEffect();
  updateChordEditorUI();
  updateTransposeUI();
  syncTransposeCollapseState();
  updateHideChordButton();
  navigateTo("pujian");
}
