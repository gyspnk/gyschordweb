/* Lyrics-Only View Mode - standalone module */
(() => {
	var lyricsData = null;
	var lyricsVerseIndex = 0;
	var lyricsFontSize = 28;
	var lyricsLineSpacing = 1.8;
	var lyricsViewActive = false;
	var lyricsViewWasActive = false;
	var lyricsTransitioning = false;
	var lyricsTransitionDir = 0; // 1=next, -1=prev
	var lyricsShowChords = true; // chord di atas lirik (mode teks)
	var _chordLayoutCache = new Map(); // fileHref -> Promise<{pages: {...}}>
	var _verseChordFallbackCache = new Map(); // fileHref -> byIndex[]
	var _verseRenderToken = 0; // penanda render untuk hasil async chord layout
	var _lyricsResizeHandler = null;
	var _lastFitFontPx = 0; // font terakhir hasil autofit (histeresis anti-osilasi)
	var _lyricsTempoPollTimer = null;
	var _lastSeenPdfDoc = null; // pdfDoc viewer yang terakhir dipakai (anti race)

	function loadPrefs() {
		try {
			var fs = localStorage.getItem("lyrics-font-size");
			if (fs) lyricsFontSize = parseInt(fs, 10) || 28;
			var ls = localStorage.getItem("lyrics-line-spacing");
			if (ls) lyricsLineSpacing = parseFloat(ls) || 1.8;
			var sc = localStorage.getItem("lyrics-show-chords");
			if (sc !== null) lyricsShowChords = sc === "1";
		} catch (e) {}
	}

	function savePrefs() {
		localStorage.setItem("lyrics-font-size", String(lyricsFontSize));
		localStorage.setItem("lyrics-line-spacing", String(lyricsLineSpacing));
		localStorage.setItem("lyrics-show-chords", lyricsShowChords ? "1" : "0");
	}

	function getSongLyricData(song) {
		if (!lyricsData || !Array.isArray(lyricsData)) return null;
		var num = String(song.nomor).replace(/^0+/, "") || "1";
		return (
			lyricsData.find(
				(entry) => String(entry.number).replace(/^0+/, "") === num,
			) || null
		);
	}

	function getCurrentLyricEntry() {
		if (
			typeof currentSongIndex === "undefined" ||
			currentSongIndex < 0 ||
			typeof pujianItems === "undefined" ||
			!pujianItems[currentSongIndex]
		)
			return null;
		return getSongLyricData(pujianItems[currentSongIndex]);
	}

	function autoFitLyricsTitle(el) {
		if (!el) return;
		var maxWidth = el.parentElement ? el.parentElement.clientWidth - 80 : 300;
		if (maxWidth < 100) maxWidth = 200;
		el.style.fontSize = "1.05rem";
		el.style.whiteSpace = "nowrap";
		el.style.overflow = "hidden";
		el.style.textOverflow = "ellipsis";
		for (var size = 1.05; size >= 0.65; size -= 0.05) {
			el.style.fontSize = size + "rem";
			if (el.scrollWidth <= el.clientWidth + 2) break;
		}
	}

	/* ============ CHORD DI MODE TEKS ============
	   Chord diambil dari file *.chord.json (note-aligned) yang sama dengan
	   mode PDF full. Posisi chord (noteIdx -> xPct pada halaman PDF) dan
	   posisi lirik (baris teks PDF) dideteksi dari layout PDF itu sendiri,
	   sehingga peletakan chord di mode teks mengikuti posisi asli di PDF. */

	function getCurrentSong() {
		if (
			typeof currentSongIndex === "undefined" ||
			currentSongIndex < 0 ||
			typeof pujianItems === "undefined" ||
			!pujianItems[currentSongIndex]
		)
			return null;
		return pujianItems[currentSongIndex];
	}

	function getChordedLinesForSong(song) {
		if (!song || !song.fileHref) return Promise.resolve(null);
		if (_chordLayoutCache.has(song.fileHref)) {
			return _chordLayoutCache.get(song.fileHref);
		}
		var p = loadChordLayout(song)
			.then((layout) => {
				// Hasil GAGAL (error load PDF dsb.) TIDAK di-cache permanen —
				// biar bisa dicoba lagi di kesempatan berikutnya (misal
				// setelah viewer selesai memuat PDF lagu tsb). Hanya hasil
				// sukses (atau 404 = memang tidak ada data) yang di-cache.
				if (layout && layout.__error) {
					_chordLayoutCache.delete(song.fileHref);
					return null;
				}
				return layout;
			})
			.catch(() => {
				_chordLayoutCache.delete(song.fileHref);
				return null;
			});
		_chordLayoutCache.set(song.fileHref, p);
		return p;
	}

	function resolveNoteChordUrl(song) {
		if (typeof getNoteChordUrl === "function") return getNoteChordUrl(song);
		var href = song.fileHref || "";
		return href.replace(/\/pdf\//i, "/chord/").replace(/\.pdf$/i, ".chord.json");
	}

	// Tunggu pdfDoc viewer sampai BERUBAH menjadi dokumen baru (viewer
	// sedang memuat lagu ini). Judul viewer sudah berubah lebih dulu,
	// jadi memakai pdfDoc lama = salah lagu. Referensi dokumen lama
	// (oldRef) dipakai untuk membedakan "belum berubah" vs "sudah siap".
	function waitForViewerPdfDocChange(oldRef, maxWaitMs) {
		return new Promise((resolve) => {
			var waited = 0;
			var iv = setInterval(() => {
				waited += 150;
				var current =
					typeof pdfDoc !== "undefined" &&
					pdfDoc &&
					typeof pdfDoc.getPage === "function"
						? pdfDoc
						: null;
				var ready = current && current !== oldRef;
				if (ready || waited >= maxWaitMs) {
					clearInterval(iv);
					resolve(ready ? current : null);
				}
			}, 150);
		});
	}

	async function loadChordLayout(song) {
		var url = resolveNoteChordUrl(song);
		var resp;
		try {
			resp = await fetch(url, { cache: "no-store" });
		} catch (e) {
			return { pages: {}, __error: true };
		}
		if (!resp.ok) return { pages: {} }; // 404 = lagu tanpa data chord
		var parsed;
		try {
			parsed = JSON.parse(await resp.text());
		} catch (e) {
			return { pages: {} };
		}
		if (
			!parsed ||
			parsed.version !== 2 ||
			parsed.type !== "note-aligned" ||
			!parsed.pages ||
			typeof parsed.pages !== "object"
		)
			return { pages: {} };

		var doc = null;
		var ownDoc = false;
		var viewerTitleEl = document.querySelector(
			".pdf-viewer-title, #pdf-viewer-title",
		);
		var titleMatches =
			viewerTitleEl &&
			viewerTitleEl.textContent.trim() === (song.judul || "").trim();

		if (titleMatches) {
			// Hanya reuse pdfDoc viewer kalau dokumennya SUDAH berganti ke
			// lagu ini (bukan sisa dokumen lagu sebelumnya). Kalau belum,
			// tunggu sebentar; bila tak kunjung siap, load sendiri.
			var currentDoc =
				typeof pdfDoc !== "undefined" &&
				pdfDoc &&
				typeof pdfDoc.getPage === "function"
					? pdfDoc
					: null;
			if (currentDoc && currentDoc !== _lastSeenPdfDoc) {
				doc = currentDoc;
			} else {
				doc = await waitForViewerPdfDocChange(_lastSeenPdfDoc, 5000);
			}
		}

		if (!doc) {
			if (typeof pdfjsLib === "undefined" || !pdfjsLib.getDocument)
				return { pages: {} };
			// Load PDF sendiri dengan retry (kompetisi resource saat
			// pindah lagu bisa membuat satu percobaan gagal)
			var attempts = 0;
			while (attempts < 3) {
				attempts++;
				var task = pdfjsLib.getDocument({
					url: song.fileHref,
					standardFontDataUrl:
						"https://mozilla.github.io/pdf.js/standard_fonts/",
				});
				try {
					doc = await task.promise;
					ownDoc = true;
					break;
				} catch (e) {
					if (attempts >= 3) return { pages: {}, __error: true };
					await new Promise((r) => setTimeout(r, 600));
				}
			}
		}

		var result = { pages: {} };
		try {
			for (var p = 1; p <= doc.numPages; p++) {
				var page = await doc.getPage(p);
				var pageKey = String(p);
				var entries = parsed.pages[pageKey] || [];
				if (!Array.isArray(entries) || entries.length === 0) continue;
				var noteData =
					typeof extractPageNotes === "function"
						? await extractPageNotes(page)
						: null;
				var lyricLines = await extractLyricLines(page);
				if (!noteData || !noteData.notes || noteData.notes.length === 0)
					continue;
				var chorded = buildChordedLines(
					noteData.notes,
					noteData.noteRows || [],
					lyricLines,
					entries,
				);
				if (chorded.length > 0) result.pages[pageKey] = chorded;
			}
		} catch (e) {
			return { pages: {}, __error: true };
		} finally {
			// Catat pdfDoc viewer yang berhasil dipakai sebagai referensi
			// anti-race untuk pemanggilan berikutnya.
			if (!ownDoc && doc && _lastSeenPdfDoc !== doc) {
				_lastSeenPdfDoc = doc;
			}
			if (ownDoc && doc && typeof doc.destroy === "function") {
				try {
					doc.destroy();
				} catch (e) {}
			}
		}
		return result;
	}

	// Baris lirik dari teks PDF: item teks (bukan digit not 1-7) yang
	// dikelompokkan per baris (nilai y hampir sama), diurutkan dari kiri.
	async function extractLyricLines(page) {
		var content = await page.getTextContent();
		var viewport = page.getViewport({ scale: 1 });
		var pageW = viewport.width;
		var digitRe = /^[0-7.\s]+$/;
		var items = content.items
			.map((it) => ({
				str: String(it.str || "").trim(),
				x: it.transform[4],
				y: it.transform[5],
				w: it.width,
			}))
			.filter((it) => it.str.length > 0 && !digitRe.test(it.str));

		var groups = [];
		var sorted = [...items].sort((a, b) => b.y - a.y);
		for (var i = 0; i < sorted.length; i++) {
			var it = sorted[i];
			var g = groups.find((gr) => Math.abs(gr.y - it.y) < 2);
			if (g) {
				g.items.push(it);
			} else {
				groups.push({ y: it.y, items: [it] });
			}
		}

		return groups
			.filter((g) => g.items.some((it) => /[A-Za-z]/.test(it.str)))
			.map((g) => {
				var its = [...g.items].sort((a, b) => a.x - b.x);
				var text = its.map((it) => it.str).join(" ");
				var startX = its[0].x;
				var endX = Math.max(...its.map((it) => it.x + it.w));
				var startPct = (startX / pageW) * 100;
				var widthPct = Math.max(1, ((endX - startX) / pageW) * 100);
				return { y: g.y, text, startPct, widthPct };
			});
	}

	// Pasangkan chord (noteIdx) ke baris lirik PDF: baris lirik terdekat di
	// BAWAH deretan digit not. Posisi chord = posisi x not relatif terhadap
	// rentang teks baris lirik (0..1), dipakai sebagai left:% di mode teks.
	function buildChordedLines(notes, noteRows, lyricLines, entries) {
		var out = [];
		if (!Array.isArray(entries) || entries.length === 0) return out;
		for (var r = 0; r < noteRows.length; r++) {
			var row = noteRows[r];
			var lyr = null;
			var bestDist = Infinity;
			for (var l = 0; l < lyricLines.length; l++) {
				var ll = lyricLines[l];
				if (ll.y < row.y && row.y - ll.y <= 45) {
					var d = row.y - ll.y;
					if (d < bestDist) {
						bestDist = d;
						lyr = ll;
					}
				}
			}
			if (!lyr) continue;
			var chords = [];
			for (var e = 0; e < entries.length; e++) {
				var entry = entries[e];
				if (
					!Number.isFinite(entry.noteIdx) ||
					entry.noteIdx < row.firstIdx ||
					entry.noteIdx > row.lastIdx
				)
					continue;
				var note = notes[entry.noteIdx];
				if (!note) continue;
				var pos = Math.max(
					0,
					Math.min(1, (note.xPct - lyr.startPct) / lyr.widthPct),
				);
				chords.push({ chord: entry.chord, pos });
			}
			if (chords.length === 0) continue;
			out.push({ text: lyr.text, chords });
		}
		return out;
	}

	function normalizeLine(s) {
		return String(s || "")
			.toLowerCase()
			.replace(/[^a-z0-9]/g, "");
	}

	// Buang label bait ("1.", "Reff.", "(2)", dsb.) di awal baris PDF/JSON
	function stripVerseLabel(s) {
		return String(s || "").replace(
			/^\s*(?:reff?|refrain|chorus|ulangan|[(（]?[0-9]+[)）]?[.\s]*)+/i,
			"",
		);
	}

	// Cari baris PDF ber-chord yang paling cocok dengan baris JSON mode teks
	function findChordedLine(jsonLine, chordedLines) {
		var target = normalizeLine(stripVerseLabel(jsonLine));
		if (!target || !Array.isArray(chordedLines) || chordedLines.length === 0)
			return null;
		var best = null;
		var bestScore = 0;
		for (var i = 0; i < chordedLines.length; i++) {
			var cand = normalizeLine(stripVerseLabel(chordedLines[i].text));
			if (!cand) continue;
			if (cand === target) return chordedLines[i];
			var score = 0;
			if (cand.includes(target) || target.includes(cand)) {
				var lenRatio =
					Math.min(cand.length, target.length) /
					Math.max(cand.length, target.length);
				score = 0.85 * lenRatio;
			} else {
				var j = 0;
				while (
					j < cand.length &&
					j < target.length &&
					cand[j] === target[j]
				)
					j++;
				score = j / Math.max(cand.length, target.length);
			}
			if (score > bestScore) {
				bestScore = score;
				best = chordedLines[i];
			}
		}
		return bestScore >= 0.6 ? best : null;
	}

	function parseHex(c) {
		var h = String(c || "").trim().replace(/^#/, "");
		if (h.length === 3)
			h = h
				.split("")
				.map((x) => x + x)
				.join("");
		var n = parseInt(h, 16);
		if (!Number.isFinite(n) || h.length !== 6) return null;
		return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
	}

	function mixHexWithWhite(hex, pct) {
		var c = parseHex(hex);
		if (!c) return hex;
		var p = Math.max(0, Math.min(1, pct));
		var mix = (v) => Math.round(v * p + 255 * (1 - p));
		return `rgb(${mix(c.r)}, ${mix(c.g)}, ${mix(c.b)})`;
	}

	// Terapkan warna/fill chord sesuai chordUiPrefs (sama dengan mode PDF)
	function applyLyricsChordStyle(el) {
		if (typeof chordUiPrefs === "undefined") return;
		var themeColor = "#0b4c99";
		try {
			if (chordUiPrefs.syncThemeWithAccent) {
				themeColor =
					getComputedStyle(document.body)
						.getPropertyValue("--accent")
						.trim() || themeColor;
			} else if (
				typeof CHORD_THEME_PRESETS !== "undefined" &&
				Array.isArray(CHORD_THEME_PRESETS)
			) {
				var t = CHORD_THEME_PRESETS.find(
					(p) => p.key === chordUiPrefs.theme,
				);
				if (t) themeColor = t.color;
			}
		} catch (e) {}
		el.style.color = themeColor;

		var fill = chordUiPrefs.fill || "none";
		if (fill !== "none") {
			var fc = "#b9d8ff";
			try {
				if (chordUiPrefs.syncFillWithAccent) {
					fc =
						getComputedStyle(document.body)
							.getPropertyValue("--accent")
							.trim() || fc;
				} else if (
					typeof CHORD_FILL_PRESETS !== "undefined" &&
					Array.isArray(CHORD_FILL_PRESETS)
				) {
					var f = CHORD_FILL_PRESETS.find(
						(p) => p.key === chordUiPrefs.fillColor,
					);
					if (f) fc = f.color;
				}
			} catch (e) {}
			var opacity =
				(typeof chordUiPrefs.fillOpacityPercent === "number"
					? chordUiPrefs.fillOpacityPercent
					: 70) / 100;
			var mixPct = fill === "solid" ? 0.65 : 0.32;
			var base = mixHexWithWhite(fc, mixPct);
			// samakan dengan CSS: color-mix(in srgb, base <opacity>, transparent)
			var rgb = base.match(/\d+/g);
			if (rgb && rgb.length >= 3) {
				el.style.backgroundColor = `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${opacity})`;
			}
			el.style.borderRadius = "6px";
		} else {
			el.style.backgroundColor = "transparent";
		}
	}

	function renderLyricLine(wrap, lineText, chordedLine) {
		// Simpan data chord & teks asli untuk layout adaptif saat baris
		// membungkus (wrap): posisi ulang chord per baris visual.
		wrap.dataset.lyricsText = lineText;
		if (
			chordedLine &&
			Array.isArray(chordedLine.chords) &&
			chordedLine.chords.length > 0
		) {
			wrap.dataset.lyricsChords = JSON.stringify(
				chordedLine.chords.map((c) => ({ chord: c.chord, pos: c.pos })),
			);
		} else {
			delete wrap.dataset.lyricsChords;
		}
		var row = document.createElement("div");
		row.className = "lyrics-chord-row";
		if (
			chordedLine &&
			Array.isArray(chordedLine.chords) &&
			chordedLine.chords.length > 0
		) {
			row.classList.add("has-chords");
			for (var c = 0; c < chordedLine.chords.length; c++) {
				var chord = chordedLine.chords[c];
				var span = document.createElement("span");
				span.className = "lyrics-chord";
				span.style.left = (chord.pos * 100).toFixed(2) + "%";
				span.dataset.raw = chord.chord;
				span.textContent =
					typeof formatChordForDisplay === "function"
						? formatChordForDisplay(chord.chord)
						: chord.chord;
				applyLyricsChordStyle(span);
				row.append(span);
			}
		}
		wrap.append(row);
		var p = document.createElement("p");
		p.className = "lyrics-line";
		p.style.cssText = "margin:0;padding:0";
		p.textContent = lineText;
		wrap.append(p);
	}

	// Ukur posisi tiap kata baris lirik (Range API) untuk mendeteksi baris
	// visual hasil wrap dan menempelkan chord ke kata/baris yang benar.
	function measureLyricsWordRects(p) {
		var node = p.firstChild;
		if (!node || node.nodeType !== 3) return null;
		var text = node.nodeValue;
		var words = text.split(/\s+/).filter(Boolean);
		if (words.length < 2) return null;
		var rects = [];
		var searchFrom = 0;
		var doc = p.ownerDocument;
		for (var i = 0; i < words.length; i++) {
			var idx = text.indexOf(words[i], searchFrom);
			if (idx < 0) {
				searchFrom = 0;
				idx = text.indexOf(words[i], searchFrom);
				if (idx < 0) return null;
			}
			searchFrom = idx + words[i].length;
			var range = doc.createRange();
			range.setStart(node, idx);
			range.setEnd(node, idx + words[i].length);
			var r = range.getBoundingClientRect();
			rects.push({
				word: words[i],
				left: r.left,
				right: r.right,
				width: r.width,
				top: r.top,
			});
		}
		return rects;
	}

	// Ukur lebar teks (satu baris, nowrap) dengan font yang sama dengan
	// elemen acuan — dipakai untuk memutuskan "gabung kembali" baris yang
	// sudah dipecah saat ruang melebar (zoom out).
	function measureLyricsTextWidth(text, refEl) {
		var cs = getComputedStyle(refEl);
		var s = document.createElement("span");
		s.style.cssText =
			"position:absolute;visibility:hidden;white-space:nowrap;pointer-events:none;" +
			"font-size:" +
			cs.fontSize +
			";font-family:" +
			cs.fontFamily +
			";font-weight:" +
			cs.fontWeight +
			";letter-spacing:" +
			cs.letterSpacing +
			";";
		s.textContent = text;
		document.body.appendChild(s);
		var w = s.getBoundingClientRect().width;
		s.remove();
		return w;
	}

	// Layout adaptif saat baris lirik membungkus ke 2+ baris visual:
	// - pecah teks menjadi satu <p> per baris visual (white-space nowrap
	//   agar stabil terhadap autofit),
	// - chord dikelompokkan ke baris visual KATA terdekatnya dan posisinya
	//   dihitung ulang relatif lebar baris itu (mengikuti posisi teks).
	function layoutWrappedChords() {
		var wraps = document.querySelectorAll(".lyrics-chorded-line");
		wraps.forEach((wrap) => {
			var chordsData = null;
			try {
				chordsData = JSON.parse(wrap.dataset.lyricsChords || "null");
			} catch (e) {}
			if (!Array.isArray(chordsData) || chordsData.length === 0) return;

			var ps = wrap.querySelectorAll(".lyrics-line");
			var p = ps[0];
			if (!p) return;
			var isMulti = ps.length > 1;

			// Baris yang SUDAH dipecah: perbarui lebar row chord agar
			// mengikuti lebar baris teks saat ini (font bisa berubah oleh
			// autofit); bila teks melebar melebihi kontainer (font
			// membesar) atau teks asli kini muat satu baris (zoom out),
			// reset & proses ulang dari teks asli.
			if (isMulti) {
				var containerW = wrap.clientWidth || 0;
				var needsReset = false;
				ps.forEach((pp) => {
					if (pp.getBoundingClientRect().width > containerW + 2)
						needsReset = true;
				});
				// Gabung kembali bila seluruh baris kini muat 1 baris
				var origText = wrap.dataset.lyricsText || "";
				if (!needsReset && origText) {
					var origW = measureLyricsTextWidth(origText, p);
					if (origW <= containerW + 2) needsReset = true;
				}
				if (!needsReset) {
					var rows = wrap.querySelectorAll(".lyrics-chord-row");
					ps.forEach((pp, i) => {
						var row = rows[i];
						if (!row) return;
						var pw = pp.getBoundingClientRect().width;
						if (pw > 0) row.style.width = pw + "px";
					});
					return;
				}
				// Reset ke struktur satu baris, lalu proses ulang di bawah
				var text = origText;
				if (!text) return;
				wrap.innerHTML = "";
				var row0 = document.createElement("div");
				row0.className =
					"lyrics-chord-row" +
					(chordsData.length ? " has-chords" : "");
				chordsData.forEach((ch) => {
					var sp = document.createElement("span");
					sp.className = "lyrics-chord";
					sp.style.left = (ch.pos * 100).toFixed(2) + "%";
					sp.dataset.raw = ch.chord;
					sp.textContent =
						typeof formatChordForDisplay === "function"
							? formatChordForDisplay(ch.chord)
							: ch.chord;
					applyLyricsChordStyle(sp);
					row0.append(sp);
				});
				wrap.append(row0);
				var p0b = document.createElement("p");
				p0b.className = "lyrics-line";
				p0b.style.cssText = "margin:0;padding:0";
				p0b.textContent = text;
				wrap.append(p0b);
				p = p0b;
			}

			// Deteksi wrap: tinggi elemen > tinggi SATU baris (line-height).
			// scrollWidth/scrollHeight tidak bisa dipakai untuk teks wrap
			// (selalu sama dengan clientWidth/clientHeight).
			var lh = parseFloat(getComputedStyle(p).lineHeight) || 0;
			if (lh <= 0 || p.scrollHeight <= lh + 2) return; // tidak wrap

			var rects = measureLyricsWordRects(p);
			if (!rects || rects.length < 2) return;

			// Kelompokkan kata berdasarkan baris visual (top)
			var visualRows = [];
			rects.forEach((r) => {
				var g = visualRows.find((gr) => Math.abs(gr.top - r.top) < 3);
				if (g) g.items.push(r);
				else visualRows.push({ top: r.top, items: [r] });
			});
			visualRows.sort((a, b) => a.top - b.top);

			// Kumulatif lebar kata (tanpa spasi) — pemetaan proporsional
			var cum = [];
			var total = 0;
			rects.forEach((r, i) => {
				cum.push(total);
				total += r.width;
			});
			if (total <= 0) return;

			// Tempatkan tiap chord ke baris visual kata terdekat
			var chordGroups = visualRows.map(() => []);
			chordsData.forEach((ch) => {
				var xFrac = Math.max(0, Math.min(1, ch.pos)) * total;
				var bestI = 0;
				var bestD = Infinity;
				for (var i = 0; i < rects.length; i++) {
					var center = cum[i] + rects[i].width / 2;
					var d = Math.abs(center - xFrac);
					if (d < bestD) {
						bestD = d;
						bestI = i;
					}
				}
				var w = rects[bestI];
				var fracInWord =
					w.width > 0
						? Math.max(
								0,
								Math.min(1, (xFrac - cum[bestI]) / w.width),
							)
						: 0;
				var xAbs = w.left + fracInWord * w.width;
				var rowIdx = visualRows.findIndex(
					(g) => Math.abs(g.top - w.top) < 3,
				);
				if (rowIdx < 0) rowIdx = visualRows.length - 1;
				var row = visualRows[rowIdx];
				var leftB = Math.min.apply(
					null,
					row.items.map((it) => it.left),
				);
				var rightB = Math.max.apply(
					null,
					row.items.map((it) => it.right),
				);
				var widthB = Math.max(1, rightB - leftB);
				var posInBaris = Math.max(
					0,
					Math.min(1, (xAbs - leftB) / widthB),
				);
				chordGroups[rowIdx].push({ chord: ch.chord, pos: posInBaris });
			});

			// Rebuild: satu baris visual = row chord (selebar baris teks)
			// + <p> nowrap, semuanya rata kiri (wrap alami browser).
			var frag = document.createDocumentFragment();
			visualRows.forEach((vr, ri) => {
				var leftB = Math.min.apply(
					null,
					vr.items.map((it) => it.left),
				);
				var rightB = Math.max.apply(
					null,
					vr.items.map((it) => it.right),
				);
				var widthB = Math.max(1, rightB - leftB);
				var rowEl = document.createElement("div");
				rowEl.className =
					"lyrics-chord-row" +
					(chordGroups[ri].length ? " has-chords" : "");
				rowEl.style.width = Math.round(widthB) + "px";
				chordGroups[ri].forEach((ch) => {
					var span = document.createElement("span");
					span.className = "lyrics-chord";
					span.style.left = (ch.pos * 100).toFixed(2) + "%";
					span.dataset.raw = ch.chord;
					span.textContent =
						typeof formatChordForDisplay === "function"
							? formatChordForDisplay(ch.chord)
							: ch.chord;
					applyLyricsChordStyle(span);
					rowEl.append(span);
				});
				frag.append(rowEl);
				var pEl = document.createElement("p");
				pEl.className = "lyrics-line";
				pEl.style.cssText = "margin:0;padding:0;white-space:nowrap";
				pEl.textContent = vr.items.map((it) => it.word).join(" ");
				frag.append(pEl);
			});
			wrap.replaceChildren(frag);
		});
		fixLyricsChordCollisions();
	}

	// Re-layout wrap dengan debounce (dipakai saat font/spacing/ukuran
	// berubah — termasuk saat tombol ditahan dan zoom) agar tidak berat.
	// Iterasi dijalankan sampai KONVERGEN (maks 3) agar tidak berosilasi
	// besar-kecil: autofit menurunkan font -> layout mengubah tinggi ->
	// autofit menyesuaikan lagi, dst.
	var _lyricsRelayoutTimer = null;
	function lyricsLayoutSignature() {
		var vt = qs("#lyrics-verse-text");
		var content = qs("#lyrics-content");
		if (!vt || !content) return "x";
		return [
			Math.round(parseFloat(vt.style.fontSize) || 0),
			lyricsLineSpacing,
			Math.round(content.clientWidth),
			Math.round(content.clientHeight),
		].join("|");
	}
	function scheduleLyricsRelayout() {
		if (_lyricsRelayoutTimer) clearTimeout(_lyricsRelayoutTimer);
		_lyricsRelayoutTimer = setTimeout(() => {
			_lyricsRelayoutTimer = null;
			for (var iter = 0; iter < 3; iter++) {
				var s1 = lyricsLayoutSignature();
				layoutWrappedChords();
				autoFitLyricsVerse();
				var s2 = lyricsLayoutSignature();
				if (s2 === s1) break; // stabil
			}
			layoutWrappedChords();
		}, 180);
	}

	// Gabungkan chorded lines dari semua halaman layout
	function flattenChordedLines(layout) {
		var all = [];
		if (!layout || !layout.pages) return all;
		for (var pk in layout.pages) {
			if (Array.isArray(layout.pages[pk])) {
				all = all.concat(layout.pages[pk]);
			}
		}
		return all;
	}

	// Fallback per-index baris: kidung rohani memakai melodi yang SAMA untuk
	// semua bait, jadi baris ke-i bait mana pun seharusnya memakai chord yang
	// sama dengan baris ke-i bait yang datanya tersedia (biasanya bait 1).
	// byIndex[i] = chorded line untuk baris index i (dari bait pertama yang
	// berhasil match teks). Baris bait lain yang tidak match teks memakai
	// fallback ini sehingga chord tampil di SETIAP bait.
	function buildVerseChordFallback(verses, layout) {
		var byIndex = [];
		if (!Array.isArray(verses) || verses.length === 0) return byIndex;
		var all = flattenChordedLines(layout);
		if (all.length === 0) return byIndex;
		for (var b = 0; b < verses.length; b++) {
			var lines = String(verses[b] || "")
				.split("\n")
				.map((l) => l.trim())
				.filter((l) => l.length > 0);
			for (var i = 0; i < lines.length; i++) {
				if (byIndex[i]) continue;
				var m = findChordedLine(lines[i], all);
				if (m) byIndex[i] = m;
			}
		}
		return byIndex;
	}

	// Render semua baris bait (dengan chord bila tersedia & aktif)
	function renderVerseLines(verseText, lines, layout, chordFallback) {
		verseText.textContent = "";
		// Reset histeresis autofit — konten berubah total saat ganti bait
		_lastFitFontPx = 0;
		// Kelas ini mengontrol visibilitas/animasi baris chord via CSS
		verseText.classList.toggle("lyrics-chords-on", lyricsShowChords);
		for (var i = 0; i < lines.length; i++) {
			var wrap = document.createElement("div");
			wrap.className = "lyrics-chorded-line";
			var chordedLine = null;
			if (layout && layout.pages) {
				for (var pk in layout.pages) {
					var cl = findChordedLine(lines[i], layout.pages[pk]);
					if (cl) {
						chordedLine = cl;
						break;
					}
				}
			}
			// Fallback per-index: baris ini tidak match teks tapi melodi-nya
			// sama dengan baris ke-i bait lain yang punya chord.
			if (!chordedLine && chordFallback && chordFallback[i]) {
				chordedLine = chordFallback[i];
			}
			renderLyricLine(wrap, lines[i], chordedLine);
			verseText.append(wrap);
		}
	}

	// Anti-tabrakan: chord yang posisinya (dari PDF) terlalu berdekatan
	// digeser ke kanan secukupnya agar tidak saling menimpa. Posisi asli
	// tetap dipertahankan selama tidak terjadi tumpang tindih.
	function fixLyricsChordCollisions() {
		var rows = document.querySelectorAll(".lyrics-chord-row");
		for (var r = 0; r < rows.length; r++) {
			var row = rows[r];
			var spans = row.querySelectorAll(".lyrics-chord");
			if (spans.length < 2) continue;
			var rowW = row.clientWidth || 1;
			var prevRightPx = -Infinity;
			for (var i = 0; i < spans.length; i++) {
				var leftPx = (parseFloat(spans[i].style.left) || 0) / 100 * rowW;
				var halfW = spans[i].offsetWidth / 2;
				var minLeft = prevRightPx + halfW + 4;
				if (leftPx < minLeft) {
					leftPx = minLeft;
					var maxLeft = Math.max(halfW + 2, rowW - halfW - 2);
					if (leftPx > maxLeft) leftPx = maxLeft;
					spans[i].style.left = (leftPx / rowW * 100).toFixed(2) + "%";
				}
				prevRightPx = leftPx + halfW;
			}
		}
	}

	// Perbarui teks chord yang sudah dirender (dipakai setelah transpose /
	// ganti nada dasar, agar tidak perlu re-render seluruh bait)
	function refreshLyricsChordTexts() {
		if (typeof formatChordForDisplay !== "function") return;
		document.querySelectorAll(".lyrics-chord").forEach((el) => {
			el.textContent = formatChordForDisplay(
				el.dataset.raw || el.textContent,
			);
		});
	}

	// Hold-to-repeat: tahan tombol -> aksi dijalankan terus menerus
	function addHoldRepeat(btn, action, opts) {
		if (!btn || typeof action !== "function") return;
		var delay = (opts && opts.delay) || 380;
		var interval = (opts && opts.interval) || 120;
		var timer = null;
		var iv = null;
		function stop() {
			if (timer) clearTimeout(timer);
			if (iv) clearInterval(iv);
			timer = null;
			iv = null;
		}
		function start(e) {
			if (e && e.cancelable) e.preventDefault();
			stop();
			action();
			timer = setTimeout(function () {
				iv = setInterval(action, interval);
			}, delay);
		}
		btn.addEventListener("pointerdown", start);
		btn.addEventListener("pointerup", stop);
		btn.addEventListener("pointerleave", stop);
		btn.addEventListener("pointercancel", stop);
		btn.addEventListener("keydown", (e) => {
			if (e.key === "Enter" || e.key === " ") {
				e.preventDefault();
				action();
			}
		});
	}

	// Ubah ukuran font bait langsung (tanpa re-render) lalu autofit.
	// Ukuran dianimasikan (WAAPI) dari nilai lama ke hasil autofit.
	function applyLyricsFontDelta(delta) {
		var vt = qs("#lyrics-verse-text");
		var oldPx =
			vt && lyricsViewActive
				? parseFloat(vt.style.fontSize) || lyricsFontSize
				: lyricsFontSize;
		lyricsFontSize = Math.max(14, Math.min(72, lyricsFontSize + delta));
		savePrefs();
		if (vt && lyricsViewActive) {
			vt.style.fontSize = lyricsFontSize + "px";
			vt.style.lineHeight = String(lyricsLineSpacing);
			autoFitLyricsVerse();
			scheduleLyricsRelayout();
			var finalPx = parseFloat(vt.style.fontSize) || lyricsFontSize;
			if (
				typeof vt.animate === "function" &&
				Math.abs(finalPx - oldPx) > 0.5
			) {
				vt.animate(
					[
						{
							fontSize: oldPx + "px",
							lineHeight: oldPx * lyricsLineSpacing + "px",
						},
						{
							fontSize: finalPx + "px",
							lineHeight: finalPx * lyricsLineSpacing + "px",
						},
					],
					{ duration: 220, easing: "ease" },
				);
			}
		}
	}

	// Ubah jarak baris langsung (tanpa re-render) lalu autofit, dengan
	// animasi dari tinggi baris lama ke baru.
	function applyLyricsSpacingDelta(delta) {
		var vt = qs("#lyrics-verse-text");
		var oldPx =
			vt && lyricsViewActive
				? parseFloat(vt.style.fontSize) || lyricsFontSize
				: lyricsFontSize;
		var oldLH =
			vt && lyricsViewActive
				? parseFloat(getComputedStyle(vt).lineHeight) || 0
				: 0;
		lyricsLineSpacing = Math.max(
			1,
			Math.min(3.5, +(lyricsLineSpacing + delta).toFixed(1)),
		);
		savePrefs();
		if (vt && lyricsViewActive) {
			vt.style.fontSize = lyricsFontSize + "px";
			vt.style.lineHeight = String(lyricsLineSpacing);
			autoFitLyricsVerse();
			scheduleLyricsRelayout();
			var finalPx = parseFloat(vt.style.fontSize) || lyricsFontSize;
			var finalLH =
				parseFloat(getComputedStyle(vt).lineHeight) || 0;
			if (
				typeof vt.animate === "function" &&
				(Math.abs(finalLH - oldLH) > 1 || finalPx !== oldPx)
			) {
				vt.animate(
					[
						{ fontSize: oldPx + "px", lineHeight: oldLH + "px" },
						{
							fontSize: finalPx + "px",
							lineHeight: finalLH + "px",
						},
					],
					{ duration: 220, easing: "ease" },
				);
			}
		}
	}

	/* ============ KONTROL MIDI DI MODE TEKS ============
	   Instrument selector, tempo, transpose, dan nada dasar (key) tetap
	   tersedia saat mode lirik aktif — memakai fungsi/state yang sama
	   dengan viewer (MidiEngine, transposeStep, dll.). */

	function mkMidiBtn(id, title, icon) {
		var b = document.createElement("button");
		b.id = id;
		b.type = "button";
		b.className = "lyrics-midi-btn";
		b.title = title;
		b.setAttribute("aria-label", title);
		var s = document.createElement("span");
		s.className = "material-symbols-outlined";
		s.textContent = icon;
		b.append(s);
		return b;
	}
	function populateLyricsInstrumentSelect() {
		var sel = qs("#lyrics-instrument-select");
		if (!sel) return;
		var sf =
			(typeof prefs !== "undefined" && prefs && prefs.midiSoundfont) ||
			(typeof MIDI_SF2_URL !== "undefined" ? MIDI_SF2_URL : "");
		var list =
			typeof getSoundfontInstrumentList === "function"
				? getSoundfontInstrumentList(sf)
				: [];
		sel.textContent = "";
		if (!list.length) {
			// Fallback: reuse options dari select viewer (bila sudah terisi)
			if (
				typeof customInstrumentSelect !== "undefined" &&
				customInstrumentSelect &&
				customInstrumentSelect.options
			) {
				for (var i = 0; i < customInstrumentSelect.options.length; i++) {
					var o = document.createElement("option");
					o.value = customInstrumentSelect.options[i].value;
					o.textContent = customInstrumentSelect.options[i].textContent;
					sel.append(o);
				}
			}
		} else {
			for (var j = 0; j < list.length; j++) {
				var opt = document.createElement("option");
				opt.value = list[j][0];
				opt.textContent = list[j][1];
				sel.append(opt);
			}
		}
		var wrap = document.querySelector(".lyrics-midi-instrument-wrap");
		if (wrap) wrap.style.display = sel.options.length ? "" : "none";
		var active =
			(typeof prefs !== "undefined" && prefs && prefs.midiInstrument != null)
				? String(prefs.midiInstrument)
				: typeof customInstrumentSelect !== "undefined" &&
					  customInstrumentSelect &&
					  customInstrumentSelect.dataset.value
					? String(customInstrumentSelect.dataset.value)
					: "";
		if (active && sel.options.length) {
			var matched = false;
			for (var k = 0; k < sel.options.length; k++) {
				if (sel.options[k].value === active) {
					matched = true;
					break;
				}
			}
			if (matched) sel.value = active;
		}
	}

	function onLyricsInstrumentChange() {
		var sel = qs("#lyrics-instrument-select");
		if (!sel) return;
		var val = sel.value;
		if (typeof prefs !== "undefined" && prefs) {
			prefs.midiInstrument = parseInt(val, 10);
		}
		if (
			typeof customInstrumentSelect !== "undefined" &&
			customInstrumentSelect
		) {
			customInstrumentSelect.dataset.value = val;
		}
		if (typeof changeInstrument === "function") changeInstrument();
	}

	function syncLyricsTempoLabel() {
		var el = qs("#lyrics-tempo-label");
		if (!el) return;
		var bpm =
			typeof getCurrentSongTempoBpm === "function"
				? getCurrentSongTempoBpm()
				: null;
		var text = bpm != null && Number.isFinite(bpm) ? String(bpm) : "";
		// Jangan timpa saat user sedang mengetik
		if (el.dataset.tempoEditing !== "1" && document.activeElement !== el) {
			el.value = text;
		}
	}

	// Saat pindah lagu, tempo default lagu baru diterapkan SETELAH MIDI
	// selesai dimuat — polling ringan menjaga label/input tetap sinkron.
	function _fmtTime(sec) {
		sec = Math.max(0, Math.floor(Number(sec) || 0));
		var m = Math.floor(sec / 60);
		return m + ":" + String(sec % 60).padStart(2, "0");
	}

	function syncLyricsTransportUI() {
		if (typeof MidiEngine === "undefined") return;
		var btn = qs("#lyrics-play-btn");
		var seek = qs("#lyrics-seek");
		var cur = qs("#lyrics-time-cur");
		var end = qs("#lyrics-time-end");
		if (!btn || !seek) return;

		var playing = typeof MidiEngine.isPlaying === "function" && MidiEngine.isPlaying();
		var icon = playing ? "pause" : "play_arrow";
		if (btn._iconState !== icon) {
			btn._iconState = icon;
			var sp = btn.querySelector(".material-symbols-outlined");
			if (sp) sp.textContent = icon;
			btn.classList.toggle("is-playing", playing);
		}

		var dur = 0, t = 0;
		try {
			dur = MidiEngine.getDuration() || 0;
			t = MidiEngine.getTime() || 0;
		} catch (e) {}

		var hasTrack = !!MidiEngine.getCurrentMidiUrl();
		seek.disabled = !hasTrack || !dur || dur <= 0;
		if (end) {
			var endText = hasTrack ? _fmtTime(dur) : "0:00";
			if (end.textContent !== endText) end.textContent = endText;
		}
		if (cur && seek.dataset.seekEditing !== "1") {
			var curText = _fmtTime(t);
			if (cur.textContent !== curText) cur.textContent = curText;
		}
		if (seek.dataset.seekEditing !== "1" && dur > 0) {
			var frac = Math.round(Math.max(0, Math.min(1, t / dur)) * 1000);
			if (String(seek.value) !== String(frac)) seek.value = frac;
		}
	}

	function startLyricsTempoPolling() {
		stopLyricsTempoPolling();
		syncLyricsTransportUI();
		_lyricsTempoPollTimer = setInterval(() => {
			if (!lyricsViewActive) return;
			var el = qs("#lyrics-tempo-label");
			if (
				el &&
				el.dataset.tempoEditing !== "1" &&
				document.activeElement !== el
			) {
				var bpm =
					typeof getCurrentSongTempoBpm === "function"
						? getCurrentSongTempoBpm()
						: null;
				if (bpm != null && String(bpm) !== String(el.value)) {
					syncLyricsTempoLabel();
					syncLyricsTransposeLabel();
					updateLyricsKeyButton();
				}
			}
			syncLyricsTransportUI();
		}, 500);
	}

	function stopLyricsTempoPolling() {
		if (_lyricsTempoPollTimer) {
			clearInterval(_lyricsTempoPollTimer);
			_lyricsTempoPollTimer = null;
		}
	}

	function onLyricsTempo(delta) {
		var cur =
			typeof getCurrentSongTempoBpm === "function"
				? getCurrentSongTempoBpm()
				: 100;
		var next = Math.max(20, Math.min(300, cur + delta));
		if (typeof setMidiTempoBpm === "function") setMidiTempoBpm(next);
		syncLyricsTempoLabel();
	}

	function syncLyricsTransposeLabel() {
		var el = qs("#lyrics-transpose-label");
		if (!el) return;
		var step =
			typeof transposeStep !== "undefined" ? transposeStep : 0;
		el.textContent = (step > 0 ? "+" : "") + step;
	}

	function onLyricsTranspose(delta) {
		if (typeof onTranspose === "function") onTranspose(delta);
		refreshLyricsChordTexts();
		updateLyricsKeyButton();
		syncLyricsTransposeLabel();
	}

	function getLyricsKeyNotes() {
		return typeof accidentalMode !== "undefined" && accidentalMode === "flat"
			? typeof NOTE_NAMES_FLAT !== "undefined"
				? NOTE_NAMES_FLAT
				: ["C", "D♭", "D", "E♭", "E", "F", "F♯", "G", "A♭", "A", "B♭", "B"]
			: typeof NOTE_NAMES_SHARP !== "undefined"
				? NOTE_NAMES_SHARP
				: ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];
	}

	function buildLyricsKeyDropdown() {
		var dd = qs("#lyrics-key-dropdown");
		if (!dd) return;
		dd.textContent = "";
		var notes = getLyricsKeyNotes();
		var currentSemi = null;
		if (typeof originalFamilyChord !== "undefined" && originalFamilyChord) {
			var parsed = parseChordToken(originalFamilyChord);
			if (parsed) {
				currentSemi = wrapSemitone(
					parsed.semitone + transposeStep + baseTransposeOffset,
				);
			}
		}
		notes.forEach((note, index) => {
			var opt = document.createElement("button");
			opt.type = "button";
			opt.className = "lyrics-key-option";
			opt.dataset.index = String(index);
			opt.textContent = note;
			if (currentSemi === index) opt.classList.add("selected");
			dd.append(opt);
		});
	}

	function updateLyricsKeyButton() {
		var btn = qs("#lyrics-key-btn");
		if (!btn) return;
		var isMinor = false;
		var base = null;
		if (typeof originalFamilyChord !== "undefined" && originalFamilyChord) {
			isMinor = originalFamilyChord.endsWith("m");
			var parsed = parseChordToken(originalFamilyChord);
			if (parsed) base = parsed.semitone;
		} else if (typeof originalPdfKey !== "undefined" && originalPdfKey) {
			isMinor = originalPdfKey.toLowerCase().endsWith("m");
			if (typeof parsePdfKeyToSemitone === "function") {
				base = parsePdfKeyToSemitone(originalPdfKey);
			}
		}
		if (base === null) {
			btn.textContent = "—";
			btn.disabled = true;
			return;
		}
		btn.disabled = false;
		var semi = wrapSemitone(base + transposeStep + baseTransposeOffset);
		var notes = getLyricsKeyNotes();
		btn.textContent = notes[semi] + (isMinor ? "m" : "");
		buildLyricsKeyDropdown();
	}

	function applyLyricsKey(index) {
		if (typeof originalFamilyChord === "undefined" || !originalFamilyChord)
			return;
		var parsedObj = parseChordToken(originalFamilyChord);
		if (!parsedObj) return;
		var delta = index - parsedObj.semitone - baseTransposeOffset;
		delta = delta % 12;
		if (delta > 6) delta -= 12;
		if (delta < -5) delta += 12;
		transposeStep = delta;
		if (typeof updateTransposeUI === "function") updateTransposeUI();
		if (typeof refreshVisibleChordMarkers === "function")
			refreshVisibleChordMarkers();
		refreshLyricsChordTexts();
		updateLyricsKeyButton();
		syncLyricsTransposeLabel();
	}

	function syncLyricsMidiControls() {
		var header = qs("#lyrics-header");
		if (typeof MidiEngine === "undefined") {
			// Tanpa MIDI: sembunyikan baris transport & tuning di header
			if (header) header.classList.add("is-no-midi");
			return;
		}
		if (header) header.classList.remove("is-no-midi");
		populateLyricsInstrumentSelect();
		syncLyricsTempoLabel();
		updateLyricsKeyButton();
		syncLyricsTransposeLabel();
	}

	/* ============ AUTOFIT FONT BAIT ============
	   Ukuran font bait di-autofit di awal: pakai preferensi user sebagai
	   ukuran maksimal, lalu turunkan (binary search) sampai seluruh baris
	   bait (termasuk baris chord) muat di area konten. Kalau masih lebih
	   tinggi dari ukuran minimum, area konten menjadi scrollable. */
	var LYRICS_AUTOFIT_MIN = 14;

	function autoFitLyricsVerse() {
		var content = qs("#lyrics-content");
		var vt = qs("#lyrics-verse-text");
		var vc = qs("#lyrics-verse-container");
		if (!content || !vt || !vc) return;
		var availH = Math.max(60, content.clientHeight - 12);
		// Toleransi pengukuran ~1.5px: menghindari osilasi besar-kecil saat
		// ukuran tepat di batas (subpixel/scrollbar) — terutama saat zoom.
		var FIT_TOLERANCE = 1.5;
		var maxSize = Math.max(LYRICS_AUTOFIT_MIN, lyricsFontSize);
		var prevTransition = vt.style.transition;
		vt.style.transition = "none";
		try {
			var lo = LYRICS_AUTOFIT_MIN;
			var hi = maxSize;
			// Default ke ukuran minimum: bila tidak ada ukuran yang muat
			// (bait sangat panjang), pakai minimum + area konten scrollable.
			var best = LYRICS_AUTOFIT_MIN;
			function measure(px) {
				vt.style.fontSize = px + "px";
				vt.style.lineHeight = String(lyricsLineSpacing);
				return vc.scrollHeight <= availH + FIT_TOLERANCE;
			}
			if (measure(maxSize)) {
				best = maxSize;
			} else {
				while (lo <= hi) {
					var mid = Math.round((lo + hi) / 2);
					if (measure(mid)) {
						best = mid;
						lo = mid + 1;
					} else {
						hi = mid - 1;
					}
				}
			}
			vt.style.fontSize = best + "px";
			vt.style.lineHeight = String(lyricsLineSpacing);
			// Histeresis: perubahan 1px bolak-balik (akibat pembulatan)
			// ditahan — pakai nilai yang sudah dipakai agar tidak bergetar.
			if (
				_lastFitFontPx >= LYRICS_AUTOFIT_MIN &&
				Math.abs(best - _lastFitFontPx) <= 1
			) {
				best = _lastFitFontPx;
				vt.style.fontSize = best + "px";
			}
			_lastFitFontPx = best;
			var overflowing = vc.scrollHeight > availH + FIT_TOLERANCE;
			content.style.alignItems = overflowing ? "flex-start" : "center";
			content.style.overflowY = overflowing ? "auto" : "";
			// Ukuran font final sudah pasti — baru aman menggeser chord yang
			// saling menimpa (lebar chord tergantung font-size).
			fixLyricsChordCollisions();
		} finally {
			vt.style.transition = prevTransition;
		}
	}

	function qs(id) {
		return document.querySelector(id);
	}

	// Check if MIDI is currently playing to preserve play state on navigation
	function _midiIsPlaying() {
		return typeof MidiEngine !== "undefined" && MidiEngine.isPlaying();
	}

	function updateLyricsVerse(animateDir) {
		var verseText = qs("#lyrics-verse-text");
		var indicator = qs("#lyrics-verse-indicator");
		var prevBtn = qs("#lyrics-prev-verse");
		var nextBtn = qs("#lyrics-next-verse");
		var container = qs("#lyrics-verse-container");
		var entry = getCurrentLyricEntry();

		if (!entry || !entry.verses || entry.verses.length === 0) {
			if (verseText) {
				verseText.textContent = "";
				var p = document.createElement("p");
				p.style.cssText =
					"font-style:italic;color:var(--md-sys-color-on-surface-variant);font-size:1rem;line-height:1.6;white-space:normal;margin:0;padding:0";
				p.textContent = "Teks lagu belum tersedia.";
				verseText.append(p);
			}
			if (indicator) indicator.textContent = "";
			if (prevBtn) prevBtn.style.visibility = "hidden";
			if (nextBtn) nextBtn.style.visibility = "hidden";
			return;
		}

		if (lyricsVerseIndex >= entry.verses.length) lyricsVerseIndex = 0;
		if (lyricsVerseIndex < 0) lyricsVerseIndex = entry.verses.length - 1;

		var verse = entry.verses[lyricsVerseIndex];
		var lines = verse.split("\n").filter((l) => l.trim().length > 0);
		_verseRenderToken++;
		var token = _verseRenderToken;

		function finishRender() {
			verseText.style.fontSize = lyricsFontSize + "px";
			verseText.style.lineHeight = String(lyricsLineSpacing);
			autoFitLyricsVerse();
			// Layout adaptif baris wrap: pecah baris & posisikan chord
			// per baris visual, lalu autofit ulang sampai stabil.
			layoutWrappedChords();
			autoFitLyricsVerse();
			layoutWrappedChords();
			// Pasang chord dari layout PDF (async) bila masih bait yang sama
			if (lyricsShowChords) {
				var song = getCurrentSong();
				if (song) {
					getChordedLinesForSong(song).then((layout) => {
						if (
							_verseRenderToken !== token ||
							!lyricsViewActive ||
							!verseText
						)
							return;
						// Fallback per-index (chord tiap bait sama): dihitung
						// sekali per lagu dari semua bait.
						var chordFallback = null;
						if (
							layout &&
							!_verseChordFallbackCache.has(song.fileHref)
						) {
							_verseChordFallbackCache.set(
								song.fileHref,
								buildVerseChordFallback(entry.verses, layout),
							);
						}
						if (layout) {
							chordFallback = _verseChordFallbackCache.get(
								song.fileHref,
							);
						}
						renderVerseLines(
							verseText,
							lines,
							layout,
							chordFallback,
						);
						verseText.style.fontSize = lyricsFontSize + "px";
						verseText.style.lineHeight = String(lyricsLineSpacing);
						autoFitLyricsVerse();
						layoutWrappedChords();
						autoFitLyricsVerse();
						layoutWrappedChords();
					});
				}
			}
		}

		if (verseText) {
			if (animateDir && animateDir !== 0 && container) {
				// Phase 1: slide OLD content out
				container.style.transition = "transform 0.2s ease, opacity 0.2s ease";
				container.style.transform =
					"translateY(" + (animateDir > 0 ? -20 : 20) + "px)";
				container.style.opacity = "0";
				setTimeout(() => {
					// Phase 2: swap to NEW content while invisible
					renderVerseLines(verseText, lines, null);
					finishRender();
					// Set starting position for slide-in (opposite side)
					container.style.transition = "none";
					container.style.transform =
						"translateY(" + (animateDir > 0 ? 20 : -20) + "px)";
					container.style.opacity = "1";
					requestAnimationFrame(() => {
						requestAnimationFrame(() => {
							// Phase 3: slide NEW content in
							container.style.transition =
								"transform 0.2s ease, opacity 0.2s ease";
							container.style.transform = "translateY(0)";
						});
					});
				}, 200);
			} else {
				// Direct update, no animation
				renderVerseLines(verseText, lines, null);
				finishRender();
			}
		}
		if (indicator)
			indicator.textContent =
				"Bait " + (lyricsVerseIndex + 1) + " dari " + entry.verses.length;
		if (prevBtn) {
			prevBtn.style.visibility = lyricsVerseIndex <= 0 ? "hidden" : "visible";
			prevBtn.disabled = lyricsVerseIndex <= 0;
		}
		if (nextBtn) {
			nextBtn.style.visibility =
				lyricsVerseIndex >= entry.verses.length - 1 ? "hidden" : "visible";
			nextBtn.disabled = lyricsVerseIndex >= entry.verses.length - 1;
		}
	}

	function navigateLyricsVerse(delta) {
		if (lyricsTransitioning) return;
		var entry = getCurrentLyricEntry();
		if (!entry || !entry.verses) return;
		var newIdx = lyricsVerseIndex + delta;
		if (newIdx < 0 || newIdx >= entry.verses.length) return;
		lyricsTransitioning = true;
		lyricsVerseIndex = newIdx;
		updateLyricsVerse(delta);
		setTimeout(() => {
			lyricsTransitioning = false;
		}, 300);
	}

	var lyricsTempoPollTimerAlias = null; // (compat alias tak dipakai)
	var _lyricsHeaderCollapsed = false;

	function loadHeaderPrefs() {
		try {
			_lyricsHeaderCollapsed =
				localStorage.getItem("lyrics-header-collapsed") === "1";
		} catch (e) {
			_lyricsHeaderCollapsed = false;
		}
	}
	loadHeaderPrefs();

	function saveHeaderCollapsed(v) {
		try {
			localStorage.setItem(
				"lyrics-header-collapsed",
				v ? "1" : "0"
			);
		} catch (e) {}
	}

	function toggleLyricsHeaderCollapse() {
		var hd = qs("#lyrics-header");
		if (!hd) return;
		_lyricsHeaderCollapsed = !_lyricsHeaderCollapsed;
		saveHeaderCollapsed(_lyricsHeaderCollapsed);
		hd.classList.toggle("is-collapsed", _lyricsHeaderCollapsed);
		scheduleLyricsRelayout();
	}

	function createLyricsPanel() {
		var existing = qs("#lyrics-panel");
		if (existing) return existing;

		var p = document.createElement("div");
		p.id = "lyrics-panel";
		p.className = "lyrics-panel";
		p.style.cssText =
			"position:fixed;inset:0;z-index:9999;display:none;flex-direction:column";

		var bd = document.createElement("div");
		bd.className = "lyrics-backdrop";
		bd.id = "lyrics-backdrop";
		bd.style.cssText =
			"position:absolute;inset:0;background:var(--md-sys-color-surface)";
		bd.addEventListener("click", (e) => {
			e.stopPropagation();
		});
		p.append(bd);

		var inn = document.createElement("div");
		inn.className = "lyrics-inner";
		inn.style.cssText =
			"position:relative;z-index:1;display:flex;flex-direction:column;width:100%;height:100%;margin:0 auto";

		// ── Header ringkas: SEMUA kontrol (teks + MIDI) dalam satu blok ──
		var hd = document.createElement("div");
		hd.id = "lyrics-header";
		hd.className = "lyrics-header";

		function mkHdrBtn(id, title, icon) {
			var b = document.createElement("button");
			b.id = id;
			b.type = "button";
			b.className = "lyrics-midi-btn lyrics-hdr-btn";
			b.title = title;
			b.setAttribute("aria-label", title);
			var s = document.createElement("span");
			s.className = "material-symbols-outlined";
			s.textContent = icon;
			b.append(s);
			return b;
		}
		function mkCtrlBtn(id, title, icon) {
			var b = mkHdrBtn(id, title, icon);
			b.classList.add("lyrics-ctrl-btn");
			return b;
		}

		/* ── Header SATU baris: prev · play · judul · seek · next · toggle · collapse ── */
		var lMain = document.createElement("div");
		lMain.id = "lyrics-main-line";
		lMain.className = "lh-line lh-main";

		var pv = mkHdrBtn("lyrics-song-prev", "Lagu sebelumnya", "skip_previous");
		pv.addEventListener("click", (e) => {
			e.stopPropagation();
			if (typeof onPrevSong === "function") onPrevSong(_midiIsPlaying(), false);
		});
		lMain.append(pv);

		var playBtn = mkHdrBtn("lyrics-play-btn", "Putar / jeda", "play_arrow");
		playBtn.classList.add("lyrics-play-toggle");
		playBtn.addEventListener("click", (e) => {
			e.stopPropagation();
			if (typeof window.toggleMidiPlayback === "function") {
				window.toggleMidiPlayback();
			} else if (
				typeof MidiEngine !== "undefined" &&
				typeof MidiEngine.resumeContext === "function"
			) {
				MidiEngine.resumeContext();
				if (MidiEngine.isPlaying()) MidiEngine.pause();
				else MidiEngine.play();
			}
			syncLyricsTransportUI();
		});
		lMain.append(playBtn);

		var curLabel = document.createElement("span");
		curLabel.id = "lyrics-time-cur";
		curLabel.className = "lyrics-midi-label lyrics-time-label";
		curLabel.textContent = "0:00";

		var si = document.createElement("div");
		si.className = "lh-title";

		var tiWrap = document.createElement("div");
		tiWrap.style.cssText =
			"display:flex;align-items:baseline;gap:3px;min-width:0;overflow:hidden;flex-shrink:1";
		var sn = document.createElement("span");
		sn.id = "lyrics-song-number";
		sn.style.cssText =
			"font-size:0.7rem;font-weight:600;color:var(--md-sys-color-primary);white-space:nowrap";
		tiWrap.append(sn);
		var st = document.createElement("h2");
		st.id = "lyrics-song-title";
		st.style.cssText =
			"font-family:var(--font-display);font-size:0.95rem;font-weight:700;color:var(--md-sys-color-on-surface);margin:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis";
		tiWrap.append(st);
		si.append(tiWrap);
		lMain.append(si);

		lMain.append(curLabel);

		var nv = mkHdrBtn("lyrics-song-next", "Lagu berikutnya", "skip_next");
		nv.addEventListener("click", (e) => {
			e.stopPropagation();
			if (typeof onNextSong === "function") onNextSong(_midiIsPlaying());
		});
		lMain.append(nv);

		/* Seek kompak di baris utama */
		var seek = document.createElement("input");
		seek.id = "lyrics-seek";
		seek.className = "lyrics-midi-seek lyrics-main-seek";
		seek.type = "range";
		seek.min = "0";
		seek.max = "1000";
		seek.step = "1";
		seek.value = "0";
		seek.title = "Geser posisi lagu";
		seek.setAttribute("aria-label", "Posisi lagu");
		var durCache = 0;
		seek.addEventListener("input", () => {
			seek.dataset.seekEditing = "1";
			if (!durCache) return;
			var frac = parseInt(seek.value, 10) / 1000;
			curLabel.textContent = _fmtTime(frac * durCache);
		});
		var commitSeek = () => {
			seek.dataset.seekEditing = "0";
			if (typeof MidiEngine === "undefined") return;
			durCache = MidiEngine.getDuration() || durCache;
			if (!durCache) return;
			var t = (parseInt(seek.value, 10) / 1000) * durCache;
			MidiEngine.seek(t);
			syncLyricsTransportUI();
		};
		seek.addEventListener("change", commitSeek);
		seek.addEventListener("pointerup", () => {
			if (seek.dataset.seekEditing === "1") commitSeek();
		});
		seek.addEventListener("keydown", (e) => e.stopPropagation());
		lMain.append(seek);

		var endLabel = document.createElement("span");
		endLabel.id = "lyrics-time-end";
		endLabel.className = "lyrics-midi-label lyrics-time-label";
		endLabel.textContent = "0:00";
		lMain.append(endLabel);

		/* Toggle chord langsung di baris utama */
		var ctg = mkCtrlBtn(
			"lyrics-chord-toggle-btn",
			lyricsShowChords ? "Sembunyikan chord" : "Tampilkan chord",
			"music_note",
		);
		ctg.setAttribute("aria-pressed", lyricsShowChords ? "true" : "false");
		if (lyricsShowChords) ctg.classList.add("active");
		ctg.addEventListener("click", () => {
			lyricsShowChords = !lyricsShowChords;
			savePrefs();
			ctg.setAttribute("aria-pressed", lyricsShowChords ? "true" : "false");
			ctg.title = lyricsShowChords ? "Sembunyikan chord" : "Tampilkan chord";
			ctg.classList.toggle("active", lyricsShowChords);
			// Tanpa re-render: class di #lyrics-verse-text memicu transisi
			// height/opacity baris chord (expand/collapse + fade) via CSS.
			var vt = qs("#lyrics-verse-text");
			if (vt) vt.classList.toggle("lyrics-chords-on", lyricsShowChords);
			// Autofit ulang SETELAH animasi selesai (tinggi konten berubah)
			clearTimeout(window.__lyricsChordsFitTimer);
			window.__lyricsChordsFitTimer = setTimeout(autoFitLyricsVerse, 360);
		});
		lMain.append(ctg);

		var cb = mkCtrlBtn("lyrics-close-btn", "Kembali ke PDF", "close");
		cb.addEventListener("click", () => {
			window.hideLyricsView();
		});
		lMain.append(cb);

		var colBtn = mkHdrBtn(
			"lyrics-header-collapse",
			_lyricsHeaderCollapsed ? "Tampilkan kontrol lain" : "Sembunyikan kontrol lain",
			"tune",
		);
		colBtn.setAttribute("aria-expanded", _lyricsHeaderCollapsed ? "false" : "true");
		colBtn.classList.add("lyrics-collapse-btn");
		colBtn.addEventListener("click", (e) => {
			e.stopPropagation();
			toggleLyricsHeaderCollapse();
			colBtn.setAttribute(
				"aria-expanded",
				_lyricsHeaderCollapsed ? "false" : "true",
			);
			colBtn.title = _lyricsHeaderCollapsed
				? "Tampilkan kontrol lain"
				: "Sembunyikan kontrol lain";
		});
		lMain.append(colBtn);
		hd.append(lMain);

		/* ── Area collapsible: tuning MIDI + pengaturan teks, 2 baris mikro ── */
		var xtra = document.createElement("div");
		xtra.id = "lyrics-extra-lines";
		xtra.className = "lyrics-extra";

		var lTune = document.createElement("div");
		lTune.id = "lyrics-tune-line";
		lTune.className = "lh-line lh-tune";

		var iw = document.createElement("div");
		iw.className = "lyrics-midi-group lyrics-midi-instrument-wrap";
		var isel = document.createElement("select");
		isel.id = "lyrics-instrument-select";
		isel.className = "lyrics-midi-select";
		isel.title = "Pilih alat musik";
		isel.setAttribute("aria-label", "Pilih alat musik");
		isel.addEventListener("change", onLyricsInstrumentChange);
		iw.append(isel);
		lTune.append(iw);

		var tg = document.createElement("div");
		tg.className = "lyrics-midi-group";
		var tdn = mkHdrBtn("lyrics-tempo-down", "Kurangi tempo", "remove");
		addHoldRepeat(tdn, () => onLyricsTempo(-2), { delay: 300, interval: 90 });
		var tlb = document.createElement("input");
		tlb.id = "lyrics-tempo-label";
		tlb.className = "lyrics-midi-label lyrics-tempo-input";
		tlb.type = "number";
		tlb.min = "30";
		tlb.max = "220";
		tlb.step = "1";
		tlb.inputMode = "numeric";
		tlb.title = "Ketik tempo (BPM)";
		tlb.setAttribute("aria-label", "Tempo dalam BPM (bisa diketik)");
		var commitTempoInput = () => {
			tlb.dataset.tempoEditing = "0";
			var v = parseInt(tlb.value, 10);
			if (!Number.isFinite(v)) {
				syncLyricsTempoLabel();
				return;
			}
			if (typeof setMidiTempoBpm === "function") setMidiTempoBpm(v);
			syncLyricsTempoLabel();
		};
		tlb.addEventListener("input", () => {
			tlb.dataset.tempoEditing = "1";
		});
		tlb.addEventListener("change", commitTempoInput);
		tlb.addEventListener("blur", commitTempoInput);
		tlb.addEventListener("keydown", (e) => {
			if (e.key === "Enter") {
				e.preventDefault();
				commitTempoInput();
				tlb.blur();
			} else if (e.key === "Escape") {
				e.preventDefault();
				tlb.dataset.tempoEditing = "0";
				syncLyricsTempoLabel();
				tlb.blur();
			}
		});
		var tup = mkHdrBtn("lyrics-tempo-up", "Tambah tempo", "add");
		addHoldRepeat(tup, () => onLyricsTempo(2), { delay: 300, interval: 90 });
		tg.append(tdn, tlb, tup);
		lTune.append(tg);

		var kg = document.createElement("div");
		kg.className = "lyrics-midi-group lyrics-key-group";
		var kbtn = document.createElement("button");
		kbtn.id = "lyrics-key-btn";
		kbtn.type = "button";
		kbtn.className = "lyrics-midi-btn lyrics-key-btn";
		kbtn.title = "Pilih nada dasar";
		kbtn.setAttribute("aria-label", "Pilih nada dasar");
		kbtn.textContent = "—";
		var kdd = document.createElement("div");
		kdd.className = "lyrics-key-dropdown";
		kdd.id = "lyrics-key-dropdown";
		kdd.setAttribute("role", "listbox");
		kbtn.addEventListener("click", (e) => {
			e.stopPropagation();
			kdd.classList.toggle("is-open");
		});
		kdd.addEventListener("click", (e) => {
			var opt = e.target.closest(".lyrics-key-option");
			if (!opt) return;
			var idx = parseInt(opt.dataset.index, 10);
			if (Number.isFinite(idx)) applyLyricsKey(idx);
			kdd.classList.remove("is-open");
		});
		kg.append(kbtn, kdd);
		lTune.append(kg);

		xtra.append(lTune);

		var lText = document.createElement("div");
		lText.id = "lyrics-text-line";
		lText.className = "lh-line lh-textline";

		var fd = mkCtrlBtn("lyrics-font-down", "Perkecil font", "text_decrease");
		addHoldRepeat(fd, () => applyLyricsFontDelta(-4));
		lText.append(fd);
		var fu = mkCtrlBtn("lyrics-font-up", "Perbesar font", "text_increase");
		addHoldRepeat(fu, () => applyLyricsFontDelta(4));
		lText.append(fu);
		var sd = mkCtrlBtn(
			"lyrics-spacing-down",
			"Rapatkan teks",
			"format_line_spacing",
		);
		addHoldRepeat(sd, () => applyLyricsSpacingDelta(-0.2), {
			interval: 100,
		});
		lText.append(sd);
		var su = mkCtrlBtn("lyrics-spacing-up", "Renggangkan teks", "line_weight");
		addHoldRepeat(su, () => applyLyricsSpacingDelta(0.2), {
			interval: 100,
		});
		lText.append(su);

		var trg = document.createElement("div");
		trg.className = "lyrics-midi-group lyrics-transpose-inline";
		var trd = mkHdrBtn("lyrics-transpose-down", "Turunkan nada", "south");
		addHoldRepeat(trd, () => onLyricsTranspose(-1), { delay: 300, interval: 90 });
		var trl = document.createElement("span");
		trl.id = "lyrics-transpose-label";
		trl.className = "lyrics-midi-label lyrics-transpose-label";
		trl.textContent = "0";
		var tru = mkHdrBtn("lyrics-transpose-up", "Naikkan nada", "north");
		addHoldRepeat(tru, () => onLyricsTranspose(1), { delay: 300, interval: 90 });
		trg.append(trd, trl, tru);
		lText.append(trg);

		xtra.append(lText);

		hd.append(xtra);

		// Terapkan status collapsible tersimpan + grid animasi tinggi
		hd.classList.toggle("is-collapsed", _lyricsHeaderCollapsed);

		// Tutup dropdown key saat klik di luar
		document.addEventListener("pointerdown", (e) => {
			if (!e.target.closest(".lyrics-key-group")) {
				var dd = qs("#lyrics-key-dropdown");
				if (dd) dd.classList.remove("is-open");
			}
		});

		inn.append(hd);
		p.append(inn);
		document.body.append(p);

		// Content: area bait lirik (swipe vertikal = ganti bait,
		// horizontal = ganti lagu)
		var ct = document.createElement("div");
		ct.id = "lyrics-content";
		ct.style.cssText =
			"flex:1 1 0;display:flex;align-items:center;justify-content:center;padding:8px 24px;min-height:0;touch-action:pan-x pan-y";
		var vc = document.createElement("div");
		vc.id = "lyrics-verse-container";
		vc.style.cssText =
			"text-align:center;width:100%;transition:transform 0.2s ease,opacity 0.2s ease";
		var vt = document.createElement("div");
		vt.id = "lyrics-verse-text";
		vt.className = "lyrics-verse-text";
		vt.style.cssText =
			"font-family:var(--font-display);color:var(--md-sys-color-on-surface);font-weight:500;transition:font-size 0.2s ease,line-height 0.2s ease;white-space:normal";
		vc.append(vt);
		ct.append(vc);
		inn.append(ct);

		// Gestures: vertical swipe = verse nav, horizontal swipe = song nav
		var tsX = 0,
			tsY = 0,
			tsT = 0;
		ct.addEventListener(
			"touchstart",
			(e) => {
				if (e.touches.length === 1) {
					tsX = e.touches[0].clientX;
					tsY = e.touches[0].clientY;
					tsT = Date.now();
				}
			},
			{ passive: true },
		);
		ct.addEventListener("touchend", (e) => {
			if (!e.changedTouches.length) return;
			var dx = e.changedTouches[0].clientX - tsX;
			var dy = e.changedTouches[0].clientY - tsY;
			var dt = Date.now() - tsT;
			if (dt > 800) return;
			var absDx = Math.abs(dx),
				absDy = Math.abs(dy);
			if (absDx < 40 && absDy < 40) return;
			if (absDx > absDy) {
				if (absDx > 40) {
					if (dx < 0) {
						if (typeof onNextSong === "function") onNextSong(_midiIsPlaying());
					} else {
						if (typeof onPrevSong === "function")
							onPrevSong(_midiIsPlaying(), false);
					}
				}
			} else {
				if (absDy > 40) {
					// Saat konten lirik bisa di-scroll (bait terlalu tinggi),
					// swipe vertikal dipakai untuk scroll, bukan ganti bait.
					var scrollable =
						ct.scrollHeight > ct.clientHeight + 1 &&
						ct.style.overflowY === "auto";
					if (!scrollable) navigateLyricsVerse(dy > 0 ? -1 : 1);
				}
			}
			});
		ct.addEventListener(
			"wheel",
			(e) => {
				if (Math.abs(e.deltaY) > 30) {
					// Bila konten bisa di-scroll, wheel untuk scroll, bukan ganti bait
					var scrollable =
						ct.scrollHeight > ct.clientHeight + 1 &&
						ct.style.overflowY === "auto";
					if (scrollable) return;
					e.preventDefault();
					navigateLyricsVerse(e.deltaY > 0 ? 1 : -1);
				}
			},
			{ passive: false },
		);

		return p;
	}

	function showLyricsView(isSongChange) {
		var panel = createLyricsPanel();
		if (!panel) return;
		lyricsViewActive = true;
		lyricsViewWasActive = true;
		lyricsVerseIndex = 0;

		var entry = getCurrentLyricEntry();
		if (entry) {
			var sn = qs("#lyrics-song-number");
			var st = qs("#lyrics-song-title");
			if (sn) sn.textContent = (entry.number || "") + " - ";
			if (st) {
				st.textContent = entry.title || "";
				st.title = entry.title || "";
				autoFitLyricsTitle(st);
			}
		}
		updateLyricsVerse(0);
		syncLyricsMidiControls();
		startLyricsTempoPolling();

		// Open animation: make visible with opacity 0, then WAAPI fade-in.
		// inline opacity:0 prevents flash before animation takes over.
		panel.style.display = "flex";
		panel.style.opacity = "0";
		if (typeof panel.animate === "function") {
			panel.animate(
				[
					{ opacity: 0, transform: "translateY(8px)" },
					{ opacity: 1, transform: "translateY(0)" },
				],
				{ duration: 250, easing: "ease", fill: "forwards" },
			);
		} else {
			void panel.offsetWidth;
			panel.style.opacity = "1";
		}

		document.body.classList.add("lyrics-mode");

		if (isSongChange) {
			var vt = qs("#lyrics-verse-text");
			if (vt && typeof vt.animate === "function") {
				vt.animate(
					[
						{ opacity: 0, transform: "scale(0.94)" },
						{ opacity: 1, transform: "scale(1)" },
					],
					{
						duration: 300,
						easing: "cubic-bezier(0.2, 0.8, 0.2, 1)",
						fill: "forwards",
					},
				);
			}
		}

		syncLyricsToggleButtons();
	}

	function hideLyricsViewImpl() {
		lyricsViewActive = false;
		lyricsViewWasActive = false;
		stopLyricsTempoPolling();

		var contentEl = qs("#lyrics-content");
		if (contentEl) {
			contentEl.scrollTop = 0;
			contentEl.style.overflowY = "";
			contentEl.style.alignItems = "center";
		}

		var panel = qs("#lyrics-panel");
		if (panel) {
			// Batalkan WAAPI apa pun yang masih jalan, lalu reset ke kondisi
			// terlihat penuh SEBELUM memulai animasi keluar sendiri (WAAPI).
			// WAAPI dipakai untuk keluar (bukan CSS transition) supaya tidak
			// bergantung pada urutan cancel/reflow yang rapuh.
			if (typeof panel.getAnimations === "function") {
				panel.getAnimations().forEach((a) => {
					a.cancel();
				});
			}
			panel.style.removeProperty("opacity");
			panel.style.removeProperty("transform");
			panel.style.display = "flex";
			panel.classList.remove("fading-out");

			if (typeof panel.animate === "function") {
				var outAnim = panel.animate(
					[
						{ opacity: 1, transform: "translateY(0)" },
						{ opacity: 0, transform: "translateY(10px)" },
					],
					{ duration: 250, easing: "ease" },
				);
				outAnim.onfinish = () => {
					panel.style.display = "none";
				};
				// Safety net: kalau onfinish tidak sempat terpanggil (tab
				// di background, animasi di-throttle), tetap sembunyikan.
				setTimeout(() => {
					if (outAnim.playState !== "finished") outAnim.cancel();
					panel.style.display = "none";
					panel.classList.remove("fading-out");
				}, 350);
			} else {
				panel.style.display = "none";
			}
		}

		document.body.classList.remove("lyrics-mode");
		syncLyricsToggleButtons();
	}

	// Ekspos ke window SEKARANG dan re-assert SETELAH bundle utama selesai
	// dimuat (hookOpenPdfViewer). Tanpa re-assert, copy lama di dalam bundle
	// yang dimuat belakangan menimpa global ini dengan versi instan tanpa
	// animasi (fade-out menghilang).
	window.hideLyricsView = hideLyricsViewImpl;

	function loadLyricsDataCached(cb) {
		if (typeof window.gysLoadLyricsData === "function") {
			window.gysLoadLyricsData((data) => {
				try {
					cb(data);
				} catch (e) {
					console.error("[lyrics] render gagal:", e);
				}
			});
			return;
		}
		fetch("assets-lyrics.json")
			.then((r) => (r.ok ? r.json() : []))
			.catch(() => [])
			.then((data) => {
				try {
					cb(data);
				} catch (e) {
					console.error("[lyrics] render gagal (fallback):", e);
				}
			});
	}

	function toggleLyricsView() {
		if (lyricsViewActive) {
			window.hideLyricsView();
		} else {
			if (lyricsData) {
				showLyricsView();
			} else {
				loadLyricsDataCached((data) => {
					lyricsData = data;
					showLyricsView();
				});
			}
		}
	}
	window.toggleLyricsView = toggleLyricsView;

	function syncLyricsToggleButtons() {
		var pressed = lyricsViewActive ? "true" : "false";
		document
			.querySelectorAll("#lyrics-toggle-btn, #midi-lyrics-toggle-btn")
			.forEach((b) => {
				b.setAttribute("aria-pressed", pressed);
				b.classList.toggle("active", lyricsViewActive);
			});
	}

	function injectLyricsToggleButton() {
		var transport = document.querySelector(".mini-transport");
		var miniExists = !!qs("#lyrics-toggle-btn");
		if (!miniExists && transport) {
			var btn = document.createElement("button");
			btn.id = "lyrics-toggle-btn";
			btn.className = "icon-button mini-lyrics-toggle-btn";
			btn.setAttribute("aria-label", "Lihat Lirik");
			btn.setAttribute("aria-pressed", "false");
			btn.title = "Lihat Lirik";
			var s = document.createElement("span");
			s.className = "material-symbols-outlined";
			s.textContent = "menu_book";
			btn.append(s);
			btn.addEventListener("click", (e) => {
				e.stopPropagation();
				toggleLyricsView();
			});
			transport.append(btn);
		}

		var midiExisting = qs("#midi-lyrics-toggle-btn");
		if (!midiExisting) {
			var playerActions = document.querySelector(".custom-player-actions");
			if (playerActions && !qs("#midi-lyrics-toggle-btn")) {
				var midiBtn = document.createElement("button");
				midiBtn.id = "midi-lyrics-toggle-btn";
				midiBtn.className =
					"instrument-capsule-btn midi-action-btn midi-icon-btn";
				midiBtn.setAttribute("aria-label", "Lihat Lirik");
				midiBtn.setAttribute("aria-pressed", "false");
				midiBtn.title = "Lihat Lirik";
				var s = document.createElement("span");
				s.className = "material-symbols-outlined cis-icon";
				s.textContent = "menu_book";
				midiBtn.append(s);
				midiBtn.addEventListener("click", (e) => {
					e.stopPropagation();
					toggleLyricsView();
				});
				var loopBtn = playerActions.querySelector("#custom-loop-btn");
				if (loopBtn) {
					loopBtn.closest(".instrument-selector-wrapper").before(midiBtn);
				} else {
					playerActions.append(midiBtn);
				}
			}
		}
	}

	function _updateLyricsContentAfterSongChange() {
		var entry = getCurrentLyricEntry();
		if (entry) {
			var sn = qs("#lyrics-song-number");
			var st = qs("#lyrics-song-title");
			if (sn) sn.textContent = (entry.number || "") + " - ";
			if (st) {
				st.textContent = entry.title || "";
				st.title = entry.title || "";
				autoFitLyricsTitle(st);
			}
		}
		lyricsVerseIndex = 0;
		updateLyricsVerse(0);
		syncLyricsMidiControls();
		// Crossfade animation for song change
		var vt = qs("#lyrics-verse-text");
		if (vt && typeof vt.animate === "function") {
			vt.animate(
				[
					{ opacity: 0, transform: "scale(0.94)" },
					{ opacity: 1, transform: "scale(1)" },
				],
				{
					duration: 300,
					easing: "cubic-bezier(0.2, 0.8, 0.2, 1)",
					fill: "forwards",
				},
			);
		}
	}

	function hookOpenPdfViewer() {
		if (typeof openPdfViewer !== "undefined") {
			// Bundle utama baru saja terdeteksi siap — pada titik ini copy lama
			// di dalam bundle telah menimpa global milik file ini. Re-assert
			// agar versi dengan animasi selalu yang aktif.
			window.hideLyricsView = hideLyricsViewImpl;
			var _orig = openPdfViewer;
			openPdfViewer = async (songId, backgroundLoad) => {
				var wasActive = lyricsViewActive;
				// Update lyrics IMMEDIATELY before PDF/MIDI load. Set currentSongIndex
				// first so getCurrentLyricEntry() reads the target song, not the old one.
				if (wasActive) {
					currentSongIndex = parseInt(songId, 10);
					loadPrefs();
					if (lyricsData) {
						_updateLyricsContentAfterSongChange();
					} else {
						loadLyricsDataCached((data) => {
							lyricsData = data;
							currentSongIndex = parseInt(songId, 10);
							_updateLyricsContentAfterSongChange();
						});
					}
				}
				// In lyrics mode, skip full PDF render — audio + lyrics is enough.
				// The PDF still loads in background for when user exits lyrics mode.
				var result = await _orig(songId, wasActive || backgroundLoad);
				if (!backgroundLoad) {
					setTimeout(injectLyricsToggleButton, 100);
				}
				return result;
			};
			if (typeof closePdfViewer !== "undefined") {
				var _origClose = closePdfViewer;
				closePdfViewer = async () => {
					if (lyricsViewActive) window.hideLyricsView();
					return await _origClose();
				};
			}
		} else {
			setTimeout(hookOpenPdfViewer, 200);
		}
	}
	setTimeout(hookOpenPdfViewer, 500);

	setTimeout(() => {
		injectLyricsToggleButton();
		loadPrefs();
	}, 2000); /* ponytail: only loads prefs now; lyrics JSON fetched on first toggle */

	// Autofit ulang saat ukuran layar/orientasi/zoom berubah (mode lirik
	// aktif). Zoom browser & pinch zoom memicu event visualViewport
	// (resize/scroll), bukan window resize — keduanya dilistener.
	var _lyricsResizeBusy = false;
	_lyricsResizeHandler = () => {
		if (!lyricsViewActive || _lyricsResizeBusy) return;
		_lyricsResizeBusy = true;
		try {
			autoFitLyricsVerse();
			scheduleLyricsRelayout();
		} finally {
			// lepaskan kunci pada tick berikutnya agar event beruntun
			// (zoom berkelanjutan) tetap masuk satu per satu
			setTimeout(() => {
				_lyricsResizeBusy = false;
			}, 0);
		}
	};
	window.addEventListener("resize", _lyricsResizeHandler);
	window.addEventListener("orientationchange", _lyricsResizeHandler);
	if (window.visualViewport) {
		window.visualViewport.addEventListener(
			"resize",
			_lyricsResizeHandler,
		);
		window.visualViewport.addEventListener(
			"scroll",
			_lyricsResizeHandler,
		);
	}
})();
