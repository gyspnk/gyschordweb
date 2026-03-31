import re
import sys

with open(r"d:\GitHub Repo\gyschordweb\docs\css\04-viewer.css", "r", encoding="utf-8") as f:
    content = f.read()

# 1. Update .custom-midi-player
midi_player_pattern = re.compile(r'\.custom-midi-player\s*\{[^}]*\}', re.DOTALL)
midi_player_repl = '''.custom-midi-player {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 500px;
  position: relative;
  border-radius: 20px;
  background: var(--md-sys-color-surface-container-highest);
  box-shadow: 0 8px 32px rgba(0,0,0,0.1), 0 2px 8px rgba(0,0,0,0.05);
  border: 1px solid color-mix(in srgb, var(--md-sys-color-outline-variant) 50%, transparent);
  padding: 12px 20px;
  overflow: visible;
  transition: all 0.3s cubic-bezier(0.2, 0, 0, 1);
}'''
content = midi_player_pattern.sub(midi_player_repl, content, count=1)


# 2. Update .player-slider thumb and track
track_webkit = re.compile(r'\.player-slider::-webkit-slider-runnable-track\s*\{[^}]*\}', re.DOTALL)
track_webkit_repl = '''.player-slider::-webkit-slider-runnable-track {
  width: 100%;
  height: 8px;
  background: var(--md-sys-color-surface-variant);
  border-radius: 4px;
  border: none;
}'''
content = track_webkit.sub(track_webkit_repl, content)

track_moz = re.compile(r'\.player-slider::-moz-range-track\s*\{[^}]*\}', re.DOTALL)
track_moz_repl = '''.player-slider::-moz-range-track {
  width: 100%;
  height: 8px;
  background: var(--md-sys-color-surface-variant);
  border-radius: 4px;
  border: none;
}'''
content = track_moz.sub(track_moz_repl, content)

thumb_webkit = re.compile(r'\.player-slider::-webkit-slider-thumb\s*\{[^}]*\}', re.DOTALL)
thumb_webkit_repl = '''.player-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--md-sys-color-primary);
  margin-top: -4px;
  box-shadow: 0 2px 5px rgba(0,0,0,0.3);
  transition: transform 0.1s;
}'''
content = thumb_webkit.sub(thumb_webkit_repl, content)

thumb_moz = re.compile(r'\.player-slider::-moz-range-thumb\s*\{[^}]*\}', re.DOTALL)
thumb_moz_repl = '''.player-slider::-moz-range-thumb {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--md-sys-color-primary);
  border: none;
  box-shadow: 0 2px 5px rgba(0,0,0,0.3);
  transition: transform 0.1s;
}'''
content = thumb_moz.sub(thumb_moz_repl, content)

seekbar_fill = re.compile(r'\.seekbar-fill\s*\{[^}]*\}', re.DOTALL)
seekbar_fill_repl = '''.seekbar-fill {
  position: absolute;
  top: 50%;
  left: 0;
  height: 8px;
  background: var(--md-sys-color-primary);
  border-radius: 4px;
  transform: translateY(-50%);
  z-index: 1;
  pointer-events: none;
  width: 0%;
  transition: width 0.1s linear;
}'''
content = seekbar_fill.sub(seekbar_fill_repl, content, count=1)


# 3. Time styling
time_pattern = re.compile(r'\.player-time\s*\{[^}]*\}', re.DOTALL)
time_repl = '''.player-time {
  font-size: 0.75rem;
  color: var(--md-sys-color-on-surface-variant);
  font-family: inherit;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  font-weight: 600;
  margin-bottom: 4px;
}'''
content = time_pattern.sub(time_repl, content)


# 4. Instrument capsule
capsule_pattern = re.compile(r'\.instrument-capsule-btn\s*\{[^}]*\}', re.DOTALL)
capsule_repl = '''.instrument-capsule-btn {
  background: var(--md-sys-color-secondary-container);
  color: var(--md-sys-color-on-secondary-container);
  border: 1px solid var(--md-sys-color-outline-variant);
  border-radius: 12px;
  height: 48px;
  padding: 0 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.2, 0, 0, 1);
  box-shadow: 0 2px 4px rgba(0,0,0,0.04);
  font-weight: 500;
}'''
content = capsule_pattern.sub(capsule_repl, content)


# 5. Appending absolute overrides to be safe and cover popover/playbtn nicely
extra_css = """
/* REDESIGN OVERRIDES */
.custom-midi-player .player-btn, .custom-midi-player #custom-play-btn {
  background: var(--md-sys-color-primary) !important;
  color: var(--md-sys-color-on-primary) !important;
  border-radius: 50% !important;
  width: 48px !important;
  height: 48px !important;
  border: none !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  box-shadow: 0 4px 12px color-mix(in srgb, var(--md-sys-color-primary) 30%, transparent) !important;
  aspect-ratio: 1/1 !important;
  padding: 0 !important;
}

.custom-midi-player .player-btn:hover {
  transform: scale(1.08) !important;
  background: color-mix(in srgb, var(--md-sys-color-primary) 85%, black) !important;
}

.custom-midi-player .player-btn .material-symbols-outlined {
  font-size: 28px !important;
  margin: 0 !important;
}

.custom-midi-player .custom-player-controls {
  gap: 16px;
}

.custom-midi-player .cis-menu-popover {
  background: var(--md-sys-color-surface-container-high) !important;
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
  border: 1px solid var(--md-sys-color-outline-variant) !important;
  border-radius: 12px !important;
}

.custom-midi-player .player-time {
  position: static !important;
  display: block;
}
.player-track-container {
  display: flex;
  flex-direction: column;
  justify-content: center;
}
"""

if "/* REDESIGN OVERRIDES */" not in content:
    content += "\\n" + extra_css

with open(r"d:\GitHub Repo\gyschordweb\docs\css\04-viewer.css", "w", encoding="utf-8") as f:
    f.write(content)

print("Updated CSS in docs/css/04-viewer.css")
