const fs = require('fs');
const content = fs.readFileSync('docs/js/13-playlist-ui.js', 'utf-8');

let newContent = content.replace(
  /function cycleLoopMode\(\) \{[\s\S]*?else newMode = 'off';/m,
  `function cycleLoopMode() {
    const currentMode = PlaylistManager.getAutoNextMode();
    let newMode = 'off';
    if (currentMode === 'off') newMode = 'one';
    else if (currentMode === 'one') newMode = 'number';
    else if (currentMode === 'number') newMode = 'playlist';
    else if (currentMode === 'playlist') newMode = 'shuffle-all';
    else if (currentMode === 'shuffle-all') newMode = 'shuffle-playlist';
    else newMode = 'off';`
);

newContent = newContent.replace(
  /showToast\(\`Auto Next: \$\{mode === 'off' \? 'Mati \\(No Loop\\)' : mode === 'one' \? '1 Lagu Saja' : mode === 'number' \? 'Sesuai Nomor' : 'Sesuai Playlist'\}\`\, \"info\"\);/m,
  `showToast(\`Auto Next: \${mode === 'off' ? 'Mati (No Loop)' : mode === 'one' ? '1 Lagu Saja' : mode === 'number' ? 'Sesuai Nomor' : mode === 'playlist' ? 'Sesuai Playlist' : mode === 'shuffle-all' ? 'Shuffle Semua' : 'Shuffle Playlist'}\`, "info");`
);

newContent = newContent.replace(
  /icon\.textContent = globalMode === 'one' \? 'repeat_one' : globalMode === 'number' \? 'repeat_on' : globalMode === 'playlist' \? 'playlist_play' : 'repeat';/m,
  `icon.textContent = globalMode === 'one' ? 'repeat_one' : globalMode === 'number' ? 'repeat_on' : globalMode === 'playlist' ? 'playlist_play' : (globalMode === 'shuffle-all' || globalMode === 'shuffle-playlist') ? 'shuffle' : 'repeat';`
);

newContent = newContent.replace(
  /window\._playlistCheckAutoNext = function\(\) \{[\s\S]*?return false;\n\}/m,
  `window._playlistCheckAutoNext = function() {
  const mode = PlaylistManager.getAutoNextMode();
  if (mode === 'off' || mode === 'one') return false;

  if (typeof onNextSong === 'function') {
     window._forceAutoPlayNext = true;
     onNextSong(true);
     return true;
  }
  return false;
}`
);

newContent = newContent.replace(
  /let subtitleText = "Tidak ada antrean";[\s\S]*?\} else if \(mode === 'off'\) \{/m,
  `let subtitleText = "Tidak ada antrean";

    if (mode === 'one') {
      subtitleText = "Single Loop Mode";
    } else if (mode === 'shuffle-all') {
      subtitleText = "Shuffle Semua Lagu";
    } else if (mode === 'off') {`
);

newContent = newContent.replace(
  /icon\.textContent = mode === 'off' \? 'repeat' : mode === 'number' \? 'repeat_on' : 'playlist_play';/m,
  `icon.textContent = mode === 'off' ? 'repeat' : mode === 'number' ? 'repeat_on' : (mode === 'shuffle-all' || mode === 'shuffle-playlist') ? 'shuffle' : 'playlist_play';`
);

// Add missing playlist visibility logic in syncAutoNextMenu
newContent = newContent.replace(
  /if \(mode === 'playlist' && plWrapper && plSelect\) \{/m,
  `if ((mode === 'playlist' || mode === 'shuffle-playlist') && plWrapper && plSelect) {`
);

newContent = newContent.replace(
  /\} else if \(mode === 'playlist'\) \{/m,
  `} else if (mode === 'playlist' || mode === 'shuffle-playlist') {`
);

fs.writeFileSync('docs/js/13-playlist-ui.js', newContent, 'utf-8');
console.log('13-playlist-ui updated successfully!');