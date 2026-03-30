with open('docs/css/04-viewer.css', 'r', encoding='utf-8') as f:
    text = f.read()

text = text.replace('.custom-instrument-dropdown.active .cis-menu', '.custom-instrument-dropdown.is-open .cis-menu')

with open('docs/css/04-viewer.css', 'w', encoding='utf-8') as f:
    f.write(text)
