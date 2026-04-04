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
    await new Promise((resolve) => setTimeout(resolve, 150));

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
  if (typeof checkLayoutCollisions === "function") {
    checkLayoutCollisions();
  }

  let rawUrl = song.fileHref;
  if (rawUrl) {
    rawUrl = rawUrl.replace(/\/pdf\//i, "/midi/").replace(/\.pdf$/i, ".mid");
  }
  const isSameSong = window._midiCurrentlyLoadedRawUrl === rawUrl;

  if (!isSameSong) {
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
      if (typeof checkLayoutCollisions === 'function') checkLayoutCollisions();
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
        var labelText = titleText.length > 20 ? titleText.substring(0, 20) + '...' : titleText;

        document
          .querySelectorAll("#cis-icon, #mini-cis-icon")
          .forEach((el) => (el.textContent = getMidiInstrumentIcon(prefs.midiInstrument, titleText)));
        document
          .querySelectorAll("#cis-label, #mini-cis-label")
          .forEach((el) => (el.textContent = labelText));

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
      if (typeof checkLayoutCollisions === 'function') checkLayoutCollisions();
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
  if (typeof checkLayoutCollisions === 'function') checkLayoutCollisions();
}

/**
 * Gapless transpose: instantly shifts pitch via Web Audio detune, then
 * debounces the background re-render so rapid button taps don't each spawn
 * a full FluidSynth render.
 *
 * @param {number} step - Transpose step (-11 to +11)
 */
let _transposeDebounceTimer = null;

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

function _extractPdfKeyFromText(pdfText) {
  if (!pdfText) return null;
  const keyMatch = pdfText.match(
    /(?:(?:do|la)\s*={1,2}\s*|[23469]\s*[\/|]\s*[248]\s+)([A-G](?:es|is|s|#|b)?(?:m)?)\b/i,
  );
  return keyMatch ? keyMatch[1] : null;
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
      _preloadTransposeByPdfHref.set(pdfHref, 0);
      return 0;
    }

    const loadingTask = pdfjsLib.getDocument({
      url: pdfHref,
      standardFontDataUrl: "https://mozilla.github.io/pdf.js/standard_fonts/",
    });
    const doc = await loadingTask.promise;
    const page1 = await doc.getPage(1);
    const textContent = await page1.getTextContent();
    const pdfText = textContent.items.map(function (item) { return item.str; }).join(" ");

    const pdfKey = _extractPdfKeyFromText(pdfText);
    if (!pdfKey || typeof parsePdfKeyToSemitone !== 'function') {
      _preloadTransposeByPdfHref.set(pdfHref, 0);
      return 0;
    }

    const pdfSemi = parsePdfKeyToSemitone(pdfKey);
    const preloadTranspose = (pdfSemi !== null && _isBlackKeySemitone(pdfSemi)) ? -1 : 0;
    _preloadTransposeByPdfHref.set(pdfHref, preloadTranspose);
    return preloadTranspose;
  } catch (_err) {
    _preloadTransposeByPdfHref.set(pdfHref, 0);
    return 0;
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
  if (typeof MidiEngine === 'undefined' || !midiUrl) return preferred;

  var instForCheck = instrumentValue >= 0 ? instrumentValue : -1;
  if (MidiEngine.hasPreloaded(midiUrl, preferred, instForCheck)) {
    return preferred;
  }

  // Fall back to the cached alternate transpose so preload stays effective.
  var alternate = preferred === 0 ? -1 : 0;
  if (MidiEngine.hasPreloaded(midiUrl, alternate, instForCheck)) {
    return alternate;
  }

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

  // Preload all neighboring MIDIs and PDFs using each song's default transpose profile.
  allSongs.forEach(function(song) {
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

    _inferSongDefaultPreloadTranspose(song).then(function(preloadTranspose) {
      const instForCheck = instrumentValue >= 0 ? instrumentValue : -1;
      if (MidiEngine.hasPreloaded(midiUrl, preloadTranspose, instForCheck)) {
        console.log('[Preload] Neighbor already cached (exact):', song.judul,
          'transpose=' + preloadTranspose,
          'instrument=' + instForCheck);
        return;
      }
      if (typeof MidiEngine.hasReusablePreload === 'function' && MidiEngine.hasReusablePreload(midiUrl, instForCheck)) {
        console.log('[Preload] Neighbor already cached (reusable variant) for', song.judul,
          'instead of rendering another transpose');
        return;
      }

      console.log('[Preload] Queue neighbor', song.judul,
        'transpose=' + preloadTranspose,
        'instrument=' + instForCheck);

      MidiEngine.preload(midiUrl, {
        transpose: preloadTranspose,
        instrument: instrumentValue >= 0 ? instrumentValue : undefined,
        source: 'neighbor-preload',
        sourceLabel: song.judul
      });
    }).catch(function() {
      const instForCheck = instrumentValue >= 0 ? instrumentValue : -1;
      if (MidiEngine.hasPreloaded(midiUrl, 0, instForCheck)) {
        console.log('[Preload] Neighbor already cached (fallback exact):', song.judul,
          'transpose=0',
          'instrument=' + instForCheck);
        return;
      }
      if (typeof MidiEngine.hasReusablePreload === 'function' && MidiEngine.hasReusablePreload(midiUrl, instForCheck)) {
        console.log('[Preload] Neighbor already cached (fallback reusable variant):', song.judul);
        return;
      }
      console.log('[Preload] Queue neighbor (fallback transpose=0)', song.judul,
        'instrument=' + instForCheck);
      MidiEngine.preload(midiUrl, {
        transpose: 0,
        instrument: instrumentValue >= 0 ? instrumentValue : undefined,
        source: 'neighbor-preload',
        sourceLabel: song.judul
      });
    });
  });
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

  // Web Audio detune changes speed along with pitch, so we skip it entirely
  // and rely on the full re-render which preserves original tempo.

  // Debounce the full re-render: only re-render 300 ms after the last press
  // so rapid +/+/+/+ taps produce a single render at the final pitch.
  if (_transposeDebounceTimer) clearTimeout(_transposeDebounceTimer);
  _transposeDebounceTimer = setTimeout(async function () {
    _transposeDebounceTimer = null;
    try {
      await MidiEngine.setTranspose(step);
    } catch (err) {
      console.warn('Failed to swap transpose:', err);
    }
    syncSeekbarUI(MidiEngine.getTime(), MidiEngine.getDuration());
    window._midiLastSeekValue = -1;
  }, 300);
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
}

/**
 * Force-update all seekbar UI elements to known-good values.
 * Called during transitions to prevent stale data from the interval.
 */
function syncSeekbarUI(time, duration) {
  const dur = duration || 0;
  const t = Math.max(0, time || 0);
  const pct = dur > 0 ? (t / dur) * 100 + "%" : "0%";

  if (typeof customSeekbar !== "undefined" && customSeekbar) {
    if (dur > 0 && customSeekbar.max != dur) customSeekbar.max = dur;
    customSeekbar.value = t;
    const fill = document.getElementById("custom-seekbar-fill");
    if (fill) fill.style.width = pct;
  }
  if (typeof customTimeDisplay !== "undefined" && customTimeDisplay) {
    customTimeDisplay.textContent = `${formatMidiTime(t)} / ${dur > 0 ? formatMidiTime(dur) : "0:00"}`;
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
    miniTimeDisplay.textContent = `${formatMidiTime(t)} / ${dur > 0 ? formatMidiTime(dur) : "0:00"}`;
  }
}
