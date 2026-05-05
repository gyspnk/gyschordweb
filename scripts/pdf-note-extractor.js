const fs = require("node:fs");

async function loadPdfJs() {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  return pdfjs;
}

async function extractPageNotes(page) {
  const textContent = await page.getTextContent();
  const viewport = page.getViewport({ scale: 1 });
  const pageWidth = viewport.width;
  const pageHeight = viewport.height;

  const items = textContent.items
    .map((item) => ({
      str: String(item.str || "").trim(),
      x: item.transform[4],
      y: item.transform[5],
      w: item.width,
      fontSize: Math.abs(item.transform[3]),
    }))
    .filter((item) => item.str.length > 0);

  const noteCharPattern = /^[0-7.\s]+$/;
  const candidateItems = items.filter((item) => noteCharPattern.test(item.str) && /[1-7]/.test(item.str));
  if (candidateItems.length === 0) return { notes: [], pageWidth, pageHeight };

  const fontSizeCounts = {};
  candidateItems.forEach((item) => {
    const key = Math.round(item.fontSize * 10) / 10;
    fontSizeCounts[key] = (fontSizeCounts[key] || 0) + 1;
  });
  const dominantFontSize = parseFloat(Object.entries(fontSizeCounts).sort((a, b) => b[1] - a[1])[0][0]);
  const fontSizeTolerance = 1.5;

  const singleNotePattern = /^[0-7.]$/;
  const multiNotePattern = /^[0-7.\s]+$/;
  const rawNoteItems = items.filter(
    (item) => multiNotePattern.test(item.str) && Math.abs(item.fontSize - dominantFontSize) < fontSizeTolerance
  );

  const noteItems = [];
  for (const item of rawNoteItems) {
    if (singleNotePattern.test(item.str)) {
      noteItems.push(item);
    } else {
      const chars = item.str.split("");
      const totalChars = chars.length;
      if (totalChars <= 1) {
        noteItems.push(item);
        continue;
      }
      const slotWidth = item.w / totalChars;
      for (let i = 0; i < totalChars; i += 1) {
        const ch = chars[i];
        if (/[0-7.]/.test(ch)) {
          noteItems.push({
            str: ch,
            x: item.x + i * slotWidth,
            y: item.y,
            w: slotWidth,
            fontSize: item.fontSize,
          });
        }
      }
    }
  }

  const yTolerance = 2.0;
  const rows = [];
  const sorted = [...noteItems].sort((a, b) => b.y - a.y);

  for (const item of sorted) {
    const existingRow = rows.find((row) => Math.abs(row.y - item.y) < yTolerance);
    if (existingRow) {
      existingRow.items.push(item);
    } else {
      rows.push({ y: item.y, items: [item] });
    }
  }

  const musicRows = rows.filter((row) => row.items.filter((item) => /^[1-7]$/.test(item.str)).length >= 2);
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
        yPct: (1 - item.y / pageHeight) * 100,
        rowY: row.y,
        isNote: /^[1-7]$/.test(item.str),
        isDot: item.str === ".",
        isRest: item.str === "0",
      });
    }
  }

  return { notes, pageWidth, pageHeight };
}

async function extractNotesFromPdf(pdfPath) {
  const pdfjs = await loadPdfJs();
  const data = new Uint8Array(fs.readFileSync(pdfPath));
  const pdf = await pdfjs.getDocument({ data, disableWorker: true }).promise;
  const pages = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum += 1) {
    const page = await pdf.getPage(pageNum);
    pages.push(await extractPageNotes(page));
  }

  await pdf.destroy();
  return { pageCount: pdf.numPages, pages };
}

module.exports = {
  extractPageNotes,
  extractNotesFromPdf,
};
