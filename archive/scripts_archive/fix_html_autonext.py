import re

with open('docs/index.html', 'r', encoding='utf-8') as f:
    html = f.read()

# Fix the custom-loop-btn misplaced string
bad_str = """</button>                      <button class="player-btn toggle-loop flex-shrink-0" id="custom-loop-btn" type="button" aria-label="Loop Mode">
                        <span class="material-symbols-outlined" id="custom-loop-icon">repeat</span>
                      </button>"""
                      
html = html.replace(bad_str, "</button>")

target = """                        <button type="button" class="cis-option" data-val="118" title="Synth Drum"><span class="material-symbols-outlined cis-menu-icon">music_note</span> Synth Drum</button>
                      </div>
                    </div>
                  </div>"""

replacement = target + """

                  <!-- Loop Button -->
                  <button class="player-btn toggle-loop flex-shrink-0" id="custom-loop-btn" type="button" aria-label="Loop Mode" style="margin-left: 8px;">
                    <span class="material-symbols-outlined" id="custom-loop-icon">repeat</span>
                  </button>

                  <!-- Auto Next Dropdown Trigger -->
                  <div class="instrument-selector-wrapper flex-shrink-0" style="margin-left:8px;">
                    <button class="instrument-capsule-btn" id="autonext-btn" type="button" aria-haspopup="dialog" aria-expanded="false" title="Pengaturan Auto Next" style="padding-left:12px; padding-right:12px;">
                      <span class="material-symbols-outlined cis-icon" id="autonext-icon">repeat_on</span>
                    </button>
                    <!-- Popover menu -->
                    <div class="cis-menu-popover" id="autonext-menu" role="dialog" style="padding:16px; width:220px; left:auto; right:0;">
                      <div style="font-weight:600; margin-bottom:8px; font-size:14px;">Mode Auto Next</div>
                      <select id="autonext-mode-select" style="width:100%; margin-bottom:16px; padding:8px; border-radius:6px; background:var(--md-sys-color-surface-container-highest); color:var(--md-sys-color-on-surface); border:1px solid var(--md-sys-color-outline-variant);">
                        <option value="off">Mati</option>
                        <option value="one">Satu Lagu (Loop 1)</option>
                        <option value="number">Sesuai Nomor</option>
                        <option value="playlist">Sesuai Playlist</option>
                      </select>

                      <div id="autonext-playlist-select-wrapper" style="display:none;">
                        <div style="font-weight:600; margin-bottom:8px; font-size:14px;">Playlist Aktif</div>
                        <select id="autonext-playlist-select" style="width:100%; padding:8px; border-radius:6px; background:var(--md-sys-color-surface-container-highest); color:var(--md-sys-color-on-surface); border:1px solid var(--md-sys-color-outline-variant);">
                        </select>
                      </div>
                    </div>
                  </div>"""

if target in html:
    html = html.replace(target, replacement)
    with open('docs/index.html', 'w', encoding='utf-8') as f:
        f.write(html)
    print("Fixed index.html structure successfully.")
else:
    print("Target not found. Please inspect index.html.")