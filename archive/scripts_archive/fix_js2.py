import re
with open('docs/js/05-events.js', 'r', encoding='utf-8') as f:
    text = f.read()

# Let's find the piece of code inside the option click handler
replacement = '''        const val = e.target.getAttribute('data-val');
        const text = e.target.textContent;
        customInstrumentSelect.dataset.value = val;
        
        let iconVal = "🎵";
        const valNum = parseInt(val, 10);
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
        if(val === "-1") iconVal = "🎵";

        const iconEl = document.getElementById("cis-icon");
        if(iconEl) iconEl.textContent = iconVal;'''

# Replace from 'const val = ...' to 'document.querySelectorAll'
text = re.sub(
    r'const val = e\.target\.getAttribute\(\'data-val\'\);[\s\S]*?(?=document\.querySelectorAll\(\'\.cis-option\'\))',
    replacement + '\n        ',
    text
)

with open('docs/js/05-events.js', 'w', encoding='utf-8') as f:
    f.write(text)
