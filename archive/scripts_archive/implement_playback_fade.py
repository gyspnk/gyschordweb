import re

with open('docs/js/05-events.js', 'r', encoding='utf-8') as f:
    text = f.read()

pattern = r'customPlayBtn\.addEventListener\(\"click\",\s*async\s*\(\)\s*=>\s*\{[\s\S]*?\}\s*\);\s*(?=\n\s*// Sync play state)'
replacement = '''customPlayBtn.addEventListener("click", async () => {
      let volNode = window.Tone && (window.Tone.Destination || window.Tone.Master);
      try {
        if (!mainMidiPlayer.playing) {
          customPlayIcon.textContent = "hourglass_empty"; // Loading state
          
          if (volNode && volNode.volume) {
             volNode.volume.value = -60; // Start silent
          }
          await mainMidiPlayer.start();
          if (volNode && volNode.volume) {
             volNode.volume.rampTo(0, 0.4); // Fade in
          }
          
          customPlayIcon.textContent = "pause";
          document.getElementById('custom-midi-player').classList.add("playing");
        } else {
          if (volNode && volNode.volume) {
             volNode.volume.rampTo(-60, 0.3); // Fade out
             await new Promise(r => setTimeout(r, 300));
          }
          mainMidiPlayer.stop();
          if (volNode && volNode.volume) {
             volNode.volume.value = 0; // Restore volume for next play
          }
          customPlayIcon.textContent = "play_arrow";
          document.getElementById('custom-midi-player').classList.remove("playing");
        }
      } catch (err) {
        console.error("Gagal start MIDI:", err);
        customPlayIcon.textContent = "play_arrow";
        document.getElementById('custom-midi-player').classList.remove("playing");
      }
    });'''

text_new = re.sub(pattern, replacement, text)

with open('docs/js/05-events.js', 'w', encoding='utf-8') as f:
    f.write(text_new)

print('Updated play/pause button with fade in/out')
