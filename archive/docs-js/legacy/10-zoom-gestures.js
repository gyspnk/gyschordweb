// --- 9. Zoom & gesture guards ---
function showToast(message, icon = "info") {
  if (toastTimeout) clearTimeout(toastTimeout);
  if (generalToastIcon) generalToastIcon.textContent = icon;

  const existingTextNode = Array.from(generalToast.childNodes).find(
    (n) => n.nodeType === Node.TEXT_NODE,
  );
  if (existingTextNode) {
    existingTextNode.textContent = ` ${message}`;
  } else {
    generalToast.appendChild(document.createTextNode(` ${message}`));
  }

  generalToast.classList.add("show");
  toastTimeout = setTimeout(() => {
    generalToast.classList.remove("show");
  }, 2500);
}

function showZoomToast(message, icon = "zoom_in") {
  if (zoomToastTimeout) clearTimeout(zoomToastTimeout);
  if (zoomToastIcon) zoomToastIcon.textContent = icon;

  const existingTextNode = Array.from(zoomToast.childNodes).find(
    (n) => n.nodeType === Node.TEXT_NODE,
  );
  if (existingTextNode) {
    existingTextNode.textContent = ` ${message}`;
  } else {
    zoomToast.appendChild(document.createTextNode(` ${message}`));
  }

  zoomToast.classList.add("show");
  zoomToastTimeout = setTimeout(() => {
    zoomToast.classList.remove("show");
  }, 2500);
}

function handleGlobalScroll(event) {
  if (!event.ctrlKey) return;

  event.preventDefault();
  if (!document.body.classList.contains("viewer-active")) return;

  // Smooth continuous scroll zoom instead of fixed steps
  handleContinuousWheelZoom(event);
}

function handleContinuousWheelZoom(event) {
  if (wheelRenderTimeout) {
    clearTimeout(wheelRenderTimeout);
    wheelRenderTimeout = null;
  }

  if (!wheelState) {
    const baseScale =
      typeof currentScale === "number" ? currentScale : initialScale;
    const rect = pdfViewerContent.getBoundingClientRect();
    const activeRect = canvasWrapper.getBoundingClientRect();

    const centerX = event.clientX;
    const centerY = event.clientY;

    const anchorInWrapperX = centerX - activeRect.left;
    const anchorInWrapperY = centerY - activeRect.top;

    wheelState = {
      baseScale,
      previewScale: baseScale,
      centerClientX: centerX,
      centerClientY: centerY,
      anchorInWrapperX,
      anchorInWrapperY,
      initScrollLeft: pdfViewerContent.scrollLeft,
      initScrollTop: pdfViewerContent.scrollTop,
      anchorViewportX: centerX - rect.left,
      anchorViewportY: centerY - rect.top,
    };

    // We use wheel-preview styling machinery for smooth un-rendered CSS scaling
    canvasWrapper.classList.add("wheel-preview");
  }

  // Normalize delta across browsers
  let deltaYPixels = event.deltaY;
  if (event.deltaMode === 1)
    deltaYPixels *= 33; // DOM_DELTA_LINE
  else if (event.deltaMode === 2) deltaYPixels *= 100; // DOM_DELTA_PAGE

  // Batasi kecepatan scroll yang berlebihan untuk mencegah glitch (clamp deltaY)
  const maxDelta = 120;
  deltaYPixels = Math.max(-maxDelta, Math.min(maxDelta, deltaYPixels));

  // Accumulate wheel delta (lower multiplier for smoother zooming)
  const zoomFactorMultiplier = Math.exp(-deltaYPixels * 0.0015);

  // Add CSS transition only for jerky mouse wheels, keep instant for trackpads.
  // Transition duration is lowered to 0.08s to reduce the bouncy elastic rubber-banding
  // effect when spamming zoom-in and zoom-out rapidly.
  if (Math.abs(deltaYPixels) >= 40) {
    canvasWrapper.style.transition = "transform 0.08s ease-out";
  } else {
    canvasWrapper.style.transition = "none";
  }

  const minScale = initialScale;
  const maxScale = initialScale * 8;
  const nextScale = Math.min(
    maxScale,
    Math.max(minScale, wheelState.previewScale * zoomFactorMultiplier),
  );

  wheelState.previewScale = nextScale;
  wheelState.centerClientX = event.clientX;
  wheelState.centerClientY = event.clientY;

  const ratio = nextScale / wheelState.baseScale;

  canvasWrapper.style.transformOrigin = `${wheelState.anchorInWrapperX}px ${wheelState.anchorInWrapperY}px`;
  canvasWrapper.style.transform = `scale(${ratio})`;

  const rect = pdfViewerContent.getBoundingClientRect();
  const currentMouseViewportX = event.clientX - rect.left;
  const currentMouseViewportY = event.clientY - rect.top;

  const anchorContentX = wheelState.initScrollLeft + wheelState.anchorViewportX;
  const anchorContentY = wheelState.initScrollTop + wheelState.anchorViewportY;

  // Selama zoom preview berlangsung, kita menonaktifkan update scroll untuk menghasilkan animasi CSS transisi yang sangat mulus,
  // karena `transform-origin` secara native sudah mengunci titik anchor. (Mencegah patah-patah antara scroll instant vs scale transisi)

  // Update real indicator values directly
  const tempPercent = Math.round((nextScale / initialScale) * 100);
  [zoomLevelIndicatorPortrait, zoomLevelIndicatorLandscape].forEach((el) => {
    if (el) el.textContent = `${tempPercent}%`;
  });

  wheelRenderTimeout = setTimeout(() => {
    wheelRenderTimeout = null;
    finalizeWheelZoom();
  }, 150);
}

