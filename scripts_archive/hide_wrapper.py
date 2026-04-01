import re
with open("docs/index.html", "r", encoding="utf-8") as f:
    text = f.read()

# Replace the autonext-btn wrapper display
text = text.replace('<div class="instrument-selector-wrapper flex-shrink-0" style="margin-left:8px;">\n                    <button class="instrument-capsule-btn" id="autonext-btn" style="display:none;"', '<div class="instrument-selector-wrapper flex-shrink-0" style="display:none; margin-left:8px;">\n                    <button class="instrument-capsule-btn" id="autonext-btn"')

with open("docs/index.html", "w", encoding="utf-8") as f:
    f.write(text)
