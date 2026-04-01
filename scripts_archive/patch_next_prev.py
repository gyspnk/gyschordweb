import re
with open('docs/js/07-pdf-viewer.js', 'r', encoding='utf-8') as f:
    text = f.read()

replacement = '''async function onPrevSong() {
  const mode = typeof PlaylistManager !== 'undefined' ? PlaylistManager.getAutoNextMode() : 'number';
  
  if (mode === 'playlist') {
    const activeId = PlaylistManager.getActiveId();
    if (activeId) {
      const pl = PlaylistManager.getById(activeId);
      if (pl && typeof pujianItems !== 'undefined' && currentSongIndex >= 0) {
        const currentGlobalSong = pujianItems[currentSongIndex];
        let currentIdxInPl = pl.songs.findIndex(s => s.nomor === currentGlobalSong.nomor);
        if (currentIdxInPl > 0) {
          if (typeof playSongFromPlaylist === 'function') {
            await playSongFromPlaylist(currentIdxInPl - 1, !document.body.classList.contains('viewer-active'), activeId);
            return;
          }
        }
      }
    }
  }

  // Fallback to normal number mode if not in playlist or reached beginning of playlist
  if (currentSongIndex > 0) {
    await openPdfViewer(currentSongIndex - 1, !document.body.classList.contains('viewer-active'));
  }
}

async function onNextSong() {
  const mode = typeof PlaylistManager !== 'undefined' ? PlaylistManager.getAutoNextMode() : 'number';

  if (mode === 'playlist') {
    const activeId = PlaylistManager.getActiveId();
    if (activeId) {
      const pl = PlaylistManager.getById(activeId);
      if (pl && typeof pujianItems !== 'undefined' && currentSongIndex >= 0) {
        const currentGlobalSong = pujianItems[currentSongIndex];
        let currentIdxInPl = pl.songs.findIndex(s => s.nomor === currentGlobalSong.nomor);
        if (currentIdxInPl >= 0 && currentIdxInPl < pl.songs.length - 1) {
          if (typeof playSongFromPlaylist === 'function') {
            await playSongFromPlaylist(currentIdxInPl + 1, !document.body.classList.contains('viewer-active'), activeId);
            return;
          }
        } else if (currentIdxInPl === pl.songs.length - 1) {
           return; // End of playlist, don't fallback to next number
        }
      }
    }
  }

  if (currentSongIndex < pujianItems.length - 1) {
    await openPdfViewer(currentSongIndex + 1, !document.body.classList.contains('viewer-active'));
  }
}'''

text = re.sub(r'async function onPrevSong\(\)\s*\{[^\}]+\}\s*\}\s*async function onNextSong\(\)\s*\{[^\}]+\}\s*\}', replacement, text)

# Just in case the regex fails, fallback script
with open('docs/js/07-pdf-viewer.js', 'w', encoding='utf-8') as f:
    f.write(text)
