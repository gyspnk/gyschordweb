// --- 13. Playlist UI ---
// Handles the Playlist tab, adding/removing songs, and the Mini Player.

// -- Globals
let currentPlaylistView = 'list'; // 'list' | 'detail'
let currentViewingPlaylistId = null;

// -- Run on load
document.addEventListener('DOMContentLoaded', () => {
  const playlistBtn = document.getElementById('playlist-btn');
  if (playlistBtn) {
    playlistBtn.addEventListener('click', () => {
      // If already on playlist tab, go back to main list view
      if (document.querySelector('.app-header').style.display === "flex" &&
          playlistBtn.classList.contains('selected')) {
        currentPlaylistView = 'list';
      }
      navigateTo('playlist');
    });
  }

  // Setup Mini Player listeners
  const miniPlayBtn = document.getElementById('mini-play-btn');
  const miniPrevBtn = document.getElementById('mini-prev-btn');
  const miniNextBtn = document.getElementById('mini-next-btn');

  if (miniPlayBtn) {
    miniPlayBtn.addEventListener('click', () => {
      // Call toggleMidiPlayback directly so the click runs in a real user gesture context
      // (using customPlayBtn.click() is a synthetic event that can't resume AudioContext)
      if (typeof window.toggleMidiPlayback === 'function') {
        window.toggleMidiPlayback();
      }
    });
  }
  if (miniPrevBtn) {
    miniPrevBtn.addEventListener('click', () => {
      onPrevSong(true, true);
    });
  }
  if (miniNextBtn) {
    miniNextBtn.addEventListener('click', () => {
      onNextSong(true); // This will be intercepted if auto-next playlist is active
    });
  }

  // Mini player title: tap to open PDF viewer for current song
  const miniPlayerInfo = document.querySelector('.mini-player-info');
  if (miniPlayerInfo) {
    miniPlayerInfo.addEventListener('click', () => {
      if (typeof currentSongIndex !== 'undefined' && currentSongIndex >= 0 && typeof openPdfViewer === 'function') {
        openPdfViewer(currentSongIndex);
      }
    });
  }

  // Monitor Pujian list clicks for "Add to playlist"
  if (mainContent) {
    mainContent.addEventListener('click', (e) => {
      const addBtn = e.target.closest('.add-to-playlist-btn');
      if (addBtn) {
        e.preventDefault();
        e.stopPropagation();
        
        const li = addBtn.closest('li');
        if (!li) return;
        
        const songId = parseInt(li.dataset.id, 10);
        let songData = null;
        if (typeof pujianItems !== 'undefined') {
          const globalSong = pujianItems.find(p => p.id === songId);
          if (globalSong) {
            songData = {
              nomor: globalSong.nomor,
              judul: globalSong.judul,
              fileHref: globalSong.fileHref
            };
          }
        }
        
        // Fallback if not found
        if (!songData) {
          songData = {
            nomor: li.dataset.nomor,
            judul: li.dataset.judul,
            fileHref: li.querySelector('a').getAttribute('href')
          };
        }
        
        // Find default or active playlist
        const playlists = PlaylistManager.getAll();
        if (playlists.length === 0) {
          PlaylistManager.create("Playlistku");
        }
        
        // Add to active, or first if none active
        let targetId = PlaylistManager.getActiveId();
        if (!targetId || !PlaylistManager.getById(targetId)) {
          targetId = PlaylistManager.getAll()[0].id;
        }
        
        const added = PlaylistManager.addSong(targetId, songData);
        if (added) {
          showToast("Ditambahkan ke playlist", "playlist_add_check");
        } else {
          showToast("Lagu sudah ada di playlist", "info");
        }
        updatePlaylistIndicators();
      }
    });
  }
  
  
  // Setup Auto-Next PDF Viewer Toggle
  const autoNextBtn = document.getElementById('autonext-btn');
  const autoNextMenu = document.getElementById('autonext-menu');
  const autoNextModeSelect = document.getElementById('autonext-mode-select');
  const autoNextPlaylistSelect = document.getElementById('autonext-playlist-select');
  const autoNextPlaylistWrapper = document.getElementById('autonext-playlist-select-wrapper');

  const customLoopBtn = document.getElementById('custom-loop-btn');
  const miniLoopBtn = document.getElementById('mini-loop-btn');
  
  function cycleLoopMode() {
    const currentMode = PlaylistManager.getAutoNextMode();
    let newMode = 'off';
    if (currentMode === 'off') newMode = 'one';
    else if (currentMode === 'one') newMode = 'number';
    else if (currentMode === 'number') newMode = 'playlist';
    else if (currentMode === 'playlist') newMode = 'shuffle-all';
    else if (currentMode === 'shuffle-all') newMode = 'shuffle-playlist';
    else newMode = 'off';
    
    // Update the dropdown if it's there
    if (autoNextModeSelect) {
      autoNextModeSelect.value = newMode;
      // trigger change event so the dropdown sync triggers
      autoNextModeSelect.dispatchEvent(new Event('change'));
    } else {
      // Just manually update it
      window.setNextMode(newMode);
    }
  }

  if (customLoopBtn) customLoopBtn.addEventListener('click', cycleLoopMode);
  if (miniLoopBtn) miniLoopBtn.addEventListener('click', cycleLoopMode);

  
  if (autoNextBtn && autoNextMenu) {
    autoNextBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isExpanded = autoNextBtn.getAttribute("aria-expanded") === "true";
      
      // Close instrument popover if open
      const instMenu = document.getElementById("cis-menu");
      if (instMenu) instMenu.style.display = "none";
      const instBtn = document.getElementById("custom-instrument-select");
      if (instBtn) instBtn.setAttribute("aria-expanded", "false");
      
      if (isExpanded) {
        autoNextMenu.style.display = "none";
        autoNextBtn.setAttribute("aria-expanded", "false");
      } else {
        // Sync values before opening
        syncAutoNextMenu();
        
        autoNextMenu.style.display = "block";
        autoNextBtn.setAttribute("aria-expanded", "true");
      }
    });
    
    // Mode changing
    if (autoNextModeSelect) {
      autoNextModeSelect.addEventListener('change', (e) => {
        setNextMode(e.target.value);
        syncAutoNextMenu();
      });
    }
    
    // Active playlist changing
    if (autoNextPlaylistSelect) {
      autoNextPlaylistSelect.addEventListener('change', (e) => {
        PlaylistManager.setActiveId(e.target.value);
        if (typeof renderPlaylistList === 'function' && document.getElementById('playlist-btn')?.classList.contains('selected')) {
           renderPlaylistList();
        }
      });
    }
    
    // Click outside to close
    document.addEventListener("click", (e) => {
      if (!autoNextBtn.contains(e.target) && !autoNextMenu.contains(e.target)) {
        autoNextMenu.style.display = "none";
        autoNextBtn.setAttribute("aria-expanded", "false");
      }
    });
  }

  // Sync Mini Player on interval
  setInterval(syncMiniPlayerUI, 500);

  // Collapsible extras row: auto-collapse when mini-player is narrow
  const miniPlayerContainer = document.getElementById('mini-player');
  const miniExtrasToggle = document.getElementById('mini-extras-toggle');
  if (miniPlayerContainer && miniExtrasToggle) {
    let userExpandedExtras = false;

    miniExtrasToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      if (miniPlayerContainer.classList.contains('is-extras-expanded')) {
        // User is collapsing
        miniPlayerContainer.classList.remove('is-extras-expanded');
        userExpandedExtras = false;
      } else {
        // User is expanding
        miniPlayerContainer.classList.add('is-extras-expanded');
        userExpandedExtras = true;
      }
    });

    // Use ResizeObserver to detect when the mini-player extras don't fit
    if (typeof ResizeObserver !== 'undefined') {
      const extrasRow = miniPlayerContainer.querySelector('.mini-player-extras');
      const extrasObserver = new ResizeObserver(() => {
        if (!extrasRow) return;
        const containerWidth = miniPlayerContainer.clientWidth - 32; // account for padding
        // Measure actual content width needed: sum of all children's natural widths + gaps
        let requiredWidth = 0;
        const gap = 6; // matches CSS gap
        const children = extrasRow.children;
        for (let i = 0; i < children.length; i++) {
          requiredWidth += children[i].scrollWidth;
          if (i > 0) requiredWidth += gap;
        }

        if (containerWidth > 0 && requiredWidth > containerWidth) {
          if (!miniPlayerContainer.classList.contains('is-extras-collapsed')) {
            miniPlayerContainer.classList.add('is-extras-collapsed');
            userExpandedExtras = false;
            miniPlayerContainer.classList.remove('is-extras-expanded');
          }
        } else {
          miniPlayerContainer.classList.remove('is-extras-collapsed');
          miniPlayerContainer.classList.remove('is-extras-expanded');
          userExpandedExtras = false;
        }
      });
      extrasObserver.observe(miniPlayerContainer);
    }
  }

  // Add interactive javascript animations to all mini player buttons
  if (miniPlayerContainer) {
    const miniBtns = miniPlayerContainer.querySelectorAll('button');
    miniBtns.forEach(btn => {
      btn.addEventListener('click', function(e) {
        // Javascript scale & pop animation
        this.animate([
          { transform: 'scale(1)', filter: 'brightness(1)' },
          { transform: 'scale(0.8)', filter: 'brightness(1.5)' },
          { transform: 'scale(1.15)', filter: 'brightness(1.2)' },
          { transform: 'scale(1)', filter: 'brightness(1)' }
        ], {
          duration: 350,
          easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)'
        });
        
        // Optional ripple effect
        const circle = document.createElement('div');
        const diameter = Math.max(btn.clientWidth, btn.clientHeight);
        const radius = diameter / 2;
        
        // Handle coordinates whether clicked by mouse or triggered programmatically
        let x, y;
        if (e.clientX && e.clientY) {
            const rect = btn.getBoundingClientRect();
            x = e.clientX - rect.left - radius;
            y = e.clientY - rect.top - radius;
        } else {
            x = 0; y = 0;
        }

        circle.style.width = circle.style.height = `${diameter}px`;
        circle.style.left = `${x}px`;
        circle.style.top = `${y}px`;
        circle.style.position = 'absolute';
        circle.style.borderRadius = '50%';
        circle.style.background = 'rgba(255, 255, 255, 0.4)';
        circle.style.transform = 'scale(0)';
        circle.style.pointerEvents = 'none';
        
        btn.style.position = 'relative';
        btn.style.overflow = 'hidden';
        
        const existingRipple = btn.querySelector('.btn-ripple');
        if (existingRipple) existingRipple.remove(); // clear old
        
        circle.classList.add('btn-ripple');
        btn.appendChild(circle);
        
        circle.animate([
          { transform: 'scale(0)', opacity: 1 },
          { transform: 'scale(2.5)', opacity: 0 }
        ], {
          duration: 400,
          easing: 'ease-out'
        }).onfinish = () => circle.remove();
      });
    });
  }
});

