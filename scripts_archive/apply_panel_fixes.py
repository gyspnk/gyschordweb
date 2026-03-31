import re

with open(r"d:\GitHub Repo\gyschordweb\docs\css\04-viewer.css", "r", encoding="utf-8") as f:
    content = f.read()

# 1. completely replace .midi-panel logic
midi_panel_regex = re.compile(r'\.midi-panel\s*\{\s*display:\s*none;.*?margin-top:\s*8px;\s*z-index:\s*100;\s*\}', re.DOTALL)
midi_panel_repl = '''.midi-panel {
    /* Made transparent wrapping container to avoid box-in-box look */
    position: absolute;
    top: 100%;
    left: 0;
    margin-top: 8px;
    z-index: 100;
    opacity: 0;
    visibility: hidden;
    pointer-events: none;
    transform: translateY(-8px) scale(0.96);
    transform-origin: top left;
    transition: opacity 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), 
                transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), 
                visibility 0.25s;
  }'''
content = midi_panel_regex.sub(midi_panel_repl, content, count=1)

# replace toggle logic
toggle_regex = re.compile(r'@keyframes dropdown-pop[\s\S]*?#midi-toggle-btn\[aria-expanded="true"\] \+ \.midi-panel\s*\{[\s\S]*?\}', re.DOTALL)
toggle_repl = '''#midi-toggle-btn[aria-expanded="true"] + .midi-panel {
    opacity: 1;
    visibility: visible;
    pointer-events: auto;
    transform: translateY(0) scale(1);
    transition: opacity 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), 
                transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), 
                visibility 0s;
  }'''
content = toggle_regex.sub(toggle_repl, content, count=1)

# fix desktop expanded block
expanded_panel = re.compile(r'body\.is-expanded-layout \.midi-panel,\s*body\.measure-layout \.midi-panel\s*\{\s*display:\s*block\s*!important;\s*position:\s*static;\s*box-shadow:\s*none;\s*border:\s*none;\s*background:\s*transparent;\s*padding:\s*0;\s*margin-top:\s*0;\s*\}')
expanded_repl = '''body.is-expanded-layout .midi-panel, body.measure-layout .midi-panel { 
    opacity: 1 !important; visibility: visible !important; pointer-events: auto !important; transform: none !important;
    position: static; box-shadow: none; border: none; background: transparent; padding: 0; margin-top: 0; 
  }'''
content = expanded_panel.sub(expanded_repl, content, count=1)


# 2. Fix the .custom-midi-player max width
custom_player = re.compile(r'\.custom-midi-player\s*\{\s*display:\s*flex;\s*flex-direction:\s*column;\s*width:\s*100%;\s*max-width:\s*500px;')
custom_player_repl = '''.custom-midi-player {
  display: flex;
  flex-direction: column;
  width: max-content;
  max-width: calc(100vw - 32px); /* Prevent leaking off screen */'''
content = custom_player.sub(custom_player_repl, content, count=1)

# Append some fixes for the .cis-label jumping widths
extra_fixes = """
/* Improve dynamic width smoothing */
.custom-midi-player .cis-label {
    min-width: 90px;
    display: inline-block;
    text-align: left;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    transition: min-width 0.3s ease;
}
.custom-midi-player {
    /* Smooth width container sizing */
    transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) !important;
}

@media (max-width: 480px) {
    .custom-midi-player {
        max-width: calc(100vw - 16px);
    }
}
"""

content += "\\n" + extra_fixes

with open(r"d:\GitHub Repo\gyschordweb\docs\css\04-viewer.css", "w", encoding="utf-8") as f:
    f.write(content)

print("Applied panel and dynamic width fixes")
