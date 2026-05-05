const test = require("node:test");
const assert = require("node:assert/strict");

const {
  normalizeChordToken,
  transposeChord,
  bestTranspositionMatch,
  orderedSubsequenceScore,
  evaluateGoldSample,
  generateJsonFromGoldSample,
  readExistingChordJson,
  planMissingChordBatch,
  findSourceImagesForSong,
  planPageImageMapping,
  alignChordWordsToNotes,
  loadSamples,
} = require("../scripts/chord-ocr-worker");

test("normalizes common OCR chord token variants", () => {
  assert.equal(normalizeChordToken("dm"), "Dm");
  assert.equal(normalizeChordToken("Bbm"), "Bbm");
  assert.equal(normalizeChordToken("F#m"), "F#m");
  assert.equal(normalizeChordToken("F#M"), "F#m");
  assert.equal(normalizeChordToken("c."), "C");
  assert.equal(normalizeChordToken("Cc"), "C");
  assert.equal(normalizeChordToken("Fi"), "F");
  assert.equal(normalizeChordToken("Dnm"), "Dm");
  assert.equal(normalizeChordToken("C7"), "C7");
  assert.equal(normalizeChordToken("F#dim"), "F#dim");
  assert.equal(normalizeChordToken("G#aug"), "G#aug");
  assert.equal(normalizeChordToken("B°"), "Bdim");
  assert.equal(normalizeChordToken("G#/G"), "G#/G");
  assert.equal(normalizeChordToken("Bb/D"), "Bb/D");
  assert.equal(normalizeChordToken("H"), "");
});

test("transposes chord roots while preserving suffixes", () => {
  assert.equal(transposeChord("F", -1), "E");
  assert.equal(transposeChord("C", -1), "B");
  assert.equal(transposeChord("Dm", -1), "C#m");
  assert.equal(transposeChord("Bbm", -1), "Am");
  assert.equal(transposeChord("C7", -1), "B7");
  assert.equal(transposeChord("F#dim", -1), "Fdim");
  assert.equal(transposeChord("G#aug", -1), "Gaug");
  assert.equal(transposeChord("G#/G", -1), "G/F#");
  assert.equal(transposeChord("Bb/D", 2), "C/E");
  assert.equal(transposeChord("B°", 1), "Cdim");
});

test("finds the best family transposition between photo and existing JSON chords", () => {
  const photo = ["F", "C", "Dm", "C", "F", "C", "Dm", "G", "C", "Bbm", "C", "F"];
  const existing = ["E", "B", "C#m", "B", "E", "B", "C#m", "F#", "B", "Am", "B", "E"];

  const result = bestTranspositionMatch(photo, existing);

  assert.equal(result.shift, -1);
  assert.equal(result.matches, existing.length);
  assert.equal(result.total, existing.length);
  assert.equal(result.score, 1);
});

test("scores noisy OCR output as an ordered subsequence instead of exact equality", () => {
  const noisy = ["D", "G", "F", "C", "A", "Dm", "C", "F", "C", "Dm", "G", "C"];
  const expected = ["F", "C", "Dm", "C", "F", "C", "Dm", "G", "C"];

  const score = orderedSubsequenceScore(noisy, expected);

  assert.equal(score.matches, expected.length);
  assert.equal(score.total, expected.length);
  assert.equal(score.score, 1);
});

test("all supervised samples from songs 2-31 match 100 percent after family transposition", () => {
  const samples = loadSamples();
  assert.deepEqual(samples.map((sample) => sample.song), [
    2, 3, 4, 5, 6, 7, 8, 9, 10,
    11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
    21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31,
  ]);

  for (const sample of samples) {
    const result = evaluateGoldSample(sample);
    assert.equal(result.score, 1, `song ${sample.song} should match exactly`);
    assert.equal(result.matches, result.total, `song ${sample.song} should have no mismatch`);
  }
});

test("generated JSON for songs 2-31 preserves the exact noteIdx positions", () => {
  for (const sample of loadSamples()) {
    const existing = readExistingChordJson(sample.song);
    const generated = generateJsonFromGoldSample(sample);

    assert.deepEqual(
      generated.json,
      existing.data,
      `song ${sample.song} generated JSON should be byte-meaning equivalent to existing sample`
    );
    assert.equal(generated.positionMatches, generated.total, `song ${sample.song} noteIdx positions should match`);
    assert.equal(generated.chordMatches, generated.total, `song ${sample.song} chords should match after transpose`);
  }
});

