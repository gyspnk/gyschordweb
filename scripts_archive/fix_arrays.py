import re
with open('docs/js/01-config.js', 'r', encoding='utf-8') as f:
    text = f.read()

text = re.sub(r'const NOTE_NAMES_SHARP = \[.*?\];', 'const NOTE_NAMES_SHARP = [\"C\", \"C#\", \"D\", \"D#\", \"E\", \"F\", \"F#\", \"G\", \"G#\", \"A\", \"A#\", \"B\"];', text)
text = re.sub(r'const NOTE_NAMES_FLAT = \[.*?\];', 'const NOTE_NAMES_FLAT = [\"C\", \"Db\", \"D\", \"Eb\", \"E\", \"F\", \"Gb\", \"G\", \"Ab\", \"A\", \"Bb\", \"B\"];', text)

with open('docs/js/01-config.js', 'w', encoding='utf-8') as f:
    f.write(text)

print('Lines replaced.')
