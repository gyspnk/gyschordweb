const fs = require('fs');
let c = fs.readFileSync('docs/js/07-pdf-viewer.js', 'utf-8');

c = c.replace(
  /if \(mode === "number" \|\| mode === "off" \|\| mode === "one"\) \{\s*if \(currentSongIndex > 0\) \{/m,
  `if (mode === "shuffle-playlist") {
      const activeId = PlaylistManager.getActiveId();
      if (activeId) {
        const pl = PlaylistManager.getById(activeId);
        if (pl && pl.songs.length > 0) {
          const randomIdxInPl = Math.floor(Math.random() * pl.songs.length);
          if (typeof playSongFromPlaylist === "function") {
            await playSongFromPlaylist(
              randomIdxInPl,
              !document.body.classList.contains("viewer-active"),
              activeId
            );
            return;
          }
        }
      }
      mode = "shuffle-all";
    }

    if (mode === "shuffle-all") {
      if (typeof pujianItems !== "undefined" && pujianItems.length > 0) {
        const randomIdx = Math.floor(Math.random() * pujianItems.length);
        await openPdfViewer(
          randomIdx,
          !document.body.classList.contains("viewer-active")
        );
        return;
      }
    }

    if (mode === "number" || mode === "off" || mode === "one") {
      if (currentSongIndex > 0) {`
);

fs.writeFileSync('docs/js/07-pdf-viewer.js', c);
console.log('patched prev song');