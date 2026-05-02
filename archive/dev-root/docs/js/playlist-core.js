/* Auto-merged runtime source. Legacy split snapshot archived under archive/docs-js/legacy. */

/* SOURCE: 12-playlist.js */
// --- 12. Playlist Manager ---
// Manages playlists stored in localStorage. Each playlist has an id, name, and songs array.

const PLAYLIST_STORAGE_KEY = "kidung_playlists";
const PLAYLIST_ACTIVE_KEY = "kidung_active_playlist";
const PLAYLIST_AUTONEXT_KEY = "kidung_autonext_mode";

const PlaylistManager = {
  /**
   * Get all playlists from localStorage.
   * @returns {Array} Array of playlist objects
   */
  getAll() {
    try {
      return JSON.parse(localStorage.getItem(PLAYLIST_STORAGE_KEY)) || [];
    } catch {
      return [];
    }
  },

  /**
   * Save all playlists to localStorage.
   */
  _save(playlists) {
    localStorage.setItem(PLAYLIST_STORAGE_KEY, JSON.stringify(playlists));
  },

  /**
   * Create a new playlist.
   * @param {string} name - Playlist name
   * @returns {object} The created playlist
   */
  create(name) {
    const playlists = this.getAll();
    const playlist = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      name: name || "Playlist Baru",
      songs: [],
      createdAt: Date.now(),
    };
    playlists.push(playlist);
    this._save(playlists);
    return playlist;
  },

  /**
   * Get a playlist by id.
   */
  getById(id) {
    return this.getAll().find((p) => p.id === id) || null;
  },

  /**
   * Delete a playlist by id.
   */
  delete(id) {
    const playlists = this.getAll().filter((p) => p.id !== id);
    this._save(playlists);
    // Clear active if deleted
    if (this.getActiveId() === id) {
      localStorage.removeItem(PLAYLIST_ACTIVE_KEY);
    }
  },

  /**
   * Rename a playlist.
   */
  rename(id, newName) {
    const playlists = this.getAll();
    const pl = playlists.find((p) => p.id === id);
    if (pl) {
      pl.name = newName;
      this._save(playlists);
    }
  },

  /**
   * Add a song to a playlist. Can be added multiple times.
   * @param {string} playlistId
   * @param {object} song - { nomor, judul, fileHref }
   */
  addSong(playlistId, song) {
    const playlists = this.getAll();
    const pl = playlists.find((p) => p.id === playlistId);
    if (pl) {
      // Prevent duplicates by song number
      if (pl.songs.some((s) => s.nomor === song.nomor)) return false;
      pl.songs.push({
        nomor: song.nomor,
        judul: song.judul,
        fileHref: song.fileHref,
        addedAt: Date.now(),
      });
      this._save(playlists);
      return true;
    }
    return false;
  },

  /**
   * Remove a song at a specific index from a playlist.
   */
  removeSong(playlistId, songIndex) {
    const playlists = this.getAll();
    const pl = playlists.find((p) => p.id === playlistId);
    if (pl && songIndex >= 0 && songIndex < pl.songs.length) {
      pl.songs.splice(songIndex, 1);
      this._save(playlists);
    }
  },

  /**
   * Move a song within a playlist (reorder).
   */
  moveSong(playlistId, fromIndex, toIndex) {
    const playlists = this.getAll();
    const pl = playlists.find((p) => p.id === playlistId);
    if (pl && fromIndex >= 0 && fromIndex < pl.songs.length) {
      const [moved] = pl.songs.splice(fromIndex, 1);
      pl.songs.splice(toIndex, 0, moved);
      this._save(playlists);
    }
  },

  /**
   * Check if a song (by nomor) exists in ANY playlist.
   * @returns {Array} List of playlist ids containing this song
   */
  getPlaylistsContainingSong(nomor) {
    return this.getAll()
      .filter((pl) => pl.songs.some((s) => s.nomor === nomor))
      .map((pl) => pl.id);
  },

  /**
   * Get/set the active playlist id.
   */
  getActiveId() {
    return localStorage.getItem(PLAYLIST_ACTIVE_KEY) || null;
  },
  setActiveId(id) {
    if (id) {
      localStorage.setItem(PLAYLIST_ACTIVE_KEY, id);
    } else {
      localStorage.removeItem(PLAYLIST_ACTIVE_KEY);
    }
  },

  /**
   * Get/set auto-next mode: 'off', 'playlist', 'number'
   */
  getAutoNextMode() {
    return localStorage.getItem(PLAYLIST_AUTONEXT_KEY) || "off";
  },
  setAutoNextMode(mode) {
    localStorage.setItem(PLAYLIST_AUTONEXT_KEY, mode);
  },

  /**
   * Export a playlist as a JSON object (for download).
   */
  exportPlaylist(id) {
    const pl = this.getById(id);
    if (!pl) return null;
    return {
      name: pl.name,
      songs: pl.songs.map((s) => ({
        nomor: s.nomor,
        judul: s.judul,
        fileHref: s.fileHref,
      })),
      exportedAt: new Date().toISOString(),
    };
  },

  /**
   * Import a playlist from a JSON object.
   * @returns {object|null} The imported playlist, or null on failure
   */
  importPlaylist(data) {
    try {
      if (!data || !data.name || !Array.isArray(data.songs)) return null;
      const playlist = this.create(data.name + " (Imported)");
      const playlists = this.getAll();
      const pl = playlists.find((p) => p.id === playlist.id);
      if (pl) {
        pl.songs = data.songs.map((s) => ({
          nomor: s.nomor || "?",
          judul: s.judul || "Tanpa Judul",
          fileHref: s.fileHref || "",
          addedAt: Date.now(),
        }));
        this._save(playlists);
        return pl;
      }
      return null;
    } catch {
      return null;
    }
  },
};
;

