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
      const isExpanded = midiToggleBtn.getAttribute("aria-expanded") === "true";

      midiToggleBtn.setAttribute("aria-expanded", !isExpanded);
    });
  }

  // Custom MIDI Controls Logic

  if (customPlayBtn) {
    // Apply logic to ALL instrument capsule buttons (main player and mini player)
    document.querySelectorAll(".instrument-capsule-btn").forEach((btnNode) => {
      btnNode.addEventListener("click", (e) => {
        // prevent closing immediately if clicking inside menu but not on option
        if (
          e.target.closest(".cis-menu-popover") &&
          !e.target.closest(".cis-option")
        )
          return;

        if (isSoundfontSwitching) {
          if (typeof showToast === "function") {
            showToast("Sedang memuat daftar instrumen SoundFont...", "hourglass_empty");
          }
          return;
        }

        const currentDropdownObj = e.target.closest(
          ".instrument-selector-wrapper",
        );
        const uiWrapper = currentDropdownObj;
        if (uiWrapper) {
          // Always regenerate from active soundfont before opening,
          // so static HTML can never override dynamic map content.
          if (typeof rebuildInstrumentSelectors === 'function') {
            rebuildInstrumentSelectors((prefs && prefs.midiSoundfont) || MIDI_SF2_URL);
          }

          // ensure autonext menu is closed if it's open
          const autoBtn = document.getElementById("autonext-btn");
          const autonextWrapper = autoBtn
            ? autoBtn.closest(".instrument-selector-wrapper")
            : null;
          if (autonextWrapper && autonextWrapper !== uiWrapper) {
            autonextWrapper.classList.remove("is-open");
            if (autoBtn) autoBtn.setAttribute("aria-expanded", "false");
          }

          // Also close other open instrument selectors
          document
            .querySelectorAll(".instrument-selector-wrapper.is-open")
            .forEach((openWrapper) => {
              if (openWrapper !== uiWrapper) {
                openWrapper.classList.remove("is-open");
                const capBtn = openWrapper.querySelector(
                  ".instrument-capsule-btn",
                );
                if (capBtn) capBtn.setAttribute("aria-expanded", "false");
              }
            });

          uiWrapper.classList.toggle("is-open");

          if (currentDropdownObj) {
            const capBtn = currentDropdownObj.querySelector(
              ".instrument-capsule-btn",
            );
            if (capBtn)
              capBtn.setAttribute(
                "aria-expanded",
                uiWrapper.classList.contains("is-open") ? "true" : "false",
              );
          }
        }
      });
    });

    // Close dropdown on outside click
    document.addEventListener("click", (e) => {
      document
        .querySelectorAll(".instrument-selector-wrapper.is-open")
        .forEach((uiWrapper) => {
          if (!uiWrapper.contains(e.target)) {
            uiWrapper.classList.remove("is-open");
            const capBtn = uiWrapper.querySelector(".instrument-capsule-btn");
            if (capBtn) capBtn.setAttribute("aria-expanded", "false");
          }
        });
      // Close settings custom dropdowns on outside click
      document.querySelectorAll(".settings-custom-dropdown.is-open").forEach(function(wrapper) {
        if (!wrapper.contains(e.target)) {
          wrapper.classList.remove("is-open");
          const btn = wrapper.querySelector(".settings-dropdown-btn");
          if (btn) btn.setAttribute("aria-expanded", "false");
        }
      });
    });

    // Option select — delegated so dynamically rebuilt lists work
    document.addEventListener("click", (e) => {
      const btn = e.target.closest(".cis-option");
      if (!btn) return;

      // Block instrument switching while engine is actively rendering/loading.
      if (isSoundfontSwitching || (typeof MidiEngine !== 'undefined' && MidiEngine.isLoading())) {
        if (typeof showToast === "function") {
          showToast("Sedang memuat audio MIDI / SoundFont, harap tunggu...", "hourglass_empty");
        }
        return;
      }

      const val = btn.getAttribute("data-val");
      if (val == null) return;

      // Auto-close menu after selection for all wrappers
      const uiWrapper = e.target.closest(".instrument-selector-wrapper");
      if (uiWrapper) {
        uiWrapper.classList.remove("is-open");
        const capBtn = uiWrapper.querySelector(".instrument-capsule-btn");
        if (capBtn) capBtn.setAttribute("aria-expanded", "false");
      }

      // Also close any other stuck wrappers
      document
        .querySelectorAll(".instrument-selector-wrapper.is-open")
        .forEach((openWrapper) => {
          openWrapper.classList.remove("is-open");
          const capBtn = openWrapper.querySelector(".instrument-capsule-btn");
          if (capBtn) capBtn.setAttribute("aria-expanded", "false");
        });

      // Remove active states
      if (
        typeof customInstrumentSelect !== "undefined" &&
        customInstrumentSelect
      )
        customInstrumentSelect.classList.remove("active");

      // Update UI styling for instrument selector options only
      document.querySelectorAll(".instrument-selector-wrapper .cis-option").forEach((o) => {
        if (o.getAttribute("data-val") === val) {
          o.classList.add("selected");
        } else {
          o.classList.remove("selected");
        }
      });

      const miniInstrumentSelect = document.getElementById(
        "mini-instrument-select",
      );
      if (
        typeof customInstrumentSelect !== "undefined" &&
        customInstrumentSelect
      )
        customInstrumentSelect.dataset.value = val;
      if (miniInstrumentSelect) miniInstrumentSelect.dataset.value = val;

      const titleText = btn.getAttribute("title") || btn.textContent.trim() || "Memuat Instrumen...";
      if (
        typeof customInstrumentSelect !== "undefined" &&
        customInstrumentSelect
      )
        customInstrumentSelect.title = titleText;
      if (
        typeof customInstrumentSelect !== "undefined" &&
        customInstrumentSelect
      )
        customInstrumentSelect.setAttribute("aria-label", titleText);
      if (miniInstrumentSelect) {
        miniInstrumentSelect.title = titleText;
        miniInstrumentSelect.setAttribute("aria-label", titleText);
      }

      document.querySelectorAll("#cis-icon, #mini-cis-icon").forEach((el) => {
        if (typeof getMidiInstrumentIcon === "function")
          el.textContent = getMidiInstrumentIcon(val, titleText);
      });

      document
        .querySelectorAll("#cis-label, #mini-cis-label")
        .forEach((el) => {
          let labelText = titleText;
          if (labelText.length > 20)
            labelText = labelText.substring(0, 20) + "...";
          el.textContent = labelText;
        });

      if (typeof prefs !== "undefined") {
        const activeSf = (typeof normalizeSoundfontKey === "function")
          ? normalizeSoundfontKey((prefs && prefs.midiSoundfont) || MIDI_SF2_URL)
          : ((prefs && prefs.midiSoundfont) || MIDI_SF2_URL);
        if (!prefs.midiInstrumentBySoundfont || typeof prefs.midiInstrumentBySoundfont !== "object") {
          prefs.midiInstrumentBySoundfont = {};
        }
        prefs.midiInstrument = val;
        prefs.midiInstrumentBySoundfont[activeSf] = String(val);
        prefs.midiInstrumentUserSelected = true;
        localStorage.setItem("prefs", JSON.stringify(prefs));
      }

      // Re-preload all pool players
      if (typeof changeInstrument === "function") {
        changeInstrument();
      }
    });

    // Play/Pause — named function so mini player can call directly (real user gesture)
    async function toggleMidiPlayback() {
      if (typeof MidiEngine === 'undefined') return;
      if (MidiEngine.isLoading()) {
        if (typeof showToast === "function")
          showToast("Sedang memuat audio MIDI, harap tunggu...", "hourglass_empty");
        return;
      }

      // Resume AudioContext on user gesture
      MidiEngine.resumeContext();

      if (!MidiEngine.getCurrentMidiUrl()) return;

      try {
        window.isMidiSwitching = false;
        const shouldPlay = !MidiEngine.isPlaying();

        if (shouldPlay) {
          if (typeof window._verifyPlaylistModeForCurrentSong === "function") {
            window._verifyPlaylistModeForCurrentSong();
          }

          // If at end, restart from beginning
          const dur = MidiEngine.getDuration();
          if (dur > 0 && MidiEngine.getTime() >= dur - MIDI_END_THRESHOLD_S) {
            MidiEngine.seek(0);
          }

          MidiEngine.play();

          // Update UI immediately
          customPlayIcon.textContent = "pause";
          document.getElementById("custom-midi-player").classList.add("playing");
          window._midiSavedTime = null;
        } else {
          MidiEngine.pause();

          window._midiSavedTime = MidiEngine.getTime();

          // Update UI immediately
          customPlayIcon.textContent = "play_arrow";
          document.getElementById("custom-midi-player").classList.remove("playing");
        }
      } catch (err) {
        console.error("Gagal start/stop MIDI:", err);
        customPlayIcon.textContent = "play_arrow";
        document.getElementById("custom-midi-player").classList.remove("playing");
      }
    }
    window.toggleMidiPlayback = toggleMidiPlayback;
    customPlayBtn.addEventListener("click", toggleMidiPlayback);

    // Seekbar sync using requestAnimationFrame for smooth updates
    let isDraggingSeekbar = false;
    window._midiLastSeekValue = -1;

    // Song end is now handled by MidiEngine's onSongEnd callback (wired in 04-init.js).
    // Listen for the custom event dispatched from that callback:
    window.addEventListener('midi-song-end', function () {
      if (window.isMidiSwitching) return;

      syncSeekbarUI(0, MidiEngine.getDuration());
      customPlayIcon.textContent = "play_arrow";
      document.getElementById("custom-midi-player").classList.remove("playing");
      window._midiLastSeekValue = 0;
      window._midiSavedTime = null;

      const endMode = PlaylistManager.getAutoNextMode();

      // Loop intercept — repeat one: restart from 0
      if (endMode === "one") {
        MidiEngine.seek(0);
        MidiEngine.play();
        customPlayIcon.textContent = "pause";
        document.getElementById("custom-midi-player").classList.add("playing");
        return;
      }

      // Auto next intercept — only for active auto-next modes (never for 'off')
      if (endMode !== 'off' && typeof window._playlistCheckAutoNext === "function") {
        window._autoAdvanceFromEnd = true;
        window._playlistCheckAutoNext();
      }
    });

    let _seekbarRafId = null;
    function seekbarAnimationLoop() {
      _seekbarRafId = requestAnimationFrame(seekbarAnimationLoop);

      // Sync loading bar on both MIDI player and mini player (always, even when skipping seekbar)
      var engineLoading = typeof MidiEngine !== 'undefined' && MidiEngine.isLoading();
      var midiPlayerLoading = document.getElementById('midi-player-loading');
      if (midiPlayerLoading) midiPlayerLoading.style.display = engineLoading ? '' : 'none';
      var miniPlayerLoading = document.getElementById('mini-player-loading');
      if (miniPlayerLoading) miniPlayerLoading.style.display = engineLoading ? '' : 'none';

      if (isDraggingSeekbar || engineLoading || window.isMidiSwitching) return;
      if (!document.body.classList.contains("viewer-active") && !(typeof MidiEngine !== 'undefined' && MidiEngine.isPlaying())) return;

      const dur = (typeof MidiEngine !== 'undefined' ? MidiEngine.getDuration() : 0) || window._midiKnownDuration || 0;
      const curr = typeof MidiEngine !== 'undefined' ? MidiEngine.getTime() : 0;

      // Only update DOM if value changed significantly
      if (Math.abs(curr - window._midiLastSeekValue) < 0.05 && customSeekbar.max == dur) return;
      window._midiLastSeekValue = curr;
      syncSeekbarUI(curr, dur);
    }
    seekbarAnimationLoop();

    // Prevent timeupdate from fighting with user interaction
    const seekbars = [
      customSeekbar,
      document.getElementById("mini-seekbar"),
    ].filter(Boolean);
    seekbars.forEach((bar) => {
      bar.addEventListener("input", (e) => {
        isDraggingSeekbar = true;
        const dur = (typeof MidiEngine !== 'undefined' ? MidiEngine.getDuration() : 0) || window._midiKnownDuration || 0;
        const val = parseFloat(e.target.value);
        if (customTimeDisplay)
          customTimeDisplay.textContent = `${formatMidiTime(val)} / ${dur > 0 ? formatMidiTime(dur) : "0:00"}`;
        const miniTimeDisplay = document.getElementById("mini-time-display");
        if (miniTimeDisplay)
          miniTimeDisplay.textContent = `${formatMidiTime(val)} / ${dur > 0 ? formatMidiTime(dur) : "0:00"}`;

        const fill = document.getElementById("custom-seekbar-fill");
        if (fill && dur > 0) fill.style.width = (val / dur) * 100 + "%";
        const miniFill = document.getElementById("mini-seekbar-fill");
        if (miniFill && dur > 0) miniFill.style.width = (val / dur) * 100 + "%";
      });

      bar.addEventListener("change", (e) => {
        isDraggingSeekbar = false;
        if (typeof MidiEngine !== 'undefined' && MidiEngine.isLoading()) return;
        const val = parseFloat(e.target.value);
        const dur = (typeof MidiEngine !== 'undefined' ? MidiEngine.getDuration() : 0) || window._midiKnownDuration || 0;

        if (typeof MidiEngine !== 'undefined' && MidiEngine.getCurrentMidiUrl()) {
          MidiEngine.seek(val);
        }
        syncSeekbarUI(val, dur);
        window._midiLastSeekValue = val;
        window._midiSavedTime = null;
      });
    });
  }

  prevSongBtn.addEventListener("click", onPrevSong);

  nextSongBtn.addEventListener("click", onNextSong);

  [viewModeBtnPortrait, viewModeBtnLandscape].forEach((btn) =>
    btn.addEventListener("click", onToggleViewMode),
  );

  [scrollModeBtnPortrait, scrollModeBtnLandscape].forEach((btn) =>
    btn.addEventListener("click", onToggleScrollMode),
  );

  [prevPageBtnPortrait, prevPageBtnLandscape].forEach((btn) =>
    btn.addEventListener("click", onPrevPage),
  );

  [nextPageBtnPortrait, nextPageBtnLandscape].forEach((btn) =>
    btn.addEventListener("click", onNextPage),
  );

  [zoomInBtnPortrait, zoomInBtnLandscape].forEach((btn) =>
    btn.addEventListener("click", () => onZoom("in")),
  );

  [zoomOutBtnPortrait, zoomOutBtnLandscape].forEach((btn) =>
    btn.addEventListener("click", () => onZoom("out")),
  );

  [zoomLevelIndicatorPortrait, zoomLevelIndicatorLandscape]

    .filter(Boolean)

    .forEach((indicator) => {
      indicator.addEventListener("touchend", onZoomIndicatorTouchEnd, {
        passive: false,
      });

      indicator.addEventListener("dblclick", onZoomIndicatorDoubleClick);
    });

  chordSaveBtn.addEventListener("click", () => {
    // Save note-aligned chord if we have notes detected, otherwise use grid format
    const hasNotes = pageNotesCache && Object.values(pageNotesCache).some(c => c && c.notes && c.notes.length > 0);
    if (hasNotes && typeof saveNoteChordConfigurationFile === "function") {
      saveNoteChordConfigurationFile();
    } else {
      saveChordConfigurationFile();
    }
  });

  // Load chord file button
  const chordLoadBtn = document.getElementById("chord-load-btn");
  if (chordLoadBtn) {
    chordLoadBtn.addEventListener("click", () => {
      if (typeof loadNoteChordFromFile === "function") {
        loadNoteChordFromFile();
      }
    });
  }

  if (chordEditorToggleBtn) {
    chordEditorToggleBtn.addEventListener("click", onToggleChordEditorCollapse);
  }

  transposeDownBtns.forEach((btn) =>
    btn.addEventListener("click", () => onTranspose(-1)),
  );

  transposeUpBtns.forEach((btn) =>
    btn.addEventListener("click", () => onTranspose(1)),
  );

  transposeResetBtns.forEach((btn) =>
    btn.addEventListener("click", resetTranspose),
  );

  accidentalSwitchBtns.forEach((btn) =>
    btn.addEventListener("click", onToggleAccidentalMode),
  );

  document
    .querySelectorAll(".family-chord-btn")
    .forEach((btn) =>
      btn.addEventListener("click", onToggleFamilyChordDropdown),
    );

  if (transposeToggleBtns.length) {
    transposeToggleBtns.forEach((btn) =>
      btn.addEventListener("click", onToggleTransposeCollapse),
    );
  }

  canvasWrapper.addEventListener("click", onChordLayerClick);

  document.addEventListener("click", onGlobalDocumentClick);

  hideChordBtns.forEach((btn) =>
    btn.addEventListener("click", onToggleChordsHidden),
  );

  songTitleWrapper.addEventListener("click", handleTitleActivatorTap);

  if (screen.orientation) {
    screen.orientation.addEventListener("change", handleOrientationChange);
  } else {
    window.addEventListener("orientationchange", handleOrientationChange);
  }

  window.addEventListener("wheel", handleGlobalScroll, { passive: false });

  window.addEventListener("keydown", handleGlobalKeydown, { passive: false });

  // Scope pinch handlers to the viewer only to avoid conflicts with global/browser gestures.

  pdfViewerContent.addEventListener("touchstart", handleTouchStart, {
    passive: true,
  });

  pdfViewerContent.addEventListener("touchmove", handleTouchMove, {
    passive: false,
  });

  pdfViewerContent.addEventListener("touchend", handleTouchEnd, {
    passive: true,
  });

  pdfViewerContent.addEventListener("touchstart", handleViewerTouchStart, {
    passive: true,
  });

  pdfViewerContent.addEventListener("touchend", handleViewerTouchEnd, {
    passive: true,
  });

  pdfViewerContent.addEventListener("mousedown", handleViewerPointerStart);

  pdfViewerContent.addEventListener("mousemove", handleViewerPointerMove);

  pdfViewerContent.addEventListener("mouseup", handleViewerPointerEnd);

  pdfViewerContent.addEventListener("mouseleave", handleViewerPointerEnd);

  window.addEventListener("resize", onLayoutResize);
}