async function finalizeWheelZoom() {
  if (!wheelState) return;
  if (isFinalizingWheelZoom) return;

  isFinalizingWheelZoom = true;

  const finalScale = wheelState.previewScale;
  const oldScale = wheelState.baseScale;
  const savedWheelState = { ...wheelState };

  if (!Number.isFinite(finalScale) || !Number.isFinite(oldScale)) {
    canvasWrapper.style.transform = "";
    canvasWrapper.style.transformOrigin = "";
    canvasWrapper.classList.remove("wheel-preview");
    wheelState = null;
    isFinalizingWheelZoom = false;
    return;
  }

  if (Math.abs(finalScale - oldScale) < 0.001) {
    currentScale = oldScale;
    canvasWrapper.style.transform = "";
    canvasWrapper.style.transformOrigin = "";
    canvasWrapper.classList.remove("wheel-preview");
    updateZoomIndicator();
    wheelState = null;
    isFinalizingWheelZoom = false;
    return;
  }

  const activeWrapper = canvasWrapper;
  currentScale = finalScale;
  updateZoomIndicator();

  zoomDeferInsert = true;
  let newWrapper;
  try {
    newWrapper = await renderPage(currentPageNum);
  } finally {
    zoomDeferInsert = false;
  }

  // Check if the user kept scrolling while we were rendering!
  // If they scrolled during the render, either wheelRenderTimeout is active,
  // or the finalScale has fundamentally drifted away from the rendered scale.
  if (wheelRenderTimeout || wheelState.previewScale !== finalScale) {
    isFinalizingWheelZoom = false;

    // If the timeout already expired but we blocked it using isFinalizingWheelZoom,
    // we need to re-trigger the finalize pipeline immediately to render the actual finalScale.
    if (!wheelRenderTimeout) {
      wheelRenderTimeout = setTimeout(() => {
        wheelRenderTimeout = null;
        finalizeWheelZoom();
      }, 50);
    }
    return;
  }

  // Now safely swap, as continuous scrolling has paused.
  wheelState = null;
  activeWrapper.style.transition = "";

  if (newWrapper === activeWrapper || !newWrapper) {
    activeWrapper.classList.remove("wheel-preview");
    activeWrapper.style.transform = "";
    activeWrapper.style.transformOrigin = "";
    updateCenteringAndOverflow();
    isFinalizingWheelZoom = false;
    return;
  }

  const oldVisualRect = activeWrapper.getBoundingClientRect();

  activeWrapper.classList.remove("wheel-preview");
  activeWrapper.style.transform = "";
  activeWrapper.style.transformOrigin = "";
  activeWrapper.replaceWith(newWrapper);
  canvasWrapper = newWrapper; // Update global reference so next pinch works

  updateCenteringAndOverflow();

  const containerRect = pdfViewerContent.getBoundingClientRect();
  const newWrapperRect = newWrapper.getBoundingClientRect();
  const ratio = finalScale / oldScale;

  const newWrapperDocX =
    pdfViewerContent.scrollLeft + (newWrapperRect.left - containerRect.left);
  const newWrapperDocY =
    pdfViewerContent.scrollTop + (newWrapperRect.top - containerRect.top);

  const newAnchorInWrapperX = savedWheelState.anchorInWrapperX * ratio;
  const newAnchorInWrapperY = savedWheelState.anchorInWrapperY * ratio;

  const targetViewportX = savedWheelState.centerClientX - containerRect.left;
  const targetViewportY = savedWheelState.centerClientY - containerRect.top;

  const targetScrollX = newWrapperDocX + newAnchorInWrapperX - targetViewportX;
  const targetScrollY = newWrapperDocY + newAnchorInWrapperY - targetViewportY;

  const maxScrollX = Math.max(
    0,
    pdfViewerContent.scrollWidth - pdfViewerContent.clientWidth,
  );
  const maxScrollY = Math.max(
    0,
    pdfViewerContent.scrollHeight - pdfViewerContent.clientHeight,
  );
  pdfViewerContent.scrollLeft = Math.min(
    Math.max(0, targetScrollX),
    maxScrollX,
  );
  pdfViewerContent.scrollTop = Math.min(Math.max(0, targetScrollY), maxScrollY);

  const newRect = newWrapper.getBoundingClientRect();
  const tx = oldVisualRect.left - newRect.left;
  const ty = oldVisualRect.top - newRect.top;
  const scaleX = oldVisualRect.width / (newRect.width || 1);
  const scaleY = oldVisualRect.height / (newRect.height || 1);

  if (Math.abs(tx) > 1 || Math.abs(ty) > 1 || Math.abs(scaleX - 1) > 0.01) {
    newWrapper.style.transition = "none";
    newWrapper.style.transformOrigin = "0 0";
    newWrapper.style.transform = `translate(${tx}px, ${ty}px) scale(${scaleX}, ${scaleY})`;

    newWrapper.getBoundingClientRect();

    newWrapper.style.transition = `transform ${ZOOM_SCROLL_SMOOTH_DURATION_MS}ms cubic-bezier(0.2, 0.8, 0.2, 1)`;
    newWrapper.style.transform = `translate(0px, 0px) scale(1)`;

    setTimeout(() => {
      newWrapper.style.transition = "";
      newWrapper.style.transform = "";
      newWrapper.style.transformOrigin = "";
    }, ZOOM_SCROLL_SMOOTH_DURATION_MS);
  }

  updateCenteringAndOverflow();
  isFinalizingWheelZoom = false;
}

