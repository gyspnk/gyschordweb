const fs = require('fs');
let c = fs.readFileSync('docs/js/13-playlist-ui.js', 'utf-8');

c = c.replace(
  /<button class="nav-btn \$\{mode==='playlist'\?'selected':''\}"(.+?)>Sesuai Playlist<\/button>/m,
  `<button class="nav-btn \${mode==='playlist'?'selected':''}"$1>Sesuai Playlist</button>
            <button class="nav-btn \${mode==='shuffle-all'?'selected':''}" style="flex:1; border-radius: 8px; background: var(--md-sys-color-surface-container-high)" onclick="setNextMode('shuffle-all')">Shuffle Semua</button>
            <button class="nav-btn \${mode==='shuffle-playlist'?'selected':''}" style="flex:1; border-radius: 8px; background: var(--md-sys-color-surface-container-high)" onclick="setNextMode('shuffle-playlist')">Shuffle Playlist</button>`
);

fs.writeFileSync('docs/js/13-playlist-ui.js', c);
console.log('patched');