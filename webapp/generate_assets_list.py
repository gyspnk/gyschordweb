import os
import json

ASSETS_DIR = os.path.join(os.path.dirname(__file__), 'assets')
OUTPUT_FILE = os.path.join(os.path.dirname(__file__), 'assets-list.json')

# List only PDF files in the assets directory
def list_pdfs():
    return sorted([
        f for f in os.listdir(ASSETS_DIR)
        if f.lower().endswith('.pdf') and os.path.isfile(os.path.join(ASSETS_DIR, f))
    ])

def main():
    pdfs = list_pdfs()
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(pdfs, f, ensure_ascii=False, indent=2)

if __name__ == '__main__':
    main()
