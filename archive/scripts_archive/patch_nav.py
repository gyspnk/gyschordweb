import re

with open("docs/js/06-navigation.js", "r", encoding="utf-8") as f:
    text = f.read()

replacement = r"""        displayPujian(pujianItems);
        
        // Auto-load last played song or first song (001) into miniplayer on first boot
        if (typeof currentSongIndex !== 'undefined' && currentSongIndex === -1 && pujianItems.length > 0) {
            let lastSongStr = localStorage.getItem('GysLastPlayedSongIndex');
            let initialSongIndex = 0; // Default to 001
            if (lastSongStr !== null) {
                let parsed = parseInt(lastSongStr, 10);
                if (!isNaN(parsed) && parsed >= 0 && parsed < pujianItems.length) {
                    initialSongIndex = parsed;
                }
            }
            if (typeof openPdfViewer === 'function') {
                openPdfViewer(initialSongIndex, true);
            }
        }
      })"""

text = re.sub(r'(\s+)displayPujian\(pujianItems\);\s+\}\)', replacement, text)

with open("docs/js/06-navigation.js", "w", encoding="utf-8") as f:
    f.write(text)
