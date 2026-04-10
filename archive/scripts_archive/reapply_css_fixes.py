import re

with open("docs/css/04-viewer.css", "r", encoding="utf-8") as f:
    text = f.read()

# Instead of general .custom-midi-player .player-btn which grabs loop button, only target #custom-play-btn
text = re.sub(
    r'\.custom-midi-player \.player-btn,\s*\.custom-midi-player #custom-play-btn\s*\{',
    '.custom-midi-player #custom-play-btn {\n',
    text
)

# And similarly for hover
text = re.sub(
    r'\.custom-midi-player \.player-btn:hover\s*\{',
    '.custom-midi-player #custom-play-btn:hover {\n',
    text
)

text = re.sub(
    r'\.custom-midi-player \.player-btn:active\s*\{',
    '.custom-midi-player #custom-play-btn:active {\n',
    text
)

# And playing animation
text = re.sub(
    r'\.custom-midi-player\.playing \.player-btn\s*\{',
    '.custom-midi-player.playing #custom-play-btn {\n',
    text
)

text = re.sub(
    r'\.custom-midi-player \.player-btn \.material-symbols-outlined\s*\{',
    '.custom-midi-player .player-btn .material-symbols-outlined {\n',
    text
)

text = re.sub(
    r'\.custom-midi-player\.playing \.player-btn \.material-symbols-outlined\s*\{',
    '.custom-midi-player.playing #custom-play-btn .material-symbols-outlined {\n',
    text
)

text = re.sub(
    r'\.custom-midi-player:not\(\.playing\) \.player-btn \.material-symbols-outlined\s*\{',
    '.custom-midi-player:not(.playing) #custom-play-btn .material-symbols-outlined {\n',
    text
)

# Media query updates
text = re.sub(r'\.custom-midi-player \.player-btn\s*\{\s*width: 36px !important;\s*height: 36px !important;\s*\}',
    '.custom-midi-player #custom-play-btn {\n    width: 36px !important;\n    height: 36px !important;\n  }', text)


with open("docs/css/04-viewer.css", "w", encoding="utf-8") as f:
    f.write(text)
