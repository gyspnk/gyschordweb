import re

with open('docs/index.html', 'r', encoding='utf-8') as f:
    html = f.read()

# Replace cis-header completely
html = re.sub(
    r'<div class="cis-header">.*?</div>',
    '''<div class="cis-header" title="Pilih Alat Musik">\n                       <span class="cis-icon" id="cis-icon">🎹</span>\n                     </div>''',
    html, flags=re.DOTALL
)

with open('docs/index.html', 'w', encoding='utf-8') as f:
    f.write(html)
