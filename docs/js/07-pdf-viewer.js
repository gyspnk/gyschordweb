// --- 6. PDF Viewer ---
async function openPdfViewer(songId, backgroundLoad = false) {
  currentSongIndex = parseInt(songId, 10);
  localStorage.setItem("GysLastPlayedSongIndex", currentSongIndex);
  const song = pujianItems[currentSongIndex];
  if (!song) return;

  // Start fetching PDF immediately to overlap network with transition
  const pdfOptions = {
    url: song.fileHref,
    standardFontDataUrl: "https://mozilla.github.io/pdf.js/standard_fonts/",
  };
  const loadingTask = pdfjsLib.getDocument(pdfOptions);

  songTitleWrapper.classList.add("is-navigating");
  canvasWrapper.classList.add("is-navigating");
  await new Promise((resolve) => setTimeout(resolve, 150));

  pdfViewerTitle.textContent = song.judul;
  pdfViewerNumber.textContent = `No. ${song.nomor}`;
  songTitleWrapper.classList.remove("is-navigating");
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
    // Reset transpose saat ganti lagu
    transposeStep = 0;
    updateTransposeUI();
  } else {
    // Keep existing chordConfig and transposeStep, but make sure UI matches
    if (typeof updateTransposeUI === "function") updateTransposeUI();
  }

  // Setup MIDI Player
  if (midiToggleBtn) {
    const wasForcedNext = window._forceAutoPlayNext === true;
    const wasPlayingGlobal =
      (_midiSfPlayer && _midiSfPlayer.isPlaying()) ||
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
      if (typeof midiPanel !== "undefined" && midiPanel) {
        midiToggleBtn.setAttribute("aria-expanded", "false");
      }

      const playIcon = document.getElementById("custom-play-icon");
      const midiPlayerEl = document.getElementById("custom-midi-player");
      if (playIcon) {
        playIcon.textContent = (_midiSfPlayer && _midiSfPlayer.isPlaying()) ? "pause" : "play_arrow";
      }
      if (midiPlayerEl) {
        midiPlayerEl.classList.toggle("playing", _midiSfPlayer && _midiSfPlayer.isPlaying());
      }
    } else {
      window._midiCurrentlyLoadedRawUrl = rawUrl;

      if (
        wasPlayingGlobal &&
        typeof window._verifyPlaylistModeForCurrentSong === "function"
      ) {
        window._verifyPlaylistModeForCurrentSong();
      }

      // Fade out if currently playing
      if (_midiSfPlayer && _midiSfPlayer.isPlaying()) {
        await fadeMidiVolume(MIDI_SILENT_VOLUME, MIDI_FADE_OUT_MS);
        try { _midiSfPlayer.stop(); } catch (e) {}
      }

      // Reset MIDI state
      resetMidiState();

      const volNode = getToneVolNode();
      if (volNode && volNode.volume) {
        volNode.volume.value = MIDI_SILENT_VOLUME;
      }

      if (window.core && typeof window.core.urlToNoteSequence === "function") {
        window.core
            .urlToNoteSequence(encodeURI(rawUrl))
            .then((seq) => {
              if (!seq || !seq.notes || !Array.isArray(seq.notes) || seq.notes.length === 0) {
                console.warn('Empty or invalid sequence, aborting load.');
                window.isMidiSwitching = false;
                return;
              }
            // Store original sequence globally
            _midiOriginalSeq = seq;
            // Store known-good duration
            if (seq && seq.totalTime) {
              window._midiKnownDuration = seq.totalTime;
              MidiTimeAuthority.setDuration(seq.totalTime);
            }

            // Load the single SoundFontPlayer with current transpose
            const currentTranspose =
              typeof transposeStep === "number" ? transposeStep : 0;
            loadAndStartMidi(seq, {
              forceStart: wasForcedNext,
              transpose: currentTranspose,
            });
          })
          .catch((err) => {
            console.warn("Gagal memuat MIDI:", err);
            window.isMidiSwitching = false;
          });
      }

      // Set UI dropdown dengan preferensi yg ada
      if (
        prefs.midiInstrument &&
        typeof customInstrumentSelect !== "undefined" &&
        customInstrumentSelect
      ) {
        customInstrumentSelect.dataset.value = prefs.midiInstrument;
        const iconEl = document.getElementById("cis-icon");
        if (iconEl) {
          const options = document.querySelectorAll(
            `.cis-option[data-val="${prefs.midiInstrument}"]`,
          );
          if (options.length > 0) {
            document
              .querySelectorAll("#cis-icon, #mini-cis-icon")
              .forEach(
                (el) =>
                  (el.textContent = getMidiInstrumentIcon(
                    prefs.midiInstrument,
                  )),
              );
            const firstOpt = options[0];
            let lbl = firstOpt.getAttribute("title") || "Piano";
            if (lbl.length > 20) lbl = lbl.substring(0, 20) + "...";
            document
              .querySelectorAll("#cis-label, #mini-cis-label")
              .forEach((el) => (el.textContent = lbl));
            document
              .querySelectorAll(".cis-option")
              .forEach((opt) => opt.classList.remove("selected"));
            options.forEach((opt) => opt.classList.add("selected"));
          }
        }
      }

      midiToggleBtn.style.display = "flex";
      if (typeof midiPanel !== "undefined" && midiPanel) {
        midiToggleBtn.setAttribute("aria-expanded", "false");
      }
    } // End of track matched guard
  }

  // Pertahankan state chord editor (jangan reset chordEditorEnabled = false)
  updateChordEditorUI();

  try {
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

    const chordLayer = createChordLayer(pageNumToRender);
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

  // Seek to 0 logic
  if (
    allowRewind &&
    typeof MidiTimeAuthority !== 'undefined' &&
    _midiSfPlayer
  ) {
    const currTime = MidiTimeAuthority.getTime();
    if (currTime > 2) {
      try {
        const dur = MidiTimeAuthority.getDuration() || window._midiKnownDuration || 0;
        if (_midiSfPlayer.isPlaying()) {
          _midiSfPlayer.stop();
        }
        if (_midiCurrentTransposedSeq) {
          _midiSfPlayer.start(_midiCurrentTransposedSeq, undefined, 0);
        }
        MidiTimeAuthority.setTime(0, dur);
        MidiTimeAuthority.setPlaying(true);
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

  let mode = typeof PlaylistManager !== 'undefined' ? PlaylistManager.getAutoNextMode() : 'number';

  if (mode === 'shuffle-playlist') {
    const activeId = PlaylistManager.getActiveId();
    if (activeId) {
      const pl = PlaylistManager.getById(activeId);
      if (pl && pl.songs.length > 0) {
        const randomIdxInPl = Math.floor(Math.random() * pl.songs.length);
        if (typeof playSongFromPlaylist === 'function') {
          await playSongFromPlaylist(randomIdxInPl, !document.body.classList.contains('viewer-active'), activeId);
          return;
        }
      }
    }
    mode = 'shuffle-all';
  }

  if (mode === 'shuffle-all') {
    if (typeof pujianItems !== 'undefined' && pujianItems.length > 0) {
      const randomIdx = Math.floor(Math.random() * pujianItems.length);
      await openPdfViewer(randomIdx, !document.body.classList.contains('viewer-active'));
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

  let mode = typeof PlaylistManager !== 'undefined' ? PlaylistManager.getAutoNextMode() : 'number';

  if (mode === 'shuffle-playlist') {
    const activeId = PlaylistManager.getActiveId();
    if (activeId) {
      const pl = PlaylistManager.getById(activeId);
      if (pl && pl.songs.length > 0) {
        const randomIdxInPl = Math.floor(Math.random() * pl.songs.length);
        if (typeof playSongFromPlaylist === 'function') {
          await playSongFromPlaylist(randomIdxInPl, !document.body.classList.contains('viewer-active'), activeId);
          return;
        }
      }
    }
    mode = 'shuffle-all';
  }

  if (mode === 'shuffle-all') {
    if (typeof pujianItems !== 'undefined' && pujianItems.length > 0) {
      const randomIdx = Math.floor(Math.random() * pujianItems.length);
      await openPdfViewer(randomIdx, !document.body.classList.contains('viewer-active'));
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
}

/**
 * Load and optionally start MIDI with a single SoundFontPlayer.
 * Replaces the old 12-player pool preloading approach.
 *
 * @param {object} seq - The original NoteSequence
 * @param {object} [opts]
 * @param {boolean} [opts.forceStart=false] - Start playback after loading
 * @param {number}  [opts.transpose=0] - Transpose step to apply
 */
async function loadAndStartMidi(seq, opts = {}) {
  if (!seq) return;
  const { forceStart = false, transpose = 0 } = opts;

  _midiSfPlayerLoading = true;
  _midiSfPlayerReady = false;

  // Resolve instrument
  let instrumentValue = "-1";
  if (prefs && prefs.midiInstrument !== undefined) {
    instrumentValue = prefs.midiInstrument;
  } else if (customInstrumentSelect && customInstrumentSelect.dataset.value) {
    instrumentValue = customInstrumentSelect.dataset.value;
  }

  // Show progress bar
  if (midiPreloadBar) {
    midiPreloadBar.style.display = "block";
    midiPreloadFill.style.width = "0%";
  }

  // Create transposed sequence
  const transposedSeq = transposeNoteSequence(seq, transpose, instrumentValue);
  _midiCurrentTransposedSeq = transposedSeq;

  // Get SoundFont URL
  const sfUrl = (prefs && prefs.midiSoundfont) || MIDI_SOUNDFONT_URL;

  // Create or reuse SoundFontPlayer (recreate if URL changed)
  if (!_midiSfPlayer || _midiSfPlayer._soundFontURL !== sfUrl) {
    _midiSfPlayer = new core.SoundFontPlayer(sfUrl);
    _midiSfPlayer._soundFontURL = sfUrl;
  }

  // Progress: 50% after creating sequence
  if (midiPreloadFill) midiPreloadFill.style.width = "50%";

  try {
    // Load the samples needed for this specific sequence
    await _midiSfPlayer.loadSamples(transposedSeq);
  } catch (err) {
    console.warn("Failed to load SoundFont samples:", err);
    _midiSfPlayerLoading = false;
    if (midiPreloadBar) midiPreloadBar.style.display = "none";
    return;
  }

  // Progress: 100%
  if (midiPreloadFill) midiPreloadFill.style.width = "100%";

  // Store duration
  const knownDuration = seq.totalTime || transposedSeq.totalTime || 0;
  window._midiKnownDuration = knownDuration;
  MidiTimeAuthority.setDuration(knownDuration);

  _midiSfPlayerReady = true;
  _midiSfPlayerLoading = false;

  // Hide progress bar
  setTimeout(() => {
    if (midiPreloadBar) midiPreloadBar.style.display = "none";
  }, 300);

  if (forceStart) {
    const volNode = getToneVolNode();
    if (volNode && volNode.volume) {
      volNode.volume.cancelScheduledValues(window.Tone.now());
      volNode.volume.value = MIDI_SILENT_VOLUME;
    }

    if (window.Tone && window.Tone.start) {
      try { await window.Tone.start(); } catch (e) {}
    }

    _midiSfPlayer.start(transposedSeq);
    MidiTimeAuthority.setTime(0, knownDuration);
    MidiTimeAuthority.setPlaying(true);

    fadeMidiVolume(MIDI_TARGET_VOLUME, MIDI_FADE_IN_MS);

    customPlayIcon.textContent = "pause";
    document.getElementById("custom-midi-player").classList.add("playing");
  }

  syncSeekbarUI(0, knownDuration);
  window.isMidiSwitching = false;
}

/**
 * Gapless transpose: stop, retranscribe, reload samples, restart from same position.
 * Much faster than the old 12-player pool swap since we only load
 * the samples needed for the NEW pitch range (delta only).
 *
 * @param {number} step - Transpose step (-5 to +6)
 */
async function swapTranspose(step) {
  if (!_midiOriginalSeq || !_midiSfPlayer) return;
  if (_midiSfPlayerLoading) return;

  const wasPlaying = _midiSfPlayer.isPlaying();
  const dur = MidiTimeAuthority.getDuration() || window._midiKnownDuration || 0;
  const currTime = MidiTimeAuthority.getTime();

  // Resolve instrument
  let instrumentValue = "-1";
  if (prefs && prefs.midiInstrument !== undefined) {
    instrumentValue = prefs.midiInstrument;
  } else if (customInstrumentSelect && customInstrumentSelect.dataset.value) {
    instrumentValue = customInstrumentSelect.dataset.value;
  }

  // Create new transposed sequence
  const newSeq = transposeNoteSequence(_midiOriginalSeq, step, instrumentValue);
  _midiCurrentTransposedSeq = newSeq;

  _midiSfPlayerLoading = true;
  window.isMidiSwitching = true;

  // Freeze authority
  MidiTimeAuthority.setPlaying(false);
  if (wasPlaying) MidiTimeAuthority.setTime(currTime, dur);

  // Stop current playback
  if (wasPlaying) {
    try { _midiSfPlayer.stop(); } catch (e) {}
  }

  // Load new samples (only fetches missing pitch samples — cached ones are reused)
  try {
    await _midiSfPlayer.loadSamples(newSeq);
  } catch (err) {
    console.warn("Failed to load transposed samples:", err);
  }

  _midiSfPlayerLoading = false;
  window.isMidiSwitching = false;

  // Resume from same position
  if (wasPlaying) {
    const volNode = getToneVolNode();
    if (volNode && volNode.volume) {
      volNode.volume.cancelScheduledValues(window.Tone.now());
      volNode.volume.value = MIDI_TARGET_VOLUME;
    }

    try {
      _midiSfPlayer.start(newSeq, undefined, currTime);
    } catch (e) {}

    MidiTimeAuthority.setTime(currTime, dur);
    MidiTimeAuthority.setPlaying(true);

    customPlayIcon.textContent = "pause";
    document.getElementById("custom-midi-player").classList.add("playing");
  }

  syncSeekbarUI(wasPlaying ? currTime : MidiTimeAuthority.getTime(), dur);
  window._midiLastSeekValue = -1;
}

/**
 * Instrument change — reload samples with new instrument program.
 */
async function changeInstrument() {
  if (!_midiOriginalSeq) return;

  const wasPlaying = _midiSfPlayer && _midiSfPlayer.isPlaying();
  const currTime = MidiTimeAuthority.getTime();
  const dur = MidiTimeAuthority.getDuration() || window._midiKnownDuration || 0;

  // Freeze authority
  MidiTimeAuthority.setPlaying(false);
  if (wasPlaying) MidiTimeAuthority.setTime(currTime, dur);

  // Stop current player
  if (_midiSfPlayer && _midiSfPlayer.isPlaying()) {
    try { _midiSfPlayer.stop(); } catch (e) {}
  }

  window.isMidiSwitching = true;

  // Recreate player to pick up new instrument (SoundFont caches by program number)
  const sfUrl = (prefs && prefs.midiSoundfont) || MIDI_SOUNDFONT_URL;
  _midiSfPlayer = new core.SoundFontPlayer(sfUrl);

  const currentTranspose = typeof transposeStep === "number" ? transposeStep : 0;

  // Resolve instrument
  let instrumentValue = "-1";
  if (prefs && prefs.midiInstrument !== undefined) {
    instrumentValue = prefs.midiInstrument;
  } else if (customInstrumentSelect && customInstrumentSelect.dataset.value) {
    instrumentValue = customInstrumentSelect.dataset.value;
  }

  const newSeq = transposeNoteSequence(_midiOriginalSeq, currentTranspose, instrumentValue);
  _midiCurrentTransposedSeq = newSeq;

  _midiSfPlayerLoading = true;

  if (midiPreloadBar) {
    midiPreloadBar.style.display = "block";
    midiPreloadFill.style.width = "0%";
  }

  try {
    await _midiSfPlayer.loadSamples(newSeq);
  } catch (err) {
    console.warn("Failed to load instrument samples:", err);
  }

  if (midiPreloadFill) midiPreloadFill.style.width = "100%";
  setTimeout(() => {
    if (midiPreloadBar) midiPreloadBar.style.display = "none";
  }, 300);

  _midiSfPlayerLoading = false;

  // Restore position and playback
  if (wasPlaying) {
    const volNode = getToneVolNode();
    if (volNode && volNode.volume) {
      volNode.volume.cancelScheduledValues(window.Tone.now());
      volNode.volume.value = MIDI_SILENT_VOLUME;
    }

    try {
      _midiSfPlayer.start(newSeq, undefined, currTime);
    } catch (e) {}

    MidiTimeAuthority.setTime(currTime, dur);
    MidiTimeAuthority.setPlaying(true);
    fadeMidiVolume(MIDI_TARGET_VOLUME, MIDI_FADE_IN_MS);

    customPlayIcon.textContent = "pause";
    document.getElementById("custom-midi-player").classList.add("playing");
  }

  syncSeekbarUI(currTime, dur);
  window.isMidiSwitching = false;
}

/**
 * Force-update all seekbar UI elements to known-good values.
 * Called during transitions to prevent stale data from the interval.
 */
function syncSeekbarUI(time, duration) {
  const dur = duration || 0;
  const t = Math.max(0, time || 0);

  if (typeof customSeekbar !== "undefined" && customSeekbar) {
    customSeekbar.max = dur;
    customSeekbar.value = t;
    const fill = document.getElementById("custom-seekbar-fill");
    if (fill) {
      fill.style.width = dur > 0 ? (t / dur) * 100 + "%" : "0%";
    }
  }
  if (typeof customTimeDisplay !== "undefined" && customTimeDisplay) {
    customTimeDisplay.textContent = `${formatMidiTime(t)} / ${dur > 0 ? formatMidiTime(dur) : "0:00"}`;
  }

  // Mini player UI sync
  const miniSeekbar = document.getElementById("mini-seekbar");
  if (miniSeekbar) {
    miniSeekbar.max = dur;
    miniSeekbar.value = t;
    const miniFill = document.getElementById("mini-seekbar-fill");
    if (miniFill) {
      miniFill.style.width = dur > 0 ? (t / dur) * 100 + "%" : "0%";
    }
  }
  const miniTimeDisplay = document.getElementById("mini-time-display");
  if (miniTimeDisplay) {
    miniTimeDisplay.textContent = `${formatMidiTime(t)} / ${dur > 0 ? formatMidiTime(dur) : "0:00"}`;
  }
}
