// --- 12. Playlist Manager ---
// Manages playlists stored in localStorage. Each playlist has an id, name, and songs array.

const PLAYLIST_STORAGE_KEY = 'kidung_playlists';
const PLAYLIST_ACTIVE_KEY = 'kidung_active_playlist';
const PLAYLIST_AUTONEXT_KEY = 'kidung_autonext_mode';

const PlaylistManager = {
  /**
   * Get all playlists from localStorage.
   * @returns {Array} Array of playlist objects
   */
  getAll() {
    try {
      return JSON.parse(localStorage.getItem(PLAYLIST_STORAGE_KEY)) || [];
    } catch { return []; }
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
      name: name || 'Playlist Baru',
      songs: [],
      createdAt: Date.now()
    };
    playlists.push(playlist);
    this._save(playlists);
    return playlist;
  },

  /**
   * Get a playlist by id.
   */
  getById(id) {
    return this.getAll().find(p => p.id === id) || null;
  },

  /**
   * Delete a playlist by id.
   */
  delete(id) {
    const playlists = this.getAll().filter(p => p.id !== id);
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
    const pl = playlists.find(p => p.id === id);
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
    const pl = playlists.find(p => p.id === playlistId);
    if (pl) {
      pl.songs.push({
        nomor: song.nomor,
        judul: song.judul,
        fileHref: song.fileHref,
        addedAt: Date.now()
      });
      this._save(playlists);
    }
  },

  /**
   * Remove a song at a specific index from a playlist.
   */
  removeSong(playlistId, songIndex) {
    const playlists = this.getAll();
    const pl = playlists.find(p => p.id === playlistId);
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
    const pl = playlists.find(p => p.id === playlistId);
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
      .filter(pl => pl.songs.some(s => s.nomor === nomor))
      .map(pl => pl.id);
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
    return localStorage.getItem(PLAYLIST_AUTONEXT_KEY) || 'number';
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
      songs: pl.songs.map(s => ({ nomor: s.nomor, judul: s.judul, fileHref: s.fileHref })),
      exportedAt: new Date().toISOString()
    };
  },

  /**
   * Import a playlist from a JSON object.
   * @returns {object|null} The imported playlist, or null on failure
   */
  importPlaylist(data) {
    try {
      if (!data || !data.name || !Array.isArray(data.songs)) return null;
      const playlist = this.create(data.name + ' (Imported)');
      const playlists = this.getAll();
      const pl = playlists.find(p => p.id === playlist.id);
      if (pl) {
        pl.songs = data.songs.map(s => ({
          nomor: s.nomor || '?',
          judul: s.judul || 'Tanpa Judul',
          fileHref: s.fileHref || '',
          addedAt: Date.now()
        }));
        this._save(playlists);
        return pl;
      }
      return null;
    } catch {
      return null;
    }
  }
};
