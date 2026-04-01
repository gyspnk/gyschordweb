import re

with open("docs/js/12-playlist.js", "r", encoding="utf-8") as f:
    text = f.read()

text = text.replace("return localStorage.getItem(PLAYLIST_AUTONEXT_KEY) || 'off';", "return localStorage.getItem(PLAYLIST_AUTONEXT_KEY) || 'number';")

with open("docs/js/12-playlist.js", "w", encoding="utf-8") as f:
    f.write(text)
