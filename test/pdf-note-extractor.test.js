const test = require("node:test");
const assert = require("node:assert/strict");

const {
  extractNotesFromPdf,
} = require("../scripts/pdf-note-extractor");
const { loadSamples, readExistingChordJson } = require("../scripts/chord-ocr-worker");

test("extracts note indices from a known one-page PDF", async () => {
  const result = await extractNotesFromPdf("docs/assets/pdf/007_Segala Sesuatu Memuji Tuhan.pdf");

  assert.equal(result.pages.length, 1);
  assert.ok(result.pages[0].notes.length > 220);
  assert.equal(result.pages[0].notes[0].idx, 0);
  assert.equal(result.pages[0].notes[0].str, "3");
});

test("extracted note counts cover every calibrated chord noteIdx", async () => {
  for (const sample of loadSamples()) {
    const existing = readExistingChordJson(sample.song);
    const pdfPath = existing.jsonPath
      .replace(/\\chord\\/i, "\\pdf\\")
      .replace(/\/chord\//i, "/pdf/")
      .replace(/\.chord\.json$/i, ".pdf");
    const result = await extractNotesFromPdf(pdfPath);

    for (const [pageKey, entries] of Object.entries(existing.data.pages)) {
      const pageIndex = Number(pageKey) - 1;
      const notes = result.pages[pageIndex]?.notes || [];
      const maxIdx = Math.max(...entries.map((entry) => entry.noteIdx));
      assert.ok(notes.length > maxIdx, `song ${sample.song} page ${pageKey} should contain noteIdx ${maxIdx}`);
    }
  }
});
