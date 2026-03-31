import re

with open(r"d:\GitHub Repo\gyschordweb\docs\css\04-viewer.css", "r", encoding="utf-8") as f:
    content = f.read()

# Fix midi-panel animation
midi_panel_toggle_pattern = re.compile(r'#midi-toggle-btn\[aria-expanded="true"\] \+ \.midi-panel\s*\{\s*display:\s*block;\s*\}')
midi_panel_anim = '''@keyframes dropdown-pop {
  0% { opacity: 0; transform: translateY(-8px) scale(0.96); }
  100% { opacity: 1; transform: translateY(0) scale(1); }
}
#midi-toggle-btn[aria-expanded="true"] + .midi-panel {
  display: block;
  transform-origin: top left;
  animation: dropdown-pop 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
}'''
content = midi_panel_toggle_pattern.sub(midi_panel_anim, content)

# Modify the play btn to remove overflow: hidden
content = content.replace("  overflow: hidden;", "  /* removed overflow hidden for shadows */")

# Improve seekbar animation: we replace the .seekbar-fill logic
# remove old seekbar shimmer animation blocks
content = re.sub(r'/\* Sheen effect over the seekbar when playing - looks very premium \*/.*?@keyframes seekbar-shimmer \{.*?\}', '', content, flags=re.DOTALL)

new_seekbar_css = """
/* Vibrant pulse for seekbar thumb instead of bar sheen */
.custom-midi-player.playing .player-slider::-webkit-slider-thumb {
  animation: none !important;
  box-shadow: 0 0 0 6px color-mix(in srgb, var(--md-sys-color-primary) 30%, transparent) !important;
  transition: box-shadow 0.2s ease !important;
}
.custom-midi-player.playing .player-slider::-moz-range-thumb {
  animation: none !important;
  box-shadow: 0 0 0 6px color-mix(in srgb, var(--md-sys-color-primary) 30%, transparent) !important;
  transition: box-shadow 0.2s ease !important;
}

/* Fluid moving gradient for track when playing */
.custom-midi-player.playing .seekbar-fill {
  background: linear-gradient(90deg, var(--md-sys-color-primary) 0%, color-mix(in srgb, var(--md-sys-color-primary) 50%, white) 50%, var(--md-sys-color-primary) 100%) !important;
  background-size: 200% 100% !important;
  animation: fluid-seekbar 2s linear infinite !important;
}

@keyframes fluid-seekbar {
  0% { background-position: 200% 0; }
  100% { background-position: 0% 0; }
}

/* Fix mobile squish layout */
@media (max-width: 480px) {
  .custom-midi-player .cis-label {
    display: none !important;
  }
  .custom-midi-player .instrument-capsule-btn {
    padding: 0 10px !important;
  }
  .custom-midi-player .custom-player-controls {
    gap: 8px !important;
  }
  .custom-midi-player .player-time {
    font-size: 0.65rem !important;
  }
  .custom-midi-player .player-btn {
    width: 36px !important;
    height: 36px !important;
  }
  .custom-midi-player .player-btn .material-symbols-outlined {
    font-size: 22px !important;
  }
}
"""

content = content + "\\n" + new_seekbar_css

with open(r"d:\GitHub Repo\gyschordweb\docs\css\04-viewer.css", "w", encoding="utf-8") as f:
    f.write(content)

print("Applied responsiveness and better animations")
