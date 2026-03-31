// --- 6. PDF Viewer ---
async function openPdfViewer(songId) {
  currentSongIndex = parseInt(songId, 10);
  const song = pujianItems[currentSongIndex];
  if (!song) return;

  songTitleWrapper.classList.add("is-navigating");
  canvasWrapper.classList.add("is-navigating");
  await new Promise((resolve) => setTimeout(resolve, 150));

  pdfViewerTitle.textContent = song.judul;
  pdfViewerNumber.textContent = `No. ${song.nomor}`;
  songTitleWrapper.classList.remove("is-navigating");
  fitViewerTitle();

  if (!document.body.classList.contains("viewer-active")) {
    document.body.classList.add("viewer-active");
  }

  // Check header layout collisions once viewer is active
  if (typeof checkLayoutCollisions === "function") {
    checkLayoutCollisions();
  }

  currentScale = "page-fit";
  chordConfig = createDefaultChordConfig();

  // Reset transpose saat ganti lagu
  transposeStep = 0;
  updateTransposeUI();

  // Setup MIDI Player
  if (typeof mainMidiPlayer !== "undefined" && mainMidiPlayer && midiToggleBtn) {
    const volNode = getToneVolNode();
    const wasPlayingGlobal = (activeMidiPlayer && activeMidiPlayer.playing);

    if (wasPlayingGlobal && volNode && volNode.volume && window.Tone) {
      const t = window.Tone.now();
      volNode.volume.cancelScheduledValues(t);
      volNode.volume.setValueAtTime(volNode.volume.value, t);
      volNode.volume.linearRampToValueAtTime(MIDI_SILENT_VOLUME, t + MIDI_FADE_OUT_MS / 1000);
      await new Promise(r => setTimeout(r, MIDI_FADE_OUT_MS + 50));
    }

    // Stop BOTH players and reset state
    try { mainMidiPlayer.stop(); } catch(e) {}
    try { if (standbyMidiPlayer) standbyMidiPlayer.stop(); } catch(e) {}
    MidiTimeAuthority.reset();
    window._midiSavedTime = null;
    _midiOriginalSeq = null;
    _midiTransitionLock = false;
    _midiQueuedTransition = null;
    if (_midiTransposeDebounceTimer) { clearTimeout(_midiTransposeDebounceTimer); _midiTransposeDebounceTimer = null; }
    window.isMidiSwitching = false;

    // Reset active/standby to defaults
    activeMidiPlayer = mainMidiPlayer;
    standbyMidiRef = standbyMidiPlayer;

    if (volNode && volNode.volume) {
      volNode.volume.value = MIDI_SILENT_VOLUME;
    }

    let rawUrl = song.fileHref;
    if (rawUrl) {
      rawUrl = rawUrl.replace(/\/pdf\//i, '/midi/').replace(/\.pdf$/i, '.mid');
    }

    if (window.core && typeof window.core.urlToNoteSequence === 'function') {
      // Clear current sequences on both players
      mainMidiPlayer.src = null;
      mainMidiPlayer.noteSequence = null;
      if (standbyMidiPlayer) {
        standbyMidiPlayer.src = null;
        standbyMidiPlayer.noteSequence = null;
      }

      window.core.urlToNoteSequence(encodeURI(rawUrl)).then(seq => {
        // Store original sequence globally
        _midiOriginalSeq = seq;
        // Store known-good duration
        if (seq && seq.totalTime) {
          window._midiKnownDuration = seq.totalTime;
          MidiTimeAuthority.setDuration(seq.totalTime);
        }

        // Use applyMidiInstrument with wasPlayingGlobal to ensure smooth transition
        applyMidiInstrument(wasPlayingGlobal);
      }).catch(err => {
        console.warn('Gagal memuat MIDI:', err);
        window.isMidiSwitching = false;
      });
    } else {
      // Fallback reguler
      mainMidiPlayer.src = encodeURI(rawUrl);
    }

    // Set UI dropdown dengan preferensi yg ada
    if (prefs.midiInstrument && typeof customInstrumentSelect !== "undefined" && customInstrumentSelect) {
      customInstrumentSelect.dataset.value = prefs.midiInstrument;
      const iconEl = document.getElementById("cis-icon");
      if (iconEl) {
        const option = document.querySelector(`.cis-option[data-val="${prefs.midiInstrument}"]`);
        if (option) {
          iconEl.textContent = getMidiInstrumentIcon(prefs.midiInstrument);
          document.querySelectorAll('.cis-option').forEach(opt => opt.classList.remove('selected'));
          option.classList.add('selected');
        }
      }
    }

    midiToggleBtn.style.display = 'flex';
    if (typeof midiPanel !== "undefined" && midiPanel) {
      midiToggleBtn.setAttribute('aria-expanded', 'false');
    }
  }

  // Pertahankan state chord editor (jangan reset chordEditorEnabled = false)
  updateChordEditorUI();

  const options = {
    url: song.fileHref,
    standardFontDataUrl: "https://mozilla.github.io/pdf.js/standard_fonts/"
  };

  try {
    const loadingTask = pdfjsLib.getDocument(options);
    pdfDoc = await loadingTask.promise;
    
    // Extract PDF Key
    try {
      const page1 = await pdfDoc.getPage(1);
      const textContent = await page1.getTextContent();
      const pdfText = textContent.items.map(item => item.str).join(' ');
      
      const keyMatch = pdfText.match(/(?:(?:do|la)\s*={1,2}\s*|[23469]\s*[\/|]\s*[248]\s+)([A-G](?:es|is|s|#|b)?(?:m)?)\b/i);
      if (keyMatch) {
        originalPdfKey = keyMatch[1];
      } else {
        originalPdfKey = null;
      }
    } catch (err) {
      console.warn("Gagal mengekstrak teks PDF untuk mendeteksi nada dasar:", err);
      originalPdfKey = null;
    }

    [pageCountElPortrait, pageCountElLandscape].forEach((el) => {
      el.textContent = pdfDoc.numPages;
    });

    await loadChordConfigurationForSong(song);

    currentPageNum = 1;
    currentViewMode = pdfDoc.numPages > 1 && prefs.defaultTwoPage ? "double" : "single";
    currentScrollMode = prefs.defaultVerticalScroll ? "vertical" : "horizontal";

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

    await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;

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
      animatePreview: true
    });
  } finally {
    zoomInProgress = false;
  }
}

async function resetZoomToDefault(anchorClientX, anchorClientY) {
  if (!pdfDoc || zoomInProgress) return;

  const oldScale = typeof currentScale === "number" ? currentScale : initialScale;
  const newScale = initialScale;
  if (!Number.isFinite(oldScale) || !Number.isFinite(newScale) || newScale <= 0) return;
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
      animatePreview: true
    });
    showToast("Zoom direset ke 100%", "center_focus_strong");
  } finally {
    zoomInProgress = false;
  }
}