function syncAutoNextMenu() {
  const mode = PlaylistManager.getAutoNextMode();
  const select = document.getElementById('autonext-mode-select');
  const plWrapper = document.getElementById('autonext-playlist-select-wrapper');
  const plSelect = document.getElementById('autonext-playlist-select');
  const icon = document.getElementById('autonext-icon');
  
  if (icon) {
    icon.textContent = mode === 'off' ? 'repeat' : mode === 'number' ? 'repeat_on' : (mode === 'shuffle-all' || mode === 'shuffle-playlist') ? 'shuffle' : 'playlist_play';
  }
  
  if (select) {
    select.value = mode;
  }
  
  if ((mode === 'playlist' || mode === 'shuffle-playlist') && plWrapper && plSelect) {
    plWrapper.style.display = 'block';
    
    const playlists = PlaylistManager.getAll();
    if (playlists.length === 0) {
      plSelect.innerHTML = '<option value="">(Belum ada playlist)</option>';
    } else {
      const activeId = PlaylistManager.getActiveId();
      plSelect.innerHTML = playlists.map(pl => 
        `<option value="${pl.id}" ${pl.id === activeId ? 'selected' : ''}>${pl.name}</option>`
      ).join('');
    }
  } else if (plWrapper) {
    plWrapper.style.display = 'none';
  }
}


