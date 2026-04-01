const fs = require("fs");
const file = "docs/js/07-pdf-viewer.js";
let content = fs.readFileSync(file, "utf8");

const onPrevRegex = /async function onPrevSong\([\s\S]*?\n\}/;
const onNextRegex = /async function onNextSong\([\s\S]*?\n\}/;

const newPrev = `async function onPrevSong(forceAutoplay = false, allowRewind = false) {
  if (forceAutoplay === true) {
    window._forceAutoPlayNext = true;
  }

  // Seek to 0 logic
  if (
    allowRewind &&
    typeof MidiTimeAuthority !== "undefined" &&
    typeof activeMidiPlayer !== "undefined"
  ) {
    const currTime = MidiTimeAuthority.getTime();
    if (currTime > 2) {
      try {
        activeMidiPlayer.currentTime = 0;
        MidiTimeAuthority.setTime(0, MidiTimeAuthority.getDuration());
        if (forceAutoplay && !activeMidiPlayer.playing) {
          activeMidiPlayer.start();
          MidiTimeAuthority.setPlaying(true);
          const playIcon = document.getElementById("custom-play-icon");
          if (playIcon) playIcon.textContent = "pause";
          const midiPlayerEl = document.getElementById("custom-midi-player");
          if (midiPlayerEl) midiPlayerEl.classList.add("playing");
        }
      } catch (e) {}
      return;
    }
  }

  let mode = typeof PlaylistManager !== "undefined" ? PlaylistManager.getAutoNextMode() : "number";

  if (mode === "shuffle-playlist") {
    const activeId = PlaylistManager.getActiveId();
    if (activeId) {
      const pl = PlaylistManager.getById(activeId);
      if (pl && pl.songs.length > 0) {
        const randomIdxInPl = Math.floor(Math.random() * pl.songs.length);
        if (typeof playSongFromPlaylist === "function") {
          await playSongFromPlaylist(randomIdxInPl, !document.body.classList.contains("viewer-active"), activeId);
          return;
        }
      }
    }
    mode = "shuffle-all";
  }

  if (mode === "shuffle-all") {
    if (typeof pujianItems !== "undefined" && pujianItems.length > 0) {
      const randomIdx = Math.floor(Math.random() * pujianItems.length);
      await openPdfViewer(randomIdx, !document.body.classList.contains("viewer-active"));
      return;
    }
  }

  if (mode === "playlist") {
    const activeId = PlaylistManager.getActiveId();
    if (activeId) {
      const pl = PlaylistManager.getById(activeId);
      if (pl && typeof pujianItems !== "undefined" && currentSongIndex >= 0) {
        const currentGlobalSong = pujianItems[currentSongIndex];
        let currentIdxInPl = pl.songs.findIndex((s) => s.nomor === currentGlobalSong.nomor);

        if (currentIdxInPl < 0) {
          if (typeof showToast === "function") showToast("Lagu aktif tidak di playlist, beralih ke Sesuai Nomor", "info");
          if (typeof setNextMode === "function") setNextMode("number");
          mode = "number";
        } else if (currentIdxInPl > 0) {
          if (typeof playSongFromPlaylist === "function") {
            await playSongFromPlaylist(currentIdxInPl - 1, !document.body.classList.contains("viewer-active"), activeId);
            return;
          }
        } else if (currentIdxInPl === 0) {
          if (typeof playSongFromPlaylist === "function" && pl.songs.length > 0) {
            await playSongFromPlaylist(pl.songs.length - 1, !document.body.classList.contains("viewer-active"), activeId);
            return;
          }
        }
      }
    }
  }

  if (mode === "number" || mode === "off" || mode === "one") {
    if (currentSongIndex > 0) {
      await openPdfViewer(currentSongIndex - 1, !document.body.classList.contains("viewer-active"));
    } else if (currentSongIndex === 0) {
      if (typeof pujianItems !== "undefined" && pujianItems.length > 0) {
        await openPdfViewer(pujianItems.length - 1, !document.body.classList.contains("viewer-active"));
      }
    }
  }
}`;

const newNext = `async function onNextSong(forceAutoplay = false) {
  if (forceAutoplay === true) {
    window._forceAutoPlayNext = true;
  }

  let mode = typeof PlaylistManager !== "undefined" ? PlaylistManager.getAutoNextMode() : "number";

  if (mode === "shuffle-playlist") {
    const activeId = PlaylistManager.getActiveId();
    if (activeId) {
      const pl = PlaylistManager.getById(activeId);
      if (pl && pl.songs.length > 0) {
        const randomIdxInPl = Math.floor(Math.random() * pl.songs.length);
        if (typeof playSongFromPlaylist === "function") {
          await playSongFromPlaylist(randomIdxInPl, !document.body.classList.contains("viewer-active"), activeId);
          return;
        }
      }
    }
    mode = "shuffle-all";
  }

  if (mode === "shuffle-all") {
    if (typeof pujianItems !== "undefined" && pujianItems.length > 0) {
      const randomIdx = Math.floor(Math.random() * pujianItems.length);
      await openPdfViewer(randomIdx, !document.body.classList.contains("viewer-active"));
      return;
    }
  }

  if (mode === "playlist") {
    const activeId = PlaylistManager.getActiveId();
    if (activeId) {
      const pl = PlaylistManager.getById(activeId);
      if (pl && typeof pujianItems !== "undefined" && currentSongIndex >= 0) {
        const currentGlobalSong = pujianItems[currentSongIndex];
        let currentIdxInPl = pl.songs.findIndex((s) => s.nomor === currentGlobalSong.nomor);

        if (currentIdxInPl < 0) {
          if (typeof showToast === "function") showToast("Lagu aktif tidak di playlist, beralih ke Sesuai Nomor", "info");
          if (typeof setNextMode === "function") setNextMode("number");
          mode = "number";
        } else if (currentIdxInPl >= 0 && currentIdxInPl < pl.songs.length - 1) {
          if (typeof playSongFromPlaylist === "function") {
            await playSongFromPlaylist(currentIdxInPl + 1, !document.body.classList.contains("viewer-active"), activeId);
            return;
          }
        } else if (currentIdxInPl === pl.songs.length - 1) {
          // Wrapped to beginning
          if (typeof playSongFromPlaylist === "function" && pl.songs.length > 0) {
            await playSongFromPlaylist(0, !document.body.classList.contains("viewer-active"), activeId);
            return;
          }
        }
      }
    }
  }

  if (mode === "number" || mode === "off" || mode === "one") {
    if (currentSongIndex < pujianItems.length - 1) {
      await openPdfViewer(currentSongIndex + 1, !document.body.classList.contains("viewer-active"));
    } else if (pujianItems && currentSongIndex === pujianItems.length - 1) {
      // Wrapped to beginning
      await openPdfViewer(0, !document.body.classList.contains("viewer-active"));
    }
  }
}`;

content = content.replace(onPrevRegex, newPrev);
content = content.replace(onNextRegex, newNext);

// Let's strip out those duplicated if (mode === "shuffle-playlist") chunks at the bottom
// They match /if \(mode === "shuffle-playlist"([^]*?)if \(mode === "number" \|\| mode === "off" \|\| mode === "one"\)/g
// But our regex above replaced onPrevSong() up to its FIRST right brace...
// Oh wait: `async function onPrevSong\([\s\S]*?\n\}` might have just matched the FIRST `}` which is inside `if (currTime > 2) { try {} catch (e) {} return; }`...

fs.writeFileSync("fix_shuffle_run.js", ""); // signal
