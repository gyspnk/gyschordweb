import re, json

with open('docs/index.html', 'r', encoding='utf-8') as f:
    html = f.read()

pattern = r'<div class=\"custom-instrument-dropdown\" id=\"custom-instrument-select\" tabindex=\"0\">.*?<!-- JS Custom Player UI -->'

new_chunk = '''<div class="custom-instrument-dropdown" id="custom-instrument-select" tabindex="0">
                     <button class="cis-header icon-button" type="button" aria-label="Ganti Alat Musik" title="Ganti Alat Musik">
                       <span class="cis-icon" id="cis-icon">🎵</span>
                     </button>
                     <div class="cis-menu" id="cis-menu">
                       <div class="cis-grid">
                         <button type="button" class="cis-option cis-default" data-val="-1" data-icon="🎵" title="Instrumen Asli Lagu">🎵</button>
                         <button type="button" class="cis-option" data-val="0" data-icon="🎹" title="Acoustic Grand Piano">🎹</button>
                         <button type="button" class="cis-option" data-val="19" data-icon="🕍" title="Church Organ">🕍</button>
                         <button type="button" class="cis-option" data-val="8" data-icon="🔔" title="Glockenspiel / Bell">🔔</button>
                         <button type="button" class="cis-option" data-val="10" data-icon="📻" title="Music Box">📻</button>
                         <button type="button" class="cis-option" data-val="24" data-icon="🎸" title="Gitar Akustik">🎸</button>
                         <button type="button" class="cis-option" data-val="26" data-icon="⚡" title="Gitar Elektrik">⚡</button>
                         <button type="button" class="cis-option" data-val="32" data-icon="🎻" title="Acoustic Bass">🎻</button>
                         <button type="button" class="cis-option" data-val="40" data-icon="🎻" title="Biola (Violin)">🎻</button>
                         <button type="button" class="cis-option" data-val="46" data-icon="🪕" title="Harp">🪕</button>
                         <button type="button" class="cis-option" data-val="56" data-icon="🎺" title="Trumpet">🎺</button>
                         <button type="button" class="cis-option" data-val="65" data-icon="🎷" title="Alto Sax">🎷</button>
                         <button type="button" class="cis-option" data-val="73" data-icon="🌬️" title="Flute">🌬️</button>
                       </div>
                     </div>
                   </div>

                   <!-- JS Custom Player UI -->'''

html = re.sub(pattern, new_chunk, html, flags=re.DOTALL)

with open('docs/index.html', 'w', encoding='utf-8') as f:
    f.write(html)
