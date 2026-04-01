import re

with open('docs/js/08-chord-logic.js', 'r', encoding='utf-8') as f:
    text = f.read()

def replace_func(m):
    return """function updateFamilyChordUI() {
    const btns = document.querySelectorAll('.family-chord-btn');
    const miniKeyInfo = document.getElementById('mini-key-info');
    const dds = document.querySelectorAll('.family-chord-dropdown');
    
    let isMinor = false;
    let fallbackLabel = '?';
    let currentKeyString = '?';
    
    if (originalFamilyChord) {
      isMinor = originalFamilyChord.endsWith('m');
      const baseLabel = formatChordForDisplay(originalFamilyChord);
      fallbackLabel = baseLabel.replace(/[^A-G#b♭♯]/g, '') + (isMinor ? 'm' : '');
      const parsed = parseChordToken(originalFamilyChord);
      if (parsed) {
        const currentSemi = wrapSemitone(parsed.semitone + transposeStep + baseTransposeOffset);
        const noteSet = accidentalMode === "flat" ? NOTE_NAMES_FLAT : NOTE_NAMES_SHARP;
        currentKeyString = noteSet[currentSemi] + (isMinor ? 'm' : '');
      } else {
        currentKeyString = fallbackLabel;
      }
    } else if (typeof originalPdfKey !== 'undefined' && originalPdfKey) {
      isMinor = originalPdfKey.toLowerCase().endsWith('m');
      fallbackLabel = originalPdfKey;
      const pdfSemi = parsePdfKeyToSemitone(originalPdfKey);
      if (pdfSemi !== null) {
        const currentSemi = wrapSemitone(pdfSemi + transposeStep);
        const noteSet = accidentalMode === "flat" ? NOTE_NAMES_FLAT : NOTE_NAMES_SHARP;
        currentKeyString = noteSet[currentSemi] + (isMinor ? 'm' : '');
      } else {
        currentKeyString = fallbackLabel;
      }
    } else {
      currentKeyString = '-';
    }

    if (miniKeyInfo) miniKeyInfo.textContent = currentKeyString;

    btns.forEach(btn => {
      btn.textContent = currentKeyString !== '-' && currentKeyString !== '?' ? currentKeyString : fallbackLabel;
    });"""

text = re.sub(r'function updateFamilyChordUI\(\)\s*\{.*?\}\);', replace_func, text, flags=re.DOTALL)

with open('docs/js/08-chord-logic.js', 'w', encoding='utf-8') as f:
    f.write(text)
