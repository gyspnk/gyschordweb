import os
import re

def clean_file_content(content):
    # Remove the outer `document.addEventListener("DOMContentLoaded", () => {`
    # and the trailing `});`
    content = re.sub(r'document\.addEventListener\(\"DOMContentLoaded\", \(\) => {\s*', '', content, count=1)
    # Removing trailing `});`
    content = content.rstrip()
    if content.endswith('});'):
        content = content[:-3].rstrip()
    return content

def main():
    with open("docs/script.js", "r", encoding="utf-8") as f:
        raw_content = f.read()
    
    content = clean_file_content(raw_content)
    
    # Also extract the general configs/constants at the very top (before any // --- 1. DOM ---)
    # Actually, the file structure already has a natural top part.
    
    sections = re.split(r'(\n\s*// --- \d+\. .*? ---)', content)
    
    # sections[0] will be everything before the first section header (Config & Constants)
    # sections[1] will be the header // --- 1. DOM ---
    # sections[2] will be the content for DOM
    
    os.makedirs("docs/js", exist_ok=True)
    
    file_map = [
        ("01-config.js", "Config & Konstanta"),
        ("02-dom.js", "DOM"),
        ("03-state.js", "State"),
        ("04-init.js", "Init"),
        ("05-events.js", "Event Listeners"),
        ("06-navigation.js", "Navigasi utama"),
        ("07-pdf-viewer.js", "PDF Viewer"),
        ("08-chord-logic.js", "Chord Overlay Logic"),
        ("09-ui-helpers.js", "Tambahan UI"),
        ("10-zoom-gestures.js", "Zoom & gesture guards"),
        ("11-handlers.js", "Handlers lainnya")
    ]
    
    html_scripts = []
    
    # Write config
    header_config = "// --- 0. Konfigurasi & Konstanta ---\n"
    with open("docs/js/01-config.js", "w", encoding="utf-8") as f:
        f.write(header_config + sections[0].strip() + "\n")
    html_scripts.append('<script defer src="js/01-config.js"></script>')
    
    # Iterate through the rest
    file_idx = 1
    for i in range(1, len(sections), 2):
        header = sections[i].strip()
        body = sections[i+1].strip()
        
        # fix indentation (remove the 2 spaces from being inside DOMContent function)
        # We can just leave the indentation as is, it's fine, or auto unindent.
        lines = body.split('\n')
        unindented = []
        for line in lines:
            if line.startswith("  "):
                unindented.append(line[2:])
            else:
                unindented.append(line)
        final_body = '\n'.join(unindented)
        
        filename = file_map[file_idx][0]
        with open(f"docs/js/{filename}", "w", encoding="utf-8") as f:
            f.write(header + "\n" + final_body + "\n")
        
        html_scripts.append(f'<script defer src="js/{filename}"></script>')
        file_idx += 1
        
    print("Files created in docs/js/ :")
    for fname, _ in file_map:
        print(f" - {fname}")
        
    print("\n--- Insert into index.html ---")
    print("\n".join(html_scripts))

if __name__ == "__main__":
    main()
