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
