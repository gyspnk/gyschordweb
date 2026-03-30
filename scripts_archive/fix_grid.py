import re
with open('docs/css/04-viewer.css', 'r', encoding='utf-8') as f:
    text = f.read()

# Make sure cis-grid has min-height: 0 and correct behavior
old_grid = '''.cis-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(44px, 1fr));
  gap: 8px;
  padding: 0 12px;
  overflow: hidden; /* Hide contents during collapse */
  opacity: 0;
  transition: opacity 0.3s, padding 0.3s;
}'''

new_grid = '''.cis-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(44px, 1fr));
  gap: 8px;
  padding: 0 12px;
  overflow: hidden; /* Hide contents during collapse */
  opacity: 0;
  min-height: 0;
  transition: opacity 0.3s, padding 0.3s, margin 0.3s;
  margin: 0;
}

.custom-midi-player.is-open .cis-grid {
  opacity: 1;
  padding: 12px;
  margin-bottom: 4px;
}'''

if old_grid in text:
    text = text.replace(old_grid, new_grid)
    with open('docs/css/04-viewer.css', 'w', encoding='utf-8') as f:
        f.write(text)
    print("Fixed CSS Grid child for 0fr.")
else:
    print("Not found")

