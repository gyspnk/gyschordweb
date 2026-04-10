import re
with open('docs/index.html', 'r', encoding='utf-8') as f:
    text = f.read()

match = re.search(r'<div class="custom-controls-wrapper".*?<!-- Hidden MIDI Player Pool', text, re.DOTALL)
if match:
    for line in match.group(0).split('\n'):
        if '<button' in line:
            print(line.strip())
