import re

with open("docs/js/13-playlist-ui.js", "r", encoding="utf-8") as f:
    text = f.read()

# 1. Update playSongFromPlaylist
text = re.sub(
    r'window\.playSongFromPlaylist = async function\(songIndex\)\s*\{\s*const pl = PlaylistManager\.getById\(currentViewingPlaylistId\);\s*if \(!pl\) return;\s*// Set this playlist as active if it\'s not\s*if \(PlaylistManager\.getActiveId\(\)\s*!==\s*currentViewingPlaylistId\)\s*\{\s*PlaylistManager\.setActiveId\(currentViewingPlaylistId\);\s*\}',
    '''window.playSongFromPlaylist = async function(songIndex, isBackground = false, forcePlaylistId = null) {
  const plId = forcePlaylistId || currentViewingPlaylistId;
  const pl = PlaylistManager.getById(plId);
  if (!pl) return;

  // Set this playlist as active if it's not
  if (PlaylistManager.getActiveId() !== plId) {
    PlaylistManager.setActiveId(plId);
  }''',
    text
)

text = text.replace('await openPdfViewer(globalIdx);', 'await openPdfViewer(globalIdx.toString(), isBackground);')
text = text.replace('playSongFromPlaylist(currentIdxInPl + 1);', 'playSongFromPlaylist(currentIdxInPl + 1, true, activeId);')
text = text.replace(' • ', ' &bull; ')

text = re.sub(
    r'window\.setNextMode = function\(mode\).*?URL\.revokeObjectURL\(url\);\s*\};\n',
    '''window.setNextMode = function(mode) {
  PlaylistManager.setAutoNextMode(mode);
  const playlistBtn = document.getElementById("playlist-btn");
  if (playlistBtn && playlistBtn.classList.contains("selected")) {
    renderPlaylistList();
  }
  showToast(`Auto Next: ${mode === 'off' ? 'Mati (No Loop)' : mode === 'one' ? '1 Lagu Saja' : mode === 'number' ? 'Sesuai Nomor' : 'Sesuai Playlist'}`, "info");

  // Sync loop icons
  const globalMode = mode;
  const icons = document.querySelectorAll('#mini-loop-icon, #custom-loop-icon');
  icons.forEach(icon => {
    icon.textContent = globalMode === 'one' ? 'repeat_one' : globalMode === 'number' ? 'repeat_on' : globalMode === 'playlist' ? 'playlist_play' : 'repeat';  
    if (globalMode !== 'off') {
      icon.classList.add("loop-active");
      icon.style.color = "var(--md-sys-color-primary)";
    } else {
      icon.classList.remove("loop-active");
      icon.style.color = "";
    }
  });
};

window.exportPlaylist = function(id) {
  const data = PlaylistManager.exportPlaylist(id);
  if (!data) return;
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${data.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.json`;   
  a.click();
  URL.revokeObjectURL(url);
};
''',
    text,
    flags=re.DOTALL
)

with open("docs/js/13-playlist-ui.js", "w", encoding="utf-8") as f:
    f.write(text)