function updatePlaylistIndicators() {
  const allBtns = document.querySelectorAll('.add-to-playlist-btn');
  allBtns.forEach(btn => {
    const li = btn.closest('li');
    if (li && li.dataset.nomor) {
      const lists = PlaylistManager.getPlaylistsContainingSong(li.dataset.nomor);
      if (lists.length > 0) {
        btn.classList.add('in-playlist');
        btn.querySelector('.material-symbols-outlined').textContent = "playlist_add_check";
      } else {
        btn.classList.remove('in-playlist');
        btn.querySelector('.material-symbols-outlined').textContent = "playlist_add";
      }
    }
  });
}



// --- Mini Player UI ---
function syncMiniPlayerUI() {
  const miniPlayer = document.getElementById('mini-player');
  const miniTitle = document.getElementById('mini-title');
  const miniSubtitle = document.getElementById('mini-subtitle');
  const miniPlayIcon = document.getElementById('mini-play-icon');
  
  if (!miniPlayer || !miniTitle) return;

  // Show only if a song is loaded (MidiTimeAuthority has a known duration)
  const dur = typeof MidiTimeAuthority !== 'undefined' ? (MidiTimeAuthority.getDuration() || window._midiKnownDuration || 0) : (window._midiKnownDuration || 0);
  const inViewer = document.body.classList.contains('viewer-active');
  const hasSong = document.getElementById('pdf-viewer-title')?.textContent;
  
  // Also show if we are not in viewer but playing
  const isPlaying = typeof MidiTimeAuthority !== 'undefined' ? MidiTimeAuthority._playing : false;
  
  const inSettings = (document.getElementById('pengaturan-btn')?.classList.contains('selected') || 
    document.querySelector('.report-page') !== null ||
    document.querySelector('.settings-panel') !== null);
  const appContent = document.getElementById('main-content');
  if (inViewer || inSettings) {
    miniPlayer.classList.add('is-hidden');
    if (appContent) appContent.classList.remove('has-mini-player');
  } else if (dur > 0 || isPlaying) {
    miniPlayer.classList.remove('is-hidden');
    if (appContent) appContent.classList.add('has-mini-player');
    miniTitle.textContent = document.getElementById('pdf-viewer-title')?.textContent || 'Lagu';
    
    // Subtitle logic
    const mode = PlaylistManager.getAutoNextMode();
    let subtitleText = "Tidak ada antrean";

    if (mode === 'one') {
      subtitleText = "Single Loop Mode";
    } else if (mode === 'shuffle-all') {
      subtitleText = "Shuffle Semua Lagu";
    } else if (mode === 'off') {
      subtitleText = "Mode Loop Mati";
    } else if (typeof pujianItems !== 'undefined' && typeof currentSongIndex !== 'undefined' && currentSongIndex >= 0) {
      if (mode === 'playlist') {
        const pId = PlaylistManager.getActiveId();
        const p = PlaylistManager.getById(pId);
        if (p && p.songs && p.songs.length > 0) {
          const currentGlobalSong = pujianItems[currentSongIndex];
          let currentIdxInPl = p.songs.findIndex(s => s.nomor === currentGlobalSong.nomor);
          if (currentIdxInPl >= 0 && currentIdxInPl < p.songs.length - 1) {
            const nextSong = p.songs[currentIdxInPl + 1];
            subtitleText = `${p.name}: ${nextSong.judul}`;
          } else {
            subtitleText = `${p.name}: Selesai`;
          }
        } else {
          subtitleText = "Auto Next: Playlist";
        }
      } else if (mode === 'number') {
        if (currentSongIndex < pujianItems.length - 1) {
           const nextSong = pujianItems[currentSongIndex + 1];
           subtitleText = `Berikutnya: ${nextSong.judul}`;
        } else {
           subtitleText = "Selesai (Akhir Daftar)";
        }
      }
    }
    
    miniSubtitle.textContent = subtitleText;
    
    if (miniPlayIcon) {
       miniPlayIcon.textContent = isPlaying ? "pause" : "play_arrow";
    }
  } else {
    miniPlayer.classList.add('is-hidden');
    if (appContent) appContent.classList.remove('has-mini-player');
  }
}

