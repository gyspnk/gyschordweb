import re

with open('docs/css/04-viewer.css', 'r', encoding='utf-8') as f:
    text = f.read()

pattern = r'\.custom-midi-player \.cis-label\s*\{[^}]*\}'
replacement = '''.custom-midi-player .cis-label {
    flex-grow: 1;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    text-align: left;
    white-space: normal;
    overflow: hidden;
    line-height: 1.1;
}'''

text_new = re.sub(pattern, replacement, text)

with open('docs/css/04-viewer.css', 'w', encoding='utf-8') as f:
    f.write(text_new)

print('Updated .custom-midi-player .cis-label css')
