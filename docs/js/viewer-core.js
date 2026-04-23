/* Auto-merged runtime source. Legacy split snapshot archived under archive/docs-js/legacy. */

/* SOURCE: 07-pdf-viewer.js */
// --- 6. PDF Viewer ---
async function openPdfViewer(songId, backgroundLoad = false) {
  // Guard against rapid prev/next navigation: each call gets a generation number.
  // After the animation delay, stale calls (superseded by a newer navigation) abort
  // before touching any shared audio/MIDI/PDF state, preventing race conditions.
  const thisOpenGeneration = ++_openPdfViewerGeneration;

  currentSongIndex = parseInt(songId, 10);
  localStorage.setItem("GysLastPlayedSongIndex", currentSongIndex);
  const song = pujianItems[currentSongIndex];
  if (!song) return;

  // Mark body as viewer-active IMMEDIATELY so the mini player hides before
  // any async delays (avoids race with syncMiniPlayerUI's 500ms interval).
  if (!backgroundLoad) {
    document.body.classList.add('viewer-active');
    document.body.removeAttribute('data-page');
    const miniPlayer = document.getElementById('mini-player');
    if (miniPlayer) miniPlayer.classList.add('is-hidden');
  }

  // Determine early if this is the same song that is already loaded and rendered.
  let _earlyRawUrl = song.fileHref;
  if (_earlyRawUrl) {
    _earlyRawUrl = _earlyRawUrl.replace(/\/pdf\//i, "/midi/").replace(/\.pdf$/i, ".mid");
  }
  const _earlyIsSameSong = window._midiCurrentlyLoadedRawUrl === _earlyRawUrl;
  // If the same song is already decoded and the canvas is still rendered, we can
  // skip the heavy PDF re-load/render to avoid audio jank during the transition.
  const _canReuseDoc = _earlyIsSameSong && !!pdfDoc;

  // Detect whether the target MIDI is already preloaded with the exact
  // transpose/instrument profile we are about to load. If yes, avoid blocking
  // the MIDI activation path on UI delay or PDF tempo parsing.
  let _earlyTargetIsPreloaded = false;
  if (!_earlyIsSameSong && _earlyRawUrl && typeof MidiEngine !== "undefined") {
    let _earlyInstrumentValue = -1;
    if (prefs && prefs.midiInstrument !== undefined) {
      _earlyInstrumentValue = parseInt(prefs.midiInstrument, 10);
    }
    const _earlyTranspose = _resolveLoadTranspose(song, _earlyRawUrl, _earlyInstrumentValue);
    const _earlyInstForCheck = _earlyInstrumentValue >= 0 ? _earlyInstrumentValue : -1;
    _earlyTargetIsPreloaded = MidiEngine.hasPreloaded(_earlyRawUrl, _earlyTranspose, _earlyInstForCheck);
  }

  // Start fetching PDF immediately to overlap network with transition
  // (skipped when we can reuse the existing decoded document)
  const pdfOptions = {
    url: song.fileHref,
    standardFontDataUrl: "https://mozilla.github.io/pdf.js/standard_fonts/",
  };
  const loadingTask = _canReuseDoc ? null : pdfjsLib.getDocument(pdfOptions);

  // Begin stopping MIDI audio on manual navigation — before the animation wait —
  // so audio stops cleanly. The actual load happens later in the main path.
  if (!_earlyIsSameSong && window._manualNavigation && typeof MidiEngine !== 'undefined' && MidiEngine.isPlaying()) {
    MidiEngine.stop();
  }

  // Instantly hide MIDI panel BEFORE any animation delay to prevent flickering.
  // The no-transition class suppresses CSS transitions so the panel disappears immediately.
  if (typeof midiPanel !== "undefined" && midiPanel && typeof midiToggleBtn !== "undefined" && midiToggleBtn) {
    midiPanel.classList.add('no-transition');
    midiToggleBtn.setAttribute("aria-expanded", "false");
  }

  if (!_canReuseDoc) {
    // Animate title/canvas only when actually switching content
    songTitleWrapper.classList.add("is-navigating");
    canvasWrapper.classList.add("is-navigating");
    const navDelayMs = _earlyTargetIsPreloaded ? 0 : 150;
    if (navDelayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, navDelayMs));
    }

    // Abort if a newer navigation started during the animation delay.
    // This prevents multiple rapid prev/next presses from concurrently
    // corrupting shared MIDI/PDF state.
    if (_openPdfViewerGeneration !== thisOpenGeneration) {
      return;
    }
  }

  pdfViewerTitle.textContent = song.judul;
  pdfViewerNumber.textContent = `No. ${song.nomor}`;
  if (!_canReuseDoc) {
    songTitleWrapper.classList.remove("is-navigating");
  }
  fitViewerTitle();

  if (!backgroundLoad && !document.body.classList.contains("viewer-active")) {
    document.body.classList.add("viewer-active");
  }

  // Check header layout collisions once viewer is active
  if (typeof scheduleLayoutCollisionCheck === 'function') {
    scheduleLayoutCollisionCheck();
  } else if (typeof checkLayoutCollisions === "function") {
    checkLayoutCollisions();
  }

  let rawUrl = song.fileHref;
  if (rawUrl) {
    rawUrl = rawUrl.replace(/\/pdf\//i, "/midi/").replace(/\.pdf$/i, ".mid");
  }
  const isSameSong = window._midiCurrentlyLoadedRawUrl === rawUrl;

  if (!isSameSong) {
    let songTempoForLoad = _getSongTargetTempoBpm(song);
    if (!_canReuseDoc && loadingTask && !_earlyTargetIsPreloaded) {
      songTempoForLoad = await _resolveSongTempoForLoad(song, loadingTask);
    } else if (!_canReuseDoc && loadingTask) {
      // Warm tempo/transpose caches in the background without delaying the
      // preloaded MIDI switch path.
      _resolveSongTempoForLoad(song, loadingTask).catch(function () {});
    }
    if (typeof setCurrentSongTempo === "function") {
      setCurrentSongTempo(songTempoForLoad, {
        resetCurrent: true,
        skipApply: _earlyTargetIsPreloaded,
      });
    }

    chordConfig = createDefaultChordConfig();
    noteChordConfig = createDefaultNoteChordConfig();
    pageNotesCache = {};
    // Reset transpose saat ganti lagu
    // For new songs, use cached default transpose profile (mol/black-key -> -1)
    // if natural-chords preference is enabled; otherwise keep neutral 0.
    transposeStep = _getSongTargetTranspose(song);
    updateTransposeUI();
  } else {
    // Keep existing chordConfig and transposeStep, but make sure UI matches
    if (typeof updateTransposeUI === "function") updateTransposeUI();
  }

  // Setup MIDI Player
  if (midiToggleBtn) {
    const wasForcedNext = window._forceAutoPlayNext === true;
    const wasPlayingGlobal =
      (typeof MidiEngine !== 'undefined' && MidiEngine.isPlaying()) ||
      window._forceAutoPlayNext === true;
    window._forceAutoPlayNext = false;

    if (isSameSong) {
      if (
        wasPlayingGlobal &&
        typeof window._verifyPlaylistModeForCurrentSong === "function"
      ) {
        window._verifyPlaylistModeForCurrentSong();
      }

      midiToggleBtn.style.display = "flex";
      document.getElementById('midi-collapse').classList.add('midi-available');
      if (typeof scheduleLayoutCollisionCheck === 'function') {
        scheduleLayoutCollisionCheck();
      } else if (typeof checkLayoutCollisions === 'function') {
        checkLayoutCollisions();
      }
      if (typeof midiPanel !== "undefined" && midiPanel) {
        // Close panel instantly (no CSS transition) to prevent flicker.
        // no-transition stays on — only removed by the toggle-button click handler
        // so that programmatic navigation never triggers the CSS open/close animation.
        midiPanel.classList.add('no-transition');
        midiToggleBtn.setAttribute("aria-expanded", "false");
      }

      const playIcon = document.getElementById("custom-play-icon");
      const midiPlayerEl = document.getElementById("custom-midi-player");
      if (playIcon) {
        playIcon.textContent = (typeof MidiEngine !== 'undefined' && MidiEngine.isPlaying()) ? "pause" : "play_arrow";
      }
      if (midiPlayerEl) {
        midiPlayerEl.classList.toggle("playing", typeof MidiEngine !== 'undefined' && MidiEngine.isPlaying());
      }
    } else {
      if (
        wasPlayingGlobal &&
        typeof window._verifyPlaylistModeForCurrentSong === "function"
      ) {
        window._verifyPlaylistModeForCurrentSong();
      }

      // Stop current playback
      if (typeof MidiEngine !== 'undefined' && MidiEngine.isPlaying()) {
        MidiEngine.stop();
      }
      window._manualNavigation = false;

      // Instantly collapse MIDI panel (no CSS transition) when switching songs.
      // Keep no-transition until MIDI load completes to prevent animation slip.
      if (typeof midiPanel !== "undefined" && midiPanel && midiToggleBtn) {
        midiPanel.classList.add('no-transition');
        midiToggleBtn.setAttribute("aria-expanded", "false");
      }

      // Set isMidiSwitching BEFORE resetMidiState so the mini player never
      // sees a gap where both duration=0 and isMidiSwitching=false.
      window.isMidiSwitching = true;

      // Reset MIDI state (but preserve isMidiSwitching and midi-available to prevent flicker)
      resetMidiState({ keepAvailable: true, keepEngineState: true });
      window.isMidiSwitching = true;
      syncSeekbarUI(0, 0);
      window._midiLastSeekValue = 0;

      // Increment generation to cancel any in-flight MIDI loads from previous songs
      const thisGeneration = ++_midiLoadGeneration;

      if (typeof MidiEngine !== 'undefined') {
        // Resolve current instrument and the best matching preload transpose.
        let instrumentValue = -1;
        if (prefs && prefs.midiInstrument !== undefined) {
          instrumentValue = parseInt(prefs.midiInstrument, 10);
        }
        const currentTranspose = _resolveLoadTranspose(song, rawUrl, instrumentValue);
        if (transposeStep !== currentTranspose) {
          transposeStep = currentTranspose;
          if (typeof updateTransposeUI === "function") updateTransposeUI();
        }

        // Show progress bar only if this song is NOT already preloaded (exact match)
        const instForCheck = instrumentValue >= 0 ? instrumentValue : -1;
        const isPreloaded = MidiEngine.hasPreloaded(rawUrl, currentTranspose, instForCheck);
        if (midiPreloadBar && !isPreloaded) {
          midiPreloadBar.style.display = "block";
          midiPreloadFill.style.width = "0%";
        }

        MidiEngine.loadMidi(rawUrl, {
          autoplay: wasForcedNext,
          transpose: currentTranspose,
          instrument: instrumentValue >= 0 ? instrumentValue : undefined,
          sourceLabel: song.judul,
          onProgress: function (pct) {
            if (midiPreloadFill) midiPreloadFill.style.width = pct + '%';
          }
        }).then(function () {
          // Cancel if a newer song load has started
          if (_midiLoadGeneration !== thisGeneration) return;

          // Mark as loaded only after a successful decode/render.
          window._midiCurrentlyLoadedRawUrl = rawUrl;

          if (midiPreloadFill) midiPreloadFill.style.width = "100%";
          if (midiPreloadBar) midiPreloadBar.style.display = "none";

          window._midiKnownDuration = MidiEngine.getDuration();
          syncSeekbarUI(0, MidiEngine.getDuration());
          window.isMidiSwitching = false;

          // no-transition stays on — only the toggle-button click removes it

          if (wasForcedNext) {
            customPlayIcon.textContent = "pause";
            document.getElementById("custom-midi-player").classList.add("playing");
          }

          // Predetermine next shuffle song and preload it in background
          _determineNextShuffleSong();
          _preloadNextSong();
        }).catch(function (err) {
          console.warn("Gagal memuat MIDI:", err);
          window.isMidiSwitching = false;
          if (midiPreloadBar) midiPreloadBar.style.display = "none";
          // no-transition stays on — only the toggle-button click removes it
        });
      }

      // Set UI dropdown dengan preferensi yg ada
      if (
        prefs.midiInstrument &&
        typeof customInstrumentSelect !== "undefined" &&
        customInstrumentSelect
      ) {
        customInstrumentSelect.dataset.value = prefs.midiInstrument;
        var activeSf = (prefs && prefs.midiSoundfont) || MIDI_SF2_URL;
        var titleText = (typeof getSoundfontInstrumentLabel === 'function')
          ? getSoundfontInstrumentLabel(prefs.midiInstrument, activeSf)
          : 'Pilih Alat Musik';

        document
          .querySelectorAll("#cis-icon, #mini-cis-icon")
          .forEach((el) => (el.textContent = getMidiInstrumentIcon(prefs.midiInstrument, titleText)));
        if (typeof applyInstrumentLabelPresentation === 'function') {
          applyInstrumentLabelPresentation(titleText);
        } else {
          document
            .querySelectorAll("#cis-label, #mini-cis-label")
            .forEach((el) => (el.textContent = titleText));
        }

        var options = document.querySelectorAll(
          `.instrument-selector-wrapper .cis-option[data-val="${prefs.midiInstrument}"]`,
        );
        document
          .querySelectorAll(".instrument-selector-wrapper .cis-option")
          .forEach((opt) => opt.classList.remove("selected"));
        options.forEach((opt) => opt.classList.add("selected"));
      }

      midiToggleBtn.style.display = "flex";
      document.getElementById('midi-collapse').classList.add('midi-available');
      if (typeof scheduleLayoutCollisionCheck === 'function') {
        scheduleLayoutCollisionCheck();
      } else if (typeof checkLayoutCollisions === 'function') {
        checkLayoutCollisions();
      }
      if (typeof midiPanel !== "undefined" && midiPanel) {
        // Keep panel suppressed — no-transition persists until user clicks toggle.
        midiPanel.classList.add('no-transition');
        midiToggleBtn.setAttribute("aria-expanded", "false");
      }
    } // End of track matched guard
  }

  // Pertahankan state chord editor (jangan reset chordEditorEnabled = false)
  updateChordEditorUI();

  try {
    if (_canReuseDoc) {
      // Fast path: same song, pdfDoc already decoded, canvas already rendered.
      // Just restore the viewer UI without any PDF work — keeps audio seamless.
      [pageCountElPortrait, pageCountElLandscape].forEach((el) => {
        el.textContent = pdfDoc.numPages;
      });
      updateViewerUI();
      updateHideChordButton();
      updateSongNavButtons();
      fitViewerTitle();
      // canvasWrapper.is-navigating was never added in this path, but clear it defensively
      canvasWrapper.classList.remove("is-navigating");
      songTitleWrapper.classList.remove("is-navigating");
    } else {
      pdfDoc = await loadingTask.promise;

      // Extract PDF Key
      try {
        const page1 = await pdfDoc.getPage(1);
        const textContent = await page1.getTextContent();
        const pdfText = textContent.items.map((item) => item.str).join(" ");
        const detectedTempo = _extractPdfTempoFromText(pdfText);

        if (song && song.fileHref) {
          _tempoByPdfHref.set(song.fileHref, detectedTempo);
        }
        if (!isSameSong && typeof setCurrentSongTempo === "function") {
          setCurrentSongTempo(detectedTempo, {
            resetCurrent: true,
            skipApply: _earlyTargetIsPreloaded,
          });
        }

        const keyMatch = pdfText.match(
          /(?:(?:do|la)\s*={1,2}\s*|[23469]\s*[\/|]\s*[248]\s+)([A-G](?:es|is|s|#|b)?(?:m)?)\b/i,
        );
        if (keyMatch) {
          originalPdfKey = keyMatch[1];
        } else {
          originalPdfKey = null;
        }
      } catch (err) {
        console.warn(
          "Gagal mengekstrak teks PDF untuk mendeteksi nada dasar:",
          err,
        );
        originalPdfKey = null;
      }

      [pageCountElPortrait, pageCountElLandscape].forEach((el) => {
        el.textContent = pdfDoc.numPages;
      });

      if (!isSameSong) {
        await loadChordConfigurationForSong(song);
        // Also load note-aligned chord config
        if (typeof loadNoteChordConfiguration === "function") {
          pageNotesCache = {}; // Clear note cache for new song
          await loadNoteChordConfiguration(song);
          if (hasNoteAlignedChords()) {
            detectNoteAlignedFamilyChord();
          }
        }
        currentPageNum = 1;
        currentViewMode =
          pdfDoc.numPages > 1 && prefs.defaultTwoPage ? "double" : "single";
        currentScrollMode = prefs.defaultVerticalScroll
          ? "vertical"
          : "horizontal";
        currentScale = "page-fit";
      }

      updateViewerUI();
      updateHideChordButton();
      await renderPage(currentPageNum);
      updateSongNavButtons();
      fitViewerTitle();

      // Force a reflow before removing the class to ensure proper transition
      void canvasWrapper.offsetWidth;

      canvasWrapper.classList.remove("is-navigating");
    }
  } catch (reason) {
    viewerLoader.classList.remove("visible");
    songTitleWrapper.classList.remove("is-navigating");
    canvasWrapper.classList.remove("is-navigating");
    console.error(`Gagal memuat PDF: ${reason}`);
    alert("Gagal memuat PDF.");
    closePdfViewer();
  }
}

async function animateViewChange(renderFunction, duration = 150) {
  canvasWrapper.classList.add("is-navigating");
  await new Promise((resolve) => setTimeout(resolve, duration));
  if (renderFunction) await renderFunction();

  // Force a reflow to ensure the initial 'is-navigating' state is registered by the browser
  void canvasWrapper.offsetWidth;

  canvasWrapper.classList.remove("is-navigating");
}

function updateCenteringAndOverflow() {
  if (canvasWrapper.scrollHeight > pdfViewerContent.clientHeight) {
    pdfViewerContent.classList.remove("vertically-centered");
  } else {
    pdfViewerContent.classList.add("vertically-centered");
  }

  if (canvasWrapper.scrollWidth > pdfViewerContent.clientWidth) {
    pdfViewerContent.classList.add("is-overflowing");
  } else {
    pdfViewerContent.classList.remove("is-overflowing");
  }
}

async function renderPage(num) {
  if (!pdfDoc) return;
  const requestId = ++renderRequestId;
  const oldWrapper = canvasWrapper;
  const nextWrapper = document.createElement("div");
  nextWrapper.className = oldWrapper.className
    .replace(/\s*pinch-preview/g, "")
    .replace(/\s*zoom-animating/g, "")
    .replace(/\s*zoom-staging/g, "")
    .replace(/\s*zoom-staging-overlay/g, "")
    .replace(/\s*zoom-fading-in-soft/g, "")
    .replace(/\s*zoom-old-fading-out/g, "")
    .replace(/\s*zoom-crossfade-in/g, "")
    .replace(/\s*zoom-hold-fixed/g, "");

  const renderSinglePageTask = async (pageNumToRender, scaleToUse) => {
    const page = await pdfDoc.getPage(pageNumToRender);
    const dpr = window.devicePixelRatio || 1;
    const finalRenderScale = scaleToUse * dpr;
    const viewport = page.getViewport({ scale: finalRenderScale });

    const cssWidth = viewport.width / dpr;
    const cssHeight = viewport.height / dpr;

    const pageContainer = document.createElement("div");
    pageContainer.className = "pdf-page-container";
    pageContainer.dataset.pageNum = String(pageNumToRender);
    pageContainer.style.width = `${cssWidth}px`;
    pageContainer.style.height = `${cssHeight}px`;

    const canvas = document.createElement("canvas");
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    canvas.style.width = `${cssWidth}px`;
    canvas.style.height = `${cssHeight}px`;

    await page.render({ canvasContext: canvas.getContext("2d"), viewport })
      .promise;

    // Extract notes for note-aligned chord editor
    if (typeof extractPageNotes === "function") {
      try {
        const noteData = await extractPageNotes(page);
        pageNotesCache[pageNumToRender] = noteData;
      } catch (e) {
        console.warn("Note extraction failed for page", pageNumToRender, e);
        pageNotesCache[pageNumToRender] = { notes: [], pageWidth: 0, pageHeight: 0 };
      }
    }

    // Use note-aligned chord layer if we have notes, otherwise fall back to grid
    const cachedNotes = pageNotesCache[pageNumToRender];
    let chordLayer;
    if (cachedNotes && cachedNotes.notes.length > 0 && typeof createNoteAlignedChordLayer === "function") {
      chordLayer = createNoteAlignedChordLayer(pageNumToRender, cachedNotes.notes);
    } else {
      chordLayer = createChordLayer(pageNumToRender);
    }
    pageContainer.appendChild(canvas);
    pageContainer.appendChild(chordLayer);

    return pageContainer;
  };

  if (currentScale === "page-fit") {
    const page1 = await pdfDoc.getPage(1);
    const viewport1 = page1.getViewport({ scale: 1 });
    let containerWidth = pdfViewerContent.clientWidth - 32;

    if (currentViewMode === "double" && pdfDoc.numPages > 1) {
      containerWidth = (containerWidth - 16) / 2;
    }

    const scaleX = containerWidth / viewport1.width;
    const scaleY = (pdfViewerContent.clientHeight - 32) / viewport1.height;
    initialScale = Math.min(scaleX, scaleY);
    currentScale = initialScale;
  }

  try {
    if (currentScrollMode === "vertical") {
      nextWrapper.classList.add("vertical-scroll");
      for (let i = 1; i <= pdfDoc.numPages; i += 1) {
        const pageContainer = await renderSinglePageTask(i, currentScale);
        nextWrapper.appendChild(pageContainer);
      }
    } else {
      nextWrapper.classList.remove("vertical-scroll");

      const page1 = await renderSinglePageTask(num, currentScale);
      nextWrapper.appendChild(page1);

      if (currentViewMode === "double" && num < pdfDoc.numPages) {
        const page2 = await renderSinglePageTask(num + 1, currentScale);
        nextWrapper.appendChild(page2);
      }
    }

    if (requestId !== renderRequestId) return;

    if (zoomDeferInsert) {
      // During zoom: DON'T insert into DOM. Keep wrapper detached.
      // The caller (applyScaleAndRerender) will handle insertion.
    } else {
      oldWrapper.replaceWith(nextWrapper);
      canvasWrapper = nextWrapper;
    }

    nextWrapper.addEventListener("click", onChordLayerClick);
    // Also listen for note-aligned chord clicks
    if (typeof onNoteAlignedChordClick === "function") {
      nextWrapper.addEventListener("click", onNoteAlignedChordClick);
    }
    return nextWrapper;
  } catch (error) {
    console.error("Gagal merender halaman:", error);
  } finally {
    viewerLoader.classList.remove("visible");
    updatePageIndicator(num);
    updatePageNavButtons();
    updateZoomIndicator();
    if (!zoomDeferInsert) {
      updateCenteringAndOverflow();
    }
  }
}

function onPrevPage() {
  if (currentPageNum <= 1) return;
  const step = currentViewMode === "double" ? 2 : 1;
  currentPageNum = Math.max(1, currentPageNum - step);
  animateViewChange(() => renderPage(currentPageNum));
}

function onNextPage() {
  if (currentPageNum >= pdfDoc.numPages) return;
  const step = currentViewMode === "double" ? 2 : 1;
  currentPageNum += step;
  animateViewChange(() => renderPage(currentPageNum));
}

async function onZoom(direction) {
  // Prevent zoom spam - only allow one zoom operation at a time
  if (!pdfDoc || zoomInProgress) return;

  try {
    zoomInProgress = true;

    if (currentScale === "page-fit") {
      currentScale = initialScale;
    }

    const percentStep = 25;
    const oldScale = currentScale;
    const currentPercent = (oldScale / initialScale) * 100;
    const minPercent = 100;
    const maxPercent = 800;

    let nextPercent = currentPercent;
    if (direction === "in") {
      nextPercent = Math.min(maxPercent, currentPercent + percentStep);
    } else {
      nextPercent = Math.max(minPercent, currentPercent - percentStep);
    }

    const newScale = initialScale * (nextPercent / 100);

    if (newScale === oldScale) return;

    const container = pdfViewerContent;
    const rect = container.getBoundingClientRect();
    const anchorClientX = rect.left + container.clientWidth / 2;
    const anchorClientY = rect.top + container.clientHeight / 2;

    await applyScaleAndRerender({
      oldScale,
      newScale,
      anchorClientX,
      anchorClientY,
      animatePreview: true,
    });
  } finally {
    zoomInProgress = false;
  }
}

async function resetZoomToDefault(anchorClientX, anchorClientY) {
  if (!pdfDoc || zoomInProgress) return;

  const oldScale =
    typeof currentScale === "number" ? currentScale : initialScale;
  const newScale = initialScale;
  if (!Number.isFinite(oldScale) || !Number.isFinite(newScale) || newScale <= 0)
    return;
  if (Math.abs(oldScale - newScale) < 0.005) {
    currentScale = newScale;
    updateZoomIndicator();
    return;
  }

  try {
    zoomInProgress = true;
    await applyScaleAndRerender({
      oldScale,
      newScale,
      anchorClientX,
      anchorClientY,
      animatePreview: true,
    });
    showZoomToast("Zoom direset ke 100%", "center_focus_strong");
  } finally {
    zoomInProgress = false;
  }
}

async function applyScaleAndRerender({
  oldScale,
  newScale,
  anchorClientX,
  anchorClientY,
  animatePreview = false,
}) {
  const container = pdfViewerContent;
  const containerWidth = container.clientWidth;
  const containerHeight = container.clientHeight;
  const rect = container.getBoundingClientRect();
  const localX = anchorClientX - rect.left;
  const localY = anchorClientY - rect.top;

  const zoomRatio = newScale / oldScale;
  const activeWrapper = canvasWrapper;

  // Clear any in-flight glide animation so bounding rect reads are accurate
  activeWrapper.style.transition = "";
  activeWrapper.style.transform = "";
  activeWrapper.style.transformOrigin = "";
  activeWrapper.classList.remove("pinch-preview", "wheel-preview", "zoom-animating");
  activeWrapper.getBoundingClientRect(); // force reflow

  // Compute anchor position relative to wrapper origin in document coordinates.
  const activeRect = activeWrapper.getBoundingClientRect();
  const wrapperBaseX = container.scrollLeft + (activeRect.left - rect.left);
  const wrapperBaseY = container.scrollTop + (activeRect.top - rect.top);
  const anchorWrapperX = container.scrollLeft + localX - wrapperBaseX;
  const anchorWrapperY = container.scrollTop + localY - wrapperBaseY;

  // --- Phase 1: Smooth CSS scale preview ---
  // This transform gives instant visual feedback while new content renders.
  if (animatePreview) {
    activeWrapper.classList.add("zoom-animating");
    activeWrapper.style.transformOrigin = `${anchorWrapperX}px ${anchorWrapperY}px`;
    activeWrapper.style.transform = `scale(${zoomRatio})`;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }

  currentScale = newScale;
  updateZoomIndicator();

  // --- Phase 2: Render new content into a DETACHED element ---
  // The old wrapper (with CSS scale transform) stays visible in the DOM.
  // The new wrapper is rendered completely off-DOM, so no layout interference.
  zoomDeferInsert = true;
  let newWrapper;
  try {
    newWrapper = await renderPage(currentPageNum);
  } finally {
    zoomDeferInsert = false;
  }

  if (newWrapper === activeWrapper || !newWrapper) {
    // Stale request — clean up preview
    activeWrapper.classList.remove("zoom-animating");
    activeWrapper.style.transform = "";
    activeWrapper.style.transformOrigin = "";
    updateCenteringAndOverflow();
    return;
  }

  // --- Phase 3: Atomic swap ---
  // All DOM mutations below are synchronous. The browser will NOT paint until
  // this synchronous block finishes, so the user sees a single-frame swap.

  // Save old visual state WITH preview transform still applied!
  // This perfectly captures the visual box the user sees on screen.
  const oldVisualRect = activeWrapper.getBoundingClientRect();

  // Remove CSS preview classes/styles from old wrapper (it's about to be replaced).
  activeWrapper.classList.remove("zoom-animating");
  activeWrapper.style.transform = "";
  activeWrapper.style.transformOrigin = "";

  // Swap: remove old, insert new.
  activeWrapper.replaceWith(newWrapper);
  canvasWrapper = newWrapper; // Update global reference

  // Update centering/overflow classes BEFORE measuring (affects layout).
  updateCenteringAndOverflow();

  // Force layout so we can measure the new wrapper's position.
  const freshRect = container.getBoundingClientRect();
  const newWrapperRectBeforeScroll = newWrapper.getBoundingClientRect();
  const newBaseX =
    container.scrollLeft + (newWrapperRectBeforeScroll.left - freshRect.left);
  const newBaseY =
    container.scrollTop + (newWrapperRectBeforeScroll.top - freshRect.top);

  // Compute target scroll to keep the anchor point stable.
  const targetScrollX = newBaseX + anchorWrapperX * zoomRatio - localX;
  const targetScrollY = newBaseY + anchorWrapperY * zoomRatio - localY;

  const maxScrollX = Math.max(0, newWrapper.scrollWidth - containerWidth);
  const maxScrollY = Math.max(0, newWrapper.scrollHeight - containerHeight);
  const clampedTargetX = Math.min(Math.max(0, targetScrollX), maxScrollX);
  const clampedTargetY = Math.min(Math.max(0, targetScrollY), maxScrollY);

  container.scrollLeft = clampedTargetX;
  container.scrollTop = clampedTargetY;

  // The new scroll is set. Calculate where the new wrapper actually landed on screen.
  const newRect = newWrapper.getBoundingClientRect();

  // How much it shifted on screen compared to the visual preview
  const tx = oldVisualRect.left - newRect.left;
  const ty = oldVisualRect.top - newRect.top;

  // In theory the scale should be exactly 1, but we calculate it to ensure perfect overlap
  const scaleX = oldVisualRect.width / (newRect.width || 1);
  const scaleY = oldVisualRect.height / (newRect.height || 1);

  // If there is ANY layout shift (e.g. snapping to center, clamping), glide it!
  // We animate on both zoom-in and zoom-out to ensure layout shifts are smooth.
  if (Math.abs(tx) > 1 || Math.abs(ty) > 1 || Math.abs(scaleX - 1) > 0.01) {
    // "Invert": stretch and move the new wrapper back to exactly cover the visual preview
    newWrapper.style.transition = "none";
    newWrapper.style.transformOrigin = "0 0";
    newWrapper.style.transform = `translate(${tx}px, ${ty}px) scale(${scaleX}, ${scaleY})`;

    // Force browser to recalculate styles before starting transition
    newWrapper.getBoundingClientRect();

    // "Play": smoothly glide to its natural layout position (snapped/centered)
    newWrapper.style.transition = `transform ${ZOOM_SCROLL_SMOOTH_DURATION_MS}ms cubic-bezier(0.2, 0.8, 0.2, 1)`;
    newWrapper.style.transform = `translate(0px, 0px) scale(1)`;

    setTimeout(() => {
      newWrapper.style.transition = "";
      newWrapper.style.transform = "";
      newWrapper.style.transformOrigin = "";
    }, ZOOM_SCROLL_SMOOTH_DURATION_MS);
  }

  // All synchronous — browser paints this as one frame. Done.
  updateCenteringAndOverflow();
}

function onZoomIndicatorTouchEnd(event) {
  if (!document.body.classList.contains("viewer-active") || !pdfDoc) return;
  event.preventDefault();
  event.stopPropagation();

  const now = Date.now();
  const currentEl = event.currentTarget;
  const isSecondTap =
    currentEl === lastIndicatorTapEl &&
    now - lastIndicatorTapAt <= INDICATOR_DOUBLE_TAP_DELAY;
  lastIndicatorTapAt = now;
  lastIndicatorTapEl = currentEl;

  if (!isSecondTap) return;

  const rect = pdfViewerContent.getBoundingClientRect();
  const anchorClientX = rect.left + pdfViewerContent.clientWidth / 2;
  const anchorClientY = rect.top + pdfViewerContent.clientHeight / 2;
  lastIndicatorTapAt = 0;
  lastIndicatorTapEl = null;
  resetZoomToDefault(anchorClientX, anchorClientY);
}

function onZoomIndicatorDoubleClick(event) {
  if (!document.body.classList.contains("viewer-active") || !pdfDoc) return;
  event.preventDefault();
  event.stopPropagation();

  const rect = pdfViewerContent.getBoundingClientRect();
  const anchorClientX = rect.left + pdfViewerContent.clientWidth / 2;
  const anchorClientY = rect.top + pdfViewerContent.clientHeight / 2;
  resetZoomToDefault(anchorClientX, anchorClientY);
}

function onToggleViewMode() {
  if (!pdfDoc || pdfDoc.numPages <= 1) return;
  currentViewMode = currentViewMode === "single" ? "double" : "single";
  currentScrollMode = "horizontal";
  currentScale = "page-fit";
  updateViewerUI();
  animateViewChange(() => renderPage(currentPageNum));
}

function onToggleScrollMode() {
  if (!pdfDoc || pdfDoc.numPages <= 1) return;
  currentScrollMode =
    currentScrollMode === "horizontal" ? "vertical" : "horizontal";
  if (currentScrollMode === "vertical") {
    currentViewMode = "single";
  }
  currentScale = "page-fit";
  updateViewerUI();
  animateViewChange(() => renderPage(currentPageNum));
}

async function onPrevSong(forceAutoplay = false, allowRewind = false) {
  if (forceAutoplay === true) {
    window._forceAutoPlayNext = true;
  }
  // Mark as manual navigation so openPdfViewer skips fade-out
  window._manualNavigation = true;

  // Seek to 0 logic
  if (
    allowRewind &&
    typeof MidiEngine !== 'undefined' &&
    MidiEngine.getCurrentMidiUrl()
  ) {
    const currTime = MidiEngine.getTime();
    if (currTime > 2) {
      try {
        MidiEngine.seek(0);
        MidiEngine.play();
        if (forceAutoplay) {
          const playIcon = document.getElementById('custom-play-icon');
          if (playIcon) playIcon.textContent = 'pause';
          const midiPlayerEl = document.getElementById('custom-midi-player');
          if (midiPlayerEl) midiPlayerEl.classList.add('playing');
        }
      } catch (e) {}
      return;
    }
  }

  let mode = _resolveEffectiveAutoNextMode({ autoFix: true, showToast: true });

  if (mode === 'shuffle-playlist') {
    const activeId = PlaylistManager.getActiveId();
    if (activeId) {
      const pl = PlaylistManager.getById(activeId);
      if (pl && pl.songs.length > 0) {
        // Previous in shuffle: go back in history if available
        if (shuffleHistory.length > 0) {
          const prev = shuffleHistory.pop();
          await openPdfViewer(prev.globalIdx, !document.body.classList.contains('viewer-active'));
          return;
        }
        // No history: fallback to random
        const nextIdx = Math.floor(Math.random() * pl.songs.length);
        if (typeof playSongFromPlaylist === 'function') {
          _pushShuffleHistory();
          await playSongFromPlaylist(nextIdx, !document.body.classList.contains('viewer-active'), activeId);
          return;
        }
      } else {
        // Empty playlist: auto-switch to global shuffle
        if (typeof setNextMode === 'function') setNextMode('shuffle-all');
        if (typeof showToast === 'function') showToast('Playlist kosong, beralih ke Shuffle Semua', 'info');
        mode = 'shuffle-all';
      }
    }
    if (mode !== 'shuffle-all') mode = 'shuffle-all';
  }

  if (mode === 'shuffle-all') {
    if (typeof pujianItems !== 'undefined' && pujianItems.length > 0) {
      // Previous in shuffle: go back in history if available
      if (shuffleHistory.length > 0) {
        const prev = shuffleHistory.pop();
        await openPdfViewer(prev.globalIdx, !document.body.classList.contains('viewer-active'));
        return;
      }
      // No history: fallback to random
      const nextIdx = Math.floor(Math.random() * pujianItems.length);
      _pushShuffleHistory();
      await openPdfViewer(nextIdx, !document.body.classList.contains('viewer-active'));
      return;
    }
  }

  if (mode === 'playlist') {
    const activeId = PlaylistManager.getActiveId();
    if (activeId) {
      const pl = PlaylistManager.getById(activeId);
      if (pl && typeof pujianItems !== 'undefined' && currentSongIndex >= 0) {
        const currentGlobalSong = pujianItems[currentSongIndex];
        let currentIdxInPl = pl.songs.findIndex((s) => s.nomor === currentGlobalSong.nomor);

        if (currentIdxInPl < 0) {
          if (typeof showToast === 'function') showToast('Lagu aktif tidak di playlist, beralih ke Sesuai Nomor', 'info');
          if (typeof setNextMode === 'function') setNextMode('number');
          mode = 'number';
        } else if (currentIdxInPl > 0) {
          if (typeof playSongFromPlaylist === 'function') {
            await playSongFromPlaylist(currentIdxInPl - 1, !document.body.classList.contains('viewer-active'), activeId);
            return;
          }
        } else if (currentIdxInPl === 0) {
          if (typeof playSongFromPlaylist === 'function' && pl.songs.length > 0) {
            await playSongFromPlaylist(pl.songs.length - 1, !document.body.classList.contains('viewer-active'), activeId);
            return;
          }
        }
      }
    }
  }

  if (mode === 'number' || mode === 'off' || mode === 'one') {
    if (currentSongIndex > 0) {
      await openPdfViewer(currentSongIndex - 1, !document.body.classList.contains('viewer-active'));
    } else if (currentSongIndex === 0) {
      if (typeof pujianItems !== 'undefined' && pujianItems.length > 0) {
        await openPdfViewer(pujianItems.length - 1, !document.body.classList.contains('viewer-active'));
      }
    }
  }
}

async function onNextSong(forceAutoplay = false) {
  if (forceAutoplay === true) {
    window._forceAutoPlayNext = true;
  }
  // Mark as manual navigation so openPdfViewer skips fade-out
  window._manualNavigation = true;

  let mode = _resolveEffectiveAutoNextMode({ autoFix: true, showToast: true });

  if (mode === 'shuffle-playlist') {
    const activeId = PlaylistManager.getActiveId();
    if (activeId) {
      const pl = PlaylistManager.getById(activeId);
      if (pl && pl.songs.length > 0) {
        // Use predetermined index; fallback to random if not set
        const nextIdx = shuffleNextPlaylistIdx >= 0 && shuffleNextPlaylistIdx < pl.songs.length
          ? shuffleNextPlaylistIdx
          : Math.floor(Math.random() * pl.songs.length);
        shuffleNextPlaylistIdx = -1; // consumed
        if (typeof playSongFromPlaylist === 'function') {
          _pushShuffleHistory();
          await playSongFromPlaylist(nextIdx, !document.body.classList.contains('viewer-active'), activeId);
          return;
        }
      } else {
        // Empty playlist: auto-switch to global shuffle
        if (typeof setNextMode === 'function') setNextMode('shuffle-all');
        if (typeof showToast === 'function') showToast('Playlist kosong, beralih ke Shuffle Semua', 'info');
        mode = 'shuffle-all';
      }
    }
    if (mode !== 'shuffle-all') mode = 'shuffle-all';
  }

  if (mode === 'shuffle-all') {
    if (typeof pujianItems !== 'undefined' && pujianItems.length > 0) {
      // Use predetermined index; fallback to random if not set
      const nextIdx = shuffleNextGlobalIdx >= 0 && shuffleNextGlobalIdx < pujianItems.length
        ? shuffleNextGlobalIdx
        : Math.floor(Math.random() * pujianItems.length);
      shuffleNextGlobalIdx = -1; // consumed
      _pushShuffleHistory();
      await openPdfViewer(nextIdx, !document.body.classList.contains('viewer-active'));
      return;
    }
  }

  if (mode === 'playlist') {
    const activeId = PlaylistManager.getActiveId();
    if (activeId) {
      const pl = PlaylistManager.getById(activeId);
      if (pl && typeof pujianItems !== 'undefined' && currentSongIndex >= 0) {
        const currentGlobalSong = pujianItems[currentSongIndex];
        let currentIdxInPl = pl.songs.findIndex((s) => s.nomor === currentGlobalSong.nomor);

        if (currentIdxInPl < 0) {
          if (typeof showToast === 'function') showToast('Lagu aktif tidak di playlist, beralih ke Sesuai Nomor', 'info');
          if (typeof setNextMode === 'function') setNextMode('number');
          mode = 'number';
        } else if (currentIdxInPl >= 0 && currentIdxInPl < pl.songs.length - 1) {
          if (typeof playSongFromPlaylist === 'function') {
            await playSongFromPlaylist(currentIdxInPl + 1, !document.body.classList.contains('viewer-active'), activeId);
            return;
          }
        } else if (currentIdxInPl === pl.songs.length - 1) {
          // Wrapped to beginning
          if (typeof playSongFromPlaylist === 'function' && pl.songs.length > 0) {
            await playSongFromPlaylist(0, !document.body.classList.contains('viewer-active'), activeId);
            return;
          }
        }
      }
    }
  }

  if (mode === 'number' || mode === 'off' || mode === 'one') {
    if (currentSongIndex < pujianItems.length - 1) {
      await openPdfViewer(currentSongIndex + 1, !document.body.classList.contains('viewer-active'));
    } else if (typeof pujianItems !== 'undefined' && currentSongIndex === pujianItems.length - 1) {
      // Wrapped to beginning
      await openPdfViewer(0, !document.body.classList.contains('viewer-active'));
    }
  }
}

function updateViewerUI() {
  const multiPage = pdfDoc && pdfDoc.numPages > 1;
  const singlePage = !pdfDoc || pdfDoc.numPages <= 1;
  const isVertical = currentScrollMode === "vertical";
  const hasPageNav = !(singlePage || isVertical);

  const viewButtons = [viewModeBtnPortrait, viewModeBtnLandscape];
  const scrollButtons = [scrollModeBtnPortrait, scrollModeBtnLandscape];

  viewButtons.forEach((btn) => {
    btn.style.display = multiPage ? "flex" : "none";
    btn.classList.toggle("active", currentViewMode === "double");
  });

  scrollButtons.forEach((btn) => {
    btn.style.display = multiPage ? "flex" : "none";
    btn.classList.toggle("active", currentScrollMode === "vertical");
  });

  pageNavigationPortrait.style.display = hasPageNav ? "flex" : "none";
  pageNavigationLandscape.style.display = hasPageNav ? "flex" : "none";
  if (pdfViewerFooter) {
    pdfViewerFooter.classList.toggle("has-page-nav", hasPageNav);
    pdfViewerFooter.classList.toggle("no-page-nav", !hasPageNav);
    pdfViewerFooter.classList.toggle("no-view-controls", !multiPage);
  }

  checkOrientation();
  updateChordEditorUI();
  updateTransposeUI();
  // Re-check layout collisions whenever button visibility changes so the
  // transpose control correctly collapses/expands in the header.
  if (typeof scheduleLayoutCollisionCheck === 'function') {
    scheduleLayoutCollisionCheck();
  } else if (typeof checkLayoutCollisions === 'function') {
    checkLayoutCollisions();
  }
}

/**
 * Transpose requests are processed with latest-wins behavior in MidiEngine.
 * Rapid repeated changes are allowed and stale renders are discarded.
 */

// ─── Shuffle Predetermination ─────────────────────────────────────────────────
/**
 * Pick the next song index for shuffle modes and store it in state so the UI
 * can show "Pujian berikutnya: ..." and the audio engine can pre-render it.
 * Called every time a new song finishes loading.
 */
function _resolveEffectiveAutoNextMode(options) {
  options = options || {};
  const mode = typeof PlaylistManager !== 'undefined' ? PlaylistManager.getAutoNextMode() : 'number';
  if (mode !== 'shuffle-playlist') return mode;

  const activeId = typeof PlaylistManager !== 'undefined' ? PlaylistManager.getActiveId() : null;
  const pl = activeId ? PlaylistManager.getById(activeId) : null;
  if (pl && pl.songs.length > 0) return mode;

  if (options.autoFix && typeof setNextMode === 'function') {
    setNextMode('shuffle-all', {
      silentToast: options.silentToast === true,
      skipShuffleRefresh: options.skipShuffleRefresh === true
    });
  } else if (options.autoFix && typeof PlaylistManager !== 'undefined') {
    PlaylistManager.setAutoNextMode('shuffle-all');
  }

  if (options.showToast && typeof showToast === 'function') {
    showToast('Playlist shuffle tidak punya antrean, beralih ke Shuffle Semua', 'info');
  }

  return 'shuffle-all';
}

function _determineNextShuffleSong() {
  const mode = _resolveEffectiveAutoNextMode({ autoFix: true, showToast: false, silentToast: true, skipShuffleRefresh: true });

  if (mode === 'shuffle-all') {
    if (typeof pujianItems !== 'undefined' && pujianItems.length > 1) {
      let next;
      do { next = Math.floor(Math.random() * pujianItems.length); }
      while (next === currentSongIndex && pujianItems.length > 1);
      shuffleNextGlobalIdx = next;
      shuffleNextPlaylistIdx = -1;
    }
  } else if (mode === 'shuffle-playlist') {
    const activeId = typeof PlaylistManager !== 'undefined' ? PlaylistManager.getActiveId() : null;
    const pl = activeId ? PlaylistManager.getById(activeId) : null;
    if (pl && pl.songs.length > 1) {
      const currentGlobalSong = pujianItems[currentSongIndex];
      let currentIdxInPl = pl.songs.findIndex(s => s.nomor === currentGlobalSong?.nomor);
      let next;
      do { next = Math.floor(Math.random() * pl.songs.length); }
      while (next === currentIdxInPl && pl.songs.length > 1);
      shuffleNextPlaylistIdx = next;
      shuffleNextGlobalIdx = -1;
    } else {
      // No active playlist or empty/1-song playlist: auto-switch to global shuffle.
      if (typeof setNextMode === 'function') setNextMode('shuffle-all', { silentToast: true, skipShuffleRefresh: true });
      _determineNextShuffleSong();
      return;
    }
  } else {
    // Non-shuffle mode: clear shuffle state
    shuffleNextGlobalIdx = -1;
    shuffleNextPlaylistIdx = -1;
  }

  // Sync UI to show the new "next song" label
  if (typeof syncMiniPlayerUI === 'function') syncMiniPlayerUI();
}

/**
 * Push current song onto shuffle history before navigating away.
 */
function _pushShuffleHistory() {
  if (typeof currentSongIndex !== 'number' || currentSongIndex < 0) return;
  shuffleHistory.push({ globalIdx: currentSongIndex });
  if (shuffleHistory.length > SHUFFLE_HISTORY_MAX) {
    shuffleHistory.shift();
  }
}

/**
 * Get the MIDI URL for a song by computing it from the fileHref.
 */
function _getMidiUrlForSong(song) {
  if (!song || !song.fileHref) return null;
  return song.fileHref.replace(/\/pdf\//i, "/midi/").replace(/\.pdf$/i, ".mid");
}

/**
 * Get neighboring songs (before and after current) for a given navigation mode.
 * Returns { before: Song[], after: Song[] }
 */
function _getNeighborSongs(count) {
  const mode = _resolveEffectiveAutoNextMode({ autoFix: false, showToast: false });
  const before = [];
  const after = [];

  function pushUnique(list, song) {
    if (!song) return;
    if (typeof currentSongIndex === 'number' && pujianItems[currentSongIndex] === song) return;
    if (list.indexOf(song) !== -1) return;
    list.push(song);
  }

  if (mode === 'shuffle-all' || mode === 'shuffle-playlist') {
    // For shuffle modes, we can only preload the predetermined next song
    // and the last song from shuffle history (if shuffle preload enabled)
    if (!prefs.preloadShuffle) return { before: before, after: after };

    if (mode === 'shuffle-all' && shuffleNextGlobalIdx >= 0) {
      const ns = pujianItems[shuffleNextGlobalIdx];
      pushUnique(after, ns);
    } else if (mode === 'shuffle-playlist' && shuffleNextPlaylistIdx >= 0) {
      const pl = typeof PlaylistManager !== 'undefined' ? PlaylistManager.getById(PlaylistManager.getActiveId()) : null;
      if (pl) {
        const ns = pujianItems.find(function(s) { return s.nomor === (pl.songs[shuffleNextPlaylistIdx] || {}).nomor; });
        pushUnique(after, ns);
      }
    }
    // Previous from shuffle history
    for (var hi = shuffleHistory.length - 1; hi >= 0 && before.length < count; hi--) {
      var ps = pujianItems[shuffleHistory[hi].globalIdx];
      pushUnique(before, ps);
    }
    return { before: before, after: after };
  }

  if (mode === 'playlist') {
    const activeId = typeof PlaylistManager !== 'undefined' ? PlaylistManager.getActiveId() : null;
    const pl = activeId ? PlaylistManager.getById(activeId) : null;
    if (pl && typeof currentSongIndex === 'number') {
      const currentGlobalSong = pujianItems[currentSongIndex];
      const idxInPl = pl.songs.findIndex(function(s) { return s.nomor === (currentGlobalSong || {}).nomor; });
      if (idxInPl >= 0) {
        for (var ai = 1; ai <= count; ai++) {
          var ni = (idxInPl + ai) % pl.songs.length;
          var ns = pujianItems.find(function(s) { return s.nomor === (pl.songs[ni] || {}).nomor; });
          pushUnique(after, ns);
        }
        for (var bi = 1; bi <= count; bi++) {
          var pi = (idxInPl - bi + pl.songs.length) % pl.songs.length;
          var ps = pujianItems.find(function(s) { return s.nomor === (pl.songs[pi] || {}).nomor; });
          pushUnique(before, ps);
        }
      }
    }
    return { before: before, after: after };
  }

  // mode === 'number' or 'off' or 'one' — circular sequential preload to match wrap-around navigation.
  if (typeof currentSongIndex === 'number' && pujianItems.length > 1) {
    for (var ai = 1; ai <= count; ai++) {
      pushUnique(after, pujianItems[(currentSongIndex + ai) % pujianItems.length]);
    }
    for (var bi = 1; bi <= count; bi++) {
      pushUnique(before, pujianItems[(currentSongIndex - bi + pujianItems.length) % pujianItems.length]);
    }
  }
  return { before: before, after: after };
}

// Cache computed default preload transpose per PDF URL.
// Value: -1 or 0, based on detected PDF key and current preference.
const _preloadTransposeByPdfHref = new Map();
const _tempoByPdfHref = new Map();

function _extractPdfKeyFromText(pdfText) {
  if (!pdfText) return null;
  const keyMatch = pdfText.match(
    /(?:(?:do|la)\s*={1,2}\s*|[23469]\s*[\/|]\s*[248]\s+)([A-G](?:es|is|s|#|b)?(?:m)?)\b/i,
  );
  return keyMatch ? keyMatch[1] : null;
}

function _normalizeDetectedTempoBpm(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return MIDI_TEMPO_FALLBACK_BPM;
  const rounded = Math.round(parsed);
  return Math.max(MIDI_TEMPO_MIN_BPM, Math.min(MIDI_TEMPO_MAX_BPM, rounded));
}

function _extractPdfTempoFromText(pdfText) {
  if (!pdfText) return MIDI_TEMPO_FALLBACK_BPM;
  const normalized = String(pdfText).replace(/\s+/g, " ").trim();

  const symbolMatch = normalized.match(/(?:^|[\s(])(?:J|j|Q|q|♩|♪|𝅘𝅥|𝅘𝅥𝅮)\s*[:=]\s*(\d{2,3})(?=\D|$)/);
  if (symbolMatch) return _normalizeDetectedTempoBpm(symbolMatch[1]);

  const bpmLabelMatch = normalized.match(/(?:tempo|tempi|bpm)\s*[:=]?\s*(\d{2,3})\b/i);
  if (bpmLabelMatch) return _normalizeDetectedTempoBpm(bpmLabelMatch[1]);

  const looseTempoMatch = normalized.match(/(?:^|[^0-9A-Za-z])=\s*(\d{2,3})\b/);
  if (looseTempoMatch) return _normalizeDetectedTempoBpm(looseTempoMatch[1]);

  return MIDI_TEMPO_FALLBACK_BPM;
}

function _getSongTargetTempoBpm(song) {
  if (!song || !song.fileHref) return MIDI_TEMPO_FALLBACK_BPM;
  return _tempoByPdfHref.get(song.fileHref) || MIDI_TEMPO_FALLBACK_BPM;
}

function _detectPreloadTransposeFromPdfText(pdfText) {
  const pdfKey = _extractPdfKeyFromText(pdfText);
  if (!pdfKey || typeof parsePdfKeyToSemitone !== 'function') return 0;
  const pdfSemi = parsePdfKeyToSemitone(pdfKey);
  return (pdfSemi !== null && _isBlackKeySemitone(pdfSemi)) ? -1 : 0;
}

async function _resolveSongTempoForLoad(song, loadingTask) {
  if (!song || !song.fileHref) return MIDI_TEMPO_FALLBACK_BPM;

  const cachedTempo = _tempoByPdfHref.get(song.fileHref);
  const hasCachedTranspose = _preloadTransposeByPdfHref.has(song.fileHref);
  if (Number.isFinite(cachedTempo) && hasCachedTranspose) return cachedTempo;

  if (!loadingTask) {
    if (!hasCachedTranspose) {
      _preloadTransposeByPdfHref.set(song.fileHref, 0);
    }
    return Number.isFinite(cachedTempo) ? cachedTempo : MIDI_TEMPO_FALLBACK_BPM;
  }

  try {
    const doc = await loadingTask.promise;
    const page1 = await doc.getPage(1);
    const textContent = await page1.getTextContent();
    const pdfText = textContent.items.map(function (item) { return item.str; }).join(" ");

    const detectedTempo = _extractPdfTempoFromText(pdfText);
    const detectedTranspose = _detectPreloadTransposeFromPdfText(pdfText);

    _tempoByPdfHref.set(song.fileHref, detectedTempo);
    _preloadTransposeByPdfHref.set(song.fileHref, detectedTranspose);

    return detectedTempo;
  } catch (_err) {
    _tempoByPdfHref.set(song.fileHref, MIDI_TEMPO_FALLBACK_BPM);
    if (!_preloadTransposeByPdfHref.has(song.fileHref)) {
      _preloadTransposeByPdfHref.set(song.fileHref, 0);
    }
    return MIDI_TEMPO_FALLBACK_BPM;
  }
}

function _isBlackKeySemitone(semi) {
  return semi === 1 || semi === 3 || semi === 6 || semi === 8 || semi === 10;
}

async function _inferSongDefaultPreloadTranspose(song) {
  if (!song || !song.fileHref) return 0;

  // If natural-chord preference is disabled, always preload neutral transpose.
  if (!prefs || prefs.preferNaturalChords !== true) return 0;

  const pdfHref = song.fileHref;
  if (_preloadTransposeByPdfHref.has(pdfHref)) {
    return _preloadTransposeByPdfHref.get(pdfHref);
  }

  try {
    if (typeof pdfjsLib === 'undefined' || !pdfjsLib.getDocument) {
      if (!_preloadTransposeByPdfHref.has(pdfHref)) {
        _preloadTransposeByPdfHref.set(pdfHref, 0);
      }
      return _preloadTransposeByPdfHref.get(pdfHref) || 0;
    }

    const loadingTask = pdfjsLib.getDocument({
      url: pdfHref,
      standardFontDataUrl: "https://mozilla.github.io/pdf.js/standard_fonts/",
    });
    const doc = await loadingTask.promise;
    const page1 = await doc.getPage(1);
    const textContent = await page1.getTextContent();
    const pdfText = textContent.items.map(function (item) { return item.str; }).join(" ");

    _tempoByPdfHref.set(pdfHref, _extractPdfTempoFromText(pdfText));

    const preloadTranspose = _detectPreloadTransposeFromPdfText(pdfText);
    _preloadTransposeByPdfHref.set(pdfHref, preloadTranspose);
    return preloadTranspose;
  } catch (_err) {
    if (!_preloadTransposeByPdfHref.has(pdfHref)) {
      _preloadTransposeByPdfHref.set(pdfHref, 0);
    }
    return _preloadTransposeByPdfHref.get(pdfHref) || 0;
  }
}

function _getSongTargetTranspose(song) {
  if (!song || !song.fileHref) return 0;
  if (!prefs || prefs.preferNaturalChords !== true) return 0;
  return _preloadTransposeByPdfHref.get(song.fileHref) || 0;
}

function _resolveLoadTranspose(song, midiUrl, instrumentValue) {
  var preferred = _getSongTargetTranspose(song);
  if (!prefs || prefs.preferNaturalChords !== true) return 0;
  // Always load the song's preferred default profile; preload should match this
  // exact transpose instead of reusing alternate cached variants.
  return preferred;
}

/**
 * Preload neighboring songs' MIDI + PDF in the background to make
 * transitions instant. Called after a song finishes loading.
 * Respects prefs.preloadEnabled, prefs.preloadCount, prefs.preloadShuffle.
 */
function _preloadNextSong() {
  if (typeof MidiEngine === 'undefined') return;
  if (typeof prefs !== 'undefined' && !prefs.preloadEnabled) {
    console.log('[Preload] Preload disabled in settings');
    return;
  }

  const count = (typeof prefs !== 'undefined' && prefs.preloadCount) ? prefs.preloadCount : 1;
  let instrumentValue = -1;
  if (typeof prefs !== 'undefined' && prefs.midiInstrument !== undefined) {
    instrumentValue = parseInt(prefs.midiInstrument, 10);
  }

  const neighbors = _getNeighborSongs(count);
  const allSongs = neighbors.after.concat(neighbors.before);

  if (allSongs.length === 0) {
    console.log('[Preload] No neighbor songs to preload (mode=' +
      (typeof PlaylistManager !== 'undefined' ? PlaylistManager.getAutoNextMode() : '?') + ')');
    return;
  }

  console.log('[Preload] Inspecting', allSongs.length, 'neighbors for cache/queue:',
    allSongs.map(function(s) { return s ? s.judul : '?'; }).join(', '));

  function queueNeighborSong(song) {
    if (!song) return;

    if (song.fileHref) {
      _prefetchPdf(song.fileHref);
    }

    const midiUrl = _getMidiUrlForSong(song);
    if (!midiUrl) return;
    if (MidiEngine.getCurrentMidiUrl() === midiUrl) {
      console.log('[Preload] Skip current song neighbor:', song.judul);
      return;
    }

    const instForCheck = instrumentValue >= 0 ? instrumentValue : -1;
    const hadCachedTranspose = !!(song.fileHref && _preloadTransposeByPdfHref.has(song.fileHref));
    const initialTranspose = _getSongTargetTranspose(song);
    const naturalChordsEnabled = !!(prefs && prefs.preferNaturalChords === true);

    function queueWithTranspose(preloadTranspose, logPrefix) {
      if (MidiEngine.hasPreloaded(midiUrl, preloadTranspose, instForCheck)) {
        console.log('[Preload] Neighbor already cached (exact):', song.judul,
          'transpose=' + preloadTranspose,
          'instrument=' + instForCheck);
        return;
      }

      console.log(logPrefix, song.judul,
        'transpose=' + preloadTranspose,
        'instrument=' + instForCheck);

      MidiEngine.preload(midiUrl, {
        transpose: preloadTranspose,
        instrument: instrumentValue >= 0 ? instrumentValue : undefined,
        source: 'neighbor-preload',
        sourceLabel: song.judul
      });
    }

    // If we already know this song's transpose profile (or natural-chord mode is
    // disabled), queue immediately with the resolved target.
    if (hadCachedTranspose || !naturalChordsEnabled) {
      queueWithTranspose(initialTranspose, '[Preload] Queue neighbor');
      return;
    }

    // Unknown transpose profile: register inference first, then queue fallback
    // on the next microtask. Already-resolved inference wins with a single
    // exact queue; unresolved inference gets a fast fallback queue.
    let fallbackQueued = false;
    let settled = false;

    const inferPromise = _inferSongDefaultPreloadTranspose(song);

    inferPromise.then(function(resolvedTranspose) {
      settled = true;

      if (!fallbackQueued) {
        queueWithTranspose(resolvedTranspose, '[Preload] Queue neighbor');
        return;
      }

      if (resolvedTranspose !== initialTranspose) {
        queueWithTranspose(resolvedTranspose, '[Preload] Queue neighbor (resolved transpose)');
      }
    }).catch(function() {
      settled = true;

      if (!fallbackQueued) {
        queueWithTranspose(initialTranspose, '[Preload] Queue neighbor (fallback transpose)');
      }
    });

    Promise.resolve().then(function() {
      if (settled) return;
      fallbackQueued = true;
      queueWithTranspose(initialTranspose, '[Preload] Queue neighbor (fallback pending transpose)');
    });
  }

  // Prioritize "after" songs first so next-song navigation gets cache warmed
  // before less-likely "before" neighbors.
  for (let i = 0; i < neighbors.after.length; i += 1) {
    queueNeighborSong(neighbors.after[i]);
  }
  for (let i = 0; i < neighbors.before.length; i += 1) {
    queueNeighborSong(neighbors.before[i]);
  }
}

/**
 * Prefetch a PDF file into browser cache for instant loading.
 */
const _prefetchedPdfs = new Set();
function _prefetchPdf(url) {
  if (_prefetchedPdfs.has(url)) return;
  _prefetchedPdfs.add(url);
  // Use low-priority fetch to avoid blocking current loading
  fetch(url, { priority: 'low' }).catch(function() {
    _prefetchedPdfs.delete(url);
  });
}

async function swapTranspose(step) {
  if (typeof MidiEngine === 'undefined' || !MidiEngine.getCurrentMidiUrl()) return;

  try {
    await MidiEngine.setTranspose(step);
  } catch (err) {
    console.warn('Failed to swap transpose:', err);
  }
  syncSeekbarUI(MidiEngine.getTime(), MidiEngine.getDuration());
  window._midiLastSeekValue = -1;
}

/**
 * Instrument change — re-render with new instrument program.
 * Uses MidiEngine's offline re-rendering + swap.
 */
async function changeInstrument() {
  if (typeof MidiEngine === 'undefined' || !MidiEngine.getCurrentMidiUrl()) return;

  // Resolve instrument
  let instrumentValue = -1;
  if (prefs && prefs.midiInstrument !== undefined) {
    instrumentValue = parseInt(prefs.midiInstrument, 10);
  } else if (customInstrumentSelect && customInstrumentSelect.dataset.value) {
    instrumentValue = parseInt(customInstrumentSelect.dataset.value, 10);
  }

  if (midiPreloadBar) {
    midiPreloadBar.style.display = "block";
    midiPreloadFill.style.width = "0%";
  }

  try {
    await MidiEngine.setInstrument(instrumentValue >= 0 ? instrumentValue : undefined);
  } catch (err) {
    console.warn("Failed to change instrument:", err);
  }

  if (midiPreloadFill) midiPreloadFill.style.width = "100%";
  setTimeout(function () {
    if (midiPreloadBar) midiPreloadBar.style.display = "none";
  }, 300);

  syncSeekbarUI(MidiEngine.getTime(), MidiEngine.getDuration());
  window.isMidiSwitching = false;

  // Instrument changes alter preload cache keys (url|transpose|instrument).
  // Refresh neighbor preloads so next/prev navigation can hit exact-key cache.
  if (typeof _preloadNextSong === 'function') {
    _preloadNextSong();
  }
}

/**
 * Force-update all seekbar UI elements to known-good values.
 * Called during transitions to prevent stale data from the interval.
 */
function syncSeekbarUI(time, duration) {
  const dur = duration || 0;
  const t = Math.max(0, time || 0);
  const pct = dur > 0 ? (t / dur) * 100 + "%" : "0%";
  const toDisplaySeconds =
    typeof toMidiDisplaySeconds === "function"
      ? toMidiDisplaySeconds
      : function (seconds) {
          return Math.max(0, Number(seconds) || 0);
        };
  const displayDur = toDisplaySeconds(dur);
  const displayTime = Math.min(displayDur || 0, toDisplaySeconds(t));

  if (typeof customSeekbar !== "undefined" && customSeekbar) {
    if (dur > 0 && customSeekbar.max != dur) customSeekbar.max = dur;
    customSeekbar.value = t;
    const fill = document.getElementById("custom-seekbar-fill");
    if (fill) fill.style.width = pct;
  }
  if (typeof customTimeDisplay !== "undefined" && customTimeDisplay) {
    customTimeDisplay.textContent = `${formatMidiTime(displayTime)} / ${displayDur > 0 ? formatMidiTime(displayDur) : "0:00"}`;
  }

  // Mini player UI sync
  const miniSeekbar = document.getElementById("mini-seekbar");
  if (miniSeekbar) {
    if (dur > 0 && miniSeekbar.max != dur) miniSeekbar.max = dur;
    miniSeekbar.value = t;
    const miniFill = document.getElementById("mini-seekbar-fill");
    if (miniFill) miniFill.style.width = pct;
  }
  const miniTimeDisplay = document.getElementById("mini-time-display");
  if (miniTimeDisplay) {
    miniTimeDisplay.textContent = `${formatMidiTime(displayTime)} / ${displayDur > 0 ? formatMidiTime(displayDur) : "0:00"}`;
  }
}
;

/* SOURCE: 08-chord-logic.js */
// --- 7. Chord Overlay Logic ---
const DEFAULT_CHORD_GRID = { cols: 10, rows: 16 };

function createDefaultChordConfig() {
  return {
    version: 1,
    grid: { ...DEFAULT_CHORD_GRID },
    pages: {}
  };
}

function sanitizeChordConfig(rawConfig) {
  const safe = createDefaultChordConfig();
  if (!rawConfig || typeof rawConfig !== "object") return safe;

  if (rawConfig.grid && Number.isFinite(rawConfig.grid.cols) && Number.isFinite(rawConfig.grid.rows)) {
    safe.grid.cols = Math.max(1, Math.round(rawConfig.grid.cols));
    safe.grid.rows = Math.max(1, Math.round(rawConfig.grid.rows));
  }

  if (rawConfig.pages && typeof rawConfig.pages === "object") {
    Object.entries(rawConfig.pages).forEach(([pageKey, entries]) => {
      if (!Array.isArray(entries)) return;

      const validEntries = entries
        .map((entry) => ({
          row: Math.max(1, Math.min(safe.grid.rows, Number.parseInt(entry.row, 10) || 1)),
          col: Math.max(1, Math.min(safe.grid.cols, Number.parseInt(entry.col, 10) || 1)),
          text: typeof entry.text === "string" ? entry.text.trim() : ""
        }))
        .filter((entry) => entry.text.length > 0);

      if (validEntries.length > 0) {
        safe.pages[pageKey] = validEntries;
      }
    });
  }

  return safe;
}

async function loadChordConfigurationForSong(song) {
  chordConfig = createDefaultChordConfig();
  originalFamilyChord = null;
  const txtUrl = getChordTxtUrl(song);
  const txtFilename = getChordTxtFilename(song);
  const noteChordFilename = getNoteChordFilename(song);

  try {
    // Prefer note-aligned chord data when available and skip legacy TXT fetches.
    const noteChordAssets = await _loadNoteChordAssetSet();
    if (noteChordAssets.has(noteChordFilename)) {
      updateTransposeVisibility();
      return;
    }

    if (_missingChordTxtAssetSet.has(txtFilename)) {
      updateTransposeVisibility();
      return;
    }

    const chordTxtAssets = await _loadChordTxtAssetSet();

    // Always attempt dynamic resolution from PDF-derived filename.
    // This avoids hard dependency on chord-assets-list.json being up to date.
    const response = await fetch(txtUrl, { cache: "no-store" });
    if (!response.ok) {
      if (response.status === 404) {
        chordTxtAssets.delete(txtFilename);
        _missingChordTxtAssetSet.add(txtFilename);
      }
      updateTransposeVisibility();
      return;
    }

    chordTxtAssets.add(txtFilename);
    _missingChordTxtAssetSet.delete(txtFilename);

    const payload = await response.text();
    const parsed = JSON.parse(payload);
    chordConfig = sanitizeChordConfig(parsed);
    detectAndSetFamilyChord();
  } catch {
    chordConfig = createDefaultChordConfig();
    originalFamilyChord = null;
  }
  updateTransposeVisibility();
}

function detectAndSetFamilyChord() {
  if (!chordConfig || !chordConfig.pages) return;
  let allChords = [];
  const pageKeys = Object.keys(chordConfig.pages).sort((a, b) => parseInt(a) - parseInt(b));
  
  pageKeys.forEach(key => {
    const entries = chordConfig.pages[key] || [];
    // Sort by row, then col
    const sorted = [...entries].sort((a, b) => a.row === b.row ? a.col - b.col : a.row - b.row);
    sorted.forEach(entry => {
      if (entry.text && entry.text.trim()) {
        allChords.push(entry.text.trim());
      }
    });
  });

  if (allChords.length === 0) return;

  const getRoot = (chordText) => {
    // Matches root note (A-G or 1-7), optional accidental, and optional 'm' or 'min' for minor (excluding 'maj')
    const match = chordText.match(/^([A-Ga-g1-7])([#♯b♭]?)(min|m(?!aj))?/);
    if (!match) return null;
    let r = match[1].toUpperCase();
    let acc = match[2];
    let isMinor = !!match[3];
    if (acc === '♭') acc = 'b';
    if (acc === '♯') acc = '#';
    // Translate number to note if needed
    if (/[1-7]/.test(r)) {
      r = NUMBER_TO_NOTE[r] || 'C';
    }
    return r + acc + (isMinor ? 'm' : '');
  };

  const roots = allChords.map(getRoot).filter(Boolean);
  if (roots.length === 0) return;

  const firstRoot = roots[0];
  const lastRoot = roots[roots.length - 1];

  let detectedRoot = firstRoot;
  if (firstRoot === lastRoot) {
    detectedRoot = firstRoot;
  } else {
    // Frequencies fallback
    const counts = {};
    let max = 0;
    let mostFreq = firstRoot;
    roots.forEach(r => {
      counts[r] = (counts[r] || 0) + 1;
      if (counts[r] > max) {
        max = counts[r];
        mostFreq = r;
      }
    });
    // Bias towards last root if it appears reasonably often
    if (counts[lastRoot] > 1) {
      detectedRoot = lastRoot;
    } else {
      detectedRoot = mostFreq;
    }
  }

  originalFamilyChord = detectedRoot;
  baseTransposeOffset = 0;

  if (originalPdfKey && originalFamilyChord) {
    const pdfSemi = parsePdfKeyToSemitone(originalPdfKey);
    const txtParsed = parseChordToken(originalFamilyChord);
    if (pdfSemi !== null && txtParsed !== null) {
      let diff = pdfSemi - txtParsed.semitone;
      diff = diff % 12;
      if (diff > 6) diff -= 12;
      if (diff < -5) diff += 12;
      baseTransposeOffset = diff;
    }
  }

  if (prefs.preferNaturalChords && originalFamilyChord) {
    const txtParsed = parseChordToken(originalFamilyChord);
    if (txtParsed !== null) {
      const finalBaseSemi = wrapSemitone(txtParsed.semitone + baseTransposeOffset);
      const isBlackKey = [1, 3, 6, 8, 10].includes(finalBaseSemi);
      if (isBlackKey) {
        transposeStep = -1;
      }
    }
  }
}

function parsePdfKeyToSemitone(keyStr) {
  if (!keyStr) return null;
  let k = keyStr.toLowerCase().replace(/m$/, '');
  const map = {
    'c': 0, 'cis': 1, 'des': 1,
    'd': 2, 'dis': 3, 'es': 3, 'eb': 3,
    'e': 4,
    'f': 5, 'fis': 6, 'ges': 6,
    'g': 7, 'gis': 8, 'as': 8, 'ab': 8,
    'a': 9, 'ais': 10, 'bes': 10, 'bb': 10,
    'b': 11, 'h': 11
  };
  
  if (map[k] !== undefined) return map[k];
  
  if (k.includes('#')) {
      const base = {'c':0,'d':2,'f':5,'g':7,'a':9}[k.charAt(0)];
      if (base !== undefined) return wrapSemitone(base + 1);
  }
  if (k.includes('b')) {
      const base = {'c':0,'d':2,'e':4,'g':7,'a':9,'b':11}[k.charAt(0)];
      if (base !== undefined) return wrapSemitone(base - 1);
  }
  return null;
}

function updateTransposeVisibility() {
  const hasChords = originalFamilyChord !== null || Object.values(chordConfig.pages).some(page => page && page.length > 0);
  const hasNoteChords = typeof hasNoteAlignedChords === "function" && hasNoteAlignedChords();
  const hasMidi = typeof midiToggleBtn !== "undefined" && midiToggleBtn && midiToggleBtn.style.display !== "none";
  const showTranspose = hasChords || hasNoteChords || chordEditorEnabled || hasMidi;
  // Only show hide-chord buttons when actual chords exist (not just MIDI)
  const showHideChord = hasChords || hasNoteChords || chordEditorEnabled;

  document.querySelectorAll('.transpose-collapse').forEach(el => {
    el.style.display = showTranspose ? '' : 'none';
  });
  if (typeof hideChordBtns !== "undefined") {
    hideChordBtns.forEach(btn => {
      btn.style.display = showHideChord ? '' : 'none';
    });
  }

  updateTransposeUI();
}

function updateFamilyChordUI() {
    const btns = document.querySelectorAll('.family-chord-btn');
    const miniKeyInfo = document.getElementById('mini-key-info');
    const dds = document.querySelectorAll('.family-chord-dropdown');
    
    let isMinor = false;
    let fallbackLabel = '?';
    let currentKeyString = '?';
    
    if (originalFamilyChord) {
      isMinor = originalFamilyChord.endsWith('m');
      const baseLabel = formatChordForDisplay(originalFamilyChord);
      fallbackLabel = baseLabel.replace(/[^A-G#b♭♯]/g, '') + (isMinor ? 'm' : '');
      const parsed = parseChordToken(originalFamilyChord);
      if (parsed) {
        const currentSemi = wrapSemitone(parsed.semitone + transposeStep + baseTransposeOffset);
        const noteSet = accidentalMode === "flat" ? NOTE_NAMES_FLAT : NOTE_NAMES_SHARP;
        currentKeyString = noteSet[currentSemi] + (isMinor ? 'm' : '');
      } else {
        currentKeyString = fallbackLabel;
      }
    } else if (typeof originalPdfKey !== 'undefined' && originalPdfKey) {
      isMinor = originalPdfKey.toLowerCase().endsWith('m');
      fallbackLabel = originalPdfKey;
      const pdfSemi = parsePdfKeyToSemitone(originalPdfKey);
      if (pdfSemi !== null) {
        const currentSemi = wrapSemitone(pdfSemi + transposeStep);
        const noteSet = accidentalMode === "flat" ? NOTE_NAMES_FLAT : NOTE_NAMES_SHARP;
        currentKeyString = noteSet[currentSemi] + (isMinor ? 'm' : '');
      } else {
        currentKeyString = fallbackLabel;
      }
    } else {
      currentKeyString = '-';
    }

    if (miniKeyInfo) miniKeyInfo.textContent = currentKeyString;

    btns.forEach(btn => {
      btn.textContent = currentKeyString !== '-' && currentKeyString !== '?' ? currentKeyString : fallbackLabel;
    });

  const allNotes = accidentalMode === "flat" ? NOTE_NAMES_FLAT : NOTE_NAMES_SHARP;
  dds.forEach(dd => {
    dd.innerHTML = '';
    allNotes.forEach((note, index) => {
      if (note === '') return; // Skip empty indices if any, but array is 12 notes
      const optNote = note + (isMinor ? 'm' : '');
      const opt = document.createElement('button');
      opt.className = 'family-chord-option';
      opt.textContent = optNote;
      if (btnText(btns[0]) === optNote) {
         opt.classList.add('selected');
      }
      opt.onclick = () => {
         if (!originalFamilyChord) return;
         const parsedObj = parseChordToken(originalFamilyChord);
         if (!parsedObj) return;
         const origSemi = parsedObj.semitone;
         let targetSemi = index;
         
         // Calculate transpose step relative to base offset
         let diff = targetSemi - origSemi - baseTransposeOffset;
         
         diff = diff % 12;
         if (diff > 6) diff -= 12;
         if (diff < -5) diff += 12;
         
         transposeStep = diff;
         updateTransposeUI();
         refreshVisibleChordMarkers();
         
         dd.classList.remove('is-open');
      };
      dd.appendChild(opt);
    });
  });
}

function btnText(btn) {
  return btn ? btn.textContent : '';
}

function getChordTxtUrl(song) {
  // song.fileHref is 'assets/pdf/filename.pdf'
  // we want 'assets/chord/filename.txt'
  let url = song.fileHref;
  // safely replace 'assets/pdf/' with 'assets/chord/' and '.pdf' with '.txt'
  url = url.replace(/\/pdf\//i, '/chord/');
  url = url.replace(/\.pdf$/i, ".txt");
  return url;
}

function getChordTxtFilename(song) {
  return decodeURIComponent(song.fileHref.split("/").pop() || "chord.txt").replace(/\.pdf$/i, ".txt");
}

const CHORD_TXT_ASSET_LIST_URL = "chord-assets-list.json";
const NOTE_CHORD_ASSET_LIST_URL = "note-chord-assets-list.json";
let _chordTxtAssetSet = null;
let _chordTxtAssetSetPromise = null;
let _noteChordAssetSet = null;
let _noteChordAssetSetPromise = null;
let _missingChordTxtAssetSet = new Set();
let _missingNoteChordAssetSet = new Set();

function _buildAssetNameSet(payload, suffix) {
  if (!Array.isArray(payload)) return new Set();

  const normalized = payload
    .filter((item) => typeof item === "string")
    .map((item) => decodeURIComponent(item.trim()))
    .filter((item) => item.length > 0 && item.toLowerCase().endsWith(suffix));

  return new Set(normalized);
}

function _loadChordTxtAssetSet() {
  if (_chordTxtAssetSet) return Promise.resolve(_chordTxtAssetSet);
  if (_chordTxtAssetSetPromise) return _chordTxtAssetSetPromise;

  _chordTxtAssetSetPromise = fetch(CHORD_TXT_ASSET_LIST_URL, { cache: "no-store" })
    .then((response) => {
      if (!response.ok) return [];
      return response.json();
    })
    .then((payload) => {
      _chordTxtAssetSet = _buildAssetNameSet(payload, ".txt");
      return _chordTxtAssetSet;
    })
    .catch(() => {
      _chordTxtAssetSet = new Set();
      return _chordTxtAssetSet;
    })
    .then((set) => {
      _chordTxtAssetSetPromise = null;
      return set;
    });

  return _chordTxtAssetSetPromise;
}

function _loadNoteChordAssetSet() {
  if (_noteChordAssetSet) return Promise.resolve(_noteChordAssetSet);
  if (_noteChordAssetSetPromise) return _noteChordAssetSetPromise;

  _noteChordAssetSetPromise = fetch(NOTE_CHORD_ASSET_LIST_URL, { cache: "no-store" })
    .then((response) => {
      if (!response.ok) return [];
      return response.json();
    })
    .then((payload) => {
      _noteChordAssetSet = _buildAssetNameSet(payload, ".chord.json");
      return _noteChordAssetSet;
    })
    .catch(() => {
      _noteChordAssetSet = new Set();
      return _noteChordAssetSet;
    })
    .then((set) => {
      _noteChordAssetSetPromise = null;
      return set;
    });

  return _noteChordAssetSetPromise;
}

function createChordLayer(pageNum) {
  const layer = document.createElement("div");
  layer.className = `chord-layer ${chordEditorEnabled ? "editor-mode show-grid" : "viewer-mode"}`;
  if (chordsHidden) layer.classList.add("is-hidden");
  layer.dataset.pageNum = String(pageNum);
  layer.style.setProperty("--grid-cols", String(chordConfig.grid.cols));
  layer.style.setProperty("--grid-rows", String(chordConfig.grid.rows));

  const entries = Array.isArray(chordConfig.pages[String(pageNum)]) ? chordConfig.pages[String(pageNum)] : [];

  if (chordEditorEnabled) {
    const activeRows = new Set();
    const activeCols = new Set();
    entries.forEach((entry) => {
      if (entry.text && entry.text.trim()) {
        activeRows.add(entry.row);
        activeCols.add(entry.col);
      }
    });

    activeRows.forEach((row) => {
      const rowHighlight = document.createElement("div");
      rowHighlight.className = "chord-highlight-row";
      rowHighlight.style.setProperty("--row", String(row));
      layer.appendChild(rowHighlight);
    });

    activeCols.forEach((col) => {
      const colHighlight = document.createElement("div");
      colHighlight.className = "chord-highlight-col";
      colHighlight.style.setProperty("--col", String(col));
      layer.appendChild(colHighlight);
    });
  }

  entries.forEach((entry) => {
    layer.appendChild(createChordMarkerElement(entry));
  });

  return layer;
}

function createChordMarkerElement(entry) {
  const marker = document.createElement("span");
  marker.className = "chord-marker";
  marker.classList.add(`chord-theme-${chordUiPrefs.theme}`);
  marker.classList.add(`chord-fill-${chordUiPrefs.fill}`);
  marker.classList.add(`chord-fill-color-${chordUiPrefs.fillColor}`);
  if (chordUiPrefs.syncThemeWithAccent) {
    marker.classList.add("chord-theme-accent");
  }
  if (chordUiPrefs.syncFillWithAccent) {
    marker.classList.add("chord-fill-color-accent");
  }
  marker.dataset.row = String(entry.row);
  marker.dataset.col = String(entry.col);
  marker.dataset.raw = entry.text;
  marker.textContent = formatChordForDisplay(entry.text);
  marker.style.setProperty("--chord-font-size", `${getChordFontSizeRem()}rem`);
  marker.style.setProperty("--chord-fill-opacity", `${chordUiPrefs.fillOpacityPercent}%`);
  marker.style.setProperty("--chord-fill-padding-scale", `${chordUiPrefs.fillPaddingPercent / 100}`);

  const xPercent = ((entry.col - 0.5) / chordConfig.grid.cols) * 100;
  const yPercent = ((entry.row - 0.5) / chordConfig.grid.rows) * 100;
  marker.style.left = `${xPercent}%`;
  marker.style.top = `${yPercent}%`;

  return marker;
}

function getChordFontSizeRem() {
  // Skala dasar yang sangat adaptif. Menghitung fisik scale PDF ke dimensi CSS layar saat ini.
  // Memastikan chord ikut membesar/mengecil mengikuti teks PDF di ukuran layar berapapun (1080p, 4K, maupun HP).
  const pdfScale = (typeof currentScale === "number" && Number.isFinite(currentScale)) ? currentScale : 1;

  // Angka 0.55 adalah konstanta aproksimasi (diturunkan lebih jauh agar ukuran default 100% lebih wajar/kecil di desktop)
  const adaptiveBase = 0.55 * pdfScale;

  const size = adaptiveBase * (chordUiPrefs.fontOverridePercent / 100);
  return Math.min(20.0, Math.max(0.2, size));
}

function onChordLayerClick(event) {
  if (!chordEditorEnabled || !pdfDoc || !document.body.classList.contains("viewer-active")) return;

  // Skip if clicking within a note-aligned layer (handled by onNoteAlignedChordClick)
  const noteAlignedLayer = event.target.closest(".note-aligned-layer");
  if (noteAlignedLayer) return;

  const marker = event.target.closest(".chord-marker");
  if (marker) {
    event.preventDefault();
    event.stopPropagation();

    const layer = marker.closest(".chord-layer");
    const pageNum = Number.parseInt(layer?.dataset.pageNum || "0", 10);
    const row = Number.parseInt(marker.dataset.row, 10);
    const col = Number.parseInt(marker.dataset.col, 10);
    const existing = marker.dataset.raw || "";

    promptAndSetChord(pageNum, row, col, existing);
    return;
  }

  const layer = event.target.closest(".chord-layer.editor-mode");
  if (!layer) return;

  const pageNum = Number.parseInt(layer.dataset.pageNum || "0", 10);
  if (!pageNum) return;

  const rect = layer.getBoundingClientRect();
  const relativeX = event.clientX - rect.left;
  const relativeY = event.clientY - rect.top;

  const col = Math.max(1, Math.min(chordConfig.grid.cols, Math.floor((relativeX / rect.width) * chordConfig.grid.cols) + 1));
  const row = Math.max(1, Math.min(chordConfig.grid.rows, Math.floor((relativeY / rect.height) * chordConfig.grid.rows) + 1));

  const existing = getChordAt(pageNum, row, col);
  promptAndSetChord(pageNum, row, col, existing);
}

function promptAndSetChord(pageNum, row, col, existingText = "") {
  const promptDefault = existingText ? formatChordForDisplay(existingText) : "";
  const userInput = window.prompt(
    "Masukkan chord (contoh: C, C♯, B♭, Fdim, Aadd9).\nKosongkan untuk hapus chord di sel ini.",
    promptDefault
  );

  if (userInput === null) return;

  const encoded = encodeChordToken(userInput);
  if (encoded === null) {
    alert("Format chord tidak valid. Gunakan root A-G lalu optional #/b dan tag (dim, add9, dst).");
    return;
  }

  setChordAt(pageNum, row, col, encoded);
  renderPage(currentPageNum);
}

function encodeChordToken(input) {
  const raw = String(input || "").trim();
  if (!raw) return "";

  const match = raw.match(/^([A-Ga-g1-7])([#♯b♭]?)(.*)$/);
  if (!match) return null;

  const rootRaw = match[1];
  const accidentalRaw = match[2] || "";
  const fullSuffix = (match[3] || "").trim();

  const rootLetter = /[1-7]/.test(rootRaw) ? NUMBER_TO_NOTE[rootRaw] : rootRaw.toUpperCase();
  const naturalIndex = NATURAL_NOTE_INDEX[rootLetter];
  if (!Number.isInteger(naturalIndex)) return null;

  const accidental = accidentalRaw === "♭" ? "b" : accidentalRaw === "♯" ? "#" : accidentalRaw;
  let semitone = naturalIndex;
  if (accidental === "#") semitone += 1;
  if (accidental === "b") semitone -= 1;

  // REVERSE the offset so that saving to file keeps it relative to original file base instead of matching PDF visual
  semitone = semitone - transposeStep - baseTransposeOffset;

  const normalizedRoot = NOTE_NAMES_SHARP_ASCII[wrapSemitone(semitone)];

  // Reverse-transpose only transposeStep for bass (bass is stored in display-key coordinates)
  const bass = _parseSlashBass(fullSuffix);
  if (bass.bassSemitone !== null) {
    const bassSemi = bass.bassSemitone - transposeStep;
    const normalizedBass = NOTE_NAMES_SHARP_ASCII[wrapSemitone(bassSemi)];
    return `${normalizedRoot}${bass.suffixBefore}/${normalizedBass}${bass.suffixAfter}`;
  }
  return `${normalizedRoot}${fullSuffix}`;
}

function formatChordForDisplay(encodedToken) {
  const token = String(encodedToken || "").trim();
  const parsed = parseChordToken(token);
  if (!parsed) return token;

  const noteSet = accidentalMode === "flat" ? NOTE_NAMES_FLAT : NOTE_NAMES_SHARP;
  const transposed = wrapSemitone(parsed.semitone + transposeStep + baseTransposeOffset);
  
  // Replace 'b' with '♭' and '#' with '♯' in suffix for common chord extensions
  let displaySuffix = parsed.suffix;
  if (accidentalMode === "flat") {
    displaySuffix = displaySuffix.replace(/b(\d+)/g, "♭$1");
  } else {
    displaySuffix = displaySuffix.replace(/#(\d+)/g, "♯$1");
  }
  displaySuffix = displaySuffix.replace(/#/g, "♯");

  // Transpose the bass note after "/" — bass is stored in display-key coordinates
  // (not reverse-transposed like the root), so only apply user transposeStep
  let bassDisplay = "";
  if (parsed.bassSemitone !== null) {
    const transposedBass = wrapSemitone(parsed.bassSemitone + transposeStep);
    bassDisplay = "/" + noteSet[transposedBass] + (parsed.suffixAfter || "");
  }

  return `${noteSet[transposed]}${displaySuffix}${bassDisplay}`;
}

function _parseSlashBass(suffix) {
  // Extract bass note from suffix like "m/E", "7/G#", "/Bb"
  const slashMatch = suffix.match(/^(.*)\/([A-Ga-g])([#♯b♭]?)(.*)$/);
  if (!slashMatch) return { suffixBefore: suffix, bassSemitone: null, bassAccidental: "", suffixAfter: "" };
  const bassRoot = slashMatch[2].toUpperCase();
  const bassAccRaw = slashMatch[3] || "";
  const bassAcc = bassAccRaw === "♭" ? "b" : bassAccRaw === "♯" ? "#" : bassAccRaw;
  let bassSemi = NATURAL_NOTE_INDEX[bassRoot];
  if (!Number.isInteger(bassSemi)) return { suffixBefore: suffix, bassSemitone: null, bassAccidental: "", suffixAfter: "" };
  if (bassAcc === "#") bassSemi += 1;
  if (bassAcc === "b") bassSemi -= 1;
  return { suffixBefore: slashMatch[1], bassSemitone: wrapSemitone(bassSemi), bassAccidental: bassAcc, suffixAfter: slashMatch[4] || "" };
}

function parseChordToken(token) {
  const newFormat = token.match(/^([A-Ga-g])([#♯b♭]?)(.*)$/);
  if (newFormat) {
    const root = newFormat[1].toUpperCase();
    const accidentalRaw = newFormat[2] || "";
    const fullSuffix = newFormat[3] || "";
    
    const accidental = accidentalRaw === "♭" ? "b" : accidentalRaw === "♯" ? "#" : accidentalRaw;

    let semitone = NATURAL_NOTE_INDEX[root];
    if (!Number.isInteger(semitone)) return null;
    if (accidental === "#") semitone += 1;
    if (accidental === "b") semitone -= 1;

    const bass = _parseSlashBass(fullSuffix);
    return { semitone: wrapSemitone(semitone), suffix: bass.suffixBefore, bassSemitone: bass.bassSemitone, suffixAfter: bass.suffixAfter };
  }

  const legacyFormat = token.match(/^([1-7])([#♯b♭]?)(.*)$/);
  if (!legacyFormat) return null;

  const legacyRoot = NUMBER_TO_NOTE[legacyFormat[1]];
  let semitone = NATURAL_NOTE_INDEX[legacyRoot];
  const accidentalRaw = legacyFormat[2] || "";
  const fullSuffix = legacyFormat[3] || "";
  
  const accidental = accidentalRaw === "♭" ? "b" : accidentalRaw === "♯" ? "#" : accidentalRaw;

  if (accidental === "#") semitone += 1;
  if (accidental === "b") semitone -= 1;

  const bass = _parseSlashBass(fullSuffix);
  return { semitone: wrapSemitone(semitone), suffix: bass.suffixBefore, bassSemitone: bass.bassSemitone, suffixAfter: bass.suffixAfter };
}

function wrapSemitone(value) {
  return ((value % 12) + 12) % 12;
}

function onTranspose(step) {
  const next = transposeStep + step;
  transposeStep = next > 11 || next < -11 ? 0 : next;
  updateTransposeUI();
  refreshVisibleChordMarkers();
}

function resetTranspose() {
  if (transposeStep !== 0) {
    transposeStep = 0;
    updateTransposeUI();
    refreshVisibleChordMarkers();
  }
}

function updateTransposeUI(options = {}) {
  const { animateAccidental = false } = options;
  const sign = transposeStep > 0 ? "+" : "";
  transposeIndicators.forEach((indicator) => {
    indicator.textContent = 'Transpose ' + sign + transposeStep;
  });

  const miniTransposeVal = document.getElementById('mini-transpose-value');
  if (miniTransposeVal) {
    miniTransposeVal.textContent = sign + transposeStep;
  }

  if (typeof updateFamilyChordUI === 'function') {
    updateFamilyChordUI();
  }

  // Gapless transpose swap — single SoundFontPlayer reloads only new pitches
  if (typeof swapTranspose === 'function') {
    swapTranspose(transposeStep);
  }

  accidentalSwitchBtns.forEach((btn) => {
    btn.classList.toggle("active", accidentalMode === "flat");
    const label = btn.querySelector(".accidental-label");
    if (label) {
      const newText = accidentalMode === "flat" ? "♭" : "♯";
      if (animateAccidental && label.textContent !== newText) {
        label.style.animation = "none";
        void label.offsetWidth; // Trigger reflow
        label.style.animation = "flipAccidental 0.3s ease-in-out forwards";
        if (label.dataset.flipTimer) clearTimeout(Number(label.dataset.flipTimer));
        label.dataset.flipTimer = setTimeout(() => {
          label.textContent = newText;
        }, 150);
      } else {
        label.textContent = newText;
      }
    }
    btn.setAttribute("aria-label", `Switcher accidental (${accidentalMode === "flat" ? "flat" : "sharp"})`);
  });
}

function onToggleAccidentalMode() {
  accidentalMode = accidentalMode === "sharp" ? "flat" : "sharp";
  localStorage.setItem(CHORD_ACCIDENTAL_STORAGE_KEY, accidentalMode);
  updateTransposeUI({ animateAccidental: true });
  refreshVisibleChordMarkers();
}

function refreshVisibleChordMarkers() {
  document.querySelectorAll(".chord-marker").forEach((marker) => {
    const existingTimer = chordDissolveTimers.get(marker);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    marker.classList.remove("is-dissolving", "is-dissolving-out", "is-dissolving-in");
    void marker.offsetWidth;
    marker.classList.add("is-dissolving-out");

    const timeoutId = setTimeout(() => {
      marker.textContent = formatChordForDisplay(marker.dataset.raw || "");
      marker.classList.remove("is-dissolving-out");
      marker.classList.add("is-dissolving-in");

      const cleanupId = setTimeout(() => {
        marker.classList.remove("is-dissolving-in");
        chordDissolveTimers.delete(marker);
      }, TRANSPOSE_DISSOLVE_IN_MS);

      chordDissolveTimers.set(marker, cleanupId);
    }, TRANSPOSE_DISSOLVE_OUT_MS);

    chordDissolveTimers.set(marker, timeoutId);
  });

  // Also refresh note-aligned chord markers on transpose
  if (typeof refreshNoteChordMarkers === "function") {
    refreshNoteChordMarkers();
  }
}

function getChordAt(pageNum, row, col) {
  const pageKey = String(pageNum);
  const entries = chordConfig.pages[pageKey];
  if (!Array.isArray(entries)) return "";

  const found = entries.find((entry) => entry.row === row && entry.col === col);
  return found ? found.text : "";
}

function setChordAt(pageNum, row, col, encodedText) {
  const pageKey = String(pageNum);
  const entries = Array.isArray(chordConfig.pages[pageKey]) ? chordConfig.pages[pageKey] : [];
  const idx = entries.findIndex((entry) => entry.row === row && entry.col === col);

  if (!encodedText) {
    if (idx >= 0) entries.splice(idx, 1);
    if (entries.length === 0) {
      delete chordConfig.pages[pageKey];
    } else {
      chordConfig.pages[pageKey] = entries;
    }
    return;
  }

  if (idx >= 0) {
    entries[idx].text = encodedText;
  } else {
    entries.push({ row, col, text: encodedText });
  }

  entries.sort((a, b) => (a.row - b.row) || (a.col - b.col));
  chordConfig.pages[pageKey] = entries;
}

function saveChordConfigurationFile() {
  if (currentSongIndex < 0 || !pujianItems[currentSongIndex]) return;

  const song = pujianItems[currentSongIndex];
  const filename = getChordTxtFilename(song);
  const dataText = JSON.stringify(chordConfig, null, 2);

  const blob = new Blob([dataText], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(url);
  showToast(`Konfigurasi chord tersimpan: ${filename}`, "download");
}

function handleTitleActivatorTap() {
  if (!document.body.classList.contains("viewer-active")) return;

  titleTapCount += 1;
  if (titleTapTimer) clearTimeout(titleTapTimer);
  titleTapTimer = setTimeout(() => {
    titleTapCount = 0;
  }, 1800);

  const required = chordEditorEnabled ? EDITOR_OFF_TAPS : EDITOR_ON_TAPS;
  if (titleTapCount < required) return;

  titleTapCount = 0;
  chordEditorEnabled = !chordEditorEnabled;
  localStorage.setItem(EDITOR_STORAGE_KEY, chordEditorEnabled ? "1" : "0");
  updateChordEditorUI();
  renderPage(currentPageNum);

  showToast(chordEditorEnabled ? "Mode edit chord aktif" : "Mode edit chord nonaktif", chordEditorEnabled ? "edit" : "visibility");
}

function updateChordEditorUI() {
  chordEditorToolbar.hidden = !chordEditorEnabled;
  chordSaveBtn.hidden = !chordEditorEnabled;
  document.body.classList.toggle("chord-editor-enabled", chordEditorEnabled);
  if (chordEditorToolbar) {
    chordEditorToolbar.classList.toggle("is-collapsed", chordEditorCollapsed);
  }
  // Always show "Chord Editor (Note-Aligned)" label
  const label = chordEditorToolbar?.querySelector(".chord-editor-label");
  if (label) {
    label.textContent = "Chord Editor (Note-Aligned)";
  }
  updateTransposeVisibility();
}

function onToggleChordEditorCollapse(event) {
  if (event) event.stopPropagation();
  chordEditorCollapsed = !chordEditorCollapsed;
  localStorage.setItem(CHORD_COLLAPSE_STORAGE_KEY, chordEditorCollapsed ? "1" : "0");
  updateChordEditorUI();
}
;

/* SOURCE: 14-note-chord-editor.js */
// --- 14. Note-Aligned Chord Editor ---
// Detects number notation (1-7, dots, rests) from PDF text content
// and allows chord placement above detected notes.

/**
 * Extract music notation notes from a PDF page using pdf.js text content.
 * Returns an array of note objects with their positions.
 */
async function extractPageNotes(page) {
  const textContent = await page.getTextContent();
  const viewport = page.getViewport({ scale: 1 });
  const pageWidth = viewport.width;
  const pageHeight = viewport.height;

  const items = textContent.items
    .map(item => ({
      str: item.str.trim(),
      x: item.transform[4],
      y: item.transform[5],
      w: item.width,
      fontSize: Math.abs(item.transform[3])
    }))
    .filter(item => item.str.length > 0);

  // Find items containing note characters (1-7, 0, .) to determine dominant font size.
  // Some PDFs return multi-char items like "1 . . 1" instead of individual chars.
  const noteCharPattern = /^[0-7.\s]+$/;
  const candidateItems = items.filter(item =>
    noteCharPattern.test(item.str) && /[1-7]/.test(item.str)
  );
  if (candidateItems.length === 0) return { notes: [], pageWidth, pageHeight };

  // Find the most common fontSize among candidate items
  const fontSizeCounts = {};
  candidateItems.forEach(item => {
    const key = Math.round(item.fontSize * 10) / 10;
    fontSizeCounts[key] = (fontSizeCounts[key] || 0) + 1;
  });
  const dominantFontSize = parseFloat(
    Object.entries(fontSizeCounts).sort((a, b) => b[1] - a[1])[0][0]
  );
  const fontSizeTolerance = 1.5;

  // Filter note-like items at the dominant font size
  const singleNotePattern = /^[0-7.]$/;
  const multiNotePattern = /^[0-7.\s]+$/;
  const rawNoteItems = items.filter(item =>
    multiNotePattern.test(item.str) &&
    Math.abs(item.fontSize - dominantFontSize) < fontSizeTolerance
  );

  // Split multi-char items into individual note characters with interpolated positions.
  // Single-char items pass through unchanged.
  const noteItems = [];
  for (const item of rawNoteItems) {
    if (singleNotePattern.test(item.str)) {
      noteItems.push(item);
    } else {
      // Multi-char item like "1 . . 1" — extract individual note chars
      const chars = item.str.split('');
      const totalChars = chars.length;
      if (totalChars <= 1) { noteItems.push(item); continue; }
      // Calculate width per character slot (including spaces)
      const slotWidth = item.w / totalChars;
      for (let i = 0; i < totalChars; i++) {
        const ch = chars[i];
        if (/[0-7.]/.test(ch)) {
          const charX = item.x + i * slotWidth;
          const charW = slotWidth;
          noteItems.push({
            str: ch,
            x: charX,
            y: item.y,
            w: charW,
            fontSize: item.fontSize
          });
        }
      }
    }
  }

  // Group by y-coordinate (items at the same vertical position form a "note row")
  const yTolerance = 2.0; // PDF units
  const rows = [];
  // Sort by y descending (higher y = higher on page in PDF coords)
  const sorted = [...noteItems].sort((a, b) => b.y - a.y);

  for (const item of sorted) {
    const existingRow = rows.find(r => Math.abs(r.y - item.y) < yTolerance);
    if (existingRow) {
      existingRow.items.push(item);
    } else {
      rows.push({ y: item.y, items: [item] });
    }
  }

  // Filter rows that have at least 2 digit items (to avoid picking up stray numbers)
  const musicRows = rows.filter(row => {
    const digits = row.items.filter(i => /^[1-7]$/.test(i.str));
    return digits.length >= 2;
  });

  // Create flat array of notes with sequential indices
  const notes = [];
  for (const row of musicRows) {
    const sortedItems = [...row.items].sort((a, b) => a.x - b.x);
    for (const item of sortedItems) {
      notes.push({
        idx: notes.length,
        str: item.str,
        x: item.x,
        y: item.y,
        w: item.w,
        xPct: ((item.x + item.w / 2) / pageWidth) * 100,
        yPct: ((1 - item.y / pageHeight) * 100),
        rowY: row.y,
        isNote: /^[1-7]$/.test(item.str),
        isDot: item.str === '.',
        isRest: item.str === '0'
      });
    }
  }

  return { notes, pageWidth, pageHeight };
}

/**
 * Create default note-aligned chord config.
 */
function createDefaultNoteChordConfig() {
  return {
    version: 2,
    type: "note-aligned",
    pages: {}
  };
}

/**
 * Sanitize a loaded note-aligned chord config.
 */
function sanitizeNoteChordConfig(rawConfig) {
  const safe = createDefaultNoteChordConfig();
  if (!rawConfig || typeof rawConfig !== "object") return safe;
  if (rawConfig.version !== 2 || rawConfig.type !== "note-aligned") return safe;

  if (rawConfig.pages && typeof rawConfig.pages === "object") {
    Object.entries(rawConfig.pages).forEach(([pageKey, entries]) => {
      if (!Array.isArray(entries)) return;
      const validEntries = entries
        .map(entry => ({
          noteIdx: Number.isFinite(entry.noteIdx) ? Math.round(entry.noteIdx) : null,
          chord: typeof entry.chord === "string" ? entry.chord.trim() : ""
        }))
        .filter(entry => entry.noteIdx !== null && entry.chord.length > 0);

      if (validEntries.length > 0) {
        safe.pages[pageKey] = validEntries;
      }
    });
  }
  return safe;
}

/**
 * Get chord-v2 URL for a song.
 */
function getNoteChordUrl(song) {
  let url = song.fileHref;
  url = url.replace(/\/pdf\//i, '/chord/');
  url = url.replace(/\.pdf$/i, ".chord.json");
  return url;
}

/**
 * Get chord-v2 filename for download.
 */
function getNoteChordFilename(song) {
  return decodeURIComponent(song.fileHref.split("/").pop() || "chord.json")
    .replace(/\.pdf$/i, ".chord.json");
}

/**
 * Load note-aligned chord configuration for the current song.
 */
async function loadNoteChordConfiguration(song) {
  noteChordConfig = createDefaultNoteChordConfig();
  const url = getNoteChordUrl(song);
  const filename = getNoteChordFilename(song);

  try {
    const noteChordAssets = await _loadNoteChordAssetSet();

    if (_missingNoteChordAssetSet.has(filename)) return;

    // Resolve note-aligned chord files dynamically from the PDF filename.
    // We still keep the asset set for positive caching, but we don't require
    // note-chord-assets-list.json to contain the filename.
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) {
      if (response.status === 404) {
        noteChordAssets.delete(filename);
        _missingNoteChordAssetSet.add(filename);
      }
      return;
    }

    noteChordAssets.add(filename);
    _missingNoteChordAssetSet.delete(filename);

    const payload = await response.text();
    const parsed = JSON.parse(payload);
    if (parsed.version === 2 && parsed.type === "note-aligned") {
      noteChordConfig = sanitizeNoteChordConfig(parsed);
    }
  } catch {
    noteChordConfig = createDefaultNoteChordConfig();
  }
}

/**
 * Create the note-aligned chord overlay layer for a page.
 */
function createNoteAlignedChordLayer(pageNum, notes) {
  const layer = document.createElement("div");
  layer.className = `chord-layer note-aligned-layer ${chordEditorEnabled ? "editor-mode" : "viewer-mode"}`;
  if (chordsHidden) layer.classList.add("is-hidden");
  layer.dataset.pageNum = String(pageNum);

  const pageKey = String(pageNum);
  const chordEntries = noteChordConfig?.pages?.[pageKey] || [];

  // Chord vertical offset above note (percentage of page height)
  const chordYOffset = NOTE_CHORD_Y_OFFSET_PCT;

  if (chordEditorEnabled) {
    // Create note target indicators for clicking
    // First: "before first note" sentinel
    if (notes.length > 0) {
      const first = notes[0];
      // Find if there are multiple rows; if so, place intro sentinel at first row
      const introX = Math.max(1, first.xPct - 2.5);
      const introTarget = createNoteTarget(NOTE_IDX_BEFORE, introX, first.yPct, "▸", "Intro / sebelum lagu");
      layer.appendChild(introTarget);
    }

    // Note targets
    notes.forEach(note => {
      const label = note.isNote ? note.str : (note.isDot ? "·" : note.str);
      const target = createNoteTarget(note.idx, note.xPct, note.yPct, label);
      layer.appendChild(target);
    });

    // Last: "after last note" sentinel
    if (notes.length > 0) {
      const last = notes[notes.length - 1];
      const outroX = Math.min(99, last.xPct + 2.5);
      const outroTarget = createNoteTarget(NOTE_IDX_AFTER, outroX, last.yPct, "◂", "Outro / setelah lagu");
      layer.appendChild(outroTarget);
    }
  }

  // Place chord markers above notes
  chordEntries.forEach(entry => {
    let pos = null;
    if (entry.noteIdx === NOTE_IDX_BEFORE && notes.length > 0) {
      const first = notes[0];
      pos = { xPct: Math.max(1, first.xPct - 2.5), yPct: first.yPct };
    } else if (entry.noteIdx >= notes.length && notes.length > 0) {
      const last = notes[notes.length - 1];
      pos = { xPct: Math.min(99, last.xPct + 2.5), yPct: last.yPct };
    } else if (entry.noteIdx >= 0 && entry.noteIdx < notes.length) {
      pos = { xPct: notes[entry.noteIdx].xPct, yPct: notes[entry.noteIdx].yPct };
    }

    if (pos) {
      const marker = createNoteChordMarker(entry, pos, chordYOffset);
      layer.appendChild(marker);
    }
  });

  return layer;
}

/**
 * Create a clickable note target element for the editor.
 */
function createNoteTarget(noteIdx, xPct, yPct, label, title) {
  const el = document.createElement("div");
  el.className = "note-target";
  if (noteIdx === NOTE_IDX_BEFORE || noteIdx === NOTE_IDX_AFTER) {
    el.classList.add("note-target-sentinel");
  }
  el.dataset.noteIdx = String(noteIdx);
  el.style.left = `${xPct}%`;
  el.style.top = `${yPct}%`;
  el.textContent = label;
  if (title) el.title = title;

  // Check if this note already has a chord
  const layer = el.closest?.(".chord-layer");
  const pageNum = layer?.dataset?.pageNum;
  // Highlight will be done after appending to layer

  return el;
}

/**
 * Create a chord marker element positioned above a note.
 */
function createNoteChordMarker(entry, pos, yOffset) {
  const marker = document.createElement("span");
  marker.className = "chord-marker note-chord-marker";
  marker.classList.add(`chord-theme-${chordUiPrefs.theme}`);
  marker.classList.add(`chord-fill-${chordUiPrefs.fill}`);
  marker.classList.add(`chord-fill-color-${chordUiPrefs.fillColor}`);
  if (chordUiPrefs.syncThemeWithAccent) {
    marker.classList.add("chord-theme-accent");
  }
  if (chordUiPrefs.syncFillWithAccent) {
    marker.classList.add("chord-fill-color-accent");
  }
  marker.dataset.noteIdx = String(entry.noteIdx);
  marker.dataset.raw = entry.chord;
  marker.textContent = formatChordForDisplay(entry.chord);
  marker.style.setProperty("--chord-font-size", `${getChordFontSizeRem()}rem`);
  marker.style.setProperty("--chord-fill-opacity", `${chordUiPrefs.fillOpacityPercent}%`);
  marker.style.setProperty("--chord-fill-padding-scale", `${chordUiPrefs.fillPaddingPercent / 100}`);

  // Position: x same as note, y above the note
  marker.style.left = `${pos.xPct}%`;
  marker.style.top = `${pos.yPct - yOffset}%`;

  return marker;
}

/**
 * Handle click on the note-aligned chord layer.
 */
function onNoteAlignedChordClick(event) {
  if (!chordEditorEnabled || !pdfDoc || !document.body.classList.contains("viewer-active")) return;

  // Check if clicking on an existing chord marker
  const marker = event.target.closest(".note-chord-marker");
  if (marker) {
    event.preventDefault();
    event.stopPropagation();

    const layer = marker.closest(".chord-layer");
    const pageNum = parseInt(layer?.dataset.pageNum || "0", 10);
    const noteIdx = parseInt(marker.dataset.noteIdx, 10);
    const existing = marker.dataset.raw || "";
    promptAndSetNoteChord(pageNum, noteIdx, existing);
    return;
  }

  // Check if clicking on a note target
  const target = event.target.closest(".note-target");
  if (target) {
    event.preventDefault();
    event.stopPropagation();

    const layer = target.closest(".chord-layer");
    const pageNum = parseInt(layer?.dataset.pageNum || "0", 10);
    const noteIdx = parseInt(target.dataset.noteIdx, 10);
    const existing = getNoteChordAt(pageNum, noteIdx);
    promptAndSetNoteChord(pageNum, noteIdx, existing);
    return;
  }
}

/**
 * Prompt user for chord input and set it.
 */
function promptAndSetNoteChord(pageNum, noteIdx, existingText) {
  const promptDefault = existingText ? formatChordForDisplay(existingText) : "";
  const userInput = window.prompt(
    "Masukkan chord (contoh: C, C♯, B♭, Fdim, Aadd9).\nKosongkan untuk hapus chord.",
    promptDefault
  );

  if (userInput === null) return;

  const encoded = encodeChordToken(userInput);
  if (encoded === null) {
    alert("Format chord tidak valid. Gunakan root A-G lalu optional #/b dan tag (dim, add9, dst).");
    return;
  }

  setNoteChordAt(pageNum, noteIdx, encoded);
  renderPage(currentPageNum);
}

/**
 * Get chord text at a specific note index on a page.
 */
function getNoteChordAt(pageNum, noteIdx) {
  const pageKey = String(pageNum);
  const entries = noteChordConfig?.pages?.[pageKey];
  if (!Array.isArray(entries)) return "";
  const found = entries.find(e => e.noteIdx === noteIdx);
  return found ? found.chord : "";
}

/**
 * Set chord text at a specific note index on a page.
 */
function setNoteChordAt(pageNum, noteIdx, chordText) {
  const pageKey = String(pageNum);
  const entries = Array.isArray(noteChordConfig.pages[pageKey])
    ? noteChordConfig.pages[pageKey]
    : [];

  const idx = entries.findIndex(e => e.noteIdx === noteIdx);

  if (!chordText) {
    if (idx >= 0) entries.splice(idx, 1);
    if (entries.length === 0) {
      delete noteChordConfig.pages[pageKey];
    } else {
      noteChordConfig.pages[pageKey] = entries;
    }
    return;
  }

  if (idx >= 0) {
    entries[idx].chord = chordText;
  } else {
    entries.push({ noteIdx, chord: chordText });
  }

  entries.sort((a, b) => a.noteIdx - b.noteIdx);
  noteChordConfig.pages[pageKey] = entries;
}

/**
 * Save (download) the note-aligned chord configuration.
 */
function saveNoteChordConfigurationFile() {
  if (currentSongIndex < 0 || !pujianItems[currentSongIndex]) return;

  const song = pujianItems[currentSongIndex];
  const filename = getNoteChordFilename(song);
  const dataText = JSON.stringify(noteChordConfig, null, 2);

  const blob = new Blob([dataText], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(url);
  showToast(`Chord tersimpan: ${filename}`, "download");
}

/**
 * Load a chord file from user's file system into the editor.
 */
function loadNoteChordFromFile() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".json,.chord.json";
  input.style.display = "none";

  input.addEventListener("change", () => {
    const file = input.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        if (parsed.version === 2 && parsed.type === "note-aligned") {
          noteChordConfig = sanitizeNoteChordConfig(parsed);
          detectNoteAlignedFamilyChord();
          renderPage(currentPageNum);
          showToast(`Chord dimuat: ${file.name}`, "upload_file");
        } else if (parsed.version === 1) {
          // Legacy grid format - notify user
          showToast("Format chord lama (grid). Gunakan format note-aligned (v2).", "warning");
        } else {
          showToast("Format file tidak dikenali.", "error");
        }
      } catch {
        showToast("Gagal membaca file chord.", "error");
      }
    };
    reader.readAsText(file);
    input.remove();
  });

  document.body.appendChild(input);
  input.click();
}

/**
 * Refresh note-chord markers after transpose/accidental changes.
 * Reuses the dissolve animation from the grid chord system.
 */
function refreshNoteChordMarkers() {
  document.querySelectorAll(".note-chord-marker").forEach(marker => {
    const existingTimer = chordDissolveTimers.get(marker);
    if (existingTimer) clearTimeout(existingTimer);

    marker.classList.remove("is-dissolving", "is-dissolving-out", "is-dissolving-in");
    void marker.offsetWidth;
    marker.classList.add("is-dissolving-out");

    const timeoutId = setTimeout(() => {
      marker.textContent = formatChordForDisplay(marker.dataset.raw || "");
      marker.classList.remove("is-dissolving-out");
      marker.classList.add("is-dissolving-in");

      const cleanupId = setTimeout(() => {
        marker.classList.remove("is-dissolving-in");
        chordDissolveTimers.delete(marker);
      }, TRANSPOSE_DISSOLVE_IN_MS);

      chordDissolveTimers.set(marker, cleanupId);
    }, TRANSPOSE_DISSOLVE_OUT_MS);

    chordDissolveTimers.set(marker, timeoutId);
  });
}

/**
 * Detect family chord from note-aligned chord config.
 * Works the same as the grid version but reads from noteChordConfig.
 */
function detectNoteAlignedFamilyChord() {
  if (!noteChordConfig || !noteChordConfig.pages) return;
  let allChords = [];
  const pageKeys = Object.keys(noteChordConfig.pages).sort((a, b) => parseInt(a) - parseInt(b));

  pageKeys.forEach(key => {
    const entries = noteChordConfig.pages[key] || [];
    const sorted = [...entries].sort((a, b) => a.noteIdx - b.noteIdx);
    sorted.forEach(entry => {
      if (entry.chord && entry.chord.trim()) {
        allChords.push(entry.chord.trim());
      }
    });
  });

  if (allChords.length === 0) return;

  const getRoot = (chordText) => {
    const match = chordText.match(/^([A-Ga-g1-7])([#♯b♭]?)(min|m(?!aj))?/);
    if (!match) return null;
    let r = match[1].toUpperCase();
    let acc = match[2];
    let isMinor = !!match[3];
    if (acc === '♭') acc = 'b';
    if (acc === '♯') acc = '#';
    if (/[1-7]/.test(r)) {
      r = NUMBER_TO_NOTE[r] || 'C';
    }
    return r + acc + (isMinor ? 'm' : '');
  };

  const roots = allChords.map(getRoot).filter(Boolean);
  if (roots.length === 0) return;

  const firstRoot = roots[0];
  const lastRoot = roots[roots.length - 1];

  let detectedRoot = firstRoot;
  if (firstRoot !== lastRoot) {
    const counts = {};
    let max = 0;
    let mostFreq = firstRoot;
    roots.forEach(r => {
      counts[r] = (counts[r] || 0) + 1;
      if (counts[r] > max) {
        max = counts[r];
        mostFreq = r;
      }
    });
    detectedRoot = counts[lastRoot] > 1 ? lastRoot : mostFreq;
  }

  originalFamilyChord = detectedRoot;
  baseTransposeOffset = 0;

  if (originalPdfKey && originalFamilyChord) {
    const pdfSemi = parsePdfKeyToSemitone(originalPdfKey);
    const txtParsed = parseChordToken(originalFamilyChord);
    if (pdfSemi !== null && txtParsed !== null) {
      let diff = pdfSemi - txtParsed.semitone;
      diff = diff % 12;
      if (diff > 6) diff -= 12;
      if (diff < -5) diff += 12;
      baseTransposeOffset = diff;
    }
  }

  if (prefs.preferNaturalChords && originalFamilyChord) {
    const txtParsed = parseChordToken(originalFamilyChord);
    if (txtParsed !== null) {
      const finalBaseSemi = wrapSemitone(txtParsed.semitone + baseTransposeOffset);
      const isBlackKey = [1, 3, 6, 8, 10].includes(finalBaseSemi);
      if (isBlackKey) {
        transposeStep = -1;
      }
    }
  }
}

/**
 * Check if note-aligned chord config has any chords.
 */
function hasNoteAlignedChords() {
  if (!noteChordConfig || !noteChordConfig.pages) return false;
  return Object.values(noteChordConfig.pages).some(page => page && page.length > 0);
}
