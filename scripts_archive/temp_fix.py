import re

with open('docs/js/08-chord-logic.js', 'r', encoding='utf-8') as f:
    text = f.read()

# We want to find the whole function updateFamilyChordUI and replace it

def replace_func(m):
    return """function updateFamilyChordUI() {
    const btns = document.querySelectorAll('.family-chord-btn');
    const miniKeyInfo = document.getElementById('mini-key-info');
    const dds = document.querySelectorAll('.family-chord-dropdown');
    const isMinor = originalFamilyChord && originalFamilyChord.endsWith('m');
    const baseLabel = originalFamilyChord ? formatChordForDisplay(originalFamilyChord) : '?';

    // Format the label, extracting root, accidentals and adding 'm' if minor
    const label = baseLabel !== '?' ? (baseLabel.replace(/[^A-G#b♭♯]/g, '') + (isMinor ? 'm' : '')) : '?';

    if (miniKeyInfo) miniKeyInfo.textContent = label;

    btns.forEach(btn => {
      btn.textContent = label;
      // Highlight if selected chord is changed by transpose (we compute the current base chord)
      if (originalFamilyChord) {
         const parsed = parseChordToken(originalFamilyChord);
         if (parsed) {
           const currentSemi = wrapSemitone(parsed.semitone + transposeStep + baseTransposeOffset);
           const noteSet = accidentalMode === "flat" ? NOTE_NAMES_FLAT : NOTE_NAMES_SHARP;
           btn.textContent = noteSet[currentSemi] + (isMinor ? 'm' : '');
           if (miniKeyInfo) miniKeyInfo.textContent = btn.textContent;
         }
      }
    });"""

text = re.sub(r'function updateFamilyChordUI\(\).*?\}\);', replace_func, text, flags=re.DOTALL)

with open('docs/js/08-chord-logic.js', 'w', encoding='utf-8') as f:
    f.write(text)
