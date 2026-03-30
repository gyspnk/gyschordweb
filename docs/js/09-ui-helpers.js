// --- 8. Tambahan UI ---
function handleOrientationChange() {
  checkOrientation();
  closeTransposeCollapse();
  setTimeout(() => {
    currentScale = "page-fit";
    animateViewChange(() => renderPage(currentPageNum));
    fitViewerTitle();
  }, 200);
}

function onLayoutResize() {
  syncTransposeCollapseState();
  fitViewerTitle();
  fitListTitles();
}

function onToggleTransposeCollapse(event) {
  event.preventDefault();
  event.stopPropagation();

  if (!isCollapsibleLayout()) return;

  const targetCollapse = event.currentTarget.closest(".transpose-collapse");
  if (!targetCollapse) return;

  const shouldOpen = !targetCollapse.classList.contains("is-open");
  targetCollapse.classList.toggle("is-open", shouldOpen);
  
  const toggleBtn = targetCollapse.querySelector(".transpose-toggle-btn");
  if (toggleBtn) {
    toggleBtn.setAttribute("aria-expanded", shouldOpen ? "true" : "false");
  }
}

function closeTransposeCollapse() {
  transposeCollapses.forEach(collapse => {
    collapse.classList.remove("is-open");
    const toggleBtn = collapse.querySelector(".transpose-toggle-btn");
    if (toggleBtn) toggleBtn.setAttribute("aria-expanded", "false");
  });
}

function syncTransposeCollapseState() {
  if (!isCollapsibleLayout()) {
    closeTransposeCollapse();
  }
}

function isCollapsibleLayout() {
  return window.matchMedia("(max-width: 640px) and (orientation: portrait), (max-width: 1366px) and (orientation: landscape)").matches;
}

function onToggleFamilyChordDropdown(event) {
  event.stopPropagation();
  const dropdown = event.currentTarget.nextElementSibling;
  const wasOpen = dropdown.classList.contains('is-open');
  
  document.querySelectorAll('.family-chord-dropdown').forEach(dd => dd.classList.remove('is-open'));
  
  if (!wasOpen) {
    dropdown.classList.add('is-open');
  }
}

function onGlobalDocumentClick(event) {
  if (!event.target.closest(".family-chord-container")) {
    document.querySelectorAll('.family-chord-dropdown').forEach(dd => dd.classList.remove('is-open'));
  }
  if (event.target.closest(".transpose-collapse")) return;
  closeTransposeCollapse();
}

function fitViewerTitle() {
  autoFitTextSingleLine(pdfViewerTitle, {
    maxPx: 18,
    minPx: 10
  });
}

function fitListTitles() {
  document.querySelectorAll(".pujian-title").forEach((titleEl) => {
    autoFitTextSingleLine(titleEl, {
      maxPx: 16,
      minPx: 10
    });
  });
}

function autoFitTextSingleLine(element, { maxPx, minPx }) {
  if (!element) return;

  let size = Math.min(maxPx, Number.parseFloat(window.getComputedStyle(element).fontSize) || maxPx);
  element.style.fontSize = `${size}px`;

  while (size > minPx && element.scrollWidth > element.clientWidth + 1) {
    size -= 0.5;
    element.style.fontSize = `${size}px`;
  }
}

function setupRippleEffect() {
  const createRipple = (event) => {
    const element = event.currentTarget;

    if (!element.classList.contains("ripple-effect")) {
      element.classList.add("ripple-effect");
    }

    const circle = document.createElement("span");
    const diameter = Math.max(element.clientWidth, element.clientHeight);
    const radius = diameter / 2;

    const rect = element.getBoundingClientRect();
    circle.style.width = circle.style.height = `${diameter}px`;
    circle.style.left = `${event.clientX - rect.left - radius}px`;
    circle.style.top = `${event.clientY - rect.top - radius}px`;
    circle.classList.add("ripple");

    element.appendChild(circle);

    setTimeout(() => {
      circle.remove();
    }, 600);
  };

  document.body.addEventListener("click", (e) => {
    const rippleTarget = e.target.closest(".nav-btn, .icon-button, .pujian-list li, .accent-color");
    if (rippleTarget) {
      createRipple({ currentTarget: rippleTarget, clientX: e.clientX, clientY: e.clientY });
    }
  });

  document.body.addEventListener(
    "touchstart",
    (e) => {
      const touch = e.touches && e.touches[0];
      if (!touch) return;

      const rippleTarget = e.target.closest(".nav-btn, .icon-button, .pujian-list li, .accent-color");
      if (rippleTarget) {
        createRipple({ currentTarget: rippleTarget, clientX: touch.clientX, clientY: touch.clientY });
      }
    },
    { passive: true }
  );
}

function checkOrientation() {
  const isPortrait = window.innerHeight > window.innerWidth;
  orientationWarning.classList.toggle("visible", currentViewMode === "double" && isPortrait);
}

function updatePageIndicator(num) {
  let text = String(num);
  if (currentViewMode === "double" && num + 1 <= pdfDoc.numPages) {
    text = `${num}-${num + 1}`;
  }
  [pageNumElPortrait, pageNumElLandscape].forEach((el) => {
    el.textContent = text;
  });
}

function updateZoomIndicator() {
  const zoomPercent = typeof currentScale === "number" ? Math.round((currentScale / initialScale) * 100) : 100;
  [zoomLevelIndicatorPortrait, zoomLevelIndicatorLandscape].forEach((el) => {
    if (el) el.textContent = `${zoomPercent}%`;
  });
}

function updatePageNavButtons() {
  const prevDisabled = currentPageNum <= 1;
  const step = currentViewMode === "double" ? 2 : 1;
  const nextDisabled = currentPageNum + step > pdfDoc.numPages;

  [prevPageBtnPortrait, prevPageBtnLandscape].forEach((btn) => {
    btn.disabled = prevDisabled;
  });
  [nextPageBtnPortrait, nextPageBtnLandscape].forEach((btn) => {
    btn.disabled = nextDisabled;
  });
}

function updateSongNavButtons() {
  prevSongBtn.disabled = currentSongIndex <= 0;
  nextSongBtn.disabled = currentSongIndex >= pujianItems.length - 1;
}

function closePdfViewer() {
  document.body.classList.remove("viewer-active");
  pdfDoc = null;
  currentSongIndex = -1;
  titleTapCount = 0;
  lastViewerTapAt = 0;
  lastViewerTapPoint = null;
  lastIndicatorTapAt = 0;
  lastIndicatorTapEl = null;
  chordsHidden = false;
  closeTransposeCollapse();
  updateHideChordButton();
}
