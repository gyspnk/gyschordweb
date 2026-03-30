import re

with open('docs/index.html', 'r', encoding='utf-8') as f:
    html = f.read()

new_html = """              <div class="custom-midi-player" id="custom-midi-player">
                <!-- Modern MD3 Player Controls -->
                <div class="custom-player-controls">
                  
                  <button class="player-btn toggle-play" id="custom-play-btn" type="button" aria-label="Play/Pause">
                    <span class="material-symbols-outlined" id="custom-play-icon">play_arrow</span>
                  </button>

                  <div class="player-time" id="custom-time-display">0:00 / 0:00</div>
                  
                  <div class="seekbar-wrapper">
                    <input type="range" class="player-slider" id="custom-seekbar" min="0" max="100" value="0" step="0.1">
                    <div class="seekbar-fill" id="custom-seekbar-fill"></div>
                  </div>

                  <div class="player-divider"></div>
                  
                  <!-- Responsive/Adaptive Dropdown Trigger -->
                  <div class="instrument-selector-wrapper">
                    <button class="instrument-toggle-btn" id="custom-instrument-select" type="button" aria-haspopup="listbox" aria-expanded="false" title="Pilih Alat Musik" aria-label="Pilih Alat Musik (Piano)">
                      <span class="cis-icon" id="cis-icon">🎹</span>
                    </button>
                    <!-- Popover menu list -->
                    <div class="cis-menu-popover" id="cis-menu" role="listbox">
                      <div class="cis-grid">
                        <!-- PIANO -->
                        <div class="cis-category">Piano & Keyboard</div>
                        <button type="button" class="cis-option cis-default selected" data-val="0" title="Acoustic Grand Piano">🎹 Grand Piano</button>
                        <button type="button" class="cis-option" data-val="4" title="Electric Piano 1">🎹 Electric Piano</button>
                        <button type="button" class="cis-option" data-val="6" title="Harpsichord">🎹 Harpsichord</button>
                        <button type="button" class="cis-option" data-val="16" title="Drawbar Organ">🎹 Drawbar Organ</button>
                        <button type="button" class="cis-option" data-val="19" title="Church Organ">🕍 Church Organ</button>
                        <button type="button" class="cis-option" data-val="21" title="Accordion">🪗 Accordion</button>

                        <!-- PITCHED PERCUSSION -->
                        <div class="cis-category">Perkusi Bernada</div>
                        <button type="button" class="cis-option" data-val="8" title="Celesta">🔔 Celesta</button>
                        <button type="button" class="cis-option" data-val="9" title="Glockenspiel">🎼 Glockenspiel</button>
                        <button type="button" class="cis-option" data-val="11" title="Vibraphone">🎵 Vibraphone</button>
                        <button type="button" class="cis-option" data-val="13" title="Xylophone">🪵 Xylophone</button>
                        <button type="button" class="cis-option" data-val="14" title="Tubular Bells">🔔 Tubular Bells</button>

                        <!-- GUITAR -->
                        <div class="cis-category">Gitar</div>
                        <button type="button" class="cis-option" data-val="24" title="Acoustic Guitar (Nylon)">🎸 Gitar Akustik (Nylon)</button>
                        <button type="button" class="cis-option" data-val="25" title="Acoustic Guitar (Steel)">🎸 Gitar Akustik (Steel)</button>
                        <button type="button" class="cis-option" data-val="26" title="Electric Guitar (Jazz)">🎸 Gitar Elektrik (Jazz)</button>
                        <button type="button" class="cis-option" data-val="27" title="Electric Guitar (Clean)">🎸 Gitar Elektrik (Clean)</button>
                        <button type="button" class="cis-option" data-val="29" title="Overdriven Guitar">🎸 Gitar Overdrive</button>

                        <!-- BASS -->
                        <div class="cis-category">Bass</div>
                        <button type="button" class="cis-option" data-val="32" title="Acoustic Bass">🎸 Acoustic Bass</button>
                        <button type="button" class="cis-option" data-val="33" title="Electric Bass (Finger)">🎸 Bass Elektrik (Finger)</button>
                        <button type="button" class="cis-option" data-val="35" title="Fretless Bass">🎸 Fretless Bass</button>
                        <button type="button" class="cis-option" data-val="38" title="Synth Bass 1">🎹 Synth Bass</button>

                        <!-- STRINGS -->
                        <div class="cis-category">Strings / Gesek</div>
                        <button type="button" class="cis-option" data-val="40" title="Violin">🎻 Biola (Violin)</button>
                        <button type="button" class="cis-option" data-val="41" title="Viola">🎻 Viola</button>
                        <button type="button" class="cis-option" data-val="42" title="Cello">🎻 Cello</button>
                        <button type="button" class="cis-option" data-val="43" title="Contrabass">🎻 Contrabass</button>
                        <button type="button" class="cis-option" data-val="46" title="Harp">🎻 Harp</button>
                        <button type="button" class="cis-option" data-val="48" title="String Ensemble 1">🎻 String Ensemble</button>
                        <button type="button" class="cis-option" data-val="52" title="Choir Aahs">🗣️ Choir Aahs</button>

                        <!-- BRASS -->
                        <div class="cis-category">Brass / Tiup Logam</div>
                        <button type="button" class="cis-option" data-val="56" title="Trumpet">🎺 Trumpet</button>
                        <button type="button" class="cis-option" data-val="57" title="Trombone">🎺 Trombone</button>
                        <button type="button" class="cis-option" data-val="58" title="Tuba">🎺 Tuba</button>
                        <button type="button" class="cis-option" data-val="60" title="French Horn">📯 French Horn</button>
                        <button type="button" class="cis-option" data-val="61" title="Brass Section">🎺 Brass Section</button>

                        <!-- REED -->
                        <div class="cis-category">Reed / Tiup Kayu</div>
                        <button type="button" class="cis-option" data-val="64" title="Soprano Sax">🎷 Soprano Sax</button>
                        <button type="button" class="cis-option" data-val="65" title="Alto Sax">🎷 Alto Sax</button>
                        <button type="button" class="cis-option" data-val="66" title="Tenor Sax">🎷 Tenor Sax</button>
                        <button type="button" class="cis-option" data-val="68" title="Oboe">🪈 Oboe</button>
                        <button type="button" class="cis-option" data-val="71" title="Clarinet">🪈 Clarinet</button>

                        <!-- PIPE -->
                        <div class="cis-category">Pipe / Seruling</div>
                        <button type="button" class="cis-option" data-val="73" title="Flute">🌬️ Flute</button>
                        <button type="button" class="cis-option" data-val="75" title="Pan Flute">🪈 Pan Flute</button>
                        <button type="button" class="cis-option" data-val="77" title="Shakuhachi">🎋 Shakuhachi</button>
                        <button type="button" class="cis-option" data-val="79" title="Ocarina">🪈 Ocarina</button>

                        <!-- SYNTH & ETHNIC -->
                        <div class="cis-category">Lainnya</div>
                        <button type="button" class="cis-option" data-val="88" title="Pad 1 (New age)">🎹 Pad (New Age)</button>
                        <button type="button" class="cis-option" data-val="104" title="Sitar">🪕 Sitar</button>
                        <button type="button" class="cis-option" data-val="105" title="Banjo">🪕 Banjo</button>
                        <button type="button" class="cis-option" data-val="114" title="Steel Drums">🛢️ Steel Drums</button>
                        <button type="button" class="cis-option" data-val="118" title="Synth Drum">🥁 Synth Drum</button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>"""

html = re.sub(
    r'<div class="custom-midi-player".*?(?=<!-- Hidden Original Component -->)',
    new_html + '\n              ',
    html,
    flags=re.DOTALL
)

with open('docs/index.html', 'w', encoding='utf-8') as f:
    f.write(html)
