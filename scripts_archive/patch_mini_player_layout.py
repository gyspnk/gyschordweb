import re

with open('docs/index.html', 'r', encoding='utf-8') as f:
    text = f.read()

new_mini_player = """      <div id="mini-player" class="mini-player is-hidden" style="padding: 10px 14px;">
      <div class="mini-player-top" style="display:flex; align-items:center; justify-content:space-between; width: 100%;">
        <div class="mini-player-info" style="margin-right:8px; overflow:hidden;">
          <div id="mini-title" class="mini-title">Judul Lagu</div>
          <div id="mini-subtitle" class="mini-subtitle">Auto Next: Nomor Berikutnya</div>
        </div>
        
        <div class="mini-player-controls">
          <div id="mini-key-info" style="font-size:12px; font-weight:600; padding:2px 6px; background:var(--md-sys-color-surface-variant); border-radius:4px; margin-right:4px; min-width: 24px; text-align: center; color: var(--md-sys-color-on-surface);" title="Nada Dasar (Key) Saat Ini">-</div>
          
          <div class="mini-transpose-controls" style="display: flex; align-items: center; gap: 0; background: var(--md-sys-color-surface-variant); border-radius: 4px; margin-right: 8px;">
            <button class="icon-button" onclick="if(typeof onTranspose==='function') onTranspose(-1)" style="width: 24px; height: 24px;">
              <span class="material-symbols-outlined" style="font-size: 14px;">remove</span>
            </button>
            <span id="mini-transpose-value" style="font-size: 11px; font-weight: bold; width: 16px; text-align: center;">0</span>
            <button class="icon-button" onclick="if(typeof onTranspose==='function') onTranspose(1)" style="width: 24px; height: 24px;">
              <span class="material-symbols-outlined" style="font-size: 14px;">add</span>
            </button>
          </div>

          <button id="mini-loop-btn" class="icon-button" aria-label="Loop" style="width: 32px; height: 32px; margin-right: 2px;">
            <span class="material-symbols-outlined" id="mini-loop-icon" style="font-size: 18px;">repeat</span>
          </button>

          <button id="mini-prev-btn" class="icon-button" aria-label="Previous"><span class="material-symbols-outlined">skip_previous</span></button>
          <button id="mini-play-btn" class="icon-button" aria-label="Play/Pause"><span class="material-symbols-outlined" id="mini-play-icon" style="transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1); display: inline-block;">play_arrow</span></button>
          <button id="mini-next-btn" class="icon-button" aria-label="Next"><span class="material-symbols-outlined">skip_next</span></button>
        </div>
      </div>
      
      <div class="mini-player-middle" style="width: 100%; margin-top: 6px; display:flex; align-items:center; gap:8px;">
        <div class="player-time" id="mini-time-display" style="font-size: 10px; color: var(--md-sys-color-on-surface-variant); white-space:nowrap;">0:00 / 0:00</div>
        <div class="seekbar-wrapper" style="height: 16px; margin: 0; padding: 0; flex-grow: 1;">
          <input type="range" class="player-slider" id="mini-seekbar" min="0" max="100" value="0" step="0.1" style="height: 4px;">
          <div class="seekbar-fill" id="mini-seekbar-fill" style="height: 4px; top: 6px;"></div>
        </div>
      </div>
    </div>"""

# Replace the whole block of #mini-player
import re
text = re.sub(r'<div id="mini-player" class="mini-player is-hidden">.*?</div>\s*</div>\s*</div>\s*</div>\s*</div>\s*</div>\s*</div>\s*</div>', new_mini_player, text, flags=re.DOTALL) # Need to be careful with divs

# Actually simpler to just script the replace using find methods
with open('docs/index.html', 'r', encoding='utf-8') as f:
    text = f.read()

start_idx = text.find('<div id="mini-player"')
end_idx = text.find('<nav class="bottom-nav">')

if start_idx != -1 and end_idx != -1:
    text = text[:start_idx] + new_mini_player + '\n\n      ' + text[end_idx:]
    with open('docs/index.html', 'w', encoding='utf-8') as f:
        f.write(text)
    print("Replaced!")
else:
    print("Could not find blocks")
