with open('docs/js/05-events.js', 'r', encoding='utf-8') as f:
    text = f.read()

import re
oldText = text
text = re.sub(
    r'(// Prevent timeupdate from fighting with user interaction\s*customSeekbar\.addEventListener\(\'input\', \(\) => \{\s*isDraggingSeekbar[\s\S]*?window\._midiSavedTime = null;\s*\}\);)',
    r'''    // Prevent timeupdate from fighting with user interaction
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
    });''',
    text
)

text = text.replace('window._isSongLooping', "PlaylistManager.getAutoNextMode() === 'one'")
print(text != oldText)

with open('docs/js/05-events.js', 'w', encoding='utf-8') as f:
    f.write(text)
