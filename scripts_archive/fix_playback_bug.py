import re

with open('docs/js/07-pdf-viewer.js', 'r', encoding='utf-8') as f:
    text = f.read()

# We need to re-attach listeners or fix seekbar synchronization when we replace the cloned noteSequence

new_func = '''function applyMidiInstrument() {
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
    mainMidiPlayer.noteSequence = clonedObj;
  } else {
    mainMidiPlayer.noteSequence = seq;
  }

  // Restore playback state so it does not interrupt the song
  if (wasPlaying && mainMidiPlayer.start) {
    requestAnimationFrame(() => {
      try {
         mainMidiPlayer.currentTime = currTime;
         mainMidiPlayer.start();
      } catch (e) {}
    });
  } else if (!wasPlaying && currTime > 0) {
      // If it was paused but had progress, restore the time
      requestAnimationFrame(() => {
         try {
             mainMidiPlayer.currentTime = currTime;
         } catch(e) {}
      });
  }
}'''

text = re.sub(r'function applyMidiInstrument\(\) \{.*?\n  \}\n\}', new_func, text, flags=re.DOTALL)

with open('docs/js/07-pdf-viewer.js', 'w', encoding='utf-8') as f:
    f.write(text)
print('Done fix playback')
