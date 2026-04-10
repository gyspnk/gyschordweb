const fs = require('fs');

let code = fs.readFileSync('docs/js/10-zoom-gestures.js', 'utf-8');

code = code.replace(
  /zoomDeferInsert = true;[\s\n]*try \{[\s\n]*await renderPage\(currentPageNum\);[\s\n]*\} finally \{[\s\n]*zoomDeferInsert = false;[\s\n]*\}[\s\n]*const newWrapper = canvasWrapper;/,
  `zoomDeferInsert = true;
  let newWrapper = null;
  try {
    newWrapper = await renderPage(currentPageNum);
  } finally {
    zoomDeferInsert = false;
  }`
);

// We need to also add `canvasWrapper = newWrapper` after the DOM swap
code = code.replace(
  /activeWrapper\.replaceWith\(newWrapper\);/,
  `activeWrapper.replaceWith(newWrapper);
  canvasWrapper = newWrapper; // Update global reference so next pinch works`
);

// Update baseScale calculation in `handleTouchStart` to be safer, like I tried earlier
code = code.replace(
  /const baseScale =[\s\n]*typeof currentScale === "number" \? currentScale : initialScale;[\s\n]*currentScale = baseScale;/,
  `const baseScale = (typeof currentScale === "number" && Number.isFinite(currentScale)) ? currentScale : initialScale;`
);

fs.writeFileSync('docs/js/10-zoom-gestures.js', code);
console.log('patched');