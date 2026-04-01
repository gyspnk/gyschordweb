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
  if (MIDI_PLAYER_POOL[0] && midiToggleBtn) {
    const wasForcedNext = window._forceAutoPlayNext === true;
    const wasPlayingGlobal =
      (activeMidiPlayer && activeMidiPlayer.playing) ||
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
      if (playIcon && activeMidiPlayer) {
        playIcon.textContent = activeMidiPlayer.playing
          ? "pause"
          : "play_arrow";
      }
      if (midiPlayerEl && activeMidiPlayer) {
        midiPlayerEl.classList.toggle("playing", activeMidiPlayer.playing);
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
      if (activeMidiPlayer && activeMidiPlayer.playing) {
        await fadeMidiVolume(MIDI_SILENT_VOLUME, MIDI_FADE_OUT_MS);
      }

      // Stop ALL pool players and reset MIDI state
      Object.values(MIDI_PLAYER_POOL).forEach((p) => {
        try {
          p.stop();
        } catch (e) {}
      });
      resetMidiState();

      const volNode = getToneVolNode();
      if (volNode && volNode.volume) {
        volNode.volume.value = MIDI_SILENT_VOLUME;
      }

      if (window.core && typeof window.core.urlToNoteSequence === "function") {
        // Clear sequences on all pool players
        Object.values(MIDI_PLAYER_POOL).forEach((p) => {
          p.src = null;
          p.noteSequence = null;
        });

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

            // Pre-load all 12 transposed variants into the pool
            const currentTranspose =
              typeof transposeStep === "number" ? transposeStep : 0;
            window.window.preloadAllTransposes(seq, {
              forceStart: wasForcedNext,
              startTranspose: currentTranspose,
            });
          })
          .catch((err) => {
            console.warn("Gagal memuat MIDI:", err);
            window.isMidiSwitching = false;
          });
      } else {
        // Fallback reguler
        MIDI_PLAYER_POOL[0].src = encodeURI(rawUrl);
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
    typeof activeMidiPlayer !== 'undefined'
  ) {
    const currTime = MidiTimeAuthority.getTime();
    if (currTime > 2) {
      try {
        activeMidiPlayer.currentTime = 0;
        MidiTimeAuthority.setTime(0, MidiTimeAuthority.getDuration());
        if (forceAutoplay && !activeMidiPlayer.playing) {
          activeMidiPlayer.start();
          MidiTimeAuthority.setPlaying(true);
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
 * Pre-load ALL 12 transposed NoteSequences into the player pool.
 * Called when a song opens or when the instrument changes.
 * Shows a progress bar during loading.
 *
 * @param {object} seq - The original NoteSequence
 * @param {object} [opts]
 * @param {boolean} [opts.forceStart=false] - Start playback after loading
 * @param {number}  [opts.startTranspose=0] - Which transpose to activate first
 */
window.preloadAllTransposes = async function (seq, opts = {}) {
  if (!seq) return;
  const { forceStart = false, startTranspose = 0 } = opts;

  _midiPoolPreloading = true;
  _midiPoolPreloaded = false;

  // Resolve instrument
  let instrumentValue = "-1";
  if (prefs && prefs.midiInstrument !== undefined) {
    instrumentValue = prefs.midiInstrument;
  } else if (
    typeof customInstrumentSelect !== "undefined" &&
    customInstrumentSelect &&
    customInstrumentSelect.dataset.value
  ) {
    instrumentValue = customInstrumentSelect.dataset.value;
  }
  const instrInt = parseInt(instrumentValue, 10);

  // Show progress bar
  if (midiPreloadBar) {
    midiPreloadBar.style.display = "block";
    midiPreloadFill.style.width = "0%";
  }

  const steps = Object.keys(MIDI_PLAYER_POOL)
    .map(Number)
    .sort((a, b) => {
      // Load the startTranspose first, then fan outward
      return Math.abs(a - startTranspose) - Math.abs(b - startTranspose);
    });

  const totalSteps = steps.length;
  let loaded = 0;

  const queue = steps.filter((s) => s !== startTranspose);

  const loadSingleTranspose = (step) => {
    return new Promise((resolve) => {
      const player = MIDI_PLAYER_POOL[step];
      if (!player) return resolve();

      const clone = JSON.parse(JSON.stringify(seq));
      if (seq.totalTime) clone.totalTime = seq.totalTime;
      if (clone.notes) {
        for (let i = 0; i < clone.notes.length; i++) {
          const note = clone.notes[i];
          if (!note.isDrum) {
            if (instrInt >= 0) note.program = instrInt;
            if (step !== 0) {
              note.pitch = Math.max(0, Math.min(127, note.pitch + step));
            }
          }
        }
      }

      let isDone = false;
      const complete = () => {
        if (isDone) return;
        isDone = true;
        player.removeEventListener("load", complete);
        loaded++;
        if (midiPreloadFill) {
          midiPreloadFill.style.width = (loaded / totalSteps) * 100 + "%";
        }
        resolve();
      };
      player.addEventListener("load", complete);
      setTimeout(complete, MIDI_LOAD_TIMEOUT_MS);

      // Setting noteSequence triggers the heavy WebAudio parsing in Magenta
      player.noteSequence = clone;
    });
  };

  // Wait for the active requested transpose synchronously
  await loadSingleTranspose(startTranspose);

  // Store duration
  const knownDuration =
    seq.totalTime || MIDI_PLAYER_POOL[startTranspose]?.duration || 0;
  window._midiKnownDuration = knownDuration;
  MidiTimeAuthority.setDuration(knownDuration);

  // Background deferred loading queue for remaining transposes
  // We use a 30ms minimal delay to yield the event loop (avoiding Tone.js audio jitter),
  // which will fully load all 11 alternative transposes in just ~330ms!
  (async () => {
    for (let step of queue) {
      await new Promise((r) => setTimeout(r, 30));
      await loadSingleTranspose(step);
    }

    _midiPoolPreloaded = true;
    _midiPoolPreloading = false;

    // Hide progress bar smoothly
    if (midiPreloadBar && loaded >= totalSteps) {
      setTimeout(() => {
        Object.assign(midiPreloadBar.style, { display: "none" });
      }, 300);
    }
  })();

  // Do not flag preload as done synchronously, but allow active transpose to start
  _midiPoolPreloaded = false;

  // Activate the requested transpose player.
  // We check the global transposeStep because chord rendering might have updated
  // the transpose (e.g., auto-detecting flat keys) during the async preload.
  const finalTranspose =
    typeof transposeStep === "number" ? transposeStep : startTranspose;
  const targetPlayer = MIDI_PLAYER_POOL[finalTranspose];
  if (targetPlayer) {
    activeMidiPlayer = targetPlayer;

    if (forceStart) {
      const volNode = getToneVolNode();
      if (volNode && volNode.volume) {
        volNode.volume.cancelScheduledValues(window.Tone.now());
        volNode.volume.value = MIDI_SILENT_VOLUME;
      }

      targetPlayer.start();
      MidiTimeAuthority.setTime(0, knownDuration);
      MidiTimeAuthority.setPlaying(true);

      // Smooth fade-in
      fadeMidiVolume(MIDI_TARGET_VOLUME, MIDI_FADE_IN_MS);

      customPlayIcon.textContent = "pause";
      document.getElementById("custom-midi-player").classList.add("playing");
    }

    syncSeekbarUI(0, knownDuration);
  }

  window.isMidiSwitching = false;
};

/**
 * INSTANT (0ms) transpose swap using the pre-loaded player pool.
 *
 * Protocol:
 * 1. Get current time from authority (wall-clock, matches seekbar)
 * 2. Pre-set new player position
 * 3. Start new player
 * 4. Re-seek after start (html-midi-player resets to 0)
 * 5. Stop old player after brief overlap
 * 6. Swap activeMidiPlayer
 *
 * @param {number} step - Transpose step (-5 to +6)
 */
function swapToPoolPlayer(step) {
  if (!_midiPoolPreloaded || _midiPoolPreloading) return;

  const newPlayer = MIDI_PLAYER_POOL[step];
  const oldPlayer = activeMidiPlayer;
  if (!newPlayer || newPlayer === oldPlayer) return;

  const wasPlaying = oldPlayer && oldPlayer.playing;
  const dur = MidiTimeAuthority.getDuration() || window._midiKnownDuration || 0;

  // IMPORTANT: Set activeMidiPlayer BEFORE start so syncPlayState listeners
  // recognize events from the new player (not the old one)
  activeMidiPlayer = newPlayer;

  if (wasPlaying) {
    // Get seekbar time
    const syncTime = Math.max(
      0,
      Math.min(MidiTimeAuthority.getTime(), dur - 0.05),
    );

    // Ensure volume is audible
    const volNode = getToneVolNode();
    if (volNode && volNode.volume) {
      volNode.volume.cancelScheduledValues(window.Tone.now());
      volNode.volume.value = MIDI_TARGET_VOLUME;
    }

    // Pre-set position, start, re-seek
    newPlayer.currentTime = syncTime;

    const startPromise = newPlayer.start();
    if (startPromise && typeof startPromise.then === "function") {
      startPromise.catch(() => {});
    }

    // Re-seek after start (start() may reset to 0)
    try {
      newPlayer.currentTime = syncTime;
    } catch (e) {}

    // html-midi-player may have paused when currentTime was set. Restart if needed.
    if (!newPlayer.playing) {
      try {
        newPlayer.start();
      } catch (e) {}
    }

    // Stop old after brief overlap
    setTimeout(() => {
      if (oldPlayer && oldPlayer !== activeMidiPlayer) {
        oldPlayer.stop();
      }
    }, 40);

    // Anchor authority
    MidiTimeAuthority.setTime(syncTime, dur);
    MidiTimeAuthority.setPlaying(true);
    syncSeekbarUI(syncTime, dur);

    // Explicitly set UI (don't rely on events)
    customPlayIcon.textContent = "pause";
    document.getElementById("custom-midi-player").classList.add("playing");
  } else {
    // Not playing — just swap reference
    const currTime = MidiTimeAuthority.getTime();
    try {
      newPlayer.currentTime = currTime;
    } catch (e) {}
  }

  window._midiLastSeekValue = -1;
}

/**
 * Instrument change — re-preload all 12 pool players with new instrument.
 * Uses a loading overlay since this requires full re-load.
 */
async function changeInstrument() {
  if (!_midiOriginalSeq) return;

  const wasPlaying = activeMidiPlayer && activeMidiPlayer.playing;
  const currTime = MidiTimeAuthority.getTime();
  const dur = MidiTimeAuthority.getDuration() || window._midiKnownDuration || 0;

  // Freeze authority
  MidiTimeAuthority.setPlaying(false);
  if (wasPlaying) MidiTimeAuthority.setTime(currTime, dur);

  // Stop current player
  if (activeMidiPlayer && activeMidiPlayer.playing) {
    try {
      activeMidiPlayer.stop();
    } catch (e) {}
  }

  window.isMidiSwitching = true;

  // Re-preload all 12 with new instrument
  const currentTranspose =
    typeof transposeStep === "number" ? transposeStep : 0;
  await window.window.preloadAllTransposes(_midiOriginalSeq, {
    forceStart: false,
    startTranspose: currentTranspose,
  });

  // Restore position and playback
  const targetPlayer = MIDI_PLAYER_POOL[currentTranspose];
  if (targetPlayer) {
    activeMidiPlayer = targetPlayer;
    try {
      targetPlayer.currentTime = currTime;
    } catch (e) {}

    if (wasPlaying) {
      const volNode = getToneVolNode();
      if (volNode && volNode.volume) {
        volNode.volume.cancelScheduledValues(window.Tone.now());
        volNode.volume.value = MIDI_SILENT_VOLUME;
      }

      targetPlayer.start();
      try {
        targetPlayer.currentTime = currTime;
      } catch (e) {}

      MidiTimeAuthority.setTime(currTime, dur);
      MidiTimeAuthority.setPlaying(true);
      fadeMidiVolume(MIDI_TARGET_VOLUME, MIDI_FADE_IN_MS);

      customPlayIcon.textContent = "pause";
      document.getElementById("custom-midi-player").classList.add("playing");
    }

    syncSeekbarUI(currTime, dur);
  }

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
