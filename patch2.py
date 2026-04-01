with open('docs/js/05-events.js', 'r', encoding='utf-8') as f:
    text = f.read()

import re

old_block = """    // Prevent timeupdate from fighting with user interaction
    customSeekbar.addEventListener('input', () => {
      isDraggingSeekbar = true;
      const dur = MidiTimeAuthority.getDuration() || window._midiKnownDuration || 0;
      const val = parseFloat(customSeekbar.value);
      customTimeDisplay.textContent = `${formatMidiTime(val)} / ${dur > 0 ? formatMidiTime(dur) : '0:00'}`;

      const fill = document.getElementById('custom-seekbar-fill');
      if (fill && dur > 0) fill.style.width = ((val / dur) * 100) + '%';
    });

    customSeekbar.addEventListener('change', () => {
      isDraggingSeekbar = false;
      if (_midiPoolPreloading) return;
      const val = parseFloat(customSeekbar.value);
      const dur = MidiTimeAuthority.getDuration() || window._midiKnownDuration || 0;

      const player = activeMidiPlayer;
      if (player) {
        const wasPlaying = player.playing;

        // Guard: block song-end detection during seek
        window.isMidiSwitching = true;

        // Ensure volume is audible (transition may have left it silent)
        const volNode = getToneVolNode();
        if (volNode && volNode.volume) {
          volNode.volume.cancelScheduledValues(window.Tone.now());
          volNode.volume.value = MIDI_TARGET_VOLUME;
        }

        try { player.currentTime = val; } catch(e) {}

        // html-midi-player may stop on currentTime set — restart if needed
        if (wasPlaying) {
          if (!player.playing) {
            try { player.start(); } catch(e) {}
          }
          // Re-seek after start (start() resets to 0), then unguard
          setTimeout(() => {
            try { player.currentTime = val; } catch(e) {}
            window.isMidiSwitching = false;
          }, 50);
        } else {
          window.isMidiSwitching = false;
        }
      }

      // Update authority to match
      MidiTimeAuthority.setTime(val, dur);
      syncSeekbarUI(val, dur);

      window._midiLastSeekValue = val;
      window._midiSavedTime = null;
    });"""

new_block = """    // Prevent timeupdate from fighting with user interaction
    const seekbars = [customSeekbar, document.getElementById('mini-seekbar')].filter(Boolean);
    seekbars.forEach(bar => {
      bar.addEventListener('input', (e) => {
        isDraggingSeekbar = true;
        const dur = MidiTimeAuthority.getDuration() || window._midiKnownDuration || 0;
        const val = parseFloat(e.target.value);
        if (customTimeDisplay) customTimeDisplay.textContent = `${formatMidiTime(val)} / ${dur > 0 ? formatMidiTime(dur) : '0:00'}`;
        const miniTimeDisplay = document.getElementById('mini-time-display');
        if (miniTimeDisplay) miniTimeDisplay.textContent = `${formatMidiTime(val)} / ${dur > 0 ? formatMidiTime(dur) : '0:00'}`;

        const fill = document.getElementById('custom-seekbar-fill');
        if (fill && dur > 0) fill.style.width = ((val / dur) * 100) + '%';
        const miniFill = document.getElementById('mini-seekbar-fill');
        if (miniFill && dur > 0) miniFill.style.width = ((val / dur) * 100) + '%';
      });

      bar.addEventListener('change', (e) => {
        isDraggingSeekbar = false;
        if (_midiPoolPreloading) return;
        const val = parseFloat(e.target.value);
        const dur = MidiTimeAuthority.getDuration() || window._midiKnownDuration || 0;

        const player = activeMidiPlayer;
        if (player) {
          const wasPlaying = player.playing;
          window.isMidiSwitching = true;
          const volNode = getToneVolNode();
          if (volNode && volNode.volume) {
            volNode.volume.cancelScheduledValues(window.Tone.now());
            volNode.volume.value = MIDI_TARGET_VOLUME;
          }
          try { player.currentTime = val; } catch(err) {}
          if (wasPlaying) {
            if (!player.playing) {
              try { player.start(); } catch(err) {}
            }
            setTimeout(() => {
              try { player.currentTime = val; } catch(err) {}
              window.isMidiSwitching = false;
            }, 50);
          } else {
            window.isMidiSwitching = false;
          }
        }
        MidiTimeAuthority.setTime(val, dur);
        syncSeekbarUI(val, dur);
        window._midiLastSeekValue = val;
        window._midiSavedTime = null;
      });
    });"""

text2 = text.replace(old_block, new_block)
import re

text2 = re.sub(r'if \(!window\._isSongLooping\)', 'if (PlaylistManager.getAutoNextMode() !== \'one\')', text2)
text2 = re.sub(r'if \(window\._isSongLooping\)', 'if (PlaylistManager.getAutoNextMode() === \'one\')', text2)

print("Replaced chunk:", old_block in text)

with open('docs/js/05-events.js', 'w', encoding='utf-8') as f:
    f.write(text2)
