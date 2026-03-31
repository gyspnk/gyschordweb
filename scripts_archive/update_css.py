import re
import os

path = r'd:\\GitHub Repo\\gyschordweb\\docs\\css\\04-viewer.css'
with open(path, 'r', encoding='utf-8') as f:
    css = f.read()

# Replace custom-midi-player
css = re.sub(
    r'\.custom-midi-player\s*\{[^}]*\}',
    '''.custom-midi-player {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 420px;
  position: relative;
  border-radius: 28px;
  background: var(--md-sys-color-surface-container-highest);
  box-shadow: 0 12px 32px rgba(0,0,0,0.12), 0 4px 12px rgba(0,0,0,0.08);
  border: 1px solid var(--md-sys-color-outline-variant);
  padding: 12px 20px;
  overflow: visible;
  transition: all 0.3s cubic-bezier(0.2, 0, 0, 1);
}''', css, count=1)

# Replace player-btn (the main block)
css = re.sub(
    r'\.player-btn\s*\{(?:\s|.)*?transition:\s*all\s*0\.2s\s*cubic-bezier\(0\.2,\s*0,\s*0,\s*1\);\s*\}',
    '''.player-btn {
  background: var(--md-sys-color-primary-container);
  color: var(--md-sys-color-on-primary-container);
  border: none;
  border-radius: 50%;
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 4px 12px color-mix(in srgb, var(--md-sys-color-primary) 15%, transparent);
  transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.3s ease, background 0.3s ease;
}''', css)

css = re.sub(
    r'\.player-btn\s*\.material-symbols-outlined\s*\{\s*font-size:\s*1\.8rem;.*?\}',
    '''.player-btn .material-symbols-outlined {
  font-size: 2rem;
  transition: transform 0.3s ease, opacity 0.2s ease-in-out;
}''', css, flags=re.DOTALL)

css = re.sub(
    r'\.player-btn:hover\s*\{.*?\}',
    '''.player-btn:hover { 
  background: var(--md-sys-color-primary);
  color: var(--md-sys-color-on-primary);
  box-shadow: 0 6px 16px color-mix(in srgb, var(--md-sys-color-primary) 30%, transparent);
  transform: translateY(-2px) scale(1.05);
}''', css, flags=re.DOTALL, count=1)

css = re.sub(
    r'\.player-btn:active\s*\{.*?\}',
    '''.player-btn:active { 
  transform: translateY(1px) scale(0.95);
  box-shadow: 0 2px 8px color-mix(in srgb, var(--md-sys-color-primary) 20%, transparent);
}
.custom-midi-player.playing .player-btn {
  animation: play-pulse 2s infinite ease-in-out;
}
@keyframes play-pulse {
  0% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--md-sys-color-primary) 40%, transparent); }
  70% { box-shadow: 0 0 0 12px color-mix(in srgb, var(--md-sys-color-primary) 0%, transparent); }
  100% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--md-sys-color-primary) 0%, transparent); }
}''', css, flags=re.DOTALL, count=1)

# Seekbar wrapper
css = re.sub(
    r'\.seekbar-wrapper\s*\{.*?\}',
    '''.seekbar-wrapper {
  position: relative;
  flex-grow: 1;
  display: flex;
  align-items: center;
  height: 32px;
  cursor: pointer;
}''', css, flags=re.DOTALL)

# Thumb styling
css = re.sub(
    r'/\*\s*Thumb styling\s*\*/(?:.*?)(?=\.seekbar-fill)',
    '''/* Thumb styling */
.player-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--md-sys-color-primary);
  margin-top: -4px;
  box-shadow: 0 2px 6px color-mix(in srgb, var(--md-sys-color-primary) 40%, transparent);
  transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.2s ease;
  border: 2px solid var(--md-sys-color-surface);
}
.player-slider::-moz-range-thumb {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--md-sys-color-primary);
  box-shadow: 0 2px 6px color-mix(in srgb, var(--md-sys-color-primary) 40%, transparent);
  transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.2s ease;
  border: 2px solid var(--md-sys-color-surface);
}

.player-slider:hover::-webkit-slider-thumb {
  transform: scale(1.3);
  box-shadow: 0 4px 10px color-mix(in srgb, var(--md-sys-color-primary) 50%, transparent);
}
.player-slider:hover::-moz-range-thumb {
  transform: scale(1.3);
  box-shadow: 0 4px 10px color-mix(in srgb, var(--md-sys-color-primary) 50%, transparent);
}
.player-slider:active::-webkit-slider-thumb {
  transform: scale(1.1);
}
.player-slider:active::-moz-range-thumb {
  transform: scale(1.1);
}

''', css, flags=re.DOTALL)

