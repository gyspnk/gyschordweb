import re
with open('docs/index.html', 'r', encoding='utf-8') as f:
    text = f.read()

# Replace custom-midi-player block
old_dropdown_match = re.search(r'<div class=\"custom-midi-player\" id=\"custom-midi-player\">.*?(?=<!-- Hidden Original Component -->)', text, re.DOTALL)

new_dropdown = '''<div class="custom-midi-player" id="custom-midi-player">
                 <!-- Aesthetic Player Controls -->
                 <div class="custom-player-controls">
                   <button class="instrument-toggle-btn" id="custom-instrument-select" type="button" aria-label="Ganti Alat Musik" title="Pilih Alat Musik (Keyboard)" aria-expanded="false">
                     <span class="cis-icon" id="cis-icon">🎹</span>
                   </button>
                   <div class="player-divider"></div>
                   <button class="player-btn" id="custom-play-btn" type="button" aria-label="Play/Pause">
                     <span class="material-symbols-outlined" id="custom-play-icon">play_arrow</span>
                   </button>
                   <div class="player-time" id="custom-time-display">0:00 / 0:00</div>
                   <div class="seekbar-wrapper">
                     <input type="range" class="player-slider" id="custom-seekbar" min="0" max="100" value="0" step="0.1">
                     <div class="seekbar-fill" id="custom-seekbar-fill"></div>
                   </div>
                 </div>

                 <!-- Collapsible Instrument Grid -->
                 <div class="cis-menu-collapsible" id="cis-menu">
                   <div class="cis-grid">
                     <button type="button" class="cis-option cis-default" data-val="-1" title="Instrumen Asli Lagu">🎵</button>
                     <button type="button" class="cis-option" data-val="0" title="Acoustic Grand Piano">🎹</button>
                     <button type="button" class="cis-option" data-val="19" title="Church Organ">🕍</button>
                     <button type="button" class="cis-option" data-val="8" title="Celesta / Bell">🔔</button>
                     <button type="button" class="cis-option" data-val="24" title="Gitar Akustik">🎸</button>
                     <button type="button" class="cis-option" data-val="26" title="Gitar Elektrik">🎸</button>
                     <button type="button" class="cis-option" data-val="32" title="Acoustic Bass">🎸</button>
                     <button type="button" class="cis-option" data-val="40" title="Biola (Violin)">🎻</button>
                     <button type="button" class="cis-option" data-val="42" title="Cello">🎻</button>
                     <button type="button" class="cis-option" data-val="46" title="Harp">🎻</button>
                     <button type="button" class="cis-option" data-val="56" title="Trumpet">🎺</button>
                     <button type="button" class="cis-option" data-val="65" title="Alto Sax">🎷</button>
                     <button type="button" class="cis-option" data-val="73" title="Flute">🌬️</button>
                   </div>
                 </div>
               </div>
               
               '''

if old_dropdown_match:
    text = text[:old_dropdown_match.start()] + new_dropdown + text[old_dropdown_match.end():]
    with open('docs/index.html', 'w', encoding='utf-8') as f:
        f.write(text)
    print('Replaced HTML.')
else:
    print('Could not find HTML block.')
