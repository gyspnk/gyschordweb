with open('docs/js/05-events.js', 'r', encoding='utf-8') as f:
    text = f.read()

# Replace cisLabel interaction with icon changing logic
old_js = '''          const val = e.target.getAttribute('data-val');
          const text = e.target.textContent;
          customInstrumentSelect.dataset.value = val;
          cisLabel.textContent = text;'''

new_js = '''          const val = e.target.getAttribute('data-val');
          const text = e.target.textContent;
          customInstrumentSelect.dataset.value = val;
          
          let iconVal = "🎵";
          const valNum = parseInt(val, 10);
          if (valNum >= 0 && valNum <= 7) iconVal = "🎹";
          else if (valNum >= 8 && valNum <= 15) iconVal = "🔔"; // mallets
          else if (valNum >= 16 && valNum <= 23) iconVal = "🕍"; // organs
          else if (valNum >= 24 && valNum <= 31) iconVal = "🎸"; // guitars
          else if (valNum >= 32 && valNum <= 39) iconVal = "🎸"; // bass
          else if (valNum >= 40 && valNum <= 47) iconVal = "🎻"; // strings
          else if (valNum >= 48 && valNum <= 55) iconVal = "🎻"; // strings ensemble
          else if (valNum >= 56 && valNum <= 63) iconVal = "🎺"; // brass
          else if (valNum >= 64 && valNum <= 71) iconVal = "🎷"; // sax
          else if (valNum >= 72 && valNum <= 79) iconVal = "🌬️"; // flute/pipe
          
          if(val == "-1") iconVal = "🎵";
          
          // Also set text for debugging or future if needed, but safe
          const iconEl = document.getElementById("cis-icon");
          if(iconEl) iconEl.textContent = iconVal;
'''

text = text.replace(old_js, new_js)

with open('docs/js/05-events.js', 'w', encoding='utf-8') as f:
    f.write(text)
