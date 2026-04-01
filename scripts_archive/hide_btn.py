import re
with open("docs/index.html", "r", encoding="utf-8") as f:
    text = f.read()

text = text.replace('<button class="instrument-capsule-btn" id="autonext-btn"', '<button class="instrument-capsule-btn" id="autonext-btn" style="display:none;"')

with open("docs/index.html", "w", encoding="utf-8") as f:
    f.write(text)