test("batch planner refuses to create final JSON without a trusted chord source", () => {
  const plan = planMissingChordBatch({
    pdfFiles: ["032_Yesus Menerima Orang Berdosa.pdf"],
    chordFiles: [],
    imageFiles: ["32.jpg"],
    trustedSongs: new Set([2, 3, 4]),
  });

  assert.equal(plan.create.length, 0);
  assert.equal(plan.skip.length, 1);
  assert.equal(plan.skip[0].reason, "no-trusted-chord-source");
});

test("source image lookup supports single files and multi-part song photos", () => {
  const imageFiles = [
    "32.jpg",
    "51a.jpg",
    "51b.jpg",
    "124a.jpg",
    "343 part 1.jpg",
    "343 part 2.jpg",
    "348 part 1.jpg",
    "348 part 2.jpg",
    "348.jpg",
  ];

  assert.deepEqual(findSourceImagesForSong(32, imageFiles), ["32.jpg"]);
  assert.deepEqual(findSourceImagesForSong("51A", imageFiles), ["51a.jpg"]);
  assert.deepEqual(findSourceImagesForSong("51B", imageFiles), ["51b.jpg"]);
  assert.deepEqual(findSourceImagesForSong("124A", imageFiles), ["124a.jpg"]);
  assert.deepEqual(findSourceImagesForSong(343, imageFiles), ["343 part 1.jpg", "343 part 2.jpg"]);
  assert.deepEqual(findSourceImagesForSong(348, imageFiles), ["348.jpg", "348 part 1.jpg", "348 part 2.jpg"]);
});

test("page image mapping keeps two separate photos aligned to page order", () => {
  const plan = planPageImageMapping(["343 part 2.jpg", "343 part 1.jpg"], [
    { page: 1, noteCount: 44 },
    { page: 2, noteCount: 39 },
  ]);

  assert.equal(plan.mode, "one-image-per-page");
  assert.equal(plan.status, "ready");
  assert.deepEqual(plan.pages, [
    { page: 1, noteCount: 44, sourceImage: "343 part 1.jpg", sourceImageIndex: 0 },
    { page: 2, noteCount: 39, sourceImage: "343 part 2.jpg", sourceImageIndex: 1 },
  ]);
});

test("page image mapping reuses one source photo when it contains two pages", () => {
  const plan = planPageImageMapping(["32.jpg"], [
    { page: 1, noteCount: 40 },
    { page: 2, noteCount: 35 },
  ]);

  assert.equal(plan.mode, "single-image-multi-page");
  assert.equal(plan.status, "ready");
  assert.deepEqual(plan.pages, [
    { page: 1, noteCount: 40, sourceImage: "32.jpg", sourceImageIndex: 0 },
    { page: 2, noteCount: 35, sourceImage: "32.jpg", sourceImageIndex: 0 },
  ]);
});

test("page image mapping flags ambiguous page/photo counts for manual review", () => {
  const plan = planPageImageMapping(["99 part 1.jpg", "99 part 2.jpg", "99 part 3.jpg"], [
    { page: 1, noteCount: 52 },
    { page: 2, noteCount: 48 },
  ]);

  assert.equal(plan.mode, "extra-source-images");
  assert.equal(plan.status, "review");
  assert.deepEqual(plan.extraSourceImages, ["99 part 3.jpg"]);
});

test("aligns OCR chord words to the nearest note on matching note rows", () => {
  const notes = [
    { idx: 0, xPct: 10, rowY: 200, isNote: true },
    { idx: 1, xPct: 30, rowY: 200, isNote: true },
    { idx: 2, xPct: 12, rowY: 100, isNote: true },
    { idx: 3, xPct: 32, rowY: 100, isNote: true },
  ];
  const words = [
    { chord: "C", xCenter: 105, yCenter: 100, conf: 80 },
    { chord: "G", xCenter: 305, yCenter: 100, conf: 80 },
    { chord: "F", xCenter: 120, yCenter: 500, conf: 80 },
  ];

  const entries = alignChordWordsToNotes(words, notes, { left: 0, top: 0, width: 1000, height: 1000 });

  assert.deepEqual(entries, [
    { noteIdx: 0, chord: "C" },
    { noteIdx: 1, chord: "G" },
    { noteIdx: 2, chord: "F" },
  ]);
});
