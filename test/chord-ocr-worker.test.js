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
  compareChordJson,
  planMissingChordBatch,
  findSourceImagesForSong,
  planPageImageMapping,
  alignChordWordsToNotes,
  alignChordWordsToNotesPdfDriven,
  selectSopranoNoteRows,
  splitSopranoRowIntoMeasures,
  inferCChordForMeasure,
  generateCChordJsonFromSoprano,
  createMelodySignature,
  buildMelodyTrainingLibrary,
  generateCChordJsonWithTraining,
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

test("compares generated chord JSON against a trusted note-aligned reference", () => {
  const expected = {
    pages: {
      "1": [
        { noteIdx: 0, chord: "C" },
        { noteIdx: 4, chord: "G" },
      ],
    },
  };
  const generated = {
    pages: {
      "1": [
        { noteIdx: 0, chord: "C" },
        { noteIdx: 3, chord: "F" },
        { noteIdx: 4, chord: "D" },
      ],
    },
  };

  assert.deepEqual(compareChordJson(generated, expected), {
    expectedCount: 2,
    generatedCount: 3,
    positionMatches: 2,
    exactMatches: 1,
    extraCount: 1,
    positionScore: 1,
    exactScore: 0.5,
  });
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

test("PDF-driven alignment uses OCR note rows as local anchors", () => {
  const notes = [
    { idx: 0, xPct: 10, rowY: 200, isNote: true },
    { idx: 1, xPct: 30, rowY: 200, isNote: true },
    { idx: 2, xPct: 50, rowY: 200, isNote: true },
    { idx: 3, xPct: 10, rowY: 100, isNote: true },
    { idx: 4, xPct: 30, rowY: 100, isNote: true },
    { idx: 5, xPct: 50, rowY: 100, isNote: true },
  ];
  const photoNoteRows = [
    {
      yCenter: 300,
      items: [
        { xCenter: 100, yCenter: 300 },
        { xCenter: 300, yCenter: 300 },
        { xCenter: 500, yCenter: 300 },
      ],
    },
    {
      yCenter: 700,
      items: [
        { xCenter: 100, yCenter: 700 },
        { xCenter: 300, yCenter: 700 },
        { xCenter: 500, yCenter: 700 },
      ],
    },
  ];
  const words = [
    { chord: "C", xCenter: 300, yCenter: 230, conf: 80 },
    { chord: "G", xCenter: 500, yCenter: 630, conf: 80 },
  ];

  const entries = alignChordWordsToNotesPdfDriven(words, photoNoteRows, notes, { left: 0, top: 0, width: 1000, height: 1000 });

  assert.deepEqual(entries, [
    { noteIdx: 1, chord: "C" },
    { noteIdx: 5, chord: "G" },
  ]);
});

test("selects only soprano rows from paired numeric-notation rows", () => {
  const notes = [
    { idx: 0, str: "3", rowY: 500, xPct: 10, isNote: true },
    { idx: 1, str: "5", rowY: 480, xPct: 10, isNote: true },
    { idx: 2, str: "1", rowY: 420, xPct: 10, isNote: true },
    { idx: 3, str: "3", rowY: 400, xPct: 10, isNote: true },
  ];

  const rows = selectSopranoNoteRows(notes);

  assert.deepEqual(rows.map((row) => row.items.map((note) => note.idx)), [[0], [2]]);
});

test("splits a soprano row into measure-like groups from wider x gaps", () => {
  const row = {
    items: [
      { idx: 0, str: "1", xPct: 10, isNote: true },
      { idx: 1, str: "2", xPct: 15, isNote: true },
      { idx: 2, str: "3", xPct: 20, isNote: true },
      { idx: 3, str: "4", xPct: 25, isNote: true },
      { idx: 4, str: "5", xPct: 35, isNote: true },
      { idx: 5, str: "6", xPct: 40, isNote: true },
    ],
  };

  const measures = splitSopranoRowIntoMeasures(row);

  assert.deepEqual(measures.map((measure) => measure.map((note) => note.idx)), [[0, 1, 2, 3], [4, 5]]);
});

test("infers C-family chords from soprano measure tones including minor colors", () => {
  assert.equal(inferCChordForMeasure(["1", "3", "5", "1"]), "C");
  assert.equal(inferCChordForMeasure(["5", "7", "2", "5"]), "G");
  assert.equal(inferCChordForMeasure(["6", "1", "3", "6"]), "Am");
  assert.equal(inferCChordForMeasure(["2", "4", "6", "2"]), "Dm");
});

test("generates note-aligned C-family chord JSON from soprano measure starts", () => {
  const notes = [
    { idx: 0, str: "1", rowY: 500, xPct: 10, isNote: true },
    { idx: 1, str: "3", rowY: 500, xPct: 15, isNote: true },
    { idx: 2, str: "5", rowY: 500, xPct: 20, isNote: true },
    { idx: 3, str: "1", rowY: 500, xPct: 25, isNote: true },
    { idx: 4, str: "6", rowY: 500, xPct: 35, isNote: true },
    { idx: 5, str: "1", rowY: 500, xPct: 40, isNote: true },
    { idx: 6, str: "5", rowY: 480, xPct: 10, isNote: true },
    { idx: 7, str: "5", rowY: 480, xPct: 15, isNote: true },
  ];

  const json = generateCChordJsonFromSoprano({ pages: [{ notes }] });

  assert.deepEqual(json, {
    version: 2,
    type: "note-aligned",
    pages: {
      "1": [
        { noteIdx: 0, chord: "C" },
        { noteIdx: 4, chord: "Am" },
      ],
    },
  });
});

test("trained melody generator reuses a trusted melody template in C family", () => {
  const extracted = {
    pages: [
      {
        notes: [
          { idx: 0, str: "1", rowY: 500, xPct: 10, isNote: true },
          { idx: 1, str: "3", rowY: 500, xPct: 20, isNote: true },
          { idx: 2, str: "5", rowY: 480, xPct: 10, isNote: true },
        ],
      },
    ],
  };
  const trustedJson = {
    version: 2,
    type: "note-aligned",
    pages: {
      "1": [
        { noteIdx: 0, chord: "E" },
        { noteIdx: 1, chord: "B" },
      ],
    },
  };

  const library = buildMelodyTrainingLibrary([{ song: 7, extracted, chordJson: trustedJson }]);
  const generated = generateCChordJsonWithTraining(extracted, library);

  assert.equal(library.get(createMelodySignature(extracted)).song, 7);
  assert.deepEqual(generated, {
    version: 2,
    type: "note-aligned",
    pages: {
      "1": [
        { noteIdx: 0, chord: "C" },
        { noteIdx: 1, chord: "G" },
      ],
    },
    trainingMatch: {
      song: 7,
      normalizedByShift: -4,
      source: "trusted-melody-template",
    },
  });
});

test("trained melody generator falls back to soprano inference when no template matches", () => {
  const extracted = {
    pages: [
      {
        notes: [
          { idx: 0, str: "1", rowY: 500, xPct: 10, isNote: true },
          { idx: 1, str: "3", xPct: 15, rowY: 500, isNote: true },
          { idx: 2, str: "5", xPct: 20, rowY: 500, isNote: true },
          { idx: 3, str: "1", xPct: 25, rowY: 500, isNote: true },
        ],
      },
    ],
  };

  const generated = generateCChordJsonWithTraining(extracted, new Map());

  assert.deepEqual(generated, {
    version: 2,
    type: "note-aligned",
    pages: {
      "1": [{ noteIdx: 0, chord: "C" }],
    },
    trainingMatch: null,
  });
});