function handleGlobalKeydown(event) {
  if (event.target.tagName === "INPUT" || event.target.tagName === "TEXTAREA")
    return;
  if (!document.body.classList.contains("viewer-active")) return;

  if (event.ctrlKey) {
    if (event.key === "+" || event.key === "=") {
      event.preventDefault();
      onZoom("in");
    } else if (event.key === "-") {
      event.preventDefault();
      onZoom("out");
    }
    return;
  }

  // Transpose shortcuts: [ = down, ] = up
  if (event.key === "[" || event.key === "]") {
    event.preventDefault();
    if (typeof onTranspose === "function") {
      onTranspose(event.key === "]" ? 1 : -1);
    }
    return;
  }

  // Don't hijack arrow keys when a family-chord dropdown is open
  const openDropdown = document.querySelector(".family-chord-dropdown.is-open");
  if (openDropdown) return;

  switch (event.key) {
    case "ArrowLeft":
      event.preventDefault();
      onPrevSong();
      break;
    case "ArrowRight":
      event.preventDefault();
      onNextSong();
      break;
    case "ArrowUp":
      event.preventDefault();
      onPrevPage();
      break;
    case "ArrowDown":
      event.preventDefault();
      onNextPage();
      break;
  }
}

function getPinchDistance(event) {
  const t1 = event.touches[0];
  const t2 = event.touches[1];
  return Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
}

