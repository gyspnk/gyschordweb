/* Lyrics-Only View Mode - standalone module */
(function () {
	"use strict";

	var lyricsData = null;
	var lyricsVerseIndex = 0;
	var lyricsFontSize = 28;
	var lyricsLineSpacing = 1.8;
	var lyricsViewActive = false;
	var lyricsViewWasActive = false;
	var lyricsTransitioning = false;
	var lyricsTransitionDir = 0; // 1=next, -1=prev

	function loadPrefs() {
		try {
			var fs = localStorage.getItem("lyrics-font-size");
			if (fs) lyricsFontSize = parseInt(fs, 10) || 28;
			var ls = localStorage.getItem("lyrics-line-spacing");
			if (ls) lyricsLineSpacing = parseFloat(ls) || 1.8;
		} catch (e) {}
	}

	function savePrefs() {
		localStorage.setItem("lyrics-font-size", String(lyricsFontSize));
		localStorage.setItem("lyrics-line-spacing", String(lyricsLineSpacing));
	}

	function getSongLyricData(song) {
		if (!lyricsData || !Array.isArray(lyricsData)) return null;
		var num = String(song.nomor).replace(/^0+/, "") || "1";
		return (
			lyricsData.find(function (entry) {
				return String(entry.number).replace(/^0+/, "") === num;
			}) || null
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
		var lines = verse.split("\n").filter(function (l) {
			return l.trim().length > 0;
		});
		if (verseText) {
			if (animateDir && animateDir !== 0 && container) {
				// Phase 1: slide OLD content out
				container.style.transition = "transform 0.2s ease, opacity 0.2s ease";
				container.style.transform =
					"translateY(" + (animateDir > 0 ? -20 : 20) + "px)";
				container.style.opacity = "0";
				setTimeout(function () {
					// Phase 2: swap to NEW content while invisible
					verseText.textContent = "";
					for (var i = 0; i < lines.length; i++) {
						var p = document.createElement("p");
						p.className = "lyrics-line";
						p.style.cssText = "margin:0;padding:0";
						p.textContent = lines[i];
						verseText.append(p);
					}
					verseText.style.fontSize = lyricsFontSize + "px";
					verseText.style.lineHeight = String(lyricsLineSpacing);
					// Set starting position for slide-in (opposite side)
					container.style.transition = "none";
					container.style.transform =
						"translateY(" + (animateDir > 0 ? 20 : -20) + "px)";
					container.style.opacity = "1";
					requestAnimationFrame(function () {
						requestAnimationFrame(function () {
							// Phase 3: slide NEW content in
							container.style.transition =
								"transform 0.2s ease, opacity 0.2s ease";
							container.style.transform = "translateY(0)";
						});
					});
				}, 200);
			} else {
				// Direct update, no animation
				verseText.textContent = "";
				for (var i = 0; i < lines.length; i++) {
					var p = document.createElement("p");
					p.className = "lyrics-line";
					p.style.cssText = "margin:0;padding:0";
					p.textContent = lines[i];
					verseText.append(p);
				}
				verseText.style.fontSize = lyricsFontSize + "px";
				verseText.style.lineHeight = String(lyricsLineSpacing);
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
		setTimeout(function () {
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
		bd.addEventListener("click", function (e) {
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
		fd.addEventListener("click", function () {
			lyricsFontSize = Math.max(14, lyricsFontSize - 4);
			savePrefs();
			updateLyricsVerse();
		});
		ha.append(fd);
		var fu = mkCtrlBtn("lyrics-font-up", "Perbesar font", "text_increase");
		fu.addEventListener("click", function () {
			lyricsFontSize = Math.min(72, lyricsFontSize + 4);
			savePrefs();
			updateLyricsVerse();
		});
		ha.append(fu);
		var sd = mkCtrlBtn(
			"lyrics-spacing-down",
			"Rapatkan teks",
			"format_line_spacing",
		);
		sd.addEventListener("click", function () {
			lyricsLineSpacing = Math.max(1, +(lyricsLineSpacing - 0.2).toFixed(1));
			savePrefs();
			updateLyricsVerse();
		});
		ha.append(sd);
		var su = mkCtrlBtn("lyrics-spacing-up", "Renggangkan teks", "line_weight");
		su.addEventListener("click", function () {
			lyricsLineSpacing = Math.min(3.5, +(lyricsLineSpacing + 0.2).toFixed(1));
			savePrefs();
			updateLyricsVerse();
		});
		ha.append(su);
		var cb = mkCtrlBtn("lyrics-close-btn", "Kembali ke PDF", "close");
		cb.addEventListener("click", function () {
			window.hideLyricsView();
		});
		ha.append(cb);
		hd.append(ha);
		inn.append(hd);

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
		pv.addEventListener("click", function (e) {
			e.stopPropagation();
			if (typeof onPrevSong === "function") onPrevSong(_midiIsPlaying(), false);
		});
		fl.append(pv);
		var nv = mkNavBtn("lyrics-song-next", "Lagu berikutnya", "skip_next");
		nv.addEventListener("click", function (e) {
			e.stopPropagation();
			if (typeof onNextSong === "function") onNextSong(_midiIsPlaying());
		});
		fr.append(nv);
		var vb = mkNavBtn("lyrics-prev-verse", "Bait sebelumnya", "arrow_upward");
		vb.addEventListener("click", function () {
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
		va.addEventListener("click", function () {
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
			function (e) {
				if (e.touches.length === 1) {
					tsX = e.touches[0].clientX;
					tsY = e.touches[0].clientY;
					tsT = Date.now();
				}
			},
			{ passive: true },
		);
		ct.addEventListener("touchend", function (e) {
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
				if (absDy > 40) navigateLyricsVerse(dy > 0 ? -1 : 1);
			}
		});
		ct.addEventListener(
			"wheel",
			function (e) {
				if (Math.abs(e.deltaY) > 30) {
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

		panel.style.display = "flex";
		panel.style.opacity = "1";
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

	window.hideLyricsView = function () {
		lyricsViewActive = false;
		lyricsViewWasActive = false;

		var panel = qs("#lyrics-panel");
		if (panel) {
			panel.classList.add("fading-out");
			setTimeout(function () {
				panel.style.display = "none";
				panel.classList.remove("fading-out");
			}, 250);
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
					.then(function (r) {
						return r.ok ? r.json() : [];
					})
					.catch(function () {
						return [];
					})
					.then(function (data) {
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
			.forEach(function (b) {
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
			btn.addEventListener("click", function (e) {
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
				midiBtn.addEventListener("click", function (e) {
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
			openPdfViewer = async function (songId, backgroundLoad) {
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
							.then(function (r) {
								return r.ok ? r.json() : [];
							})
							.catch(function () {
								return [];
							})
							.then(function (data) {
								lyricsData = data;
								currentSongIndex = parseInt(songId, 10);
								_updateLyricsContentAfterSongChange();
							});
					}
				}
				var result = await _orig(songId, backgroundLoad);
				if (!backgroundLoad) {
					setTimeout(injectLyricsToggleButton, 100);
				}
				return result;
			};
			if (typeof closePdfViewer !== "undefined") {
				var _origClose = closePdfViewer;
				closePdfViewer = async function () {
					if (lyricsViewActive) window.hideLyricsView();
					return await _origClose();
				};
			}
		} else {
			setTimeout(hookOpenPdfViewer, 200);
		}
	}
	setTimeout(hookOpenPdfViewer, 500);

	setTimeout(function () {
		injectLyricsToggleButton();
		if (!lyricsData) {
			fetch("assets-lyrics.json")
				.then(function (r) {
					return r.ok ? r.json() : [];
				})
				.catch(function () {
					return [];
				})
				.then(function (data) {
					lyricsData = data;
				});
		}
		loadPrefs();
	}, 2000);
})();
