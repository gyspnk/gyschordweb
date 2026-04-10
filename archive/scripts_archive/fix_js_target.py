import re
with open('docs/js/05-events.js', 'r', encoding='utf-8') as f:
    text = f.read()

text = text.replace("e.target.classList.add('selected');", "btn.classList.add('selected');")

with open('docs/js/05-events.js', 'w', encoding='utf-8') as f:
    f.write(text)
print('Fixed target.')
