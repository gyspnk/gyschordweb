import os
import json

ASSETS_PDF_DIR = os.path.join(os.path.dirname(__file__), 'assets', 'pdf')
ASSETS_CHORD_DIR = os.path.join(os.path.dirname(__file__), 'assets', 'chord')
OUTPUT_FILE = os.path.join(os.path.dirname(__file__), 'assets-list.json')       
CHORD_OUTPUT_FILE = os.path.join(os.path.dirname(__file__), 'chord-assets-list.json')

# List only non-txt files in the assets directory, Update 27/7/25 for folder restructure
def list_pdfs():
    if not os.path.exists(ASSETS_PDF_DIR): return []
    return sorted([
        f for f in os.listdir(ASSETS_PDF_DIR)
        if f.lower().endswith('.pdf') and os.path.isfile(os.path.join(ASSETS_PDF_DIR, f))
    ])

def list_chord_txts():
    if not os.path.exists(ASSETS_CHORD_DIR): return []
    return sorted([
        f for f in os.listdir(ASSETS_CHORD_DIR)
        if f.lower().endswith('.txt') and os.path.isfile(os.path.join(ASSETS_CHORD_DIR, f))
    ])

def main():
    pdfs = list_pdfs()
    chords = list_chord_txts()
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(pdfs, f, ensure_ascii=False, indent=2)
    with open(CHORD_OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(chords, f, ensure_ascii=False, indent=2)

if __name__ == '__main__':
    main()