// --- Playlist Tab Renderers ---
function renderPlaylistView() {
  if (currentPlaylistView === 'detail' && currentViewingPlaylistId) {
    renderPlaylistDetail(currentViewingPlaylistId);
  } else {
    renderPlaylistList();
  }
}

function renderPlaylistList() {
  const playlists = PlaylistManager.getAll();
  const activeId = PlaylistManager.getActiveId();
  const mode = PlaylistManager.getAutoNextMode();
  
  let html = `
    <div class="playlist-view-container">
      <div class="playlist-header-actions">
        <h2 style="margin: 0;">Playlist Anda</h2>
        <button class="icon-button" id="create-playlist-btn" aria-label="Buat Playlist">
          <span class="material-symbols-outlined">add</span>
        </button>
      </div>
      
      <div class="playlist-autonext-panel">
         <h3>Mode Lanjut Otomatis (Auto Next)</h3>
         <div class="playlist-mode-grid">
            <button class="playlist-mode-btn ${mode==='off'?'selected':''}" onclick="setNextMode('off')">Mati</button>
            <button class="playlist-mode-btn ${mode==='one'?'selected':''}" onclick="setNextMode('one')">1 Lagu</button>
            <button class="playlist-mode-btn ${mode==='number'?'selected':''}" onclick="setNextMode('number')">Nomor</button>
            <button class="playlist-mode-btn ${mode==='playlist'?'selected':''}" onclick="setNextMode('playlist')">Playlist</button>
            <button class="playlist-mode-btn ${mode==='shuffle-all'?'selected':''}" onclick="setNextMode('shuffle-all')">Shuffle</button>
            <button class="playlist-mode-btn ${mode==='shuffle-playlist'?'selected':''}" onclick="setNextMode('shuffle-playlist')">Shuffle PL</button>
         </div>
      </div>
  `;
  
  if (playlists.length === 0) {
    html += `
      <div class="playlist-empty-state">
        <span class="material-symbols-outlined">queue_music</span>
        <p>Anda belum memiliki playlist.</p>
        <button id="create-first-playlist" class="playlist-create-btn">
          Buat Playlist Sekarang
        </button>
      </div>
    `;
  } else {
    playlists.forEach(pl => {
      const isActive = pl.id === activeId;
      html += `
        <div class="playlist-card" onclick="openPlaylistDetail('${pl.id}')">
          <div class="playlist-card-info">
            <div class="playlist-card-title">${pl.name}</div>
            <div class="playlist-card-meta">${pl.songs.length} lagu ${isActive ? ' &bull; <b>Aktif</b>' : ''}</div>
          </div>
          <div class="playlist-card-actions">
            ${isActive ? `
               <span class="material-symbols-outlined" style="color: var(--md-sys-color-primary);">check_circle</span>
            ` : `
               <button class="icon-button" onclick="event.stopPropagation(); PlaylistManager.setActiveId('${pl.id}'); renderPlaylistList(); showToast('Diatur sebagai playlist aktif', 'done');" title="Jadikan aktif">
                 <span class="material-symbols-outlined">play_circle</span>
               </button>
            `}
            <button class="icon-button" onclick="event.stopPropagation(); downloadPlaylist('${pl.id}')" title="Unduh Playlist">
              <span class="material-symbols-outlined">download</span>
            </button>
          </div>
        </div>
      `;
    });
  }

  html += `
     <div class="playlist-import-section">
        <button class="playlist-import-btn" id="import-playlist-btn">
          <span class="material-symbols-outlined">upload</span> Impor Playlist (.json)
        </button>
        <input type="file" id="import-playlist-input" accept=".json" style="display:none;">
     </div>
  </div>`;

  mainContent.innerHTML = html;

  // Listeners
  const createBtns = document.querySelectorAll('#create-playlist-btn, #create-first-playlist');
  createBtns.forEach(btn => btn.addEventListener('click', () => {
    const name = prompt("Nama Playlist:");
    if (name) {
      PlaylistManager.create(name);
      renderPlaylistList();
    }
  }));

  const importBtn = document.getElementById('import-playlist-btn');
  const importInput = document.getElementById('import-playlist-input');
  if (importBtn && importInput) {
    importBtn.addEventListener('click', () => importInput.click());
    importInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const data = JSON.parse(ev.target.result);
          const pl = PlaylistManager.importPlaylist(data);
          if (pl) {
            showToast("Playlist berhasil diimpor", "done");
            renderPlaylistList();
          } else {
            showToast("Format file tidak valid", "error");
          }
        } catch {
          showToast("Gagal membaca file", "error");
        }
      };
      reader.readAsText(file);
    });
  }
}