async function applyScaleAndRerender({ oldScale, newScale, anchorClientX, anchorClientY, animatePreview = false }) {
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
  const newBaseX = container.scrollLeft + (newWrapperRectBeforeScroll.left - freshRect.left);
  const newBaseY = container.scrollTop + (newWrapperRectBeforeScroll.top - freshRect.top);

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
  const isSecondTap = currentEl === lastIndicatorTapEl && (now - lastIndicatorTapAt) <= INDICATOR_DOUBLE_TAP_DELAY;
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
  currentScrollMode = currentScrollMode === "horizontal" ? "vertical" : "horizontal";
  if (currentScrollMode === "vertical") {
    currentViewMode = "single";
  }
  currentScale = "page-fit";
  updateViewerUI();
  animateViewChange(() => renderPage(currentPageNum));
}

async function onPrevSong() {
  if (currentSongIndex > 0) {
    await openPdfViewer(currentSongIndex - 1);
  }
}

async function onNextSong() {
  if (currentSongIndex < pujianItems.length - 1) {
    await openPdfViewer(currentSongIndex + 1);
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
 * Dual-player crossfade MIDI instrument/transpose applicator.
 *
 * Architecture:
 * - Two <midi-player> elements alternate roles (active / standby)
 * - The active player keeps playing while the standby pre-loads the transposed sequence
 * - Once loaded, a fast overlap switch (~30ms) provides near-gapless transition
 * - MidiTimeAuthority is the single source of truth for playback time
 * - A mutex prevents overlapping transitions
 */
async function applyMidiInstrument(forceStart = false) {
  if (!_midiOriginalSeq) return;

  // --- MUTEX: If a transition is already in progress, queue this request ---
  if (_midiTransitionLock) {
    _midiQueuedTransition = { forceStart };
    return;
  }
  _midiTransitionLock = true;

  try {
    await _doApplyMidiInstrument(forceStart);
  } catch (err) {
    console.error('applyMidiInstrument error:', err);
  } finally {
    _midiTransitionLock = false;

    // Process queued transition if any
    if (_midiQueuedTransition) {
      const queued = _midiQueuedTransition;
      _midiQueuedTransition = null;
      // Use setTimeout(0) to avoid stack overflow from recursive calls
      setTimeout(() => applyMidiInstrument(queued.forceStart), 0);
    }
  }
}

async function _doApplyMidiInstrument(forceStart) {
  const seq = _midiOriginalSeq;
  if (!seq) return;

  let instrumentValue = "-1";
  if (prefs && prefs.midiInstrument !== undefined) {
    instrumentValue = prefs.midiInstrument;
  } else if (typeof customInstrumentSelect !== "undefined" && customInstrumentSelect && customInstrumentSelect.dataset.value) {
    instrumentValue = customInstrumentSelect.dataset.value;
  }

  const instrInt = parseInt(instrumentValue, 10);
  const currentTranspose = typeof transposeStep === 'number' ? transposeStep : 0;

  const oldPlayer = activeMidiPlayer;
  const newPlayer = standbyMidiRef;
  if (!oldPlayer || !newPlayer) return;

  const wasPlaying = (oldPlayer.playing) || forceStart;

  // --- Snapshot time from MidiTimeAuthority (NOT the player) ---
  const authorityTime = MidiTimeAuthority.getTime();
  const authorityDuration = MidiTimeAuthority.getDuration() || window._midiKnownDuration || 0;

  // Signal seekbar interval to stop updating
  window.isMidiSwitching = true;

  // --- Clone and apply transpose/instrument (synchronous, fast) ---
  let newSequence;
  try {
    newSequence = JSON.parse(JSON.stringify(seq));
    if (newSequence.notes) {
      for (let i = 0; i < newSequence.notes.length; i++) {
        const note = newSequence.notes[i];
        if (!note.isDrum) {
          if (instrInt >= 0) note.program = instrInt;
          if (currentTranspose !== 0) {
            note.pitch = Math.max(0, Math.min(127, note.pitch + currentTranspose));
          }
        }
      }
    }
  } catch (e) {
    console.error("Failed to clone sequence:", e);
    window.isMidiSwitching = false;
    return;
  }

  // --- Pre-load sequenceinto STANDBY player (old player keeps playing!) ---
  const loadPromise = new Promise(resolve => {
    let isDone = false;
    const complete = () => {
      if (isDone) return;
      isDone = true;
      newPlayer.removeEventListener('load', complete);
      resolve();
    };
    newPlayer.addEventListener('load', complete);
    setTimeout(complete, 300); // Fallback timeout
  });

  newPlayer.noteSequence = newSequence;
  await loadPromise;

  // --- Calculate target time ---
  // Use authority time + elapsed time since snapshot
  const knownDuration = newPlayer.duration || authorityDuration;
  window._midiKnownDuration = knownDuration;
  MidiTimeAuthority.setDuration(knownDuration);

  // Get fresh time from authority (accounts for time that passed during load)
  let targetTime = MidiTimeAuthority.getTime();
  if (knownDuration > 0) {
    targetTime = Math.max(0, Math.min(targetTime, knownDuration - 0.05));
  }

  // --- Force-sync seekbar BEFORE the switch ---
  syncSeekbarUI(targetTime, knownDuration);

  const volNode = getToneVolNode();

  // --- GAPLESS OVERLAP SWITCH ---
  if (wasPlaying) {
    try {
      // 1. Set new player position BEFORE starting
      newPlayer.currentTime = targetTime;

      // 2. Start new player while old player is STILL PLAYING
      const startPromise = newPlayer.start();
      if (startPromise && typeof startPromise.then === 'function') {
        // Wait for the start promise to resolve if it returns one
        await startPromise.catch(() => {});
      }

      // Set time AGAIN after start because some players reset it to 0 internally on start
      try { newPlayer.currentTime = targetTime; } catch(e) {}

      // 3. Give the new player a tiny window to populate its audio buffers 
      // before stopping the old one to prevent a dry gap
      await new Promise(r => setTimeout(r, 50));

      // 4. Stop old player
      oldPlayer.stop();

      // 5. Update authority
      MidiTimeAuthority.setTime(targetTime, knownDuration);
      MidiTimeAuthority.setPlaying(true);

      // 6. Verify time stuck after a short delay
      setTimeout(() => {
        if (newPlayer.playing && knownDuration > 0) {
          const actual = newPlayer.currentTime || 0;
          if (Math.abs(actual - targetTime) > 2.0 && targetTime > 2.0) {
            try { newPlayer.currentTime = targetTime; } catch(e) {}
          }
          // Sync authority to actual player time once stable
          MidiTimeAuthority.sync(newPlayer.currentTime || targetTime);
          syncSeekbarUI(MidiTimeAuthority.getTime(), knownDuration);
        }
      }, 150);
    } catch (e) {
      console.error("Error during player switch:", e);
    }
  } else {
    // Not playing: just load the sequence into standby, stop old, swap
    oldPlayer.stop();
    try {
      newPlayer.currentTime = targetTime;
    } catch(e) {}
    MidiTimeAuthority.setTime(targetTime, knownDuration);
    MidiTimeAuthority.setPlaying(false);
    if (volNode && volNode.volume) {
      volNode.volume.value = MIDI_TARGET_VOLUME;
    }
  }

  // --- SWAP active/standby references ---
  activeMidiPlayer = newPlayer;
  standbyMidiRef = oldPlayer;

  // Reset seekbar tracking
  window._midiLastSeekValue = -1;
  window.isMidiSwitching = false;
}

/**
 * Debounced version of applyMidiInstrument for transpose operations.
 * Batches rapid transpose presses so only the final value triggers a transition.
 */
function applyMidiInstrumentDebounced() {
  if (_midiTransposeDebounceTimer) {
    clearTimeout(_midiTransposeDebounceTimer);
  }
  _midiTransposeDebounceTimer = setTimeout(() => {
    _midiTransposeDebounceTimer = null;
    applyMidiInstrument();
  }, MIDI_TRANSPOSE_DEBOUNCE_MS);
}

/**
 * Force-update all seekbar UI elements to known-good values.
 * Called during transitions to prevent stale data from the interval.
 */
function syncSeekbarUI(time, duration) {
  const dur = duration || 0;
  const t = Math.max(0, time || 0);

  if (typeof customSeekbar !== 'undefined' && customSeekbar) {
    customSeekbar.max = dur;
    customSeekbar.value = t;
    const fill = document.getElementById('custom-seekbar-fill');
    if (fill) {
      fill.style.width = dur > 0 ? ((t / dur) * 100) + '%' : '0%';
    }
  }
  if (typeof customTimeDisplay !== 'undefined' && customTimeDisplay) {
    const fmt = (s) => {
      const i = Math.floor(s || 0);
      return `${Math.floor(i / 60)}:${(i % 60).toString().padStart(2, '0')}`;
    };
    customTimeDisplay.textContent = `${fmt(t)} / ${dur > 0 ? fmt(dur) : '0:00'}`;
  }
}
