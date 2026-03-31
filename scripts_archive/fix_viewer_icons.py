import re

with open('docs/js/07-pdf-viewer.js', 'r', encoding='utf-8') as f:
    text = f.read()

pattern = r'let iconVal = \".*?\";[\s\S]*?if\(prefs\.midiInstrument === \"-1\"\) iconVal = \".*?\";'
replacement = '''let iconVal = "music_note";
            if (valNum >= 0 && valNum <= 7) iconVal = "piano";
            else if (valNum >= 8 && valNum <= 15) iconVal = "notifications_active";
            else if (valNum >= 16 && valNum <= 23) iconVal = "piano";
            else if (valNum >= 24 && valNum <= 31) iconVal = "library_music";
            else if (valNum >= 32 && valNum <= 39) iconVal = "library_music";
            else if (valNum >= 40 && valNum <= 47) iconVal = "graphic_eq";
            else if (valNum >= 48 && valNum <= 55) iconVal = "graphic_eq";
            else if (valNum >= 56 && valNum <= 63) iconVal = "campaign";
            else if (valNum >= 64 && valNum <= 71) iconVal = "styler";
            else if (valNum >= 72 && valNum <= 79) iconVal = "media_link";
            if(prefs.midiInstrument === "-1") iconVal = "music_note";'''

text_new = re.sub(pattern, replacement, text)

with open('docs/js/07-pdf-viewer.js', 'w', encoding='utf-8') as f:
    f.write(text_new)

print('Replaced icon logic in 07-pdf-viewer.js')