function handleTouchStart(event) {
  if (event.touches.length !== 2) return;
  if (!document.body.classList.contains("viewer-active")) return;
  if (!event.target.closest(".pdf-viewer-content")) return;

  const baseScale = (typeof currentScale === "number" && Number.isFinite(currentScale)) ? currentScale : initialScale;
  initialPinchDistance = getPinchDistance(event);
  swipeStartPoint = null;

  const t1 = event.touches[0];
  const t2 = event.touches[1];
  const centerX = (t1.clientX + t2.clientX) / 2;
  const centerY = (t1.clientY + t2.clientY) / 2;
  const rect = pdfViewerContent.getBoundingClientRect();
  const activeRect = canvasWrapper.getBoundingClientRect();

  // Anchor position in wrapper-local coordinates (unscaled)
  const anchorInWrapperX = centerX - activeRect.left;
  const anchorInWrapperY = centerY - activeRect.top;

  pinchState = {
    baseScale,
    previewScale: baseScale,
    centerClientX: centerX,
    centerClientY: centerY,
    // Anchor position in wrapper-local coords at the start of pinch
    anchorInWrapperX,
    anchorInWrapperY,
    // Initial scroll offsets
    initScrollLeft: pdfViewerContent.scrollLeft,
    initScrollTop: pdfViewerContent.scrollTop,
    // Anchor position relative to viewport (container-local)
    anchorViewportX: centerX - rect.left,
    anchorViewportY: centerY - rect.top,
  };

  canvasWrapper.classList.add("pinch-preview");
  updateZoomIndicator();
}

function handleTouchMove(event) {
  if (event.touches.length !== 2 || !pinchState || initialPinchDistance <= 0)
    return;
  event.preventDefault();

  const distance = getPinchDistance(event);
  const factor = distance / initialPinchDistance;
  // Minimum 100%, maximum 800%
  const minScale = initialScale;
  const maxScale = initialScale * 8;
  const nextScale = Math.min(
    maxScale,
    Math.max(minScale, pinchState.baseScale * factor),
  );

  const t1 = event.touches[0];
  const t2 = event.touches[1];
  const centerX = (t1.clientX + t2.clientX) / 2;
  const centerY = (t1.clientY + t2.clientY) / 2;

  pinchState.previewScale = nextScale;
  pinchState.centerClientX = centerX;
  pinchState.centerClientY = centerY;

  const ratio = nextScale / pinchState.baseScale;

  // Use the anchor point as transform origin for accurate visual preview
  canvasWrapper.style.transformOrigin = `${pinchState.anchorInWrapperX}px ${pinchState.anchorInWrapperY}px`;
  canvasWrapper.style.transform = `scale(${ratio})`;

  // Compute correct scroll to keep anchor under finger
  // After CSS scale, the anchor point in the wrapper has moved.
  // We want the anchor's screen position to follow the current finger center.
  const rect = pdfViewerContent.getBoundingClientRect();
  const currentFingerViewportX = centerX - rect.left;
  const currentFingerViewportY = centerY - rect.top;

  // The anchor's document position after scaling (wrapper origin + scaled anchor offset)
  const wrapperBaseX =
    pinchState.initScrollLeft +
    (canvasWrapper.getBoundingClientRect().left - rect.left) -
    pdfViewerContent.scrollLeft +
    pdfViewerContent.scrollLeft;
  // Simpler: anchor position in content-space = initScroll + anchorViewport initially.
  // After scale with transform-origin at anchor, the anchor stays at same content position.
  // So we just need scroll such that anchor appears at finger position.
  const anchorContentX = pinchState.initScrollLeft + pinchState.anchorViewportX;
  const anchorContentY = pinchState.initScrollTop + pinchState.anchorViewportY;

  // With transform-origin at anchor, the anchor doesn't move in the wrapper's local pre-scale coords.
  // But CSS scale around that point means the wrapper's bounding rect changes.
  // The anchor in document space stays at: anchorContentX, anchorContentY
  // We want it to appear at finger viewport position:
  let targetScrollX = anchorContentX - currentFingerViewportX;
  let targetScrollY = anchorContentY - currentFingerViewportY;

  // Clamp scroll to viewport bounds
  const maxScrollX = Math.max(
    0,
    pdfViewerContent.scrollWidth - pdfViewerContent.clientWidth,
  );
  const maxScrollY = Math.max(
    0,
    pdfViewerContent.scrollHeight - pdfViewerContent.clientHeight,
  );
  pdfViewerContent.scrollLeft = Math.min(
    Math.max(0, targetScrollX),
    maxScrollX,
  );
  pdfViewerContent.scrollTop = Math.min(Math.max(0, targetScrollY), maxScrollY);

  currentScale = nextScale;
  updateZoomIndicator();
}

