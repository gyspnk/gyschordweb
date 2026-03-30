with open('docs/css/04-viewer.css', 'r', encoding='utf-8') as f:
    text = f.read()

text = text.replace('    display: none;\n    flex-direction: column;\n', '    align-items: center;\n') 
text = text.replace('    display: flex;\n    display: none;', '    display: flex;')

with open('docs/css/04-viewer.css', 'w', encoding='utf-8') as f:
    f.write(text)