/* SOURCE: 13-playlist-ui.js */
// --- 13. Playlist UI ---
// Handles the Playlist tab, adding/removing songs, and the Mini Player.

// -- Globals
let currentPlaylistView = 'list'; // 'list' | 'detail'
let currentViewingPlaylistId = null;

// -- Run on load
function initPlaylistUiBindings() {
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

  function hasUsableShufflePlaylist() {
    const activeId = PlaylistManager.getActiveId();
    const pl = activeId ? PlaylistManager.getById(activeId) : null;
    return !!(pl && pl.songs && pl.songs.length > 0);
  }
  
  function cycleLoopMode() {
    const currentMode = typeof _resolveEffectiveAutoNextMode === 'function'
      ? _resolveEffectiveAutoNextMode({ autoFix: false, showToast: false })
      : PlaylistManager.getAutoNextMode();
    let newMode = 'off';
    if (currentMode === 'off') newMode = 'one';
    else if (currentMode === 'one') newMode = 'number';
    else if (currentMode === 'number') newMode = 'playlist';
    else if (currentMode === 'playlist') newMode = 'shuffle-all';
    else if (currentMode === 'shuffle-all') newMode = hasUsableShufflePlaylist() ? 'shuffle-playlist' : 'off';
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

  // Keep mini-player state in sync with low idle overhead.
  setInterval(() => {
    if (document.hidden) return;
    syncMiniPlayerUI();
  }, 1000);

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) syncMiniPlayerUI();
  });

  // Collapsible extras row: auto-collapse when mini-player is narrow
  const miniPlayerContainer = document.getElementById('mini-player');
  const miniExtrasToggle = document.getElementById('mini-extras-toggle');
  if (miniPlayerContainer && miniExtrasToggle) {
    const mobileMiniMedia = window.matchMedia ? window.matchMedia('(max-width: 640px)') : null;
    const collapseWidth = 540;
    const expandWidth = 600;
    let userExpandedExtras = false;
    let resizeRaf = 0;
    let miniCollapseAnimating = false;

    const updateMiniPlayerReservedHeight = () => {
      if (miniPlayerContainer.classList.contains('is-hidden')) return;
      const height = Math.ceil(miniPlayerContainer.getBoundingClientRect().height || 0);
      if (height > 0) {
        document.documentElement.style.setProperty('--mini-player-reserved-height', `${height + 20}px`);
      }
    };

    const applyMiniPlayerExtrasLayout = () => {
      resizeRaf = 0;
      if (miniCollapseAnimating) return;
      const containerWidth = miniPlayerContainer.clientWidth;
      const isMobileStable = !!(mobileMiniMedia && mobileMiniMedia.matches);

      if (isMobileStable) {
        miniPlayerContainer.classList.remove('is-extras-collapsed');
        miniPlayerContainer.classList.remove('is-extras-expanded');
        userExpandedExtras = false;
        updateMiniPlayerReservedHeight();
        return;
      }

      if (containerWidth <= collapseWidth) {
        miniPlayerContainer.classList.add('is-extras-collapsed');
        if (!userExpandedExtras) {
          miniPlayerContainer.classList.remove('is-extras-expanded');
        }
        updateMiniPlayerReservedHeight();
        return;
      }

      if (containerWidth >= expandWidth) {
        miniPlayerContainer.classList.remove('is-extras-collapsed');
        if (!userExpandedExtras) {
          miniPlayerContainer.classList.remove('is-extras-expanded');
        }
      }
      updateMiniPlayerReservedHeight();
    };

    const scheduleMiniExtrasLayout = () => {
      if (resizeRaf) cancelAnimationFrame(resizeRaf);
      resizeRaf = requestAnimationFrame(applyMiniPlayerExtrasLayout);
    };

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
      scheduleMiniExtrasLayout();
    });

    // Keep auto-collapse stable on tablet/desktop, but disable it on mobile
    if (typeof ResizeObserver !== 'undefined') {
      const extrasObserver = new ResizeObserver(scheduleMiniExtrasLayout);
      extrasObserver.observe(miniPlayerContainer);
    }

    if (mobileMiniMedia && typeof mobileMiniMedia.addEventListener === 'function') {
      mobileMiniMedia.addEventListener('change', scheduleMiniExtrasLayout);
    }

    window.addEventListener('resize', scheduleMiniExtrasLayout, { passive: true });
    scheduleMiniExtrasLayout();
  }

  // --- Mini player collapse / expand toggle ---
  const miniCollapseToggle = document.getElementById('mini-collapse-toggle');
  if (miniCollapseToggle && miniPlayerContainer) {
    const appContent = document.getElementById('main-content');
    // Helper: set overflow on collapsible wrappers so popovers are not clipped
    function setCollapsibleOverflow(visible) {
      miniPlayerContainer.querySelectorAll('.mini-player-collapsible').forEach(function (el) {
        el.style.overflow = visible ? 'visible' : '';
        var inner = el.querySelector('.mini-player-collapsible-inner');
        if (inner) inner.style.overflow = visible ? 'visible' : '';
      });
    }

    // Restore persisted collapsed state
    if (localStorage.getItem('miniPlayerCollapsed') === '1') {
      miniPlayerContainer.classList.add('is-mini-collapsed');
      if (appContent) appContent.classList.add('has-mini-player-collapsed');
      miniCollapseToggle.setAttribute('aria-expanded', 'false');
      miniCollapseToggle.setAttribute('aria-label', 'Expand mini player');
    } else {
      miniCollapseToggle.setAttribute('aria-expanded', 'true');
      miniCollapseToggle.setAttribute('aria-label', 'Collapse mini player');
      // Expanded on load — allow popovers to overflow
      setCollapsibleOverflow(true);
    }

    miniCollapseToggle.addEventListener('click', function (e) {
      e.stopPropagation();
      if (miniCollapseAnimating) return;
      miniCollapseAnimating = true;
      miniPlayerContainer.classList.add('is-mini-animating');

      var isCollapsed = !miniPlayerContainer.classList.contains('is-mini-collapsed');
      localStorage.setItem('miniPlayerCollapsed', isCollapsed ? '1' : '0');
      miniCollapseToggle.setAttribute('aria-expanded', isCollapsed ? 'false' : 'true');
      miniCollapseToggle.setAttribute('aria-label', isCollapsed ? 'Expand mini player' : 'Collapse mini player');

      requestAnimationFrame(function () {
        miniPlayerContainer.classList.toggle('is-mini-collapsed', isCollapsed);
        if (appContent) {
          appContent.classList.toggle('has-mini-player-collapsed', isCollapsed);
        }
      });

      if (isCollapsed) {
        // Collapsing — revert to CSS default (overflow: hidden)
        setCollapsibleOverflow(false);
      } else {
        // Expanding — wait for animation to finish, then allow overflow
        var wrappers = miniPlayerContainer.querySelectorAll('.mini-player-collapsible');
        wrappers.forEach(function (el) {
          function onEnd(evt) {
            if (evt.propertyName === 'grid-template-rows') {
              el.removeEventListener('transitionend', onEnd);
              setCollapsibleOverflow(true);
            }
          }
          el.addEventListener('transitionend', onEnd);
        });
      }

      setTimeout(function () {
        miniCollapseAnimating = false;
        miniPlayerContainer.classList.remove('is-mini-animating');
        if (!miniPlayerContainer.classList.contains('is-mini-collapsed')) {
          setCollapsibleOverflow(true);
        }
        updateMiniPlayerReservedHeight();
        scheduleMiniExtrasLayout();
      }, 340);
    });
  }

}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPlaylistUiBindings, { once: true });
} else {
  initPlaylistUiBindings();
}

