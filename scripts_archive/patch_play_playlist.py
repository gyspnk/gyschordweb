import re
with open('docs/js/13-playlist-ui.js', 'r', encoding='utf-8') as f:
    text = f.read()

text = text.replace(
    '''window.playSongFromPlaylist = async function(songIndex, isBackground = false) {
  const pl = PlaylistManager.getById(currentViewingPlaylistId);
  if (!pl) return;

  // Set this playlist as active if it's not
  if (PlaylistManager.getActiveId() !== currentViewingPlaylistId) {
    PlaylistManager.setActiveId(currentViewingPlaylistId);
  }''',
    '''window.playSongFromPlaylist = async function(songIndex, isBackground = false, forcePlaylistId = null) {
  const plId = forcePlaylistId || currentViewingPlaylistId;
  const pl = PlaylistManager.getById(plId);
  if (!pl) return;

  // Set this playlist as active if it's not
  if (PlaylistManager.getActiveId() !== plId) {
    PlaylistManager.setActiveId(plId);
  }'''
)

text = text.replace(
    "playSongFromPlaylist(currentIdxInPl + 1, !document.body.classList.contains('viewer-active'));",
    "playSongFromPlaylist(currentIdxInPl + 1, !document.body.classList.contains('viewer-active'), activeId);"
)

with open('docs/js/13-playlist-ui.js', 'w', encoding='utf-8') as f:
    f.write(text)