# Seekbar fill
css = re.sub(
    r'\.seekbar-fill\s*\{.*?\}',
    '''.seekbar-fill {
  position: absolute;
  top: 50%;
  left: 0;
  height: 8px;
  background: linear-gradient(90deg, var(--md-sys-color-primary-container), var(--md-sys-color-primary));
  border-radius: 4px;
  transform: translateY(-50%);
  z-index: 1;
  pointer-events: none;
  width: 0%;
  transition: width 0.1s linear;
  box-shadow: 0 1px 4px color-mix(in srgb, var(--md-sys-color-primary) 30%, transparent);
}''', css, flags=re.DOTALL)


css = re.sub(
    r'/\*\s*Optional:\s*animate fill when playing\s*\*/(.*?)(?=\.custom-player-controls)',
    '''/* Optional: animate fill when playing */
.custom-midi-player.playing .seekbar-fill {
  background-size: 200% 200%;
  animation: gradient-shift 2s ease infinite;
}

@keyframes gradient-shift {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}

''', css, flags=re.DOTALL)

# Instrument capsule btn
css = re.sub(
    r'\.instrument-capsule-btn\s*\{.*?\}',
    '''.instrument-capsule-btn {
  background: var(--md-sys-color-surface-container);
  border: 2px solid transparent;
  border-radius: 12px;
  height: 48px;
  padding: 0 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
  color: var(--md-sys-color-on-surface);
  box-shadow: 0 2px 6px rgba(0,0,0,0.06);
}''', css, flags=re.DOTALL, count=1)

css = re.sub(
    r'\.instrument-capsule-btn:hover\s*\{.*?\}',
    '''.instrument-capsule-btn:hover {
  background: var(--md-sys-color-surface-container-high);
  border-color: var(--md-sys-color-primary-container);
  transform: translateY(-2px);
  box-shadow: 0 6px 12px rgba(0,0,0,0.1);
}''', css, flags=re.DOTALL, count=1)

css = re.sub(
    r'\.instrument-capsule-btn:active\s*\{.*?\}',
    '''.instrument-capsule-btn:active {
  transform: translateY(1px) scale(0.97);
}''', css, flags=re.DOTALL, count=1)

css = re.sub(
    r'\.instrument-capsule-btn\.active\s*\{.*?\}(\s*)\.custom-midi-player\.is-open\s*\.instrument-capsule-btn\s*\{',
    '''.instrument-capsule-btn.active, 
.custom-midi-player.is-open .instrument-capsule-btn {''', css, flags=re.DOTALL, count=1)

# just directly replace .instrument-capsule-btn.active block
css = re.sub(
    r'\.instrument-capsule-btn\.active\s*\{.*?\}',
    '''.instrument-capsule-btn.active, 
.custom-midi-player.is-open .instrument-capsule-btn {
  background: var(--md-sys-color-primary-container);
  color: var(--md-sys-color-on-primary-container);
  border-color: var(--md-sys-color-primary);
  box-shadow: 0 4px 10px color-mix(in srgb, var(--md-sys-color-primary) 15%, transparent);
}''', css, flags=re.DOTALL, count=1)

# cis menu popover
css = re.sub(
    r'\.cis-menu-popover\s*\{.*?\}',
    '''.cis-menu-popover {
  position: absolute;
  top: calc(100% + 16px);
  left: auto;
  right: 0;
  width: auto;
  min-width: 280px;
  max-height: 450px;
  background: var(--md-sys-color-surface-container-high);
  border-radius: 20px;
  box-shadow: 0 20px 48px rgba(0,0,0,0.25), 0 8px 16px rgba(0,0,0,0.15);
  border: 1px solid var(--md-sys-color-outline-variant);
  z-index: 1000;
  overflow-y: auto;
  opacity: 0;
  visibility: hidden;
  transform: translateY(-15px) scale(0.9);
  transform-origin: top right;
  transition: opacity 0.25s ease, transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), visibility 0.25s;
}''', css, flags=re.DOTALL, count=1)

with open(path, 'w', encoding='utf-8') as f:
    f.write(css)
print("done")
