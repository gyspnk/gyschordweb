with open('docs/js/08-chord-logic.js', 'r', encoding='utf-8', errors='ignore') as f:
    text = f.read()

text = text.replace('â™¯', '?')
text = text.replace('â™', '?')

with open('docs/js/08-chord-logic.js', 'w', encoding='utf-8') as f:
    f.write(text)
print('Done unicode')
