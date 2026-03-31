with open('docs/js/07-pdf-viewer.js', 'r', encoding='utf-8') as f:
    text = f.read()

import re

# We want to change unction applyMidiInstrument() {
# to sync function applyMidiInstrument() {

pattern = r'function applyMidiInstrument\(\) \{[\s\S]*?(?=\n\}\n)'
replacement = '''async function applyMidiInstrument() {
  if (typeof mainMidiPlayer === "undefined" || !mainMidiPlayer || !mainMidiPlayer._originalSeq) return;

  const seq = mainMidiPlayer._originalSeq;
  let instrumentValue = "-1";
  if (prefs && prefs.midiInstrument !== undefined) {
    instrumentValue = prefs.midiInstrument;
  } else if (typeof customInstrumentSelect !== "undefined" && customInstrumentSelect && customInstrumentSelect.dataset.value) {
    instrumentValue = customInstrumentSelect.dataset.value;
  }

  const instrInt = parseInt(instrumentValue, 10);
  const currentTranspose = typeof transposeStep === 'number' ? transposeStep : 0;

  const wasPlaying = mainMidiPlayer.playing;
  const currTime = mainMidiPlayer.currentTime || 0;
  
  let volNode = window.Tone && (window.Tone.Destination || window.Tone.Master);

  // Crossfade out if playing
  if (wasPlaying && volNode && volNode.volume) {
      volNode.volume.rampTo(-60, 0.2);
      await new Promise(r => setTimeout(r, 200));
  }

  let newSequence = seq;
  if (instrInt >= 0 || currentTranspose !== 0) {
    // Kloning sequence memakai JSON deep copy agar aman
    const clonedObj = JSON.parse(JSON.stringify(seq));
    if (clonedObj && clonedObj.notes) {
      clonedObj.notes.forEach(note => {
        // Jangan timpa channel drum (biasanya isDrum bernilai true, atau channel 9 (0-indexed => channel 9 di config standar))
        if (!note.isDrum) {
          if (instrInt >= 0) note.program = instrInt;
          if (currentTranspose !== 0) {
            note.pitch += currentTranspose;
            if (note.pitch < 0) note.pitch = 0;
            if (note.pitch > 127) note.pitch = 127;
          }
        }
      });
    }
    newSequence = clonedObj;
  }

  mainMidiPlayer.noteSequence = newSequence;

  // Restore playback state so it does not interrupt the song
  if (wasPlaying && mainMidiPlayer.start) {
      try {
         mainMidiPlayer.currentTime = currTime;
         await mainMidiPlayer.start();
         if (volNode && volNode.volume) {
             volNode.volume.rampTo(0, 0.3);
         }
      } catch (e) {
        console.error("Error restarting player:", e);
      }
  } else if (!wasPlaying && currTime > 0) {
     setTimeout(() => {
         try {
             mainMidiPlayer.currentTime = currTime;
         } catch(e) {}
     }, 50);
     if (volNode && volNode.volume) {
         volNode.volume.value = 0; // Restore volume just in case
     }
  } else {
     if (volNode && volNode.volume) {
         volNode.volume.value = 0; // Restore volume just in case
     }
  }'''

# Extract old body bounds
start_idx = text.find('function applyMidiInstrument() {\n')
if start_idx != -1:
    end_idx = text.find('\n}\n', start_idx)
    new_text = text[:start_idx] + replacement + text[end_idx:]
    with open('docs/js/07-pdf-viewer.js', 'w', encoding='utf-8') as f:
        f.write(new_text)
    print("Replaced applyMidiInstrument")
else:
    print("Could not find applyMidiInstrument")
