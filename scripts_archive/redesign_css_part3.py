import re
import sys

with open(r"d:\GitHub Repo\gyschordweb\docs\css\04-viewer.css", "r", encoding="utf-8") as f:
    content = f.read()

# remove old overrides
override_start = content.find("/* REDESIGN OVERRIDES */")
if override_start != -1:
    content = content[:override_start]

# We will inject a completely refined approach
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
  /* Add smooth transition for standard states */
  transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), background-color 0.3s ease, box-shadow 0.3s ease !important;
  position: relative;
  overflow: hidden;
}

/* Hover and Active squish */
.custom-midi-player .player-btn:hover {
  transform: scale(1.08) !important;
  background: color-mix(in srgb, var(--md-sys-color-primary) 85%, black) !important;
  box-shadow: 0 6px 16px color-mix(in srgb, var(--md-sys-color-primary) 40%, transparent) !important;
}
.custom-midi-player .player-btn:active {
  transform: scale(0.85) !important;
  box-shadow: 0 2px 6px color-mix(in srgb, var(--md-sys-color-primary) 50%, transparent) !important;
}

/* Playing state pulsing - subtle and smooth */
.custom-midi-player.playing .player-btn {
  animation: smooth-pulse 2s infinite cubic-bezier(0.4, 0, 0.2, 1) !important;
}

@keyframes smooth-pulse {
  0% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--md-sys-color-primary) 40%, transparent); }
  50% { box-shadow: 0 0 0 10px rgba(0,0,0,0); }
  100% { box-shadow: 0 0 0 0 rgba(0,0,0,0); }
}

/* The play/pause Icon */
.custom-midi-player .player-btn .material-symbols-outlined {
  font-size: 24px !important;
  margin: 0 !important;
  transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.2s ease !important;
}

/* Animate the icon when playing (e.g. from play -> pause) */
.custom-midi-player.playing .player-btn .material-symbols-outlined {
  transform: rotate(180deg) scale(0.9) !important;
}
.custom-midi-player:not(.playing) .player-btn .material-symbols-outlined {
  transform: rotate(0deg) scale(1) !important;
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

/* Smooth elegant seekbar fill */
.custom-midi-player .seekbar-fill {
  background: var(--md-sys-color-primary) !important;
  box-shadow: 0 0 4px color-mix(in srgb, var(--md-sys-color-primary) 50%, transparent) !important;
  transition: width 0.15s linear !important;
  position: absolute;
  overflow: hidden; /* For shimmer */
}

/* Sheen effect over the seekbar when playing - looks very premium */
.custom-midi-player.playing .seekbar-fill::after {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background: linear-gradient(
    90deg, 
    transparent 0%, 
    color-mix(in srgb, var(--md-sys-color-on-primary) 50%, transparent) 50%, 
    transparent 100%
  );
  transform: translateX(-100%);
  animation: seekbar-shimmer 2.5s infinite ease-in-out;
}

@keyframes seekbar-shimmer {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}

/* Slight thumb pulse when playing */
.custom-midi-player.playing .player-slider::-webkit-slider-thumb {
  animation: thumb-pulse 1.5s infinite alternate ease-in-out !important;
}
.custom-midi-player.playing .player-slider::-moz-range-thumb {
  animation: thumb-pulse 1.5s infinite alternate ease-in-out !important;
}

@keyframes thumb-pulse {
  0% { box-shadow: 0 1px 3px rgba(0,0,0,0.3), 0 0 0 0 color-mix(in srgb, var(--md-sys-color-primary) 50%, transparent); transform: scale(1); }
  100% { box-shadow: 0 1px 3px rgba(0,0,0,0.3), 0 0 0 6px color-mix(in srgb, var(--md-sys-color-primary) 20%, transparent); transform: scale(1.1); }
}
"""

content = content.rstrip() + "\\n\\n" + extra_css

with open(r"d:\GitHub Repo\gyschordweb\docs\css\04-viewer.css", "w", encoding="utf-8") as f:
    f.write(content)

print("Applied polished tweaks")
