// --- 3. Init ---
async function init() {
  // Memicu preload font agar PDF.js tidak mengeluarkan warning "Cannot load system font"
  // karena font belum ditarik oleh rel=stylesheet ke dalam DOM.
  try {
    // Kurangi volume global Tone.js dan tambahkan limiter/compressor 
    // untuk mencegah clipping/distorsi pada instrumen MIDI berpolifoni tinggi
    if (window.Tone) {
      if (Tone.getDestination) {
        Tone.getDestination().volume.value = -12; // Lower to -12 dB to prevent clipping
        // Tambahkan dynamics compressor/limiter jika didukung untuk mencegah distorsi puncak
        try {
          const limiter = new Tone.Limiter(-6); // Limit pada -6 dB (yang mana dikalkulasi sebelum/sesudah master volume)
          Tone.getDestination().chain(limiter);
        } catch(e) { } 
      } else if (Tone.Master) {
        Tone.Master.volume.value = -12;
      }
    }

    await document.fonts.load('16px "GoudyOldStyleBT-Roman"');
    await document.fonts.load('16px "AbadiMT-CondensedLight"');
    console.log("Font eksternal PDF siap.");
  } catch (err) {
    console.warn("Gagal pre-load font PDF:", err);
  }

  // Handle AudioContext warning
  const resumeAudioContext = () => {
    if (window.Tone && Tone.context.state !== 'running') {
      Tone.context.resume();
    }
  };
  document.body.addEventListener('click', resumeAudioContext, { once: true, capture: true });
  document.body.addEventListener('touchstart', resumeAudioContext, { once: true, capture: true });


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
