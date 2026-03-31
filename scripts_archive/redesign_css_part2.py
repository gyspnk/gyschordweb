import re
import sys

with open(r"d:\GitHub Repo\gyschordweb\docs\css\04-viewer.css", "r", encoding="utf-8") as f:
    content = f.read()

# 1. Update padding of custom-midi-player to prevent leak
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
  padding: 4px 12px; /* reduced to ensure no leak on header */
  overflow: visible;
  transition: all 0.3s cubic-bezier(0.2, 0, 0, 1);
}'''
content = midi_player_pattern.sub(midi_player_repl, content, count=1)

# 2. Update .instrument-capsule-btn to smaller height
capsule_pattern = re.compile(r'\.instrument-capsule-btn\s*\{[^}]*\}', re.DOTALL)
capsule_repl = '''.instrument-capsule-btn {
  background: var(--md-sys-color-secondary-container);
  color: var(--md-sys-color-on-secondary-container);
  border: 1px solid var(--md-sys-color-outline-variant);
  border-radius: 20px;
  height: 40px; /* reduced from 48px */
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

# 3. Modify overrides (replace play button sizes)
# We will just write a regex to replace the entire /* REDESIGN OVERRIDES */ block to EOF
override_start = content.find("/* REDESIGN OVERRIDES */")
if override_start != -1:
    content = content[:override_start]

extra_css = """/* REDESIGN OVERRIDES */
.custom-midi-player .player-btn, .custom-midi-player #custom-play-btn {
  background: var(--md-sys-color-primary) !important;
  color: var(--md-sys-color-on-primary) !important;
  border-radius: 50% !important;
  width: 40px !important;
  height: 40px !important;
  border: none !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  box-shadow: 0 4px 12px color-mix(in srgb, var(--md-sys-color-primary) 30%, transparent) !important;
  aspect-ratio: 1/1 !important;
  padding: 0 !important;
  transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1), background 0.2s, box-shadow 0.2s !important;
}

.custom-midi-player .player-btn:hover {
  transform: scale(1.1) !important;
  background: color-mix(in srgb, var(--md-sys-color-primary) 85%, black) !important;
}

.custom-midi-player .player-btn:active {
  transform: scale(0.9) !important;
}

.custom-midi-player.playing .player-btn {
  animation: play-btn-pulse 1.5s infinite cubic-bezier(0.4, 0, 0.2, 1) !important;
}

@keyframes play-btn-pulse {
  0% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--md-sys-color-primary) 50%, transparent) !important; }
  70% { box-shadow: 0 0 0 12px transparent !important; }
  100% { box-shadow: 0 0 0 0 transparent !important; }
}

.custom-midi-player .player-btn .material-symbols-outlined {
  font-size: 24px !important;
  margin: 0 !important;
}

.custom-midi-player .custom-player-controls {
  gap: 12px;
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
  font-size: 0.70rem;
}

.player-track-container {
  display: flex;
  flex-direction: column;
  justify-content: center;
  margin-top: 2px;
}

.custom-midi-player.playing .seekbar-fill {
  background: linear-gradient(90deg, var(--md-sys-color-primary), var(--md-sys-color-tertiary)) !important;
  background-size: 200% 100% !important;
  animation: seekbar-glow 2s infinite alternate, seekbar-flow 3s infinite linear !important;
}

@keyframes seekbar-glow {
  0% { filter: brightness(1); box-shadow: 0 0 4px var(--md-sys-color-primary); }
  100% { filter: brightness(1.25); box-shadow: 0 0 10px var(--md-sys-color-primary); }
}
@keyframes seekbar-flow {
  0% { background-position: 100% 0; }
  100% { background-position: -100% 0; }
}
"""

content = content.rstrip() + "\\n\\n" + extra_css

with open(r"d:\GitHub Repo\gyschordweb\docs\css\04-viewer.css", "w", encoding="utf-8") as f:
    f.write(content)

print("Applied tweaks")
