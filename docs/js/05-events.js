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

  if (customPlayBtn && MIDI_PLAYER_POOL[0]) {
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

    // Option select (for all popovers)
    document.querySelectorAll(".cis-option").forEach((option) => {
      option.addEventListener("click", (e) => {
        // Block during transition
        if (typeof _midiPoolPreloading !== "undefined" && _midiPoolPreloading)
          return;

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

        if (typeof labelEl !== "undefined" && labelEl) {
          let labelText =
            titleText === "Pilih Alat Musik" ? "Pilihan" : titleText;
          if (labelText.length > 20)
            labelText = labelText.substring(0, 20) + "...";
          labelEl.textContent = labelText;
        }

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

    // Play/Pause button
    customPlayBtn.addEventListener("click", async () => {
      if (window.isMidiFading) return;
      if (_midiPoolPreloading) {
        if (typeof showToast === "function")
          showToast(
            "Sedang memuat audio MIDI, harap tunggu...",
            "hourglass_empty",
          );
        return;
      }

      if (window.Tone && window.Tone.start) {
        try {
          await window.Tone.start();
        } catch (e) {}
      }

      const volNode = getToneVolNode();
      const player = activeMidiPlayer;
      if (!player) return;

      try {
        // Clear any stale seek guard
        window.isMidiSwitching = false;

        // Use authority state to decide play/pause (more reliable than player.playing
        // which can be in a weird state after seek)
        const shouldPlay = !MidiTimeAuthority._playing;

        if (shouldPlay) {
          // Verify playlist auto-next context if applicable
          if (typeof window._verifyPlaylistModeForCurrentSong === "function") {
            window._verifyPlaylistModeForCurrentSong();
          }

          // --- PLAY (with fade-in) ---
          window.isMidiFading = true;
          customPlayIcon.textContent = "hourglass_empty";

          // Set volume to silent BEFORE starting to prevent any pop
          if (volNode && volNode.volume) {
            volNode.volume.cancelScheduledValues(window.Tone.now());
            volNode.volume.value = MIDI_SILENT_VOLUME;
          }

          // Restore position from authority
          let restoreTime = MidiTimeAuthority.getTime();
          const dur =
            MidiTimeAuthority.getDuration() || window._midiKnownDuration || 0;

          // If we're at or near the end (e.g. after song finished), reset to beginning
          if (dur > 0 && restoreTime >= dur - MIDI_END_THRESHOLD_S) {
            restoreTime = 0;
            MidiTimeAuthority.setTime(0, dur);
          }

          if (restoreTime > 0) {
            try {
              player.currentTime = restoreTime;
            } catch (e) {}
          }

          // Stop first if player is in a stale state (e.g. from seek restart)
          if (player.playing) {
            try {
              player.stop();
            } catch (e) {}
          }
          player.start();

          // Set time again after start to combat reset
          if (restoreTime > 0) {
            try {
              player.currentTime = restoreTime;
            } catch (e) {}
          }

          // Update authority
          MidiTimeAuthority.setPlaying(true);

          // Smooth fade-in using shared helper (non-blocking)
          fadeMidiVolume(MIDI_TARGET_VOLUME, MIDI_FADE_IN_MS);

          customPlayIcon.textContent = "pause";
          document
            .getElementById("custom-midi-player")
            .classList.add("playing");
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
          document
            .getElementById("custom-midi-player")
            .classList.remove("playing");

          // Smooth fade-out using shared helper
          await fadeMidiVolume(MIDI_SILENT_VOLUME, MIDI_FADE_OUT_MS);

          player.stop();

          if (volNode && volNode.volume) {
            volNode.volume.value = MIDI_SILENT_VOLUME;
          }
          window.isMidiFading = false;
        }
      } catch (err) {
        console.error("Gagal start/stop MIDI:", err);
        customPlayIcon.textContent = "play_arrow";
        document
          .getElementById("custom-midi-player")
          .classList.remove("playing");
        window.isMidiFading = false;
      }
    });

    // Sync play state from BOTH players (since active player can swap)
    const syncPlayState = (evt) => {
      if (window.isMidiFading || _midiPoolPreloading) return;
      // Only respond to events from the currently active player
      if (evt.target !== activeMidiPlayer) return;
      const isPlaying = activeMidiPlayer.playing;
      customPlayIcon.textContent = isPlaying ? "pause" : "play_arrow";
      document
        .getElementById("custom-midi-player")
        .classList.toggle("playing", isPlaying);
    };
    // Attach sync listeners to ALL pool players
    Object.values(MIDI_PLAYER_POOL).forEach((player) => {
      player.addEventListener("start", syncPlayState);
      player.addEventListener("stop", syncPlayState);
    });

    // Update UI on time update via an interval (html-midi-player doesn't fire timeupdate reliably)
    let isDraggingSeekbar = false;
    // Expose lastSeekValue globally so pool swap can reset it
    window._midiLastSeekValue = -1;

    setInterval(() => {
      if (isDraggingSeekbar || _midiPoolPreloading) return;
      if (
        !document.body.classList.contains("viewer-active") &&
        !MidiTimeAuthority._playing
      )
        return;

      const player = activeMidiPlayer;
      const dur =
        MidiTimeAuthority.getDuration() || window._midiKnownDuration || 0;

      // --- Read from MidiTimeAuthority (pure wall-clock) ---
      const curr = MidiTimeAuthority.getTime();

      // --- Song end detection: authority reaches duration ---
      // DON'T check player.playing — seeks briefly stop the player,
      // triggering false positives. Authority wall-clock is reliable.
      if (
        dur > 0 &&
        curr >= dur - 0.1 &&
        MidiTimeAuthority._playing &&
        !window.isMidiSwitching
      ) {
        MidiTimeAuthority.setPlaying(false);
        MidiTimeAuthority.setTime(0, dur);
        if (player) {
          try {
            player.stop();
          } catch (e) {}
        }
        syncSeekbarUI(0, dur);
        customPlayIcon.textContent = "play_arrow";
        document
          .getElementById("custom-midi-player")
          .classList.remove("playing");
        window._midiLastSeekValue = 0;
        window._midiSavedTime = null;

        // --- LOOP INTERCEPT ---
        if (PlaylistManager.getAutoNextMode() === "one") {
          try {
            player.currentTime = 0;
            player.start();
            MidiTimeAuthority.setPlaying(true);
            MidiTimeAuthority.setTime(0, dur);
            customPlayIcon.textContent = "pause";
            document
              .getElementById("custom-midi-player")
              .classList.add("playing");
            fadeMidiVolume(MIDI_TARGET_VOLUME, MIDI_FADE_IN_MS);
            return;
          } catch (e) {}
        }

        // --- AUTO NEXT INTERCEPT ---
        if (typeof window._playlistCheckAutoNext === "function") {
          window._playlistCheckAutoNext();
        }

        return;
      }

      // Only update DOM if value changed
      if (
        Math.abs(curr - window._midiLastSeekValue) < 0.1 &&
        customSeekbar.max == dur
      )
        return;
      window._midiLastSeekValue = curr;

      syncSeekbarUI(curr, dur);
    }, 100);

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
        if (_midiPoolPreloading) return;
        const val = parseFloat(e.target.value);
        const dur =
          MidiTimeAuthority.getDuration() || window._midiKnownDuration || 0;

        const player = activeMidiPlayer;
        if (player) {
          const wasPlaying = player.playing;
          window.isMidiSwitching = true;
          const volNode = getToneVolNode();
          if (volNode && volNode.volume) {
            volNode.volume.cancelScheduledValues(window.Tone.now());
            volNode.volume.value = MIDI_TARGET_VOLUME;
          }
          try {
            player.currentTime = val;
          } catch (err) {}
          if (wasPlaying) {
            if (!player.playing) {
              try {
                player.start();
              } catch (err) {}
            }
            setTimeout(() => {
              try {
                player.currentTime = val;
              } catch (err) {}
              window.isMidiSwitching = false;
            }, 50);
          } else {
            window.isMidiSwitching = false;
          }
        }
        MidiTimeAuthority.setTime(val, dur);
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

  chordSaveBtn.addEventListener("click", saveChordConfigurationFile);

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

  pdfViewerTitle.addEventListener("click", handleTitleActivatorTap);

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
