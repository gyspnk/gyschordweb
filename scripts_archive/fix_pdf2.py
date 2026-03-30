import re

with open('docs/js/07-pdf-viewer.js', 'r', encoding='utf-8') as f:
    text = f.read()

replacement = '''      if (prefs.midiInstrument && typeof customInstrumentSelect !== "undefined" && customInstrumentSelect) {
        customInstrumentSelect.dataset.value = prefs.midiInstrument;
        const iconEl = document.getElementById("cis-icon");
        if (iconEl) {
          const option = document.querySelector(\.cis-option[data-val="\"]\);
          if (option) {
            const valNum = parseInt(prefs.midiInstrument, 10);
            let iconVal = "🎵";
            if (valNum >= 0 && valNum <= 7) iconVal = "🎹";
            else if (valNum >= 8 && valNum <= 15) iconVal = "🔔";
            else if (valNum >= 16 && valNum <= 23) iconVal = "🕍";
            else if (valNum >= 24 && valNum <= 31) iconVal = "🎸";
            else if (valNum >= 32 && valNum <= 39) iconVal = "🎸";
            else if (valNum >= 40 && valNum <= 47) iconVal = "🎻";
            else if (valNum >= 48 && valNum <= 55) iconVal = "🎻";
            else if (valNum >= 56 && valNum <= 63) iconVal = "🎺";
            else if (valNum >= 64 && valNum <= 71) iconVal = "🎷";
            else if (valNum >= 72 && valNum <= 79) iconVal = "🌬️";
            if(prefs.midiInstrument === "-1") iconVal = "🎵";
            iconEl.textContent = iconVal;
            
            // select active class
            document.querySelectorAll('.cis-option').forEach(opt => opt.classList.remove('selected'));
            option.classList.add('selected');
          }
        }
      }'''

text = re.sub(r'if \(prefs\.midiInstrument && typeof customInstrumentSelect.*?\n\s+midiToggleBtn\.style\.display', replacement + '\n\n      midiToggleBtn.style.display', text, flags=re.DOTALL)

with open('docs/js/07-pdf-viewer.js', 'w', encoding='utf-8') as f:
    f.write(text)
