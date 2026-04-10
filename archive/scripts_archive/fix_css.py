import re

with open('docs/css/04-viewer.css', 'r', encoding='utf-8') as f:
    text = f.read()

# First, remove old conflicting classes
classes_to_remove = [
    r'\.custom-midi-player, body\.measure-layout .custom-midi-player\s*\{[^}]*\}',
    r'\.custom-instrument-dropdown(?:\.is-open|:hover)?\s*\{[^}]*\}',
    r'\.cis-[a-zA-Z0-9-]+\s*(?:\([^)]*\)|:[^{]+)?\s*\{[^}]*\}', # any .cis-class or pseudos
    r'\.custom-player-controls\s*\{[^}]*\}',
    r'\.custom-midi-player\s*\{\s*display:\s*flex[^}]*\}',
    r'\.custom-midi-player\s*\.[a-zA-Z-]+\s*\{[^}]*\}',
]

for pat in classes_to_remove:
    text = re.sub(pat, '', text, flags=re.DOTALL | re.MULTILINE)

# Now, ensure we removed all .cis- correctly since regex might have failed. 
# Sometimes it's easier to just append !important to our new rules? No, better rewrite cleaner.
text = re.sub(r'\.cis-[a-zA-Z-]+\s*\{[^}]*\}', '', text, flags=re.DOTALL)
text = re.sub(r'\.cis-[a-zA-Z-]+\.[a-zA-Z-]+\s*\{[^}]*\}', '', text, flags=re.DOTALL)
text = re.sub(r'\.cis-[a-zA-Z-]+:[a-zA-Z-]+\s*\{[^}]*\}', '', text, flags=re.DOTALL)

# Add our beautifully designed layout block
new_css = '''
/* ------------------------------- */
/* Aesthetic Collapsible MIDI Player */
/* ------------------------------- */
.custom-midi-player {
  display: flex;
  flex-direction: column; /* controls on top, dropdown sliding out beneath */
  width: 100%;
  max-width: 400px;
  position: relative;
  border-radius: 12px;
  background: var(--md-sys-color-surface-container);
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  overflow: hidden; /* for smooth collapse */
}

/* Horizontal Player Controls */
.custom-player-controls {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  z-index: 2; /* keep above collapsed menu */
  background: var(--md-sys-color-surface-container);
  border-bottom: 1px solid transparent;
  transition: border-bottom-color 0.3s;
}

.custom-midi-player.is-open .custom-player-controls {
  border-bottom-color: var(--md-sys-color-outline-variant);
}

.instrument-toggle-btn {
  background: var(--md-sys-color-surface-container-highest);
  border: 1px solid var(--md-sys-color-outline-variant);
  border-radius: 8px;
  width: 42px;
  height: 42px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.2, 0, 0, 1);
  font-size: 1.4rem;
}

.instrument-toggle-btn:hover {
  background: var(--md-sys-color-primary-container);
  transform: scale(1.05);
}

.instrument-toggle-btn.active {
  background: var(--md-sys-color-primary);
  border-color: var(--md-sys-color-primary);
  box-shadow: inset 0 0 0 2px rgba(255,255,255,0.3);
}

.player-divider {
  width: 1px;
  height: 32px;
  background-color: var(--md-sys-color-outline-variant);
}

.seekbar-wrapper {
  position: relative;
  flex-grow: 1;
  display: flex;
  align-items: center;
  height: 24px;
}

.player-slider {
  width: 100%;
  cursor: pointer;
  margin: 0;
  accent-color: var(--md-sys-color-primary);
  z-index: 2;
  opacity: 0.8;
  transition: opacity 0.2s;
}

.player-slider:hover {
  opacity: 1;
}

.seekbar-fill {
  position: absolute;
  top: 50%;
  left: 0;
  height: 4px;
  background: var(--md-sys-color-primary);
  border-radius: 2px;
  transform: translateY(-50%);
  z-index: 1;
  pointer-events: none;
  width: 0%; 
}

/* Collapsible Menu Grid */
.cis-menu-collapsible {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows 0.3s cubic-bezier(0.25, 1, 0.5, 1);
  background: var(--md-sys-color-surface-container-low);
}

.custom-midi-player.is-open .cis-menu-collapsible {
  grid-template-rows: 1fr;
}

.cis-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(44px, 1fr));
  gap: 8px;
  padding: 0 12px;
  overflow: hidden; /* Hide contents during collapse */
  opacity: 0;
  transition: opacity 0.3s, padding 0.3s;
}

.custom-midi-player.is-open .cis-grid {
  opacity: 1;
  padding: 12px;
}

.cis-option {
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.4rem;
  background: var(--md-sys-color-surface-container);
  border: 1px solid transparent;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.cis-option:hover {
  background: var(--md-sys-color-surface-container-highest);
  transform: translateY(-2px);
  border-color: var(--md-sys-color-outline-variant);
  box-shadow: 0 4px 6px rgba(0,0,0,0.1);
}

.cis-option.selected {
  background: var(--md-sys-color-primary-container);
  border-color: var(--md-sys-color-primary);
  filter: brightness(1.1);
  transform: scale(1.05);
  box-shadow: 0 4px 8px rgba(0,0,0,0.15);
}

/* Animation for seek bar while playing */
@keyframes seekbar-glow {
  0% { box-shadow: 0 0 4px var(--md-sys-color-primary); }
  50% { box-shadow: 0 0 12px var(--md-sys-color-primary); }
  100% { box-shadow: 0 0 4px var(--md-sys-color-primary); }
}

.custom-midi-player.playing .seekbar-fill {
  animation: seekbar-glow 2s infinite;
}
'''

text = text + new_css

with open('docs/css/04-viewer.css', 'w', encoding='utf-8') as f:
    f.write(text)

print('CSS Updated!')
