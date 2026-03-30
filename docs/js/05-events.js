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
        

        

        let iconVal = "music_note";
        const valNum = parseInt(val, 10);

        if (valNum >= 0 && valNum <= 7) iconVal = "piano";
        else if (valNum >= 8 && valNum <= 15) iconVal = "notifications_active";
        else if (valNum >= 16 && valNum <= 23) iconVal = "piano";
        else if (valNum >= 24 && valNum <= 31) iconVal = "library_music";
        else if (valNum >= 32 && valNum <= 39) iconVal = "library_music";
        else if (valNum >= 40 && valNum <= 47) iconVal = "graphic_eq";
        else if (valNum >= 48 && valNum <= 55) iconVal = "graphic_eq";
        else if (valNum >= 56 && valNum <= 63) iconVal = "campaign";
        else if (valNum >= 64 && valNum <= 71) iconVal = "styler";
        else if (valNum >= 72 && valNum <= 79) iconVal = "media_link";
        
        if (val === "-1") iconVal = "music_note";

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
      try {
        if (!mainMidiPlayer.playing) {
          customPlayIcon.textContent = "hourglass_empty"; // Loading state
          await mainMidiPlayer.start();
          customPlayIcon.textContent = "pause";
          document.getElementById('custom-midi-player').classList.add("playing");
        } else {
          mainMidiPlayer.stop();
          customPlayIcon.textContent = "play_arrow";
          document.getElementById('custom-midi-player').classList.remove("playing");
        }
      } catch (err) {
        console.error("Gagal start MIDI:", err);
        customPlayIcon.textContent = "play_arrow";
        document.getElementById('custom-midi-player').classList.remove("playing");
      }
    });

    // Sync play state
    mainMidiPlayer.addEventListener('start', () => {
      customPlayIcon.textContent = "pause";
      document.getElementById('custom-midi-player').classList.add("playing");
    });
    mainMidiPlayer.addEventListener('stop', () => {
      customPlayIcon.textContent = "play_arrow";
      document.getElementById('custom-midi-player').classList.remove("playing");
    });



    // Seek bar formatting helper

    const formatTime = (seconds) => {

      const isecs = Math.floor(seconds || 0);

      const m = Math.floor(isecs / 60);

      const s = isecs % 60;

      return `${m}:${s.toString().padStart(2, '0')}`;

    };



// Update UI on time update via an interval (html-midi-player doesn't fire timeupdate reliably)

    let isDraggingSeekbar = false;

    setInterval(() => {

      if (isDraggingSeekbar) return;

      const curr = mainMidiPlayer.currentTime || 0;

      const dur = mainMidiPlayer.duration || 0;



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

    }, 250);



    // Prevent timeupdate from fighting with user interaction

    customSeekbar.addEventListener('input', () => {

      isDraggingSeekbar = true;

      const dur = mainMidiPlayer.duration || 0;

      customTimeDisplay.textContent = `${formatTime(customSeekbar.value)} / ${dur > 0 ? formatTime(dur) : '0:00'}`;
      
      const fill = document.getElementById('custom-seekbar-fill');
      if (fill && dur > 0) fill.style.width = ((parseFloat(customSeekbar.value) / dur) * 100) + '%';

    });



    customSeekbar.addEventListener('change', () => {

      isDraggingSeekbar = false;

      mainMidiPlayer.currentTime = parseFloat(customSeekbar.value);

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

