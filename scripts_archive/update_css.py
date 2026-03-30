import re

with open('docs/css/04-viewer.css', 'r', encoding='utf-8') as f:
    css = f.read()

# We need to change .custom-midi-player to remove overflow: hidden since that clips our new 
# absolutely positioned popover (we want it to popup visually regardless of container height)
css = re.sub(r'\.custom-midi-player\s*\{[^}]+\}', """.custom-midi-player {
  display: flex;
  flex-direction: column; 
  width: 100%;
  max-width: 400px; /* keep to small width */
  position: relative;
  border-radius: 100px; /* Fully rounded pill shape for MD3 player */
  background: var(--md-sys-color-surface-container-high);
  box-shadow: 0 4px 8px rgba(0,0,0,0.1), 0 1px 3px rgba(0,0,0,0.06);
  padding: 8px 16px;
  overflow: visible; /* CRITICAL: allows popover to break out of container bounds */
  transition: all 0.3s cubic-bezier(0.2, 0, 0, 1);
}""", css)

# Make sure the container holding controls has correct flex
css = re.sub(r'\.custom-player-controls\s*\{[^}]+\}', """.custom-player-controls {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  height: 48px;
}""", css)

# Wrap instrument selector wrapper (new container)
new_popover_css = """
.instrument-selector-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Material Design 3 Popover Menu - Adaptive Positioning */
.cis-menu-popover {
  position: absolute;
  /* Adaptive positioning: starts from bottom-right of button */
  bottom: calc(100% + 12px);
  right: 0;
  width: 320px;
  max-height: 400px;
  background: var(--md-sys-color-surface-container-lowest);
  border-radius: 16px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.15), 0 2px 8px rgba(0,0,0,0.1);
  border: 1px solid var(--md-sys-color-outline-variant);
  z-index: 1000;
  overflow-y: auto; /* Scrollable list */
  
  /* Hidden state */
  opacity: 0;
  visibility: hidden;
  transform: translateY(10px) scale(0.95);
  transform-origin: bottom right;
  transition: opacity 0.2s ease, transform 0.2s cubic-bezier(0.2, 0, 0, 1), visibility 0.2s;
}

/* Show when active */
.custom-midi-player.is-open .cis-menu-popover {
  opacity: 1;
  visibility: visible;
  transform: translateY(0) scale(1);
}

.cis-category {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-weight: 600;
  color: var(--md-sys-color-primary);
  margin: 16px 16px 8px 16px;
  padding-bottom: 4px;
  border-bottom: 1px solid var(--md-sys-color-outline-variant);
}

.cis-grid {
  display: flex;
  flex-direction: column;
  padding: 8px;
  gap: 2px;
}

.cis-option {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  text-align: left;
  font-size: 0.95rem;
  padding: 10px 16px;
  background: transparent;
  color: var(--md-sys-color-on-surface);
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.2s, color 0.2s;
  width: 100%;
}

.cis-option:hover {
  background: var(--md-sys-color-surface-variant);
  transform: none;
  box-shadow: none;
}

.cis-option.selected {
  background: var(--md-sys-color-secondary-container);
  color: var(--md-sys-color-on-secondary-container);
  font-weight: 600;
  transform: none;
  box-shadow: none;
}

/* Custom Scrollbar for Popover */
.cis-menu-popover::-webkit-scrollbar {
  width: 6px;
}
.cis-menu-popover::-webkit-scrollbar-track {
  background: transparent;
}
.cis-menu-popover::-webkit-scrollbar-thumb {
  background: var(--md-sys-color-outline-variant);
  border-radius: 3px;
}
"""

# Replace the old .cis-menu-collapsible logic
css = re.sub(r'\.cis-menu-collapsible\s*\{.*?(?=\/\* Animation for seek bar while playing)/s', new_popover_css + '\n\n', css, flags=re.DOTALL)

with open('docs/css/04-viewer.css', 'w', encoding='utf-8') as f:
    f.write(css)
