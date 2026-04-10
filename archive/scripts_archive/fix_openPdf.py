import re

with open('docs/js/07-pdf-viewer.js', 'r', encoding='utf-8') as f:
    text = f.read()

pattern = r'(?<=if \(typeof mainMidiPlayer !== "undefined" && mainMidiPlayer && midiToggleBtn\) \{)(\s*)(const rawUrl)'
replacement = r'''\1let volNode = window.Tone && (window.Tone.Destination || window.Tone.Master);
    if (mainMidiPlayer.playing && volNode && volNode.volume) {
      volNode.volume.rampTo(-60, 0.2);
      await new Promise(r => setTimeout(r, 200));
      mainMidiPlayer.stop();
      volNode.volume.value = 0; // Restore volume
    }
\1\2'''

text_new = re.sub(pattern, replacement, text)

with open('docs/js/07-pdf-viewer.js', 'w', encoding='utf-8') as f:
    f.write(text_new)

print('Updated openPdfViewer with fade out')