async function handleTouchEnd(event) {
  initialPinchDistance = 0;

  if (!pinchState) return;
  if (event.touches && event.touches.length >= 2) return;

  if (zoomInProgress) {
    canvasWrapper.style.transform = "";
    canvasWrapper.style.transformOrigin = "";
    canvasWrapper.classList.remove("pinch-preview");
    pinchState = null;
    return;
  }

  const finalScale = pinchState.previewScale;
  const oldScale = pinchState.baseScale;
  const savedPinchState = { ...pinchState };

  // Record the current preview scroll position - this is what looks correct to the user
  const previewScrollLeft = pdfViewerContent.scrollLeft;
  const previewScrollTop = pdfViewerContent.scrollTop;
  const ratio = finalScale / oldScale;

  pinchState = null;

  if (!Number.isFinite(finalScale) || !Number.isFinite(oldScale)) {
    canvasWrapper.style.transform = "";
    canvasWrapper.style.transformOrigin = "";
    canvasWrapper.classList.remove("pinch-preview");
    return;
  }
  if (Math.abs(finalScale - oldScale) < 0.005) {
    currentScale = oldScale;
    canvasWrapper.style.transform = "";
    canvasWrapper.style.transformOrigin = "";
    canvasWrapper.classList.remove("pinch-preview");
    updateZoomIndicator();
    return;
  }

  // Keep the CSS-scaled preview visible while we render new content offscreen
  // DO NOT remove transform yet - that causes the glitch
  const activeWrapper = canvasWrapper;

  zoomInProgress = true;
  currentScale = finalScale;
  updateZoomIndicator();

  // Render new content into a DETACHED element
  zoomDeferInsert = true;
  let newWrapper = null;
  try {
    newWrapper = await renderPage(currentPageNum);
  } catch (e) {
    zoomDeferInsert = false;
    activeWrapper.classList.remove("pinch-preview");
    activeWrapper.style.transform = "";
    activeWrapper.style.transformOrigin = "";
    zoomInProgress = false;
    return;
  } finally {
    zoomDeferInsert = false;
  }

  if (newWrapper === activeWrapper || !newWrapper) {
    activeWrapper.classList.remove("pinch-preview");
    activeWrapper.style.transform = "";
    activeWrapper.style.transformOrigin = "";
    updateCenteringAndOverflow();
    zoomInProgress = false;
    return;
  }

  // Save old visual state WITH preview transform still applied!
  const oldVisualRect = activeWrapper.getBoundingClientRect();

  // Atomic swap: remove CSS preview, insert freshly rendered wrapper
  activeWrapper.classList.remove("pinch-preview");
  activeWrapper.style.transform = "";
  activeWrapper.style.transformOrigin = "";
  activeWrapper.replaceWith(newWrapper);
  canvasWrapper = newWrapper; // Update global reference so next pinch works

  updateCenteringAndOverflow();

  // Restore scroll position based on the anchor point
  // The anchor was at anchorInWrapperX/Y in old wrapper coords.
  // In new wrapper it's at anchorInWrapperX * ratio, anchorInWrapperY * ratio.
  // We want the anchor to appear at the same viewport position as during preview.
  const containerRect = pdfViewerContent.getBoundingClientRect();
  const newWrapperRect = newWrapper.getBoundingClientRect();
  const newWrapperDocX =
    pdfViewerContent.scrollLeft + (newWrapperRect.left - containerRect.left);
  const newWrapperDocY =
    pdfViewerContent.scrollTop + (newWrapperRect.top - containerRect.top);

  // Anchor position in new wrapper = old anchor * ratio
  const newAnchorInWrapperX = savedPinchState.anchorInWrapperX * ratio;
  const newAnchorInWrapperY = savedPinchState.anchorInWrapperY * ratio;

  // Place anchor at same viewport position as finger
  const targetViewportX = savedPinchState.centerClientX - containerRect.left;
  const targetViewportY = savedPinchState.centerClientY - containerRect.top;

  const targetScrollX = newWrapperDocX + newAnchorInWrapperX - targetViewportX;
  const targetScrollY = newWrapperDocY + newAnchorInWrapperY - targetViewportY;

  const maxScrollX = Math.max(
    0,
    pdfViewerContent.scrollWidth - pdfViewerContent.clientWidth,
  );
  const maxScrollY = Math.max(
    0,
    pdfViewerContent.scrollHeight - pdfViewerContent.clientHeight,
  );
  pdfViewerContent.scrollLeft = Math.min(
    Math.max(0, targetScrollX),
    maxScrollX,
  );
  pdfViewerContent.scrollTop = Math.min(Math.max(0, targetScrollY), maxScrollY);

  // The new scroll is set. Calculate where the new wrapper actually landed on screen.
  const newRect = newWrapper.getBoundingClientRect();

  // How much it shifted on screen compared to the visual preview
  const tx = oldVisualRect.left - newRect.left;
  const ty = oldVisualRect.top - newRect.top;

  // In theory the scale should be exactly 1, but we calculate it to ensure perfect overlap
  const scaleX = oldVisualRect.width / (newRect.width || 1);
  const scaleY = oldVisualRect.height / (newRect.height || 1);

  // If there is ANY layout shift (e.g. snapping to center, clamping), glide it!
  if (Math.abs(tx) > 1 || Math.abs(ty) > 1 || Math.abs(scaleX - 1) > 0.01) {
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

  updateCenteringAndOverflow();
  zoomInProgress = false;
}

function handleViewerTouchStart(event) {
  if (
    !document.body.classList.contains("viewer-active") ||
    event.touches.length !== 1
  )
    return;

  const touch = event.touches[0];
  const isFromControl = event.target.closest(
    "button, input, select, label, .chord-layer.editor-mode, .chord-marker",
  );

  if (isFromControl) {
    swipeStartPoint = null;
    return;
  }

  swipeStartPoint = {
    x: touch.clientX,
    y: touch.clientY,
    time: Date.now(),
  };
}

function handleViewerTouchEnd(event) {
  if (!document.body.classList.contains("viewer-active")) {
    swipeStartPoint = null;
    return;
  }

  if (!swipeStartPoint || !document.body.classList.contains("viewer-active")) {
    swipeStartPoint = null;
    return;
  }

  const touch = event.changedTouches && event.changedTouches[0];
  if (!touch) {
    swipeStartPoint = null;
    return;
  }

  const isControlInteraction = event.target.closest(
    "button, input, select, label, .chord-layer.editor-mode, .chord-marker",
  );
  const elapsed = Date.now() - swipeStartPoint.time;
  const dx = touch.clientX - swipeStartPoint.x;
  const dy = touch.clientY - swipeStartPoint.y;

  const absX = Math.abs(dx);
  const absY = Math.abs(dy);
  const isTap = absX < 14 && absY < 14 && elapsed < 260;

  if (!isControlInteraction && isTap) {
    const now = Date.now();
    const isFastEnough = now - lastViewerTapAt <= DOUBLE_TAP_MAX_DELAY;
    const isNearEnough =
      lastViewerTapPoint &&
      Math.hypot(
        touch.clientX - lastViewerTapPoint.x,
        touch.clientY - lastViewerTapPoint.y,
      ) <= DOUBLE_TAP_MAX_DISTANCE;

    if (isFastEnough && isNearEnough) {
      lastViewerTapAt = 0;
      lastViewerTapPoint = null;
      swipeStartPoint = null;
      resetZoomToDefault(touch.clientX, touch.clientY);
      return;
    }

    lastViewerTapAt = now;
    lastViewerTapPoint = { x: touch.clientX, y: touch.clientY };
    swipeStartPoint = null;
    return;
  }

  if (!isTap) {
    lastViewerTapAt = 0;
    lastViewerTapPoint = null;
  }

  swipeStartPoint = null;

  processSwipeGesture(dx, dy, elapsed);
}

function handleViewerPointerStart(event) {
  if (!document.body.classList.contains("viewer-active")) return;
  if (event.button !== 0) return;

  const isFromControl = event.target.closest(
    "button, input, select, label, .chord-layer.editor-mode, .chord-marker",
  );
  if (isFromControl) {
    swipeStartPoint = null;
    isMouseDragging = false;
    return;
  }

  swipeStartPoint = {
    x: event.clientX,
    y: event.clientY,
    time: Date.now(),
  };

  if (event.type === "mousedown") {
    isMouseDragging = true;
    pdfViewerContent.style.cursor = "grabbing";
    mouseDragStartX = event.clientX;
    mouseDragStartY = event.clientY;
    mouseDragScrollLeft = pdfViewerContent.scrollLeft;
    mouseDragScrollTop = pdfViewerContent.scrollTop;
  }
}

function handleViewerPointerMove(event) {
  if (!isMouseDragging) return;
  if (!document.body.classList.contains("viewer-active")) return;

  event.preventDefault(); // Prevent default text selection
  const dx = event.clientX - mouseDragStartX;
  const dy = event.clientY - mouseDragStartY;

  pdfViewerContent.scrollLeft = mouseDragScrollLeft - dx;
  pdfViewerContent.scrollTop = mouseDragScrollTop - dy;
}

function handleViewerPointerEnd(event) {
  if (isMouseDragging) {
    isMouseDragging = false;
    pdfViewerContent.style.cursor = "";
  }

  if (!document.body.classList.contains("viewer-active")) {
    swipeStartPoint = null;
    return;
  }

  if (!swipeStartPoint || event.button !== 0) {
    swipeStartPoint = null;
    return;
  }

  const elapsed = Date.now() - swipeStartPoint.time;
  const dx = event.clientX - swipeStartPoint.x;
  const dy = event.clientY - swipeStartPoint.y;
  swipeStartPoint = null;

  processSwipeGesture(dx, dy, elapsed);
}

function processSwipeGesture(dx, dy, elapsed) {
  // Disable page/song swipe while zoomed in to avoid accidental navigation.
  if (isViewerZoomedIn()) return;

  const now = Date.now();
  if (now - lastSwipeHandledAt < 220) return;

  const absX = Math.abs(dx);
  const absY = Math.abs(dy);
  if (elapsed > 850) return;
  if (absX < 30 && absY < 30) return;

  if (absY > absX * 1.2 && canSwipePdfPage()) {
    if (dy > 30) {
      onPrevPage();
      lastSwipeHandledAt = now;
    } else if (dy < -30) {
      onNextPage();
      lastSwipeHandledAt = now;
    }
    return;
  }

  if (absX > absY * 1.2) {
    if (dx < -30) {
      onNextSong();
      lastSwipeHandledAt = now;
    } else if (dx > 30) {
      onPrevSong();
      lastSwipeHandledAt = now;
    }
  }
}

function canSwipePdfPage() {
  return (
    Boolean(pdfDoc) &&
    pdfDoc.numPages > 1 &&
    currentViewMode === "single" &&
    currentScrollMode === "horizontal"
  );
}

function isViewerZoomedIn() {
  if (!Number.isFinite(initialScale) || initialScale <= 0) return false;
  if (typeof currentScale !== "number" || !Number.isFinite(currentScale))
    return false;
  return currentScale > initialScale * 1.001;
}
