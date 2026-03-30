import re

with open('docs/js/05-events.js', 'r', encoding='utf-8') as f:
    js = f.read()

replacement = """customInstrumentSelect.dataset.value = val;
        customInstrumentSelect.title = btn.getAttribute('title') || 'Pilih Alat Musik';"""

js = js.replace('customInstrumentSelect.dataset.value = val;', replacement)

replacement_sel = """document.querySelectorAll('.cis-option').forEach(o => o.classList.remove('selected'));
        btn.classList.add('selected');"""

# It's an array method so let's just make sure.
if ".forEach(o => o.classList.remove(" in js:
    print("Found selection reset block, maybe it exists.")
else:
    # Let's insert it before closing logic
    js = js.replace('customInstrumentSelect.dataset.value = val;', "btn.parentElement.querySelectorAll('.cis-option').forEach(o => o.classList.remove('selected'));\n        btn.classList.add('selected');\n        customInstrumentSelect.dataset.value = val;")


with open('docs/js/05-events.js', 'w', encoding='utf-8') as f:
    f.write(js)