function syncAutoNextMenu() {
  const mode = typeof _resolveEffectiveAutoNextMode === 'function'
    ? _resolveEffectiveAutoNextMode({ autoFix: false, showToast: false })
    : PlaylistManager.getAutoNextMode();
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

  const isSwitchingMidi = window.isMidiSwitching === true;
  // Show only if a song is loaded (MidiTimeAuthority has a known duration)
  const dur = isSwitchingMidi
    ? 0
    : (typeof MidiTimeAuthority !== 'undefined' ? (MidiTimeAuthority.getDuration() || window._midiKnownDuration || 0) : (window._midiKnownDuration || 0));
  const inViewer = document.body.classList.contains('viewer-active');
  const page = document.body.getAttribute('data-page') || '';
  const hasSong = document.getElementById('pdf-viewer-title')?.textContent;
  
  // Also show if we are not in viewer but playing, loading, or a song was recently loaded
  const isPlaying = !isSwitchingMidi && typeof MidiEngine !== 'undefined' ? MidiEngine.isPlaying() : false;
  const isEngineLoading = typeof MidiEngine !== 'undefined' && MidiEngine.isLoading();
  const isLoading = isSwitchingMidi || isEngineLoading;
  const miniPlayerLoading = document.getElementById('mini-player-loading');
  if (miniPlayerLoading) miniPlayerLoading.style.display = isLoading ? '' : 'none';
  
  const inSettings = (page === 'pengaturan' || page === 'report-bug' || page === 'about-project' ||
    document.getElementById('pengaturan-btn')?.classList.contains('selected') || 
    document.querySelector('.report-page') !== null ||
    document.querySelector('.settings-panel') !== null);
  const appContent = document.getElementById('main-content');
  var isCollapsed = miniPlayer.classList.contains('is-mini-collapsed');
  if (inViewer || inSettings) {
    miniPlayer.classList.add('is-hidden');
    miniPlayer.classList.remove('mini-player-enter');
    if (appContent) { appContent.classList.remove('has-mini-player'); appContent.classList.remove('has-mini-player-collapsed'); }
  } else if (dur > 0 || isPlaying || isLoading || !!hasSong) {
    // Show mini player — add entrance animation only on first show
    var wasHidden = miniPlayer.classList.contains('is-hidden');
    miniPlayer.classList.remove('is-hidden');
    if (wasHidden) {
      miniPlayer.classList.remove('mini-player-enter');
      void miniPlayer.offsetWidth; // force reflow to restart animation
      miniPlayer.classList.add('mini-player-enter');
    }
    if (appContent) {
      appContent.classList.add('has-mini-player');
      appContent.classList.toggle('has-mini-player-collapsed', isCollapsed);
    }
    miniTitle.textContent = window._midiLoadingSongTitle || document.getElementById('pdf-viewer-title')?.textContent || 'Lagu';

    // Loading bar is now synced by the RAF loop in 05-events.js
    
    // Subtitle logic
    const mode = typeof _resolveEffectiveAutoNextMode === 'function'
      ? _resolveEffectiveAutoNextMode({ autoFix: false, showToast: false })
      : PlaylistManager.getAutoNextMode();
    let subtitleText = "Tidak ada antrean";

    if (mode === 'one') {
      subtitleText = "Single Loop Mode";
    } else if (mode === 'off') {
      subtitleText = "Mode Loop Mati";
    } else if (mode === 'shuffle-all') {
      // Show the predetermined next shuffle song if known
      const nextIdx = typeof shuffleNextGlobalIdx !== 'undefined' ? shuffleNextGlobalIdx : -1;
      if (nextIdx >= 0 && typeof pujianItems !== 'undefined' && pujianItems[nextIdx]) {
        subtitleText = `Pujian berikutnya: ${pujianItems[nextIdx].judul}`;
      } else {
        subtitleText = "Shuffle Semua Lagu";
      }
    } else if (mode === 'shuffle-playlist') {
      // Show the predetermined next shuffle-playlist song if known
      const nextPIdx = typeof shuffleNextPlaylistIdx !== 'undefined' ? shuffleNextPlaylistIdx : -1;
      const pId = PlaylistManager.getActiveId();
      const p = pId ? PlaylistManager.getById(pId) : null;
      if (p && p.songs.length <= 0) {
        subtitleText = "Playlist kosong — Shuffle Semua Lagu";
      } else if (nextPIdx >= 0 && p && p.songs[nextPIdx]) {
        const nextSongNomor = p.songs[nextPIdx].nomor;
        const nextSongGlobal = typeof pujianItems !== 'undefined'
          ? pujianItems.find(s => s.nomor === nextSongNomor)
          : null;
        subtitleText = `Pujian berikutnya: ${nextSongGlobal ? nextSongGlobal.judul : p.songs[nextPIdx].judul}`;
      } else {
        subtitleText = "Shuffle Playlist";
      }
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
    
    miniSubtitle.textContent = isLoading ? 'Memuat MIDI...' : subtitleText;
    
    if (miniPlayIcon) {
       miniPlayIcon.textContent = isPlaying ? "pause" : "play_arrow";
       miniPlayIcon.classList.toggle('is-playing', isPlaying);
    }
    miniPlayer.classList.toggle('is-playing', isPlaying);
  } else {
    miniPlayer.classList.add('is-hidden');
    miniPlayer.classList.remove('mini-player-enter');
    miniPlayer.classList.remove('is-playing');
    if (miniPlayIcon) miniPlayIcon.classList.remove('is-playing');
    if (appContent) { appContent.classList.remove('has-mini-player'); appContent.classList.remove('has-mini-player-collapsed'); }
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
window.setNextMode = function(mode, options) {
  options = options || {};
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

  if (!options.silentToast) {
    showToast(`Auto Next: ${mode === 'off' ? 'Mati (No Loop)' : mode === 'one' ? '1 Lagu Saja' : mode === 'number' ? 'Sesuai Nomor' : mode === 'playlist' ? 'Sesuai Playlist' : mode === 'shuffle-all' ? 'Acak Semua' : 'Acak Playlist'}`, "info");
  }

  // Sync loop icons with animation
  const icons = document.querySelectorAll('#mini-loop-icon, #custom-loop-icon');
  icons.forEach(icon => {
    const newIcon = mode === 'one' ? 'repeat_one' : mode === 'number' ? 'repeat_on' : mode === 'playlist' ? 'playlist_play' : (mode === 'shuffle-all' || mode === 'shuffle-playlist') ? 'shuffle' : 'repeat';
    if (icon.textContent !== newIcon) {
      const anim1 = icon.animate([
        { transform: 'scale(1) rotate(0deg)', opacity: 1 },
        { transform: 'scale(0.5) rotate(-90deg)', opacity: 0 },
      ], { duration: 120, easing: 'ease-in' });
      anim1.onfinish = function() {
        icon.textContent = newIcon;
        icon.animate([
          { transform: 'scale(0.5) rotate(90deg)', opacity: 0 },
          { transform: 'scale(1.15) rotate(0deg)', opacity: 1 },
          { transform: 'scale(1) rotate(0deg)', opacity: 1 }
        ], { duration: 200, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)', fill: 'forwards' }).onfinish = function() {
          // Clear all animations so CSS/inline styles take over cleanly
          icon.getAnimations().forEach(a => a.cancel());
        };
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

  if (!options.skipShuffleRefresh) {
    if (mode === 'shuffle-all' || mode === 'shuffle-playlist') {
      if (typeof _determineNextShuffleSong === 'function') _determineNextShuffleSong();
      if (typeof _preloadNextSong === 'function') _preloadNextSong();
    } else {
      if (typeof shuffleNextGlobalIdx !== 'undefined') shuffleNextGlobalIdx = -1;
      if (typeof shuffleNextPlaylistIdx !== 'undefined') shuffleNextPlaylistIdx = -1;
      if (typeof syncMiniPlayerUI === 'function') syncMiniPlayerUI();
    }
  }
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
  const mode = typeof _resolveEffectiveAutoNextMode === 'function'
    ? _resolveEffectiveAutoNextMode({ autoFix: true, showToast: true })
    : PlaylistManager.getAutoNextMode();
  if (mode === 'off') {
    window._autoAdvanceFromEnd = false; // clear stale flag
    return false;
  }
  
  if (mode === 'number') {
    // Next song by global index
    if (typeof onNextSong === 'function') {
       window._forceAutoPlayNext = true;
       onNextSong();
       return true;
    }
  }

  if (mode === 'shuffle-all') {
    // Shuffle from all songs — use predetermined next if available
    if (typeof pujianItems !== 'undefined' && pujianItems.length > 1) {
      let nextIdx = typeof shuffleNextGlobalIdx !== 'undefined' && shuffleNextGlobalIdx >= 0
        ? shuffleNextGlobalIdx
        : -1;
      if (nextIdx < 0 || nextIdx >= pujianItems.length) {
        do {
          nextIdx = Math.floor(Math.random() * pujianItems.length);
        } while (nextIdx === currentSongIndex && pujianItems.length > 1);
      }
      shuffleNextGlobalIdx = -1; // consumed
      window._forceAutoPlayNext = true;
      if (typeof _pushShuffleHistory === 'function') _pushShuffleHistory();
      if (typeof openPdfViewer === 'function') openPdfViewer(nextIdx.toString());
      return true;
    }
  }

  if (mode === 'playlist' || mode === 'shuffle-playlist') {
    const activeId = PlaylistManager.getActiveId();
    if (!activeId) {
      if (mode === 'shuffle-playlist' && typeof setNextMode === 'function') {
        setNextMode('shuffle-all', { silentToast: true, skipShuffleRefresh: false });
        return window._playlistCheckAutoNext();
      }
      return false;
    }

    const pl = PlaylistManager.getById(activeId);
    if (!pl || pl.songs.length === 0) {
      if (mode === 'shuffle-playlist' && typeof setNextMode === 'function') {
        setNextMode('shuffle-all', { silentToast: true, skipShuffleRefresh: false });
        if (typeof showToast === 'function') showToast('Playlist kosong, beralih ke Shuffle Semua', 'info');
        return window._playlistCheckAutoNext();
      }
      return false;
    }

    if (typeof pujianItems !== 'undefined' && typeof currentSongIndex !== 'undefined') {
      const currentGlobalSong = pujianItems[currentSongIndex];
      if (currentGlobalSong) {
        let currentIdxInPl = pl.songs.findIndex(s => s.nomor === currentGlobalSong.nomor);
        
        if (mode === 'shuffle-playlist') {
          // Shuffle within playlist — use predetermined next if available
          let nextPlIdx = typeof shuffleNextPlaylistIdx !== 'undefined' && shuffleNextPlaylistIdx >= 0
            ? shuffleNextPlaylistIdx
            : -1;
          if (nextPlIdx < 0 || nextPlIdx >= pl.songs.length) {
            do {
              nextPlIdx = Math.floor(Math.random() * pl.songs.length);
            } while (nextPlIdx === currentIdxInPl && pl.songs.length > 1);
          }
          shuffleNextPlaylistIdx = -1; // consumed
          window._forceAutoPlayNext = true;
          if (typeof _pushShuffleHistory === 'function') _pushShuffleHistory();
          playSongFromPlaylist(nextPlIdx, false, activeId);
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
