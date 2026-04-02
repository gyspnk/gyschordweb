// --- 4. Event Listeners ---

/**
 * Filter instrument options based on selected soundfont.
 * Salamander only supports acoustic_grand_piano (program 0).
 */
function filterInstrumentsBySoundfont(sfUrl) {
  const isSalamander = sfUrl && sfUrl.includes('salamander');
  document.querySelectorAll('.cis-menu-popover').forEach(function(popover) {
    popover.querySelectorAll('.cis-option').forEach(function(opt) {
      var val = opt.getAttribute('data-val');
      // Salamander only has acoustic_grand_piano (program 0); -1 = default = also maps to 0
      const shouldHide = isSalamander && val !== '0' && val !== '-1';
      opt.classList.toggle('cis-hidden', shouldHide);
    });
    // Hide category headers whose children are all hidden
    popover.querySelectorAll('.cis-category').forEach(function(cat) {
      var next = cat.nextElementSibling;
      var hasVisible = false;
      while (next && !next.classList.contains('cis-category')) {
        if (next.classList.contains('cis-option') && !next.classList.contains('cis-hidden')) {
          hasVisible = true;
          break;
        }
        next = next.nextElementSibling;
      }
      cat.classList.toggle('cis-hidden', !hasVisible);
    });
  });
  // Auto-select Grand Piano if current instrument isn't available in Salamander
  if (isSalamander && typeof prefs !== 'undefined' && prefs.midiInstrument !== '0' && prefs.midiInstrument !== '-1') {
    prefs.midiInstrument = '0';
    localStorage.setItem('prefs', JSON.stringify(prefs));
    document.querySelectorAll('.cis-option').forEach(function(o) {
      o.classList.toggle('selected', o.getAttribute('data-val') === '0');
    });
    document.querySelectorAll('#cis-icon, #mini-cis-icon').forEach(function(el) {
      if (typeof getMidiInstrumentIcon === 'function') el.textContent = getMidiInstrumentIcon('0');
    });
    document.querySelectorAll('#cis-label, #mini-cis-label').forEach(function(el) {
      el.textContent = 'Grand Piano';
    });
    var cis = document.getElementById('custom-instrument-select');
    if (cis) cis.dataset.value = '0';
    var mcis = document.getElementById('mini-instrument-select');
    if (mcis) mcis.dataset.value = '0';
  }
}

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

        const currentDropdownObj = e.target.closest(
          ".instrument-selector-wrapper",
        );
        const uiWrapper = currentDropdownObj;
        if (uiWrapper) {
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

          // Sync soundfont toggle state when popover opens
          if (uiWrapper.classList.contains("is-open")) {
            const currentSf = (prefs && prefs.midiSoundfont) || MIDI_SOUNDFONT_URL;
            uiWrapper.querySelectorAll(".cis-sf-btn").forEach((b) => {
              b.classList.toggle("selected", b.getAttribute("data-sf") === currentSf);
            });
            filterInstrumentsBySoundfont(currentSf);
          }

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
    });

    // Soundfont toggle buttons inside instrument popover
    document.querySelectorAll(".cis-sf-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const sfUrl = btn.getAttribute("data-sf");
        if (!sfUrl) return;
        // Update all soundfont toggles across both popovers
        document.querySelectorAll(".cis-sf-btn").forEach((b) => {
          b.classList.toggle("selected", b.getAttribute("data-sf") === sfUrl);
        });
        prefs.midiSoundfont = sfUrl;
        localStorage.setItem("prefs", JSON.stringify(prefs));
        // Filter instrument list based on selected soundfont
        filterInstrumentsBySoundfont(sfUrl);
        // Apply immediately if a song is loaded
        if (typeof changeInstrument === "function" && _midiOriginalSeq) {
          changeInstrument();
        }
      });
    });

    // Option select (for all popovers)
    document.querySelectorAll(".cis-option").forEach((option) => {
      option.addEventListener("click", (e) => {
        // Block during transition
        if (_midiSfPlayerLoading) return;

        // Find nearest button in case user clicked inner element
        const btn = e.target.closest(".cis-option");
        if (!btn) return;
        const val = btn.getAttribute("data-val");

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

        // Update UI styling for ALL .cis-option buttons matching the value
        document.querySelectorAll(".cis-option").forEach((o) => {
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

        const titleText = btn.getAttribute("title") || "Pilih Alat Musik";
        if (
          typeof customInstrumentSelect !== "undefined" &&
          customInstrumentSelect
        )
          customInstrumentSelect.title = titleText;
        if (miniInstrumentSelect) miniInstrumentSelect.title = titleText;

        document.querySelectorAll("#cis-icon, #mini-cis-icon").forEach((el) => {
          if (typeof getMidiInstrumentIcon === "function")
            el.textContent = getMidiInstrumentIcon(val);
        });

        document
          .querySelectorAll("#cis-label, #mini-cis-label")
          .forEach((el) => {
            let labelText =
              titleText === "Pilih Alat Musik" ? "Pilihan" : titleText;
            if (labelText.length > 20)
              labelText = labelText.substring(0, 20) + "...";
            el.textContent = labelText;
          });

        if (typeof prefs !== "undefined") {
          prefs.midiInstrument = val;
          localStorage.setItem("prefs", JSON.stringify(prefs));
        }

        // Re-preload all pool players
        if (typeof changeInstrument === "function") {
          changeInstrument();
        }
      });
    });

    // Play/Pause — named function so mini player can call directly (real user gesture)
    async function toggleMidiPlayback() {
      if (window.isMidiFading) return;
      if (_midiSfPlayerLoading) {
        if (typeof showToast === "function")
          showToast("Sedang memuat audio MIDI, harap tunggu...", "hourglass_empty");
        return;
      }

      if (window.Tone && window.Tone.start) {
        try { await window.Tone.start(); } catch (e) {}
      }

      const volNode = getToneVolNode();
      if (!_midiSfPlayer || !_midiCurrentTransposedSeq) return;

      try {
        window.isMidiSwitching = false;
        const shouldPlay = !MidiTimeAuthority._playing;

        if (shouldPlay) {
          if (typeof window._verifyPlaylistModeForCurrentSong === "function") {
            window._verifyPlaylistModeForCurrentSong();
          }

          window.isMidiFading = true;

          // Set volume to silent BEFORE starting to prevent click
          if (volNode && volNode.volume) {
            volNode.volume.cancelScheduledValues(window.Tone.now());
            volNode.volume.value = MIDI_SILENT_VOLUME;
          }

          let restoreTime = MidiTimeAuthority.getTime();
          const dur = MidiTimeAuthority.getDuration() || window._midiKnownDuration || 0;

          if (dur > 0 && restoreTime >= dur - MIDI_END_THRESHOLD_S) {
            restoreTime = 0;
            MidiTimeAuthority.setTime(0, dur);
          }

          // Stop if already playing
          if (_midiSfPlayer.isPlaying()) {
            try { _midiSfPlayer.stop(); } catch (e) {}
          }

          // Start from offset (audio is silent, no click)
          _midiSfPlayer.start(_midiCurrentTransposedSeq, undefined, restoreTime);

          MidiTimeAuthority.setTime(restoreTime, dur);
          MidiTimeAuthority.setPlaying(true);

          // Update UI immediately
          customPlayIcon.textContent = "pause";
          document.getElementById("custom-midi-player").classList.add("playing");
          window._midiSavedTime = null;

          // Fade in AFTER start — await to prevent race condition
          await fadeMidiVolume(MIDI_TARGET_VOLUME, MIDI_FADE_IN_MS);
          window.isMidiFading = false;
        } else {
          window.isMidiFading = true;

          MidiTimeAuthority.setPlaying(false);
          window._midiSavedTime = MidiTimeAuthority.getTime();

          // Update UI immediately for responsiveness
          customPlayIcon.textContent = "play_arrow";
          document.getElementById("custom-midi-player").classList.remove("playing");

          // Fade out completely before stopping
          await fadeMidiVolume(MIDI_SILENT_VOLUME, MIDI_FADE_OUT_MS);

          if (_midiSfPlayer.isPlaying()) {
            try { _midiSfPlayer.stop(); } catch (e) {}
          }

          if (volNode && volNode.volume) {
            volNode.volume.value = MIDI_SILENT_VOLUME;
          }
          window.isMidiFading = false;
        }
      } catch (err) {
        console.error("Gagal start/stop MIDI:", err);
        customPlayIcon.textContent = "play_arrow";
        document.getElementById("custom-midi-player").classList.remove("playing");
        window.isMidiFading = false;
      }
    }
    window.toggleMidiPlayback = toggleMidiPlayback;
    customPlayBtn.addEventListener("click", toggleMidiPlayback);

    // Seekbar sync using requestAnimationFrame for smooth updates
    let isDraggingSeekbar = false;
    window._midiLastSeekValue = -1;

    // Debounce: track when end detection last fired to prevent double-triggering
    let _midiEndDetectedAt = 0;

    let _seekbarRafId = null;
    function seekbarAnimationLoop() {
      _seekbarRafId = requestAnimationFrame(seekbarAnimationLoop);

      if (isDraggingSeekbar || _midiSfPlayerLoading || window.isMidiSwitching) return;
      if (!document.body.classList.contains("viewer-active") && !MidiTimeAuthority._playing) return;

      const dur = MidiTimeAuthority.getDuration() || window._midiKnownDuration || 0;
      const curr = MidiTimeAuthority.getTime();

      // Song end detection — use proper threshold constant
      const now = performance.now();
      if (dur > 0 && curr >= dur - MIDI_END_THRESHOLD_S && MidiTimeAuthority._playing && !window.isMidiSwitching
          && (now - _midiEndDetectedAt) > 1000) {
        _midiEndDetectedAt = now;
        MidiTimeAuthority.setPlaying(false);
        MidiTimeAuthority.setTime(0, dur);
        if (_midiSfPlayer && _midiSfPlayer.isPlaying()) {
          // Micro-ramp to silent before stop — prevents audible click
          const volNode = getToneVolNode();
          if (volNode && volNode.volume && window.Tone) {
            const t = window.Tone.now();
            volNode.volume.cancelScheduledValues(t);
            volNode.volume.setValueAtTime(volNode.volume.value, t);
            volNode.volume.linearRampToValueAtTime(MIDI_SILENT_VOLUME, t + MIDI_MICRO_RAMP_S);
          }
          // Delay stop so the micro-ramp reaches silence first
          const _endRef = _midiSfPlayer;
          setTimeout(() => {
            try { if (_endRef && _endRef.isPlaying()) _endRef.stop(); } catch (e) {}
          }, MIDI_MICRO_RAMP_S * 1000 + 5);
        }
        syncSeekbarUI(0, dur);
        customPlayIcon.textContent = "play_arrow";
        document.getElementById("custom-midi-player").classList.remove("playing");
        window._midiLastSeekValue = 0;
        window._midiSavedTime = null;

        const endMode = PlaylistManager.getAutoNextMode();

        // Loop intercept — repeat one
        if (endMode === "one") {
          try {
            const volNode = getToneVolNode();
            if (volNode && volNode.volume && window.Tone) {
              const t = window.Tone.now();
              volNode.volume.cancelScheduledValues(t);
              volNode.volume.setValueAtTime(volNode.volume.value, t);
              volNode.volume.linearRampToValueAtTime(MIDI_SILENT_VOLUME, t + MIDI_MICRO_RAMP_S);
            }
            // Delay stop+restart so the micro-ramp reaches silence first
            const _loopRef = _midiSfPlayer;
            const _loopSeq = _midiCurrentTransposedSeq;
            setTimeout(() => {
              try {
                if (_loopRef && _loopRef.isPlaying()) _loopRef.stop();
                _loopRef.start(_loopSeq);
                MidiTimeAuthority.setPlaying(true);
                MidiTimeAuthority.setTime(0, dur);
                fadeMidiVolume(MIDI_TARGET_VOLUME, MIDI_FADE_IN_MS);
                customPlayIcon.textContent = "pause";
                document.getElementById("custom-midi-player").classList.add("playing");
              } catch (e2) {}
            }, MIDI_MICRO_RAMP_S * 1000 + 5);
          } catch (e) {}
          return;
        }

        // Auto next intercept — only for active auto-next modes (never for 'off')
        if (endMode !== 'off' && typeof window._playlistCheckAutoNext === "function") {
          window._autoAdvanceFromEnd = true;
          window._playlistCheckAutoNext();
        }
        return;
      }

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
        const dur =
          MidiTimeAuthority.getDuration() || window._midiKnownDuration || 0;
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
        if (_midiSfPlayerLoading) return;
        const val = parseFloat(e.target.value);
        const dur = MidiTimeAuthority.getDuration() || window._midiKnownDuration || 0;

        if (_midiSfPlayer && _midiCurrentTransposedSeq) {
          const wasPlaying = _midiSfPlayer.isPlaying();
          window.isMidiSwitching = true;
          const volNode = getToneVolNode();
          // Micro-ramp to silent before stop+start — prevents audible click
          if (volNode && volNode.volume && window.Tone) {
            const t = window.Tone.now();
            volNode.volume.cancelScheduledValues(t);
            volNode.volume.setValueAtTime(volNode.volume.value, t);
            volNode.volume.linearRampToValueAtTime(MIDI_SILENT_VOLUME, t + MIDI_MICRO_RAMP_S);
          }

          // Delay stop+restart so the micro-ramp reaches silence first
          const _seekPlayer = _midiSfPlayer;
          const _seekSeq = _midiCurrentTransposedSeq;
          setTimeout(() => {
            // SoundFontPlayer: stop and restart from new offset
            if (_seekPlayer.isPlaying()) {
              try { _seekPlayer.stop(); } catch (err) {}
            }

            if (wasPlaying) {
              try {
                _seekPlayer.start(_seekSeq, undefined, val);
              } catch (err) {}
              MidiTimeAuthority.setTime(val, dur);
              MidiTimeAuthority.setPlaying(true);
              fadeMidiVolume(MIDI_TARGET_VOLUME, MIDI_CROSSFADE_IN_MS);
            } else {
              MidiTimeAuthority.setTime(val, dur);
              // Restore volume for when playback resumes
              if (volNode && volNode.volume) {
                volNode.volume.value = MIDI_TARGET_VOLUME;
              }
            }

            window.isMidiSwitching = false;
          }, MIDI_MICRO_RAMP_S * 1000 + 5);
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