function openPlaylistDetail(id) {
  currentViewingPlaylistId = id;
  currentPlaylistView = 'detail';
  renderPlaylistDetail(id);
}

function renderPlaylistDetail(id) {
  const pl = PlaylistManager.getById(id);
  if (!pl) {
    currentPlaylistView = 'list';
    renderPlaylistList();
    return;
  }

  let html = `
    <div class="playlist-view-container">
      <div class="playlist-header-actions" style="margin-bottom: 1.5rem;">
        <button class="icon-button" onclick="currentPlaylistView='list'; renderPlaylistList();" aria-label="Kembali">
          <span class="material-symbols-outlined">arrow_back</span>
        </button>
        <h2 style="margin: 0; flex:1; text-align:center;">${pl.name}</h2>
        <div style="display:flex; gap: 4px;">
           <button class="icon-button" onclick="renameCurrentPlaylist()" aria-label="Ganti Nama" title="Ganti Nama">
             <span class="material-symbols-outlined">edit</span>
           </button>
           <button class="icon-button" onclick="deleteCurrentPlaylist()" aria-label="Hapus" title="Hapus Playlist" style="color:var(--md-sys-color-error)">
             <span class="material-symbols-outlined">delete</span>
           </button>
        </div>
      </div>
  `;

  if (pl.songs.length === 0) {
    html += `
      <div class="playlist-empty-state">
        <p>Belum ada lagu di playlist ini.</p>
        <p style="font-size: 14px;">Tambahkan lagu dari tab Pujian.</p>
      </div>
    `;
  } else {
    const items = [];
    items.push(`<ul class="pujian-list" id="playlist-track-list">`);
    pl.songs.forEach((song, idx) => {
      items.push(`
        <li class="playlist-track-item">
          <div class="playlist-track-info" onclick="playSongFromPlaylist(${idx})">
            <div class="playlist-track-nomor">No. ${song.nomor}</div>
            <div class="playlist-track-judul">${song.judul}</div>
          </div>
          <div class="playlist-track-reorder">
             ${idx > 0 ? `<button class="icon-button" onclick="PlaylistManager.moveSong('${id}', ${idx}, ${idx-1}); renderPlaylistDetail('${id}')"><span class="material-symbols-outlined">keyboard_arrow_up</span></button>` : ''}
             ${idx < pl.songs.length - 1 ? `<button class="icon-button" onclick="PlaylistManager.moveSong('${id}', ${idx}, ${idx+1}); renderPlaylistDetail('${id}')"><span class="material-symbols-outlined">keyboard_arrow_down</span></button>` : ''}
          </div>
          <button class="icon-button" style="margin-left: 8px; color:var(--md-sys-color-error);" onclick="PlaylistManager.removeSong('${id}', ${idx}); renderPlaylistDetail('${id}'); updatePlaylistIndicators();" title="Hapus Lagu">
             <span class="material-symbols-outlined">close</span>
          </button>
        </li>
      `);
    });
    items.push(`</ul>`);
    html += items.join('');
  }

  html += `</div>`;
  mainContent.innerHTML = html;
}

