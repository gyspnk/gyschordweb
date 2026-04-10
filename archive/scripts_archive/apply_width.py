import re
import sys

with open(r"d:\GitHub Repo\gyschordweb\docs\css\04-viewer.css", "r", encoding="utf-8") as f:
    content = f.read()

# Make width constant or fully animate width. 
# "width: max-content" doesn't animate well in CSS.
# Better approach: Make the instrument wrapper have a fixed width or just let the button have a fixed width so it doesn't jump.

# Replace max-content with 100% and auto or fixed sizing
custom_player = re.compile(r'\.custom-midi-player\s*\{\s*display:\s*flex;\s*flex-direction:\s*column;\s*width:\s*max-content;')
custom_player_repl = '''.custom-midi-player {
  display: flex;
  flex-direction: column;
  width: 100%;
  min-width: 320px;'''
content = custom_player.sub(custom_player_repl, content, count=1)

# Modify .instrument-capsule-btn to have a fixed width, or flex-grow
capsule_pattern = re.compile(r'\.instrument-capsule-btn\s*\{[^}]*\}', re.DOTALL)
capsule_repl = '''.instrument-capsule-btn {
  background: var(--md-sys-color-secondary-container);
  color: var(--md-sys-color-on-secondary-container);
  border: 1px solid var(--md-sys-color-outline-variant);
  border-radius: 20px;
  height: 40px;
  padding: 0 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
  box-shadow: 0 2px 4px rgba(0,0,0,0.04);
  font-weight: 500;
  width: 160px; /* Fixed width prevents jittering entirely */
  box-sizing: border-box;
}'''
content = capsule_pattern.sub(capsule_repl, content)

# Modify the cis-label overrides
cis_label_fix = re.compile(r'\.custom-midi-player \.cis-label\s*\{[\s\S]*?\}', re.DOTALL)

cis_label_new = '''.custom-midi-player .cis-label {
    flex-grow: 1;
    display: inline-block;
    text-align: left;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}'''

content = cis_label_fix.sub(cis_label_new, content)

# Remove the dynamic transition width sizing that wasn't working well
width_transition_regex = re.compile(r'\.custom-midi-player\s*\{\s*/\*\s*Smooth width container sizing\s*\*/[\s\S]*?\}', re.DOTALL)
content = width_transition_regex.sub('', content)

with open(r"d:\GitHub Repo\gyschordweb\docs\css\04-viewer.css", "w", encoding="utf-8") as f:
    f.write(content)

print("Applied strict width fixes to prevent jumping completely")
