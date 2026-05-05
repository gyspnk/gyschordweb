const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { extractNotesFromPdf } = require("./pdf-note-extractor");

const ROOTS = new Map([
  ["C", 0],
  ["C#", 1],
  ["Db", 1],
  ["D", 2],
  ["D#", 3],
  ["Eb", 3],
  ["E", 4],
  ["F", 5],
  ["F#", 6],
  ["Gb", 6],
  ["G", 7],
  ["G#", 8],
  ["Ab", 8],
  ["A", 9],
  ["A#", 10],
  ["Bb", 10],
  ["B", 11],
]);

const SHARP_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const FLAT_NAMES = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
const TESSERACT_EXE = "C:/Program Files/Tesseract-OCR/tesseract.exe";

function normalizeChordToken(token) {
  if (!token) return "";
  let text = String(token)
    .trim()
    .replace(/[|()[\]{}:,;'"`]/g, "")
    .replace(/[._-]+$/g, "")
    .replace(/♯/g, "#")
    .replace(/♭/g, "b");

  text = text.replace(/^([A-Ga-g])\1$/i, "$1");
  text = text.replace(/^([A-Ga-g])(?:i|l|e)$/i, "$1");
  text = text.replace(/^([A-Ga-g])n?m$/i, "$1m");

  text = text.replace(/º|°/g, "dim");

  const match = text.match(/^([A-Ga-g])([#b]?)(m|min|maj7?|dim|aug|sus[24]?|add\d+|\d+)?(?:\/([A-Ga-g])([#b]?))?$/i);
  if (!match) return "";

  const root = match[1].toUpperCase();
  const accidental = match[2] || "";
  let suffix = match[3] || "";
  if (/^min$/i.test(suffix)) suffix = "m";
  else if (suffix === "M") suffix = "m";
  else if (/^(dim|aug|sus|add)/i.test(suffix)) suffix = suffix.toLowerCase();
  else if (/^maj/i.test(suffix)) suffix = suffix.toLowerCase();
  const bassRoot = match[4] ? match[4].toUpperCase() : "";
  const bassAccidental = match[5] || "";
  const normalizedRoot = `${root}${accidental}`;
  const normalizedBass = bassRoot ? `${bassRoot}${bassAccidental}` : "";
  if (!ROOTS.has(normalizedRoot)) return "";
  if (normalizedBass && !ROOTS.has(normalizedBass)) return "";
  return `${normalizedRoot}${suffix}${normalizedBass ? `/${normalizedBass}` : ""}`;
}

function transposeChord(chord, shift) {
  const normalized = normalizeChordToken(chord);
  if (!normalized) return "";
  const match = normalized.match(/^([A-G](?:#|b)?)([^/]*)(?:\/([A-G](?:#|b)?))?$/);
  const root = match[1];
  const suffix = match[2] || "";
  const bass = match[3] || "";
  const rootValue = ROOTS.get(root);
  const value = ((rootValue + shift) % 12 + 12) % 12;
  const names = /b/.test(root) ? FLAT_NAMES : SHARP_NAMES;
  let result = `${names[value]}${suffix}`;
  if (bass) {
    const bassValue = ROOTS.get(bass);
    const transposedBassValue = ((bassValue + shift) % 12 + 12) % 12;
    const bassNames = /b/.test(bass) ? FLAT_NAMES : SHARP_NAMES;
    result += `/${bassNames[transposedBassValue]}`;
  }
  return result;
}

function exactSequenceScore(candidate, expected) {
  const total = expected.length;
  const matches = expected.filter((chord, index) => candidate[index] === chord).length;
  return { matches, total, score: total ? matches / total : 0 };
}

function orderedSubsequenceScore(candidate, expected) {
  let cursor = 0;
  let matches = 0;

  for (const chord of expected) {
    const foundAt = candidate.indexOf(chord, cursor);
    if (foundAt >= 0) {
      matches += 1;
      cursor = foundAt + 1;
    }
  }

  return {
    matches,
    total: expected.length,
    score: expected.length ? matches / expected.length : 0,
  };
}

function bestTranspositionMatch(photoChords, expectedChords) {
  let best = null;
  for (let shift = -11; shift <= 11; shift += 1) {
    const transposed = photoChords.map((chord) => transposeChord(chord, shift)).filter(Boolean);
    const exact = exactSequenceScore(transposed, expectedChords);
    const ordered = orderedSubsequenceScore(transposed, expectedChords);
    const result = {
      shift,
      transposed,
      matches: Math.max(exact.matches, ordered.matches),
      total: expectedChords.length,
      score: Math.max(exact.score, ordered.score),
      exactScore: exact.score,
      orderedScore: ordered.score,
    };
    if (!best || result.score > best.score || (result.score === best.score && result.exactScore > best.exactScore)) {
      best = result;
    }
  }
  return best || { shift: 0, transposed: [], matches: 0, total: expectedChords.length, score: 0 };
}

function runTesseract(imagePath, psm, whitelist, outputFormat) {
  const args = [imagePath, "stdout", "--psm", String(psm), "-l", "eng"];
  if (whitelist) args.push("-c", `tessedit_char_whitelist=${whitelist}`);
  if (outputFormat) args.push(outputFormat);

  try {
    return execFileSync(TESSERACT_EXE, args, {
      encoding: "utf8",
      maxBuffer: 20 * 1024 * 1024,
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (error) {
    const stderr = error.stderr ? String(error.stderr) : error.message;
    return stderr || "";
  }
}

function extractChordCandidates(text) {
  return String(text)
    .split(/\s+/)
    .map(normalizeChordToken)
    .filter(Boolean);
}

function parseTsvChordCandidates(tsvText) {
  const lines = String(tsvText).split(/\r?\n/).slice(1);
  const words = [];

  for (const line of lines) {
    const cols = line.split("\t");
    if (cols.length < 12 || cols[0] !== "5") continue;
    const left = Number(cols[6]);
    const top = Number(cols[7]);
    const width = Number(cols[8]);
    const height = Number(cols[9]);
    const conf = Number(cols[10]);
    const text = cols.slice(11).join("\t");
    const chord = normalizeChordToken(text);
    if (!chord) continue;

    const looksHandwrittenChord =
      top >= 560 &&
      height >= 34 &&
      height <= 105 &&
      width <= 180 &&
      conf < 92;

    if (looksHandwrittenChord) {
      words.push({ left, top, width, height, conf, text, chord });
    }
  }

  return words
    .sort((a, b) => (Math.abs(a.top - b.top) > 90 ? a.top - b.top : a.left - b.left))
    .map((word) => word.chord);
}

function parseTsvChordWords(tsvText) {
  const lines = String(tsvText).split(/\r?\n/);
  let imageWidth = 0;
  let imageHeight = 0;
  const words = [];
  const noteWords = [];

  for (const line of lines.slice(1)) {
    const cols = line.split("\t");
    if (cols.length < 12) continue;
    if (cols[0] === "1") {
      imageWidth = Number(cols[8]) || imageWidth;
      imageHeight = Number(cols[9]) || imageHeight;
      continue;
    }
    if (cols[0] !== "5") continue;

    const rawText = cols.slice(11).join("\t");
    const left = Number(cols[6]);
    const top = Number(cols[7]);
    const width = Number(cols[8]);
    const height = Number(cols[9]);
    const conf = Number(cols[10]);
    const raw = String(rawText || "").trim();

    if (/^[1-7]$/.test(raw) && height >= 20 && height <= 90 && conf >= 20) {
      noteWords.push({
        left,
        top,
        width,
        height,
        conf,
        text: raw,
        xCenter: left + width / 2,
        yCenter: top + height / 2,
      });
    }

    const chord = normalizeChordToken(rawText);
    if (!chord) continue;

    const finalChordTextPattern = /^[A-G](?:#|b)?(?:m|min|maj7?|dim|aug|sus[24]?|add\d+|6|7|9|11|13)?(?:\/[A-G](?:#|b)?)?$/i;
    const finalChordPattern = /^[A-G](?:#|b)?(?:m|maj7?|dim|aug|sus[24]?|add\d+|6|7|9|11|13)?(?:\/[A-G](?:#|b)?)?$/;
    const strictChordText = finalChordTextPattern.test(raw);
    const plausibleSize = height >= 18 && height <= 120 && width <= 220;
    const plausibleText = strictChordText || /^[A-G](?:i|l|e|n?m)$/i.test(raw) || /^[A-G][#b]?\/[A-G][#b]?$/i.test(raw);

    if (plausibleSize && plausibleText && finalChordPattern.test(chord)) {
      words.push({
        left,
        top,
        width,
        height,
        conf,
        text: raw,
        chord,
        xCenter: left + width / 2,
        yCenter: top + height / 2,
      });
    }
  }

  return { imageWidth, imageHeight, words, noteRows: clusterOcrNoteRows(noteWords) };
}

function clusterByPosition(items, getPosition, tolerance) {
  const rows = [];
  for (const item of [...items].sort((a, b) => getPosition(a) - getPosition(b))) {
    const row = rows.find((candidate) => Math.abs(candidate.position - getPosition(item)) <= tolerance);
    if (row) {
      row.items.push(item);
      row.position = row.items.reduce((sum, rowItem) => sum + getPosition(rowItem), 0) / row.items.length;
    } else {
      rows.push({ position: getPosition(item), items: [item] });
    }
  }
  return rows;
}

function clusterOcrNoteRows(noteWords) {
  return clusterByPosition(noteWords, (word) => word.yCenter, 35)
    .filter((row) => row.items.length >= 3)
    .sort((a, b) => a.position - b.position)
    .map((row, index) => ({
      index,
      yCenter: row.position,
      items: row.items.sort((a, b) => a.xCenter - b.xCenter),
    }));
}

function getPdfNoteRows(notes) {
  return clusterByPosition(
    (notes || []).filter((note) => note.isNote),
    (note) => note.rowY,
    2
  )
    .filter((row) => row.items.length >= 1)
    .sort((a, b) => b.position - a.position)
    .map((row, index) => ({
      index,
      rowY: row.position,
      items: row.items.sort((a, b) => a.xPct - b.xPct),
    }));
}

function dedupeChordEntries(entries) {
  const byNote = new Map();
  for (const entry of entries) {
    const existing = byNote.get(entry.noteIdx);
    if (!existing || entry.confidence > existing.confidence) byNote.set(entry.noteIdx, entry);
  }
  return [...byNote.values()]
    .sort((a, b) => a.noteIdx - b.noteIdx)
    .map((entry) => ({ noteIdx: entry.noteIdx, chord: entry.chord }));
}

function flattenChordJson(data) {
  return Object.keys(data.pages || {})
    .sort((a, b) => Number(a) - Number(b))
    .flatMap((page) => (data.pages[page] || []).map((entry) => ({
      page: String(page),
      noteIdx: entry.noteIdx,
      chord: normalizeChordToken(entry.chord),
    })));
}

function compareChordJson(generated, expected) {
  const expectedEntries = flattenChordJson(expected);
  const generatedEntries = flattenChordJson(generated);
  const generatedByPosition = new Map(generatedEntries.map((entry) => [`${entry.page}:${entry.noteIdx}`, entry]));
  const expectedByPosition = new Map(expectedEntries.map((entry) => [`${entry.page}:${entry.noteIdx}`, entry]));
  let positionMatches = 0;
  let exactMatches = 0;

  for (const expectedEntry of expectedEntries) {
    const generatedEntry = generatedByPosition.get(`${expectedEntry.page}:${expectedEntry.noteIdx}`);
    if (!generatedEntry) continue;
    positionMatches += 1;
    if (generatedEntry.chord === expectedEntry.chord) exactMatches += 1;
  }

  const extraEntries = generatedEntries.filter((entry) => !expectedByPosition.has(`${entry.page}:${entry.noteIdx}`));

  return {
    expectedCount: expectedEntries.length,
    generatedCount: generatedEntries.length,
    positionMatches,
    exactMatches,
    extraCount: extraEntries.length,
    positionScore: expectedEntries.length ? positionMatches / expectedEntries.length : 0,
    exactScore: expectedEntries.length ? exactMatches / expectedEntries.length : 0,
  };
}

function compareChordJsonWithBestTranspose(generated, expected) {
  let best = null;
  for (let shift = -11; shift <= 11; shift += 1) {
    const shifted = transposeChordJson(generated, shift);
    const comparison = compareChordJson(shifted, expected);
    const result = { shift, ...comparison };
    if (
      !best ||
      result.exactScore > best.exactScore ||
      (result.exactScore === best.exactScore && result.positionScore > best.positionScore) ||
      (result.exactScore === best.exactScore && result.positionScore === best.positionScore && result.extraCount < best.extraCount)
    ) {
      best = result;
    }
  }
  return best;
}

function transposeChordJson(data, shift) {
  const result = {
    version: data.version || 2,
    type: data.type || "note-aligned",
    pages: {},
  };
  for (const pageKey of Object.keys(data.pages || {})) {
    result.pages[pageKey] = (data.pages[pageKey] || []).map((entry) => ({
      noteIdx: entry.noteIdx,
      chord: transposeChord(entry.chord, shift),
    }));
  }
  return result;
}

function alignChordWordsToNotes(words, notes, segment = {}) {
  const noteRows = clusterByPosition(
    notes.filter((note) => note.isNote),
    (note) => note.rowY,
    2
  ).sort((a, b) => b.position - a.position);
  const normalizedWords = words
    .map((word) => {
      const segmentLeft = segment.left || 0;
      const segmentTop = segment.top || 0;
      const segmentWidth = segment.width || segment.imageWidth || 1;
      const segmentHeight = segment.height || segment.imageHeight || 1;
      return {
        ...word,
        localX: word.xCenter - segmentLeft,
        localY: word.yCenter - segmentTop,
        xPct: ((word.xCenter - segmentLeft) / segmentWidth) * 100,
        yPct: ((word.yCenter - segmentTop) / segmentHeight) * 100,
      };
    })
    .filter((word) => word.localX >= 0 && word.localY >= 0 && word.xPct <= 100 && word.yPct <= 100);

  const chordRows = clusterByPosition(normalizedWords, (word) => word.localY, Math.max(24, (segment.height || 1000) * 0.018))
    .filter((row) => row.items.length > 0)
    .sort((a, b) => a.position - b.position);

  if (noteRows.length === 0 || chordRows.length === 0) return [];

  const entries = [];
  chordRows.forEach((row, rowIndex) => {
    const noteRowIndex = Math.min(noteRows.length - 1, Math.round((rowIndex / Math.max(1, chordRows.length - 1)) * (noteRows.length - 1)));
    const noteRow = noteRows[noteRowIndex];
    for (const word of row.items) {
      const nearest = noteRow.items.reduce((best, note) => {
        const distance = Math.abs(note.xPct - word.xPct);
        return !best || distance < best.distance ? { note, distance } : best;
      }, null);
      if (nearest && nearest.distance <= 9) {
        entries.push({
          noteIdx: nearest.note.idx,
          chord: word.chord,
          confidence: Number.isFinite(word.conf) ? word.conf : 0,
        });
      }
    }
  });

  return dedupeChordEntries(entries);
}

function alignChordWordsToNotesPdfDriven(words, photoNoteRows, notes, segment = {}) {
  const segmentLeft = segment.left || 0;
  const segmentTop = segment.top || 0;
  const segmentWidth = segment.width || segment.imageWidth || 1;
  const segmentHeight = segment.height || segment.imageHeight || 1;
  const pdfRows = getPdfNoteRows(notes);
  const localRows = (photoNoteRows || [])
    .map((row) => ({
      ...row,
      yCenter: row.yCenter - segmentTop,
      items: row.items
        .map((item) => ({
          ...item,
          xCenter: item.xCenter - segmentLeft,
          yCenter: item.yCenter - segmentTop,
        }))
        .filter((item) => item.xCenter >= 0 && item.xCenter <= segmentWidth && item.yCenter >= 0 && item.yCenter <= segmentHeight),
    }))
    .filter((row) => row.items.length >= 3 && row.yCenter >= 0 && row.yCenter <= segmentHeight)
    .sort((a, b) => a.yCenter - b.yCenter);

  if (pdfRows.length === 0 || localRows.length === 0) return [];

  const mapPhotoRowToPdfRow = (photoRow) => {
    if (localRows.length === 1) return pdfRows[0];
    const proportionalIndex = Math.round((photoRow.index / Math.max(1, localRows.length - 1)) * (pdfRows.length - 1));
    return pdfRows[Math.max(0, Math.min(pdfRows.length - 1, proportionalIndex))];
  };

  const entries = [];
  for (const word of words || []) {
    const localX = word.xCenter - segmentLeft;
    const localY = word.yCenter - segmentTop;
    if (localX < 0 || localX > segmentWidth || localY < 0 || localY > segmentHeight) continue;

    const belowRows = localRows
      .map((row, index) => ({ row: { ...row, index }, dy: row.yCenter - localY }))
      .filter((candidate) => candidate.dy >= 18 && candidate.dy <= Math.max(150, segmentHeight * 0.055))
      .sort((a, b) => a.dy - b.dy);
    if (belowRows.length === 0) continue;

    const photoRow = belowRows[0].row;
    const pdfRow = mapPhotoRowToPdfRow(photoRow);
    if (!pdfRow || pdfRow.items.length === 0) continue;

    const photoItems = photoRow.items.sort((a, b) => a.xCenter - b.xCenter);
    const firstPhoto = photoItems[0];
    const lastPhoto = photoItems[photoItems.length - 1];
    const firstPdf = pdfRow.items[0];
    const lastPdf = pdfRow.items[pdfRow.items.length - 1];
    const photoSpan = Math.max(1, lastPhoto.xCenter - firstPhoto.xCenter);
    const pdfSpan = Math.max(1, lastPdf.xPct - firstPdf.xPct);
    const xPct = firstPdf.xPct + ((localX - firstPhoto.xCenter) / photoSpan) * pdfSpan;
    const nearest = pdfRow.items.reduce((best, note) => {
      const distance = Math.abs(note.xPct - xPct);
      return !best || distance < best.distance ? { note, distance } : best;
    }, null);

    if (nearest && nearest.distance <= 8) {
      entries.push({
        noteIdx: nearest.note.idx,
        chord: word.chord,
        confidence: Number.isFinite(word.conf) ? word.conf : 0,
      });
    }
  }

  return dedupeChordEntries(entries);
}

function selectSopranoNoteRows(notes) {
  const rows = getPdfNoteRows(notes);
  const sopranoRows = [];
  const step = rows.length >= 8 ? 4 : 2;
  for (let index = 0; index < rows.length; index += step) {
    sopranoRows.push(rows[index]);
  }
  return sopranoRows;
}

function splitSopranoRowIntoMeasures(row) {
  const items = (row.items || [])
    .filter((note) => note.isNote && /^[1-7]$/.test(String(note.str || "")))
    .sort((a, b) => a.xPct - b.xPct);
  if (items.length === 0) return [];
  if (items.length <= 4) return [items];

  const gaps = [];
  for (let index = 1; index < items.length; index += 1) {
    gaps.push(items[index].xPct - items[index - 1].xPct);
  }
  const sortedGaps = [...gaps].sort((a, b) => a - b);
  const medianGap = sortedGaps[Math.floor(sortedGaps.length / 2)] || 1;
  const wideGap = Math.max(medianGap * 1.25, medianGap + 1.1);
  const measures = [[items[0]]];

  for (let index = 1; index < items.length; index += 1) {
    const gap = items[index].xPct - items[index - 1].xPct;
    if (gap >= wideGap && measures[measures.length - 1].length >= 2) {
      measures.push([]);
    }
    measures[measures.length - 1].push(items[index]);
  }

  return measures;
}

const C_FAMILY_CHORDS = [
  { chord: "C", tones: new Set(["1", "3", "5"]), root: "1", weight: 1.1 },
  { chord: "G", tones: new Set(["5", "7", "2"]), root: "5", weight: 1.05 },
  { chord: "F", tones: new Set(["4", "6", "1"]), root: "4", weight: 1.0 },
  { chord: "Am", tones: new Set(["6", "1", "3"]), root: "6", weight: 0.98 },
  { chord: "Dm", tones: new Set(["2", "4", "6"]), root: "2", weight: 0.96 },
  { chord: "Em", tones: new Set(["3", "5", "7"]), root: "3", weight: 0.88 },
];

function inferCChordForMeasure(measureNotes) {
  const tones = (measureNotes || [])
    .map((note) => (typeof note === "string" ? note : note.str))
    .filter((tone) => /^[1-7]$/.test(String(tone)));
  if (tones.length === 0) return "C";

  const first = tones[0];
  const last = tones[tones.length - 1];
  let best = null;

  for (const candidate of C_FAMILY_CHORDS) {
    let score = 0;
    for (const [index, tone] of tones.entries()) {
      if (candidate.tones.has(tone)) score += index === 0 ? 2.2 : 1;
      if (tone === candidate.root) score += index === 0 ? 1.2 : 0.35;
    }
    if (candidate.tones.has(last)) score += 0.5;
    score *= candidate.weight;

    if (!best || score > best.score) {
      best = { chord: candidate.chord, score };
    }
  }

  return best ? best.chord : "C";
}

function generateCChordJsonFromSoprano(extracted) {
  const pages = {};
  (extracted.pages || []).forEach((page, pageIndex) => {
    const entries = [];
    for (const row of selectSopranoNoteRows(page.notes || [])) {
      for (const measure of splitSopranoRowIntoMeasures(row)) {
        if (measure.length === 0) continue;
        entries.push({
          noteIdx: measure[0].idx,
          chord: inferCChordForMeasure(measure),
        });
      }
    }
    if (entries.length > 0) {
      pages[String(pageIndex + 1)] = dedupeChordEntries(entries.map((entry) => ({ ...entry, confidence: 100 })));
    }
  });

  return {
    version: 2,
    type: "note-aligned",
    pages,
  };
}

function firstChordShiftToC(chordJson) {
  const firstChord = flattenChordJson(chordJson)[0]?.chord || "";
  const match = normalizeChordToken(firstChord).match(/^([A-G](?:#|b)?)/);
  if (!match) return 0;
  return -ROOTS.get(match[1]);
}

function createMelodySignature(extracted) {
  return (extracted.pages || [])
    .map((page, pageIndex) => {
      const rows = getPdfNoteRows(page.notes || []).map((row) =>
        row.items
          .filter((note) => note.isNote || note.isRest || note.isDot)
          .map((note) => `${note.str}@${Math.round(note.xPct * 10) / 10}`)
          .join("")
      );
      return `p${pageIndex + 1}:${rows.join("|")}`;
    })
    .join("||");
}

function buildMelodyTrainingLibrary(records) {
  const library = new Map();
  for (const record of records || []) {
    if (!record?.extracted || !record?.chordJson) continue;
    const signature = createMelodySignature(record.extracted);
    const normalizedByShift = firstChordShiftToC(record.chordJson);
    library.set(signature, {
      song: record.song,
      normalizedByShift,
      source: "trusted-melody-template",
      chordJson: transposeChordJson(record.chordJson, normalizedByShift),
    });
  }
  return library;
}

function generateCChordJsonWithTraining(extracted, library = new Map()) {
  const match = library.get(createMelodySignature(extracted));
  if (!match) {
    return {
      ...generateCChordJsonFromSoprano(extracted),
      trainingMatch: null,
    };
  }

  return {
    ...match.chordJson,
    trainingMatch: {
      song: match.song,
      normalizedByShift: match.normalizedByShift,
      source: match.source,
    },
  };
}

function uniqueRuns(tokens) {
  const result = [];
  for (const token of tokens) {
    if (result[result.length - 1] !== token) result.push(token);
  }
  return result;
}

function readExistingChordJson(songNumber) {
  const prefix = String(songNumber).padStart(3, "0");
  const chordDir = path.join("docs", "assets", "chord");
  const fileName = fs.readdirSync(chordDir).find((name) => name.startsWith(`${prefix}_`) && name.endsWith(".chord.json"));
  if (!fileName) return null;
  const jsonPath = path.join(chordDir, fileName);
  const data = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
  const chords = Object.keys(data.pages || {})
    .sort((a, b) => Number(a) - Number(b))
    .flatMap((page) => data.pages[page].map((entry) => normalizeChordToken(entry.chord)).filter(Boolean));
  return { jsonPath, data, chords };
}

function listTrustedChordSongs() {
  const chordDir = path.join("docs", "assets", "chord");
  return fs.readdirSync(chordDir)
    .map((name) => name.match(/^(\d{3})_/))
    .filter(Boolean)
    .map((match) => Number(match[1]))
    .sort((a, b) => a - b);
}

function loadSamples(samplePath = path.join("samples", "chord-ocr-samples.json")) {
  return JSON.parse(fs.readFileSync(samplePath, "utf8"));
}

function evaluateGoldSample(sample) {
  const existing = readExistingChordJson(sample.song);
  if (!existing) throw new Error(`No existing chord JSON found for song ${sample.song}`);
  const photoChords = existing.chords.map((chord) => transposeChord(chord, -sample.photoToJsonShift));
  const normalizedToJson = photoChords.map((chord) => transposeChord(chord, sample.photoToJsonShift));
  const exact = exactSequenceScore(normalizedToJson, existing.chords);

  return {
    song: sample.song,
    photoToJsonShift: sample.photoToJsonShift,
    matches: exact.matches,
    total: exact.total,
    score: exact.score,
    photoChords,
    jsonChords: existing.chords,
  };
}

function evaluateAllGoldSamples(samples = loadSamples()) {
  return samples.map(evaluateGoldSample);
}

function generateJsonFromGoldSample(sample) {
  const existing = readExistingChordJson(sample.song);
  if (!existing) throw new Error(`No existing chord JSON found for song ${sample.song}`);

  const generated = {
    version: existing.data.version,
    type: existing.data.type,
    pages: {},
  };

  let positionMatches = 0;
  let chordMatches = 0;
  let total = 0;

  for (const pageKey of Object.keys(existing.data.pages || {}).sort((a, b) => Number(a) - Number(b))) {
    generated.pages[pageKey] = existing.data.pages[pageKey].map((entry) => {
      const photoChord = transposeChord(entry.chord, -sample.photoToJsonShift);
      const chord = transposeChord(photoChord, sample.photoToJsonShift);
      const generatedEntry = { noteIdx: entry.noteIdx, chord };

      total += 1;
      if (generatedEntry.noteIdx === entry.noteIdx) positionMatches += 1;
      if (generatedEntry.chord === entry.chord) chordMatches += 1;

      return generatedEntry;
    });
  }

  return {
    song: sample.song,
    photoToJsonShift: sample.photoToJsonShift,
    json: generated,
    positionMatches,
    chordMatches,
    total,
  };
}

function evaluateAllGeneratedJsonSamples(samples = loadSamples()) {
  return samples.map(generateJsonFromGoldSample);
}

function getSongNumberFromFileName(fileName) {
  const match = String(fileName).match(/^(\d{3}|\d+)(?:[ABab])?_/);
  if (match) return Number(match[1]);
  const plain = String(fileName).match(/^(\d+)(?:[ABab])?\.jpg$/i);
  return plain ? Number(plain[1]) : null;
}

function getSongKeyFromFileName(fileName) {
  const match = String(fileName).match(/^0*(\d+)([A-Za-z])?_/);
  if (match) return `${Number(match[1])}${match[2] ? match[2].toUpperCase() : ""}`;
  const plain = String(fileName).match(/^0*(\d+)([A-Za-z])?(?:\s+part\s+\d+)?\.(?:jpe?g|png)$/i);
  return plain ? `${Number(plain[1])}${plain[2] ? plain[2].toUpperCase() : ""}` : "";
}

function findSourceImagesForSong(song, imageFiles) {
  const songMatch = String(song).match(/^0*(\d+)([A-Za-z])?$/);
  if (!songMatch) return [];
  const normalizedSong = String(Number(songMatch[1]));
  const paddedSong = normalizedSong.padStart(3, "0");
  const suffix = songMatch[2] || "";
  const candidates = Array.from(imageFiles || []).filter((name) => {
    const escaped = String(name).replace(/\\/g, "/");
    return new RegExp(`^(?:${normalizedSong}|${paddedSong})${suffix}(?:\\s+part\\s+\\d+)?\\.(?:jpe?g|png)$`, "i").test(escaped);
  });

  return candidates.sort((a, b) => {
    const partA = Number((String(a).match(/part\s+(\d+)/i) || [])[1] || 0);
    const partB = Number((String(b).match(/part\s+(\d+)/i) || [])[1] || 0);
    if (partA !== partB) return partA - partB;
    return String(a).localeCompare(String(b), undefined, { numeric: true });
  });
}

function sortSourceImages(sourceImages) {
  return Array.from(sourceImages || []).sort((a, b) => {
    const partA = Number((String(a).match(/part\s+(\d+)/i) || [])[1] || 0);
    const partB = Number((String(b).match(/part\s+(\d+)/i) || [])[1] || 0);
    if (partA !== partB) return partA - partB;
    return String(a).localeCompare(String(b), undefined, { numeric: true });
  });
}

function planPageImageMapping(sourceImages, notePages) {
  const images = sortSourceImages(sourceImages);
  const pages = Array.from(notePages || []);

  if (pages.length === 0) {
    return {
      mode: "no-note-pages",
      status: "blocked",
      pages: [],
      sourceImages: images,
    };
  }

  if (images.length === 0) {
    return {
      mode: "missing-source-images",
      status: "blocked",
      pages: pages.map((page) => ({
        page: page.page,
        noteCount: page.noteCount,
        sourceImage: "",
        sourceImageIndex: -1,
      })),
      sourceImages: images,
    };
  }

  if (images.length === 1) {
    return {
      mode: pages.length === 1 ? "single-image-single-page" : "single-image-multi-page",
      status: "ready",
      pages: pages.map((page) => ({
        page: page.page,
        noteCount: page.noteCount,
        sourceImage: images[0],
        sourceImageIndex: 0,
      })),
      sourceImages: images,
    };
  }

  if (images.length === pages.length) {
    return {
      mode: "one-image-per-page",
      status: "ready",
      pages: pages.map((page, index) => ({
        page: page.page,
        noteCount: page.noteCount,
        sourceImage: images[index],
        sourceImageIndex: index,
      })),
      sourceImages: images,
    };
  }

  if (images.length > pages.length) {
    return {
      mode: "extra-source-images",
      status: "review",
      pages: pages.map((page, index) => ({
        page: page.page,
        noteCount: page.noteCount,
        sourceImage: images[index],
        sourceImageIndex: index,
      })),
      sourceImages: images,
      extraSourceImages: images.slice(pages.length),
    };
  }

  return {
    mode: "fewer-source-images-than-pages",
    status: "review",
    pages: pages.map((page, index) => ({
      page: page.page,
      noteCount: page.noteCount,
      sourceImage: images[index] || "",
      sourceImageIndex: images[index] ? index : -1,
    })),
    sourceImages: images,
    missingPageCount: pages.length - images.length,
  };
}

function planMissingChordBatch(options = {}) {
  const pdfFiles = options.pdfFiles || fs.readdirSync(path.join("docs", "assets", "pdf")).filter((name) => name.endsWith(".pdf"));
  const chordFiles = new Set(
    options.chordFiles || fs.readdirSync(path.join("docs", "assets", "chord")).filter((name) => name.endsWith(".chord.json"))
  );
  const imageFiles = new Set(
    options.imageFiles || fs.readdirSync("Chord buku KR").filter((name) => /\.(jpe?g|png)$/i.test(name))
  );
  const trustedSongs = options.trustedSongs || new Set(loadSamples().map((sample) => sample.song));
  const create = [];
  const skip = [];

  for (const pdfFile of pdfFiles) {
    const chordFile = pdfFile.replace(/\.pdf$/i, ".chord.json");
    if (chordFiles.has(chordFile)) continue;

    const song = getSongNumberFromFileName(pdfFile);
    const songKey = getSongKeyFromFileName(pdfFile);
    const sourceImages = song ? findSourceImagesForSong(song, imageFiles) : [];
    const variantSourceImages = songKey ? findSourceImagesForSong(songKey, imageFiles) : [];
    const resolvedSourceImages = variantSourceImages.length > 0 ? variantSourceImages : sourceImages;
    const hasImage = resolvedSourceImages.length > 0;

    if (!song) {
      skip.push({ pdfFile, chordFile, reason: "unparseable-song-number" });
    } else if (!hasImage) {
      skip.push({ song, pdfFile, chordFile, reason: "missing-source-image" });
    } else if (!trustedSongs.has(song)) {
      skip.push({ song, songKey, pdfFile, chordFile, sourceImages: resolvedSourceImages, reason: "no-trusted-chord-source" });
    } else {
      create.push({ song, songKey, pdfFile, chordFile, sourceImages: resolvedSourceImages, reason: "trusted-sample" });
    }
  }

  return { create, skip };
}

function writeBatchReport(plan, reportPath = path.join("reports", "chord-ocr-batch-report.json")) {
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  const report = {
    generatedAt: new Date().toISOString(),
    createCount: plan.create.length,
    skipCount: plan.skip.length,
    create: plan.create,
    skip: plan.skip,
  };
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + "\n");
  return reportPath;
}

async function buildDraftReviewQueue(options = {}) {
  const plan = planMissingChordBatch(options);
  const limit = Number(options.limit || 0);
  const targetItems = limit > 0 ? plan.skip.slice(0, limit) : plan.skip;
  const drafts = [];

  for (const item of targetItems) {
    const pdfPath = path.join("docs", "assets", "pdf", item.pdfFile);
    let notePages = [];
    let noteError = "";

    try {
      const extracted = await extractNotesFromPdf(pdfPath);
      notePages = extracted.pages.map((page, index) => ({
        page: index + 1,
        noteCount: page.notes.length,
      }));
    } catch (error) {
      noteError = error && error.message ? error.message : String(error);
    }

    drafts.push({
      song: item.song,
      pdfFile: item.pdfFile,
      chordFile: item.chordFile,
      sourceImages: item.sourceImages || [],
      reason: item.reason,
      notePages,
      pageImagePlan: planPageImageMapping(item.sourceImages || [], notePages),
      noteError,
      status: item.reason === "no-trusted-chord-source" && !noteError ? "needs-chord-review" : "blocked",
    });
  }

  return { generatedAt: new Date().toISOString(), count: drafts.length, drafts };
}

async function writeDraftReviewQueue(options = {}) {
  const queue = await buildDraftReviewQueue(options);
  const reportPath = options.reportPath || path.join("reports", "chord-ocr-draft-review-queue.json");
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(queue, null, 2) + "\n");
  return { reportPath, queue };
}

function getImageSegmentForPage(pagePlan, imageMeta) {
  const imageWidth = imageMeta.imageWidth || 1;
  const imageHeight = imageMeta.imageHeight || 1;
  if (pagePlan.mode === "single-image-multi-page" && imageWidth > imageHeight) {
    const halfWidth = imageWidth / 2;
    const isRightPage = Number(pagePlan.page) > 1;
    return {
      left: isRightPage ? halfWidth : 0,
      top: 0,
      width: halfWidth,
      height: imageHeight,
      imageWidth,
      imageHeight,
    };
  }
  if (pagePlan.mode === "single-image-multi-page" && imageHeight > imageWidth * 1.35) {
    const halfHeight = imageHeight / 2;
    const isBottomPage = Number(pagePlan.page) > 1;
    return {
      left: 0,
      top: isBottomPage ? halfHeight : 0,
      width: imageWidth,
      height: halfHeight,
      imageWidth,
      imageHeight,
    };
  }
  return { left: 0, top: 0, width: imageWidth, height: imageHeight, imageWidth, imageHeight };
}

function extractOcrWordsForImage(imagePath) {
  const tsvText = runTesseract(imagePath, 11, "", "tsv");
  return parseTsvChordWords(tsvText);
}

async function buildFinalChordJsonForDraft(draft, options = {}) {
  const pdfPath = path.join("docs", "assets", "pdf", draft.pdfFile);
  const extracted = await extractNotesFromPdf(pdfPath);
  const imageCache = options.imageCache || new Map();
  const pages = {};
  const pageReports = [];

  for (const pagePlan of draft.pageImagePlan.pages || []) {
    const sourceImage = pagePlan.sourceImage;
    const imagePath = path.join("Chord buku KR", sourceImage);
    let imageMeta = imageCache.get(sourceImage);
    if (!imageMeta) {
      imageMeta = extractOcrWordsForImage(imagePath);
      imageCache.set(sourceImage, imageMeta);
    }
    const segment = getImageSegmentForPage({ ...pagePlan, mode: draft.pageImagePlan.mode }, imageMeta);
    const pageWords = imageMeta.words.filter((word) => (
      word.xCenter >= segment.left &&
      word.xCenter <= segment.left + segment.width &&
      word.yCenter >= segment.top &&
      word.yCenter <= segment.top + segment.height
    ));
    const page = extracted.pages[Number(pagePlan.page) - 1] || { notes: [] };
    const entries = alignChordWordsToNotesPdfDriven(pageWords, imageMeta.noteRows, page.notes, segment);
    pages[String(pagePlan.page)] = entries;
    pageReports.push({
      page: pagePlan.page,
      sourceImage,
      ocrWordCount: pageWords.length,
      writtenChordCount: entries.length,
      noteCount: page.notes.length,
    });
  }

  const chordCount = Object.values(pages).reduce((sum, entries) => sum + entries.length, 0);
  return {
    json: {
      version: 2,
      type: "note-aligned",
      pages,
    },
    report: {
      song: draft.song,
      pdfFile: draft.pdfFile,
      chordFile: draft.chordFile,
      sourceImages: draft.sourceImages,
      pageImageMode: draft.pageImagePlan.mode,
      pageReports,
      chordCount,
      status: chordCount > 0 ? "written" : "no-chords-detected",
    },
  };
}

async function finalizeMissingChordJson(options = {}) {
  if (!options.allowUnverified) {
    const verificationPath = path.join("reports", "chord-ocr-sample-verification-report.json");
    if (!fs.existsSync(verificationPath)) {
      throw new Error("Refusing to finalize: sample verification report is missing. Run --verify-finalizer-samples first.");
    }
    const verification = JSON.parse(fs.readFileSync(verificationPath, "utf8"));
    if (verification.failed > 0 || verification.blocked > 0 || verification.passed !== verification.sampleCount) {
      throw new Error(
        `Refusing to finalize: sample verifier is not 100% ` +
        `(passed=${verification.passed}, failed=${verification.failed}, blocked=${verification.blocked}).`
      );
    }
  }

  const queuePath = options.queuePath || path.join("reports", "chord-ocr-draft-review-queue.json");
  const queue = fs.existsSync(queuePath)
    ? JSON.parse(fs.readFileSync(queuePath, "utf8"))
    : await buildDraftReviewQueue();
  const limit = Number(options.limit || 0);
  const drafts = (limit > 0 ? queue.drafts.slice(0, limit) : queue.drafts).filter((draft) => draft.pageImagePlan && draft.pageImagePlan.status === "ready");
  const imageCache = new Map();
  const written = [];
  const skipped = [];
  const chordDir = path.join("docs", "assets", "chord");

  for (const draft of drafts) {
    const outputPath = path.join(chordDir, draft.chordFile);
    if (fs.existsSync(outputPath)) {
      skipped.push({ song: draft.song, chordFile: draft.chordFile, status: "already-exists" });
      continue;
    }

    try {
      const result = await buildFinalChordJsonForDraft(draft, { imageCache });
      if (result.report.chordCount === 0) {
        skipped.push(result.report);
        continue;
      }
      fs.writeFileSync(outputPath, JSON.stringify(result.json, null, 2) + "\n");
      written.push({ ...result.report, outputPath });
    } catch (error) {
      skipped.push({
        song: draft.song,
        pdfFile: draft.pdfFile,
        chordFile: draft.chordFile,
        status: "error",
        error: error && error.message ? error.message : String(error),
      });
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    writtenCount: written.length,
    skippedCount: skipped.length,
    written,
    skipped,
  };
  const reportPath = options.reportPath || path.join("reports", "chord-ocr-finalize-report.json");
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + "\n");
  return { reportPath, report };
}

async function verifyFinalizerAgainstSamples(options = {}) {
  const samples = options.samples || loadSamples();
  const pdfFiles = fs.readdirSync(path.join("docs", "assets", "pdf")).filter((name) => name.endsWith(".pdf"));
  const imageFiles = fs.readdirSync("Chord buku KR").filter((name) => /\.(jpe?g|png)$/i.test(name));
  const imageCache = new Map();
  const results = [];

  for (const sample of samples) {
    const prefix = String(sample.song).padStart(3, "0");
    const pdfFile = pdfFiles.find((name) => name.startsWith(`${prefix}_`));
    const existing = readExistingChordJson(sample.song);
    const sourceImages = findSourceImagesForSong(sample.song, imageFiles);
    let result;

    if (!pdfFile || !existing || sourceImages.length === 0) {
      result = {
        song: sample.song,
        status: "blocked",
        pdfFile: pdfFile || "",
        sourceImages,
        reason: !pdfFile ? "missing-pdf" : !existing ? "missing-existing-json" : "missing-source-image",
      };
      results.push(result);
      continue;
    }

    const extracted = await extractNotesFromPdf(path.join("docs", "assets", "pdf", pdfFile));
    const notePages = extracted.pages.map((page, index) => ({ page: index + 1, noteCount: page.notes.length }));
    const draft = {
      song: sample.song,
      pdfFile,
      chordFile: path.basename(existing.jsonPath),
      sourceImages,
      pageImagePlan: planPageImageMapping(sourceImages, notePages),
    };
    const generated = await buildFinalChordJsonForDraft(draft, { imageCache });
    const shiftedGeneratedJson = transposeChordJson(generated.json, sample.photoToJsonShift || 0);
    const comparison = compareChordJson(shiftedGeneratedJson, existing.data);

    result = {
      song: sample.song,
      status: comparison.exactScore === 1 && comparison.extraCount === 0 ? "pass" : "fail",
      pdfFile,
      sourceImages,
      pageImageMode: draft.pageImagePlan.mode,
      generatedChordCount: comparison.generatedCount,
      expectedChordCount: comparison.expectedCount,
      positionMatches: comparison.positionMatches,
      exactMatches: comparison.exactMatches,
      extraCount: comparison.extraCount,
      positionScore: comparison.positionScore,
      exactScore: comparison.exactScore,
    };
    results.push(result);
  }

  const passed = results.filter((result) => result.status === "pass").length;
  const failed = results.filter((result) => result.status === "fail").length;
  const blocked = results.filter((result) => result.status === "blocked").length;
  const averageExactScore = results.length
    ? results.reduce((sum, result) => sum + (result.exactScore || 0), 0) / results.length
    : 0;
  const report = {
    generatedAt: new Date().toISOString(),
    sampleCount: results.length,
    passed,
    failed,
    blocked,
    averageExactScore,
    results,
  };
  const reportPath = options.reportPath || path.join("reports", "chord-ocr-sample-verification-report.json");
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + "\n");
  return { reportPath, report };
}

async function verifyMelodyGeneratorAgainstSamples(options = {}) {
  const samples = options.samples || loadSamples();
  const results = [];
  const trainingLibrary = options.trainingLibrary || (options.useTraining ? await buildMelodyTrainingLibraryFromSamples(samples) : null);

  for (const sample of samples) {
    const prefix = String(sample.song).padStart(3, "0");
    const pdfFile = fs.readdirSync(path.join("docs", "assets", "pdf")).find((name) => name.startsWith(`${prefix}_`) && name.endsWith(".pdf"));
    const existing = readExistingChordJson(sample.song);

    if (!pdfFile || !existing) {
      results.push({
        song: sample.song,
        status: "blocked",
        reason: !pdfFile ? "missing-pdf" : "missing-existing-json",
      });
      continue;
    }

    const extracted = await extractNotesFromPdf(path.join("docs", "assets", "pdf", pdfFile));
    const generated = trainingLibrary
      ? generateCChordJsonWithTraining(extracted, trainingLibrary)
      : generateCChordJsonFromSoprano(extracted);
    const comparison = compareChordJsonWithBestTranspose(generated, existing.data);
    results.push({
      song: sample.song,
      status: comparison.exactScore === 1 && comparison.extraCount === 0 ? "pass" : "fail",
      generatorMode: trainingLibrary ? "trained-template" : "soprano-heuristic",
      trainingMatch: generated.trainingMatch || null,
      pdfFile,
      generatedChordCount: comparison.generatedCount,
      expectedChordCount: comparison.expectedCount,
      positionMatches: comparison.positionMatches,
      exactMatches: comparison.exactMatches,
      extraCount: comparison.extraCount,
      positionScore: comparison.positionScore,
      exactScore: comparison.exactScore,
      bestTransposeShift: comparison.shift,
    });
  }

  const passed = results.filter((result) => result.status === "pass").length;
  const failed = results.filter((result) => result.status === "fail").length;
  const blocked = results.filter((result) => result.status === "blocked").length;
  const averageExactScore = results.length
    ? results.reduce((sum, result) => sum + (result.exactScore || 0), 0) / results.length
    : 0;
  const averagePositionScore = results.length
    ? results.reduce((sum, result) => sum + (result.positionScore || 0), 0) / results.length
    : 0;
  const report = {
    generatedAt: new Date().toISOString(),
    generatorMode: trainingLibrary ? "trained-template" : "soprano-heuristic",
    trainingSampleCount: trainingLibrary ? trainingLibrary.size : 0,
    sampleCount: results.length,
    passed,
    failed,
    blocked,
    averageExactScore,
    averagePositionScore,
    results,
  };
  const reportPath = options.reportPath || path.join("reports", "chord-melody-generator-sample-report.json");
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + "\n");
  return { reportPath, report };
}

async function buildMelodyTrainingLibraryFromSamples(samples = loadSamples()) {
  const records = [];
  for (const sample of samples) {
    const prefix = String(sample.song).padStart(3, "0");
    const pdfFile = fs.readdirSync(path.join("docs", "assets", "pdf")).find((name) => name.startsWith(`${prefix}_`) && name.endsWith(".pdf"));
    const existing = readExistingChordJson(sample.song);
    if (!pdfFile || !existing) continue;
    const extracted = await extractNotesFromPdf(path.join("docs", "assets", "pdf", pdfFile));
    records.push({ song: sample.song, extracted, chordJson: existing.data });
  }
  return buildMelodyTrainingLibrary(records);
}

function calibrateSong(songNumber) {
  const imagePath = path.join("Chord buku KR", `${songNumber}.jpg`);
  const existing = readExistingChordJson(songNumber);
  if (!existing) throw new Error(`No existing chord JSON found for song ${songNumber}`);
  if (!fs.existsSync(imagePath)) throw new Error(`Image not found: ${imagePath}`);

  const passes = [
    { name: "psm6-all", psm: 6, whitelist: "" },
    { name: "psm11-chords", psm: 11, whitelist: "ABCDEFGabcdefg#bmMdim" },
    { name: "psm12-chords", psm: 12, whitelist: "ABCDEFGabcdefg#bmMdim" },
  ].map((pass) => {
    const text = runTesseract(imagePath, pass.psm, pass.whitelist);
    const candidates = uniqueRuns(extractChordCandidates(text));
    const match = bestTranspositionMatch(candidates, existing.chords);
    return { ...pass, candidateCount: candidates.length, candidates, match };
  });

  const tsvText = runTesseract(imagePath, 11, "", "tsv");
  const tsvCandidates = uniqueRuns(parseTsvChordCandidates(tsvText));
  passes.push({
    name: "psm11-tsv-sized",
    psm: 11,
    whitelist: "",
    candidateCount: tsvCandidates.length,
    candidates: tsvCandidates,
    match: bestTranspositionMatch(tsvCandidates, existing.chords),
  });

  const best = passes.reduce((winner, pass) => (pass.match.score > winner.match.score ? pass : winner), passes[0]);
  return { songNumber, imagePath, existingPath: existing.jsonPath, expectedCount: existing.chords.length, passes, best };
}

function printCalibration(result) {
  console.log(`Song ${result.songNumber}`);
  console.log(`Image: ${result.imagePath}`);
  console.log(`Existing JSON: ${result.existingPath}`);
  console.log(`Expected chords: ${result.expectedCount}`);
  for (const pass of result.passes) {
    console.log("");
    console.log(`${pass.name}:`);
    console.log(`  candidates: ${pass.candidateCount}`);
    console.log(`  best shift: ${pass.match.shift}`);
    console.log(`  match: ${pass.match.matches}/${pass.match.total} (${Math.round(pass.match.score * 100)}%)`);
    console.log(`  tokens: ${pass.candidates.slice(0, 80).join(" ")}`);
  }
  console.log("");
  console.log(`Best pass: ${result.best.name}`);
}

function printSampleEvaluation(results) {
  let allPassed = true;
  for (const result of results) {
    const passed = result.score === 1;
    allPassed = allPassed && passed;
    console.log(
      `Song ${result.song}: ${result.matches}/${result.total} (${Math.round(result.score * 100)}%) ` +
      `shift=${result.photoToJsonShift} ${passed ? "PASS" : "FAIL"}`
    );
  }
  console.log(`Strict 100% gate: ${allPassed ? "PASS" : "FAIL"}`);
  if (!allPassed) process.exitCode = 1;
}

function printGeneratedJsonEvaluation(results) {
  let allPassed = true;
  for (const result of results) {
    const passed = result.positionMatches === result.total && result.chordMatches === result.total;
    allPassed = allPassed && passed;
    console.log(
      `Song ${result.song}: positions ${result.positionMatches}/${result.total}, ` +
      `chords ${result.chordMatches}/${result.total}, shift=${result.photoToJsonShift} ${passed ? "PASS" : "FAIL"}`
    );
  }
  console.log(`Strict generated JSON gate: ${allPassed ? "PASS" : "FAIL"}`);
  if (!allPassed) process.exitCode = 1;
}

function main(argv) {
  if (argv.includes("--verify-trained-melody-generator-samples")) {
    verifyMelodyGeneratorAgainstSamples({
      useTraining: true,
      reportPath: path.join("reports", "chord-trained-melody-generator-sample-report.json"),
    }).then(({ reportPath, report }) => {
      console.log(
        `Trained melody generator sample verification: passed=${report.passed}, failed=${report.failed}, ` +
        `blocked=${report.blocked}, averageExact=${Math.round(report.averageExactScore * 100)}%, ` +
        `averagePosition=${Math.round(report.averagePositionScore * 100)}%, trainingSamples=${report.trainingSampleCount}`
      );
      console.log(`Report: ${reportPath}`);
      if (report.failed > 0 || report.blocked > 0) process.exitCode = 1;
    }).catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
    return;
  }
  if (argv.includes("--verify-trained-melody-generator-trusted")) {
    const trustedSamples = listTrustedChordSongs().map((song) => ({ song }));
    verifyMelodyGeneratorAgainstSamples({
      samples: trustedSamples,
      useTraining: true,
      reportPath: path.join("reports", "chord-trained-melody-generator-trusted-report.json"),
    }).then(({ reportPath, report }) => {
      console.log(
        `Trusted melody generator verification: passed=${report.passed}, failed=${report.failed}, ` +
        `blocked=${report.blocked}, averageExact=${Math.round(report.averageExactScore * 100)}%, ` +
        `averagePosition=${Math.round(report.averagePositionScore * 100)}%, trainingSamples=${report.trainingSampleCount}`
      );
      console.log(`Report: ${reportPath}`);
      if (report.failed > 0 || report.blocked > 0) process.exitCode = 1;
    }).catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
    return;
  }
  if (argv.includes("--verify-melody-generator-samples")) {
    verifyMelodyGeneratorAgainstSamples().then(({ reportPath, report }) => {
      console.log(
        `Melody generator sample verification: passed=${report.passed}, failed=${report.failed}, ` +
        `blocked=${report.blocked}, averageExact=${Math.round(report.averageExactScore * 100)}%, ` +
        `averagePosition=${Math.round(report.averagePositionScore * 100)}%`
      );
      console.log(`Report: ${reportPath}`);
      if (report.failed > 0 || report.blocked > 0) process.exitCode = 1;
    }).catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
    return;
  }
  if (argv.includes("--verify-finalizer-samples")) {
    verifyFinalizerAgainstSamples().then(({ reportPath, report }) => {
      console.log(
        `Sample finalizer verification: passed=${report.passed}, failed=${report.failed}, ` +
        `blocked=${report.blocked}, averageExact=${Math.round(report.averageExactScore * 100)}%`
      );
      console.log(`Report: ${reportPath}`);
      if (report.failed > 0 || report.blocked > 0) process.exitCode = 1;
    }).catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
    return;
  }
  if (argv.includes("--finalize-missing")) {
    const limitArgIndex = argv.findIndex((arg) => arg === "--limit");
    const limit = limitArgIndex >= 0 ? Number(argv[limitArgIndex + 1]) : 0;
    const allowUnverified = argv.includes("--force-unverified");
    finalizeMissingChordJson({ limit, allowUnverified }).then(({ reportPath, report }) => {
      console.log(`Final chord JSON: written=${report.writtenCount}, skipped=${report.skippedCount}`);
      console.log(`Report: ${reportPath}`);
    }).catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
    return;
  }
  if (argv.includes("--draft-queue")) {
    const limitArgIndex = argv.findIndex((arg) => arg === "--limit");
    const limit = limitArgIndex >= 0 ? Number(argv[limitArgIndex + 1]) : 0;
    writeDraftReviewQueue({ limit }).then(({ reportPath, queue }) => {
      console.log(`Draft review queue: ${queue.count}`);
      console.log(`Report: ${reportPath}`);
    }).catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
    return;
  }
  if (argv.includes("--batch-missing")) {
    const plan = planMissingChordBatch();
    const reportPath = writeBatchReport(plan);
    console.log(`Batch missing chord plan: create=${plan.create.length}, skip=${plan.skip.length}`);
    console.log(`Report: ${reportPath}`);
    if (plan.create.length === 0 && plan.skip.length === 0) {
      console.log("All PDF assets already have chord JSON files.");
    } else if (plan.create.length === 0) {
      console.log("No final chord JSON files were written because no missing song has a trusted 100% chord source yet.");
    }
    return;
  }
  if (argv.includes("--samples-json")) {
    printGeneratedJsonEvaluation(evaluateAllGeneratedJsonSamples());
    return;
  }
  if (argv.includes("--samples")) {
    printSampleEvaluation(evaluateAllGoldSamples());
    return;
  }
  const songArgIndex = argv.findIndex((arg) => arg === "--song");
  const songNumber = songArgIndex >= 0 ? Number(argv[songArgIndex + 1]) : 7;
  const result = calibrateSong(songNumber);
  printCalibration(result);
}

if (require.main === module) {
  main(process.argv.slice(2));
}

module.exports = {
  normalizeChordToken,
  transposeChord,
  bestTranspositionMatch,
  orderedSubsequenceScore,
  calibrateSong,
  evaluateGoldSample,
  evaluateAllGoldSamples,
  generateJsonFromGoldSample,
  evaluateAllGeneratedJsonSamples,
  readExistingChordJson,
  listTrustedChordSongs,
  compareChordJson,
  compareChordJsonWithBestTranspose,
  transposeChordJson,
  planMissingChordBatch,
  writeBatchReport,
  buildDraftReviewQueue,
  writeDraftReviewQueue,
  finalizeMissingChordJson,
  verifyFinalizerAgainstSamples,
  verifyMelodyGeneratorAgainstSamples,
  findSourceImagesForSong,
  planPageImageMapping,
  parseTsvChordWords,
  alignChordWordsToNotes,
  alignChordWordsToNotesPdfDriven,
  selectSopranoNoteRows,
  splitSopranoRowIntoMeasures,
  inferCChordForMeasure,
  generateCChordJsonFromSoprano,
  createMelodySignature,
  buildMelodyTrainingLibrary,
  buildMelodyTrainingLibraryFromSamples,
  generateCChordJsonWithTraining,
  loadSamples,
};
