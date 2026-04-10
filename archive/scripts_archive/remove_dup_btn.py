import re

with open("docs/index.html", "r", encoding="utf-8") as f:
    text = f.read()

# Pattern grabs the Auto Next Dropdown Trigger
pattern = r'<!-- Auto Next Dropdown Trigger -->\s*<div class="instrument-selector-wrapper flex-shrink-0" style="margin-left:8px;">\s*<button class="instrument-capsule-btn" id="autonext-btn"[\s\S]*?</select>\s*</div>\s*</div>\s*</div>'

text = re.sub(pattern, '', text)

with open("docs/index.html", "w", encoding="utf-8") as f:
    f.write(text)
