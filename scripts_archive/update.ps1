$path = "docs\css\04-viewer.css"
$content = Get-Content -Path $path -Raw

# Replace Custom MIDI player
$content = $content -replace '(?s)\.custom-midi-player \{.*?\}', '.custom-midi-player {
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
}'

# Replace Player btn main block
$content = $content -replace '(?s)\.player-btn \{.*?\}','.player-btn {
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
}'

$content = $content -replace '(?s)\.player-btn \.material-symbols-outlined \{.*?\}','.player-btn .material-symbols-outlined {
  font-size: 2rem;
  transition: transform 0.3s ease, opacity 0.2s ease-in-out;
}'

$content = $content -replace '(?s)\.player-btn:hover \{.*?\}','.player-btn:hover { 
  background: var(--md-sys-color-primary);
  color: var(--md-sys-color-on-primary);
  box-shadow: 0 6px 16px color-mix(in srgb, var(--md-sys-color-primary) 30%, transparent);
  transform: translateY(-2px) scale(1.05);
}'

$content = $content -replace '(?s)\.player-btn:active \{.*?\}','.player-btn:active { 
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
}'

# Seekbar wrapper
$content = $content -replace '(?s)\.seekbar-wrapper \{.*?\}','.seekbar-wrapper {
  position: relative;
  flex-grow: 1;
  display: flex;
  align-items: center;
  height: 32px;
  cursor: pointer;
}'

# Seekbar fill
$content = $content -replace '(?s)\.seekbar-fill \{.*?\}','.seekbar-fill {
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
}'

# Instrument capsule btn
$content = $content -replace '(?s)\.instrument-capsule-btn \{.*?\}','.instrument-capsule-btn {
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
}'

$content = $content -replace '(?s)\.instrument-capsule-btn:hover \{.*?\}','.instrument-capsule-btn:hover {
  background: var(--md-sys-color-surface-container-high);
  border-color: var(--md-sys-color-primary-container);
  transform: translateY(-2px);
  box-shadow: 0 6px 12px rgba(0,0,0,0.1);
}'

$content = $content -replace '(?s)\.instrument-capsule-btn:active \{.*?\}','.instrument-capsule-btn:active {
  transform: translateY(1px) scale(0.97);
}'

# cis menu popover
$content = $content -replace '(?s)\.cis-menu-popover \{.*?\}','.cis-menu-popover {
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
}'

Set-Content -Path $path -Value $content -NoNewline
Write-Host "Replaced CSS using PS"
