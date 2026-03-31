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

      const isExpanded = midiToggleBtn.getAttribute('aria-expanded') === 'true';

      midiToggleBtn.setAttribute('aria-expanded', !isExpanded);

    });

  }



  // Custom MIDI Controls Logic

  if (customInstrumentSelect && cisMenu && customPlayBtn && mainMidiPlayer) {

    // Dropdown toggle

    customInstrumentSelect.addEventListener("click", (e) => {

      // prevent closing immediately if clicking inside menu but not on option

      if (e.target.closest('.cis-menu') && !e.target.closest('.cis-option')) return;

      const playerContainer = document.getElementById('custom-midi-player');
      if (playerContainer) {
          playerContainer.classList.toggle('is-open');
          customInstrumentSelect.setAttribute('aria-expanded', playerContainer.classList.contains('is-open'));
      }

    });



    // Close dropdown on outside click

    document.addEventListener("click", (e) => {

      const playerContainer = document.getElementById('custom-midi-player');
      if (playerContainer && playerContainer.classList.contains("is-open")) {
        if (!playerContainer.contains(e.target) && !customInstrumentSelect.contains(e.target)) {
          playerContainer.classList.remove("is-open");
          customInstrumentSelect.setAttribute('aria-expanded', 'false');
        }
      }

    });



    // Option select
    document.querySelectorAll('.cis-option').forEach(option => {
      option.addEventListener("click", (e) => {
        // Find nearest button in case user clicked inner element
        const btn = e.target.closest('.cis-option');
        if(!btn) return;
        const val = btn.getAttribute('data-val');
        btn.parentElement.querySelectorAll('.cis-option').forEach(o => o.classList.remove('selected'));
        btn.classList.add('selected');
        customInstrumentSelect.dataset.value = val;
        customInstrumentSelect.title = btn.getAttribute('title') || 'Pilih Alat Musik';
        
        // Auto-close menu after selection
        document.getElementById('custom-midi-player').classList.remove("is-open");
        customInstrumentSelect.setAttribute("aria-expanded", "false");
        customInstrumentSelect.classList.remove("active");
        

        
        const iconVal = getMidiInstrumentIcon(val);

        const iconEl = document.getElementById("cis-icon");
        if(iconEl) iconEl.textContent = iconVal;
        
        const labelEl = document.getElementById("cis-label");
        if(labelEl) {
          // Extract the english/primary title from the selected option
          let labelText = btn.getAttribute('title') || 'Pilihan';
          // Truncate if too long to keep capsule sleek
          if (labelText.length > 20) labelText = labelText.substring(0, 20) + '...';
          labelEl.textContent = labelText;
        }

        document.querySelectorAll('.cis-option').forEach(opt => opt.classList.remove('selected'));

        btn.classList.add('selected');



        prefs.midiInstrument = val;

        localStorage.setItem("prefs", JSON.stringify(prefs));

        if (typeof applyMidiInstrument === "function") {

          applyMidiInstrument();

        }

      });

    });



    // Play/Pause button
    customPlayBtn.addEventListener("click", async () => {
      if (window.isMidiSwitching || window.isMidiFading) return;

      if (window.Tone && window.Tone.start) {
        try { await window.Tone.start(); } catch (e) {}
      }
      
      const volNode = getToneVolNode();
      const player = activeMidiPlayer;
      if (!player) return;
      
      try {
        if (!player.playing) {
          // --- PLAY (with fade-in) ---
          window.isMidiFading = true;
          customPlayIcon.textContent = "hourglass_empty";
          
          // Set volume to silent BEFORE starting to prevent any pop
          if (volNode && volNode.volume) {
            volNode.volume.cancelScheduledValues(window.Tone.now());
            volNode.volume.value = MIDI_SILENT_VOLUME;
          }
          
          // Restore position from authority
          const restoreTime = MidiTimeAuthority.getTime();
          if (restoreTime > 0) {
            try {
              player.currentTime = restoreTime;
            } catch (e) {}
          }
          
          player.start();
          
          // Set time again after start to combat reset
          if (restoreTime > 0) {
            try { player.currentTime = restoreTime; } catch(e) {}
          }
          
          // Update authority
          MidiTimeAuthority.setPlaying(true);
          
          // Schedule smooth fade-in
          if (volNode && volNode.volume && window.Tone) {
            const t = window.Tone.now();
            volNode.volume.cancelScheduledValues(t);
            volNode.volume.setValueAtTime(MIDI_SILENT_VOLUME, t);
            volNode.volume.linearRampToValueAtTime(MIDI_TARGET_VOLUME, t + MIDI_FADE_IN_MS / 1000);
          }
          
          customPlayIcon.textContent = "pause";
          document.getElementById('custom-midi-player').classList.add("playing");
          window._midiSavedTime = null;
          window.isMidiFading = false;
        } else {
          // --- PAUSE (with fade-out) ---
          window.isMidiFading = true;
          
          // Freeze authority time (snapshot current position)
          MidiTimeAuthority.setPlaying(false);
          window._midiSavedTime = MidiTimeAuthority.getTime();
          
          // Optimistic UI update for responsive feel
          customPlayIcon.textContent = "play_arrow";
          document.getElementById('custom-midi-player').classList.remove("playing");

          if (volNode && volNode.volume && window.Tone) {
            const t = window.Tone.now();
            volNode.volume.cancelScheduledValues(t);
            volNode.volume.setValueAtTime(volNode.volume.value, t);
            volNode.volume.linearRampToValueAtTime(MIDI_SILENT_VOLUME, t + MIDI_FADE_OUT_MS / 1000);
            await new Promise(r => setTimeout(r, MIDI_FADE_OUT_MS + 50));
          }
          
          player.stop();
          
          if (volNode && volNode.volume) {
            volNode.volume.value = MIDI_SILENT_VOLUME;
          }
          window.isMidiFading = false;
        }
      } catch (err) {
        console.error("Gagal start/stop MIDI:", err);
        customPlayIcon.textContent = "play_arrow";
        document.getElementById('custom-midi-player').classList.remove("playing");
        window.isMidiFading = false;
      }
    });

    // Sync play state from BOTH players (since active player can swap)
    const syncPlayState = (evt) => {
      if (window.isMidiFading || window.isMidiSwitching) return;
      // Only respond to events from the currently active player
      if (evt.target !== activeMidiPlayer) return;
      const isPlaying = activeMidiPlayer.playing;
      customPlayIcon.textContent = isPlaying ? "pause" : "play_arrow";
      document.getElementById('custom-midi-player').classList.toggle("playing", isPlaying);
    };
    mainMidiPlayer.addEventListener('start', syncPlayState);
    mainMidiPlayer.addEventListener('stop', syncPlayState);
    if (standbyMidiPlayer) {
      standbyMidiPlayer.addEventListener('start', syncPlayState);
      standbyMidiPlayer.addEventListener('stop', syncPlayState);
    }

    // Seek bar formatting helper
    const formatTime = (seconds) => {
      const isecs = Math.floor(seconds || 0);
      const m = Math.floor(isecs / 60);
      const s = isecs % 60;
      return `${m}:${s.toString().padStart(2, '0')}`;
    };

    // Update UI on time update via an interval (html-midi-player doesn't fire timeupdate reliably)
    let isDraggingSeekbar = false;
    // Expose lastSeekValue globally so applyMidiInstrument can reset it
    window._midiLastSeekValue = -1;

    setInterval(() => {
      if (isDraggingSeekbar || window.isMidiSwitching) return;
      if (!document.body.classList.contains('viewer-active')) return;
      
      // --- Read from MidiTimeAuthority (single source of truth) ---
      const curr = MidiTimeAuthority.getTime();
      const dur = MidiTimeAuthority.getDuration() || window._midiKnownDuration || 0;

      // Only update DOM if value changed significantly to save CPU
      if (Math.abs(curr - window._midiLastSeekValue) < 0.1 && customSeekbar.max == dur) return;
      window._midiLastSeekValue = curr;

      // Periodically sync authority to actual player time (drift correction)
      const player = activeMidiPlayer;
      if (player && player.playing && !window.isMidiSwitching) {
        const playerTime = player.currentTime || 0;
        MidiTimeAuthority.sync(playerTime);
      }

      customTimeDisplay.textContent = `${formatTime(curr)} / ${dur > 0 ? formatTime(dur) : '0:00'}`;

      if (dur > 0) {
        customSeekbar.max = dur;
        customSeekbar.value = curr;
        
        const fill = document.getElementById('custom-seekbar-fill');
        if (fill) fill.style.width = ((curr / dur) * 100) + '%';
      } else {
        customSeekbar.value = 0;
        customSeekbar.max = 100;
        
        const fill = document.getElementById('custom-seekbar-fill');
        if (fill) fill.style.width = '0%';
      }
    }, 100);

    // Prevent timeupdate from fighting with user interaction
    customSeekbar.addEventListener('input', () => {
      isDraggingSeekbar = true;
      const dur = MidiTimeAuthority.getDuration() || window._midiKnownDuration || 0;
      const val = parseFloat(customSeekbar.value);
      customTimeDisplay.textContent = `${formatTime(val)} / ${dur > 0 ? formatTime(dur) : '0:00'}`;
      
      const fill = document.getElementById('custom-seekbar-fill');
      if (fill && dur > 0) fill.style.width = ((val / dur) * 100) + '%';
    });

    customSeekbar.addEventListener('change', () => {
      isDraggingSeekbar = false;
      if (window.isMidiSwitching) return;
      const val = parseFloat(customSeekbar.value);
      const dur = MidiTimeAuthority.getDuration() || window._midiKnownDuration || 0;
      
      // Update authority FIRST (single source of truth)
      MidiTimeAuthority.setTime(val, dur);
      
      // Then update the active player with retry mechanism
      const player = activeMidiPlayer;
      if (player) {
        player.currentTime = val;
        
        // Retry setting time shortly after (player might reject it if it thinks it's not ready)
        setTimeout(() => {
          if (player && !window.isMidiSwitching) {
            const actual = player.currentTime || 0;
            if (Math.abs(actual - val) > 1.0) {
              try { player.currentTime = val; } catch(e) {}
            }
          }
        }, 50);
      }
      
      window._midiLastSeekValue = val;
      window._midiSavedTime = null;
    });

  }



  prevSongBtn.addEventListener("click", onPrevSong);

  nextSongBtn.addEventListener("click", onNextSong);



  [viewModeBtnPortrait, viewModeBtnLandscape].forEach((btn) => btn.addEventListener("click", onToggleViewMode));

  [scrollModeBtnPortrait, scrollModeBtnLandscape].forEach((btn) => btn.addEventListener("click", onToggleScrollMode));



  [prevPageBtnPortrait, prevPageBtnLandscape].forEach((btn) => btn.addEventListener("click", onPrevPage));

  [nextPageBtnPortrait, nextPageBtnLandscape].forEach((btn) => btn.addEventListener("click", onNextPage));

  [zoomInBtnPortrait, zoomInBtnLandscape].forEach((btn) => btn.addEventListener("click", () => onZoom("in")));

  [zoomOutBtnPortrait, zoomOutBtnLandscape].forEach((btn) => btn.addEventListener("click", () => onZoom("out")));

  [zoomLevelIndicatorPortrait, zoomLevelIndicatorLandscape]

    .filter(Boolean)

    .forEach((indicator) => {

      indicator.addEventListener("touchend", onZoomIndicatorTouchEnd, { passive: false });

      indicator.addEventListener("dblclick", onZoomIndicatorDoubleClick);

    });



  chordSaveBtn.addEventListener("click", saveChordConfigurationFile);

  if (chordEditorToggleBtn) {

    chordEditorToggleBtn.addEventListener("click", onToggleChordEditorCollapse);

  }

  transposeDownBtns.forEach((btn) => btn.addEventListener("click", () => onTranspose(-1)));

  transposeUpBtns.forEach((btn) => btn.addEventListener("click", () => onTranspose(1)));

  transposeResetBtns.forEach((btn) => btn.addEventListener("click", resetTranspose));

  accidentalSwitchBtns.forEach((btn) => btn.addEventListener("click", onToggleAccidentalMode));

  document.querySelectorAll('.family-chord-btn').forEach(btn => btn.addEventListener("click", onToggleFamilyChordDropdown));

  if (transposeToggleBtns.length) {

    transposeToggleBtns.forEach(btn => btn.addEventListener("click", onToggleTransposeCollapse));

  }

  canvasWrapper.addEventListener("click", onChordLayerClick);

  document.addEventListener("click", onGlobalDocumentClick);



  hideChordBtns.forEach((btn) => btn.addEventListener("click", onToggleChordsHidden));



  pdfViewerTitle.addEventListener("click", handleTitleActivatorTap);



  if (screen.orientation) {

    screen.orientation.addEventListener("change", handleOrientationChange);

  } else {

    window.addEventListener("orientationchange", handleOrientationChange);

  }



  window.addEventListener("wheel", handleGlobalScroll, { passive: false });

  window.addEventListener("keydown", handleGlobalKeydown, { passive: false });



  // Scope pinch handlers to the viewer only to avoid conflicts with global/browser gestures.

  pdfViewerContent.addEventListener("touchstart", handleTouchStart, { passive: true });

  pdfViewerContent.addEventListener("touchmove", handleTouchMove, { passive: false });

  pdfViewerContent.addEventListener("touchend", handleTouchEnd, { passive: true });



  pdfViewerContent.addEventListener("touchstart", handleViewerTouchStart, { passive: true });

  pdfViewerContent.addEventListener("touchend", handleViewerTouchEnd, { passive: true });

  pdfViewerContent.addEventListener("mousedown", handleViewerPointerStart);

  pdfViewerContent.addEventListener("mousemove", handleViewerPointerMove);

  pdfViewerContent.addEventListener("mouseup", handleViewerPointerEnd);

  pdfViewerContent.addEventListener("mouseleave", handleViewerPointerEnd);



  window.addEventListener("resize", onLayoutResize);

}