// Helpers called from HTML strings
window.setNextMode = function(mode) {
  PlaylistManager.setAutoNextMode(mode);

  // Update mode buttons in-place instead of re-rendering the whole playlist view
  document.querySelectorAll('.playlist-mode-btn').forEach(function(btn) {
    const btnMode = btn.getAttribute('onclick');
    // Extract the mode from onclick="setNextMode('xxx')"
    const match = btnMode && btnMode.match(/setNextMode\(['"]([^'"]+)['"]\)/);
    if (match) {
      const isSelected = match[1] === mode;
      btn.classList.toggle('selected', isSelected);
      // Animate the newly selected button
      if (isSelected) {
        btn.animate([
          { transform: 'scale(0.92)', opacity: 0.7 },
          { transform: 'scale(1.06)', opacity: 1 },
          { transform: 'scale(1)', opacity: 1 }
        ], { duration: 250, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' });
      }
    }
  });

  showToast(`Auto Next: ${mode === 'off' ? 'Mati (No Loop)' : mode === 'one' ? '1 Lagu Saja' : mode === 'number' ? 'Sesuai Nomor' : mode === 'playlist' ? 'Sesuai Playlist' : mode === 'shuffle-all' ? 'Acak Semua' : 'Acak Playlist'}`, "info");

  // Sync loop icons with animation
  const icons = document.querySelectorAll('#mini-loop-icon, #custom-loop-icon');
  icons.forEach(icon => {
    const newIcon = mode === 'one' ? 'repeat_one' : mode === 'number' ? 'repeat_on' : mode === 'playlist' ? 'playlist_play' : (mode === 'shuffle-all' || mode === 'shuffle-playlist') ? 'shuffle' : 'repeat';
    if (icon.textContent !== newIcon) {
      icon.animate([
        { transform: 'scale(1) rotate(0deg)', opacity: 1 },
        { transform: 'scale(0.5) rotate(-90deg)', opacity: 0 },
      ], { duration: 120, easing: 'ease-in', fill: 'forwards' }).onfinish = function() {
        icon.textContent = newIcon;
        icon.animate([
          { transform: 'scale(0.5) rotate(90deg)', opacity: 0 },
          { transform: 'scale(1.15) rotate(0deg)', opacity: 1 },
          { transform: 'scale(1) rotate(0deg)', opacity: 1 }
        ], { duration: 200, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' });
      };
    }
    if (mode !== 'off') {
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

window.renameCurrentPlaylist = function() {
  const pl = PlaylistManager.getById(currentViewingPlaylistId);
  if (!pl) return;
  const newName = prompt("Nama Playlist Baru:", pl.name);
  if (newName && newName !== pl.name) {
    PlaylistManager.rename(currentViewingPlaylistId, newName);
    renderPlaylistDetail(currentViewingPlaylistId);
  }
};

window.deleteCurrentPlaylist = function() {
  if (confirm("Hapus playlist ini?")) {
    PlaylistManager.delete(currentViewingPlaylistId);
    currentPlaylistView = 'list';
    renderPlaylistList();
    updatePlaylistIndicators();
  }
};

// Play a specific song from a playlist and set it as active
window.playSongFromPlaylist = async function(songIndex, isBackground = false, forcePlaylistId = null) {
  const plId = forcePlaylistId || currentViewingPlaylistId;
  const pl = PlaylistManager.getById(plId);
  if (!pl) return;

  // Set this playlist as active if it's not
  if (PlaylistManager.getActiveId() !== plId) {
    PlaylistManager.setActiveId(plId);
  }
  
  const targetSong = pl.songs[songIndex];
  if (!targetSong) return;

  // We need to find its true global index in pujianItems
  if (typeof pujianItems !== 'undefined') {
    const globalIdx = pujianItems.findIndex(p => p.nomor === targetSong.nomor);
    if (globalIdx >= 0) {
      if (typeof openPdfViewer === 'function') {
        await openPdfViewer(globalIdx.toString(), isBackground);
      }
    } else {
      showToast("Lagu tidak ditemukan di direktori utama", "error");
    }
  }
};

// --- Intercept Playback Auto-Next ---
// This hooks into the end of song detection in 05-events.js
// If we intercept it properly, we can trigger the next song automatically.

window._playlistCheckAutoNext = function() {
  const mode = PlaylistManager.getAutoNextMode();
  if (mode === 'off') return false;
  
  if (mode === 'number') {
    // Next song by global index
    if (typeof onNextSong === 'function') {
       window._forceAutoPlayNext = true;
       onNextSong();
       return true;
    }
  }

  if (mode === 'shuffle-all') {
    // Shuffle from all songs
    if (typeof pujianItems !== 'undefined' && pujianItems.length > 1) {
      let randomIdx;
      do {
        randomIdx = Math.floor(Math.random() * pujianItems.length);
      } while (randomIdx === currentSongIndex && pujianItems.length > 1);
      window._forceAutoPlayNext = true;
      if (typeof openPdfViewer === 'function') openPdfViewer(randomIdx.toString());
      return true;
    }
  }

  if (mode === 'playlist' || mode === 'shuffle-playlist') {
    const activeId = PlaylistManager.getActiveId();
    if (!activeId) return false;

    const pl = PlaylistManager.getById(activeId);
    if (!pl || pl.songs.length === 0) return false;

    if (typeof pujianItems !== 'undefined' && typeof currentSongIndex !== 'undefined') {
      const currentGlobalSong = pujianItems[currentSongIndex];
      if (currentGlobalSong) {
        let currentIdxInPl = pl.songs.findIndex(s => s.nomor === currentGlobalSong.nomor);
        
        if (mode === 'shuffle-playlist') {
          // Shuffle within playlist
          let randomPlIdx;
          do {
            randomPlIdx = Math.floor(Math.random() * pl.songs.length);
          } while (randomPlIdx === currentIdxInPl && pl.songs.length > 1);
          window._forceAutoPlayNext = true;
          playSongFromPlaylist(randomPlIdx, false, activeId);
          return true;
        }
        
        // Sequential playlist mode
        if (currentIdxInPl >= 0 && currentIdxInPl < pl.songs.length - 1) {
          window._forceAutoPlayNext = true;
          playSongFromPlaylist(currentIdxInPl + 1, false, activeId);
          return true;
        } else {
          // End of playlist — loop back to start
          window._forceAutoPlayNext = true;
          playSongFromPlaylist(0, false, activeId);
          showToast("Playlist diulang dari awal", "replay");
          return true;
        }
      }
    }
  }
  
  return false;
}

