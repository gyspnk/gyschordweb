// --- 3. Init ---
async function init() {
  try {
    // Setup Tone.js audio chain: Volume -> Compressor -> Limiter -> Destination
    // This prevents clicking/popping and manages dynamics for MIDI polyphony
    if (window.Tone) {
      if (Tone.getDestination) {
        Tone.getDestination().volume.value = -6; // Master volume: -6 dB
        try {
          // Compressor to tame transients (reduces clicks from note onset)
          const compressor = new Tone.Compressor({
            threshold: -24,
            ratio: 4,
            attack: 0.003,
            release: 0.1
          });
          // Limiter at -1 dB to prevent clipping on polyphonic passages
          const limiter = new Tone.Limiter(-1);
          Tone.getDestination().chain(compressor, limiter);
        } catch(e) {
          // Fallback: just limiter
          try {
            const limiter = new Tone.Limiter(-1);
            Tone.getDestination().chain(limiter);
          } catch(e2) {}
        }
      } else if (Tone.Master) {
        Tone.Master.volume.value = -6;
      }
    }

    await document.fonts.load('16px "GoudyOldStyleBT-Roman"');
    await document.fonts.load('16px "AbadiMT-CondensedLight"');
  } catch (err) {
    console.warn("Gagal pre-load font PDF:", err);
  }

  // Resume AudioContext on first user interaction
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
