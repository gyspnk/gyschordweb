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
    const chord = normalizeChordToken(rawText);
    if (!chord) continue;

    const left = Number(cols[6]);
    const top = Number(cols[7]);
    const width = Number(cols[8]);
    const height = Number(cols[9]);
    const conf = Number(cols[10]);
    const raw = String(rawText || "").trim();
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

  return { imageWidth, imageHeight, words };
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
    const entries = alignChordWordsToNotes(pageWords, page.notes, segment);
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
  if (argv.includes("--finalize-missing")) {
    const limitArgIndex = argv.findIndex((arg) => arg === "--limit");
    const limit = limitArgIndex >= 0 ? Number(argv[limitArgIndex + 1]) : 0;
    finalizeMissingChordJson({ limit }).then(({ reportPath, report }) => {
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
  planMissingChordBatch,
  writeBatchReport,
  buildDraftReviewQueue,
  writeDraftReviewQueue,
  finalizeMissingChordJson,
  findSourceImagesForSong,
  planPageImageMapping,
  parseTsvChordWords,
  alignChordWordsToNotes,
  loadSamples,
};
