with open("docs/js/13-playlist-ui.js", "r", encoding="utf-8") as f:
    text = f.read()

search_str = """    // Subtitle logic
    const mode = PlaylistManager.getAutoNextMode();
    if (mode === 'playlist') {
      const pId = PlaylistManager.getActiveId();
      const p = PlaylistManager.getById(pId);
      miniSubtitle.textContent = p ? `Playlist: ${p.name}` : "Auto Next: Playlist";
    } else if (mode === 'number') {
      miniSubtitle.textContent = "Auto Next: Nomor Berikutnya";
    } else {
      miniSubtitle.textContent = "Tidak ada antrean";
    }"""

replacement_str = """    // Subtitle logic
    const mode = PlaylistManager.getAutoNextMode();
    let subtitleText = "Tidak ada antrean";

    if (mode === 'one') {
      subtitleText = "Single Loop Mode";
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
    
    miniSubtitle.textContent = subtitleText;"""

if search_str in text:
    with open("docs/js/13-playlist-ui.js", "w", encoding="utf-8") as f:
        f.write(text.replace(search_str, replacement_str))
    print("Subtitle logic updated successfully!")
else:
    print("Search string not found.")
