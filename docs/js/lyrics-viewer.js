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
	var _verseRenderToken = 0; // penanda render untuk hasil async chord layout
	var _lyricsResizeHandler = null;
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

	// Render semua baris bait (dengan chord bila tersedia & aktif)
	function renderVerseLines(verseText, lines, layout) {
		verseText.textContent = "";
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

	// Ubah ukuran font bait langsung (tanpa re-render) lalu autofit
	function applyLyricsFontDelta(delta) {
		lyricsFontSize = Math.max(14, Math.min(72, lyricsFontSize + delta));
		savePrefs();
		var vt = qs("#lyrics-verse-text");
		if (vt && lyricsViewActive) {
			vt.style.fontSize = lyricsFontSize + "px";
			vt.style.lineHeight = String(lyricsLineSpacing);
			autoFitLyricsVerse();
		}
	}

	// Ubah jarak baris langsung (tanpa re-render) lalu autofit
	function applyLyricsSpacingDelta(delta) {
		lyricsLineSpacing = Math.max(
			1,
			Math.min(3.5, +(lyricsLineSpacing + delta).toFixed(1)),
		);
		savePrefs();
		var vt = qs("#lyrics-verse-text");
		if (vt && lyricsViewActive) {
			vt.style.fontSize = lyricsFontSize + "px";
			vt.style.lineHeight = String(lyricsLineSpacing);
			autoFitLyricsVerse();
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

	function buildLyricsMidiBar(inn) {
		var bar = document.createElement("div");
		bar.className = "lyrics-midi-bar";
		bar.id = "lyrics-midi-bar";

		// Instrument
		var iw = document.createElement("div");
		iw.className = "lyrics-midi-group lyrics-midi-instrument-wrap";
		var isel = document.createElement("select");
		isel.id = "lyrics-instrument-select";
		isel.className = "lyrics-midi-select";
		isel.title = "Pilih alat musik";
		isel.setAttribute("aria-label", "Pilih alat musik");
		isel.addEventListener("change", onLyricsInstrumentChange);
		iw.append(isel);
		bar.append(iw);

		// Tempo
		var tg = document.createElement("div");
		tg.className = "lyrics-midi-group";
		var tdn = mkMidiBtn("lyrics-tempo-down", "Kurangi tempo", "remove");
		addHoldRepeat(tdn, () => onLyricsTempo(-2), { delay: 300, interval: 90 });
		var tlb = document.createElement("span");
		tlb.id = "lyrics-tempo-label";
		tlb.className = "lyrics-midi-label";
		tlb.textContent = "♩ —";
		var tup = mkMidiBtn("lyrics-tempo-up", "Tambah tempo", "add");
		addHoldRepeat(tup, () => onLyricsTempo(2), { delay: 300, interval: 90 });
		tg.append(tdn, tlb, tup);
		bar.append(tg);

		// Nada dasar (key) + dropdown 12 nada
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
		bar.append(kg);

		// Transpose
		var trg = document.createElement("div");
		trg.className = "lyrics-midi-group";
		var trd = mkMidiBtn("lyrics-transpose-down", "Turunkan nada", "south");
		addHoldRepeat(trd, () => onLyricsTranspose(-1), { delay: 300, interval: 90 });
		var trl = document.createElement("span");
		trl.id = "lyrics-transpose-label";
		trl.className = "lyrics-midi-label lyrics-transpose-label";
		trl.textContent = "Transpose 0";
		var tru = mkMidiBtn("lyrics-transpose-up", "Naikkan nada", "north");
		addHoldRepeat(tru, () => onLyricsTranspose(1), { delay: 300, interval: 90 });
		trg.append(trd, trl, tru);
		bar.append(trg);

		inn.append(bar);

		// Tutup dropdown key saat klik di luar
		document.addEventListener("pointerdown", (e) => {
			if (!e.target.closest(".lyrics-key-group")) {
				var dd = qs("#lyrics-key-dropdown");
				if (dd) dd.classList.remove("is-open");
			}
		});
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
		el.textContent = bpm != null && Number.isFinite(bpm) ? "♩ " + bpm : "♩ —";
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
		el.textContent = "Transpose " + (step > 0 ? "+" : "") + step;
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
		if (typeof MidiEngine === "undefined") {
			var bar = qs("#lyrics-midi-bar");
			if (bar) bar.style.display = "none";
			return;
		}
		var bar2 = qs("#lyrics-midi-bar");
		if (bar2) bar2.style.display = "";
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
				return vc.scrollHeight <= availH;
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
			var overflowing = vc.scrollHeight > availH + 1;
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
						renderVerseLines(verseText, lines, layout);
						verseText.style.fontSize = lyricsFontSize + "px";
						verseText.style.lineHeight = String(lyricsLineSpacing);
						autoFitLyricsVerse();
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

		// Header
		var hd = document.createElement("div");
		hd.style.cssText =
			"display:flex;align-items:center;justify-content:space-between;padding:10px 16px;flex-shrink:0;gap:8px";
		var si = document.createElement("div");
		si.style.cssText =
			"display:flex;align-items:baseline;gap:2px;min-width:0;flex:1";
		var sn = document.createElement("span");
		sn.id = "lyrics-song-number";
		sn.style.cssText =
			"font-size:0.75rem;font-weight:600;color:var(--md-sys-color-primary);white-space:nowrap";
		si.append(sn);
		var st = document.createElement("h2");
		st.id = "lyrics-song-title";
		st.style.cssText =
			"font-family:var(--font-display);font-size:1.05rem;font-weight:700;color:var(--md-sys-color-on-surface);margin:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis";
		si.append(st);
		hd.append(si);

		var ha = document.createElement("div");
		ha.style.cssText = "display:flex;gap:2px;flex-shrink:0";

		function mkCtrlBtn(id, title, icon) {
			var b = document.createElement("button");
			b.id = id;
			b.className = "icon-button lyrics-ctrl-btn";
			b.title = title;
			b.setAttribute("aria-label", title);
			b.style.cssText =
				"width:32px;height:32px;border-radius:10px;opacity:0.5;display:flex;align-items:center;justify-content:center";
			var s = document.createElement("span");
			s.className = "material-symbols-outlined";
			s.style.fontSize = "18px";
			s.textContent = icon;
			b.append(s);
			return b;
		}

		var fd = mkCtrlBtn("lyrics-font-down", "Perkecil font", "text_decrease");
		addHoldRepeat(fd, () => applyLyricsFontDelta(-4));
		ha.append(fd);
		var fu = mkCtrlBtn("lyrics-font-up", "Perbesar font", "text_increase");
		addHoldRepeat(fu, () => applyLyricsFontDelta(4));
		ha.append(fu);
		var sd = mkCtrlBtn(
			"lyrics-spacing-down",
			"Rapatkan teks",
			"format_line_spacing",
		);
		addHoldRepeat(sd, () => applyLyricsSpacingDelta(-0.2), {
			interval: 100,
		});
		ha.append(sd);
		var su = mkCtrlBtn("lyrics-spacing-up", "Renggangkan teks", "line_weight");
		addHoldRepeat(su, () => applyLyricsSpacingDelta(0.2), {
			interval: 100,
		});
		ha.append(su);
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
		ha.append(ctg);
		var cb = mkCtrlBtn("lyrics-close-btn", "Kembali ke PDF", "close");
		cb.addEventListener("click", () => {
			window.hideLyricsView();
		});
		ha.append(cb);
		hd.append(ha);
		inn.append(hd);
		buildLyricsMidiBar(inn);

		// Content
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

		// Footer
		var ft = document.createElement("div");
		ft.style.cssText =
			"display:flex;align-items:center;padding:8px 16px 16px;flex-shrink:0";
		var fl = document.createElement("div");
		fl.style.cssText = "flex:1;display:flex";
		var fc = document.createElement("div");
		fc.style.cssText = "display:flex;align-items:center;gap:10px";
		var fr = document.createElement("div");
		fr.style.cssText = "flex:1;display:flex;justify-content:flex-end";

		function mkNavBtn(id, title, icon) {
			var b = document.createElement("button");
			b.id = id;
			b.className = "icon-button lyrics-nav-btn";
			b.title = title;
			b.setAttribute("aria-label", title);
			b.style.cssText =
				"width:38px;height:38px;border-radius:12px;background:var(--md-sys-color-surface-container-highest);display:flex;align-items:center;justify-content:center;transition:opacity 0.2s,transform 0.12s";
			var s = document.createElement("span");
			s.className = "material-symbols-outlined";
			s.style.fontSize = "22px";
			s.textContent = icon;
			b.append(s);
			return b;
		}

		var pv = mkNavBtn("lyrics-song-prev", "Lagu sebelumnya", "skip_previous");
		pv.addEventListener("click", (e) => {
			e.stopPropagation();
			if (typeof onPrevSong === "function") onPrevSong(_midiIsPlaying(), false);
		});
		fl.append(pv);
		var nv = mkNavBtn("lyrics-song-next", "Lagu berikutnya", "skip_next");
		nv.addEventListener("click", (e) => {
			e.stopPropagation();
			if (typeof onNextSong === "function") onNextSong(_midiIsPlaying());
		});
		fr.append(nv);
		var vb = mkNavBtn("lyrics-prev-verse", "Bait sebelumnya", "arrow_upward");
		vb.addEventListener("click", () => {
			navigateLyricsVerse(-1);
		});
		fc.append(vb);
		var vi = document.createElement("span");
		vi.id = "lyrics-verse-indicator";
		vi.className = "lyrics-verse-indicator";
		vi.style.cssText =
			"font-size:0.82rem;font-weight:600;color:var(--md-sys-color-on-surface-variant);min-width:110px;text-align:center;white-space:nowrap";
		vi.textContent = "Bait 1 dari 1";
		fc.append(vi);
		var va = mkNavBtn("lyrics-next-verse", "Bait berikutnya", "arrow_downward");
		va.addEventListener("click", () => {
			navigateLyricsVerse(1);
		});
		fc.append(va);

		ft.append(fl);
		ft.append(fc);
		ft.append(fr);
		inn.append(ft);
		p.append(inn);
		document.body.append(p);

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

	window.hideLyricsView = () => {
		lyricsViewActive = false;
		lyricsViewWasActive = false;

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
	};

	function toggleLyricsView() {
		if (lyricsViewActive) {
			window.hideLyricsView();
		} else {
			if (lyricsData) {
				showLyricsView();
			} else {
				fetch("assets-lyrics.json")
					.then((r) => (r.ok ? r.json() : []))
					.catch(() => [])
					.then((data) => {
						lyricsData = data;
						showLyricsView();
					});
			}
		}
	}

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
						fetch("assets-lyrics.json")
							.then((r) => (r.ok ? r.json() : []))
							.catch(() => [])
							.then((data) => {
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

	// Autofit ulang saat ukuran layar/orientasi berubah (mode lirik aktif)
	_lyricsResizeHandler = () => {
		if (lyricsViewActive) autoFitLyricsVerse();
	};
	window.addEventListener("resize", _lyricsResizeHandler);
	window.addEventListener("orientationchange", _lyricsResizeHandler);
})();
