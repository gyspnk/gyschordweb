import re

with open("docs/index.html", "r", encoding="utf-8") as f:
    content = f.read()

# I will write a regex to find all <button ... class="cis-option"...>...emoji... Text</button>
# And replace the emoji with a material-symbols-outlined span.

def replace_emoji(match):
    full_btn = match.group(0)
    val = int(match.group(1))
    text_label = match.group(2)
    # determine icon based on ranges matching JS logic
    icon = "music_note"
    if 0 <= val <= 7: icon = "piano"
    elif 8 <= val <= 15: icon = "notifications_active" # pitched percussion
    elif 16 <= val <= 23: icon = "piano" # organs
    elif 24 <= val <= 31: icon = "queue_music" # guitars (using queue_music or graphic_eq)
    elif 32 <= val <= 39: icon = "queue_music" # bass
    elif 40 <= val <= 55: icon = "graphic_eq" # strings & ensemble
    elif 56 <= val <= 63: icon = "campaign" # brass
    elif 64 <= val <= 71: icon = "styler" # reed
    elif 72 <= val <= 79: icon = "media_link" # pipe
    else: icon = "music_note"

    # Some manual overrides for better matching
    if 24 <= val <= 39: icon = "music_note" # generic note for guitar/bass is better than library_music
    if 40 <= val <= 55: icon = "graphic_eq"
    
    # Strip existing emojis from text_label (like ðŸŽ¹ Grand Piano -> Grand Piano)
    # The emoji might be represented as unknown characters in raw text, we will just strip anything before the first alphanumeric character
    clean_text = re.sub(r'^[^a-zA-Z0-9(]+', '', text_label)
    
    return re.sub(r'>.*?([^<]+)</button>$', f'><span class="material-symbols-outlined cis-menu-icon">{icon}</span> {clean_text}</button>', full_btn)

# match <button ... data-val="0" ...>🎹 Grand Piano</button>
pattern = re.compile(r'<button[^>]+?class="cis-option[^>]+?data-val="([0-9]+)"[^>]*>([^<]+)</button>')

content = pattern.sub(replace_emoji, content)

with open("docs/index.html", "w", encoding="utf-8") as f:
    f.write(content)

print("Icons replaced in HTML")
