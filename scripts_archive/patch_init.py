import re

with open("docs/js/07-pdf-viewer.js", "r", encoding="utf-8") as f:
    text = f.read()

# Add saving to localStorage when openPdfViewer is called
replacement = r"""async function openPdfViewer(songId, backgroundLoad = false) {
  currentSongIndex = parseInt(songId, 10);
  localStorage.setItem('GysLastPlayedSongIndex', currentSongIndex);
  const song = pujianItems[currentSongIndex];"""
text = re.sub(r"async function openPdfViewer\(songId, backgroundLoad = false\) \{\s*currentSongIndex = parseInt\(songId, 10\);\s*const song = pujianItems\[currentSongIndex\];", replacement, text)

with open("docs/js/07-pdf-viewer.js", "w", encoding="utf-8") as f:
    f.write(text)
