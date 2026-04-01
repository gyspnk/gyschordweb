import re
with open('debug_preload_target.txt', 'r', encoding='utf-8') as f:
    old_func = f.read()
with open('docs/js/07-pdf-viewer.js', 'r', encoding='utf-8') as f:
    text = f.read()
new_func = old_func.replace('Promise.all(loadPromises).then(() => {', '''  const complete = () => {')
new_func = new_func.replace('''    const activeIndex = steps.indexOf(startTranspose);
    if (activeIndex >= 0) {
        await loadPromises[activeIndex];
    } else {
        await loadPromises[0];
    }''', '')
new_func = new_func.replace('''  const loadPromises = steps.map((st, i) => {''', '''  // Helper to load single sequential transpose
  const loadSingleTranspose = async (index) => {
    const st = steps[index];
    const i = index;''')
new_func = new_func.replace('''    });
  });''', '''    });
  };''')
new_func = new_func.replace('''  // Store duration
  const knownDuration = seq.totalTime || MIDI_PLAYER_POOL[startTranspose]?.duration || 0;''', '''  const activeIndex = steps.indexOf(startTranspose) >= 0 ? steps.indexOf(startTranspose) : steps.indexOf(0);
  await loadSingleTranspose(activeIndex); // load main player

  const knownDuration = seq.totalTime || MIDI_PLAYER_POOL[activeIndex]?.duration || 0;''')
new_func = new_func.replace('''        _midiPoolPreloaded = true;
        _midiPoolPreloading = false;
        if (typeof midiPreloadBar !== 'undefined'; midiPreloadBar) {
            midiPreloadBar.style.display = 'none';
        }
    });''', '''    };
  complete();

  // Load remainder in background
  (async () => {
      for(let j=0; j<steps.length; j++) {
          if (j === activeIndex) continue;
          await new Promise(res => setTimeout(res, 800)); // Wait before next load to avoid Tone audio jitter
          await loadSingleTranspose(j);
      }
      _midiPoolPreloaded = true;
      _midiPoolPreloading = false;
      if (typeof midiPreloadBar !== 'undefined' ; midiPreloadBar) {
          midiPreloadBar.style.display = 'none';
      }
  })();''')
if old_func in text:
    text = text.replace(old_func, new_func)
    with open('docs/js/07-pdf-viewer.js', 'w', encoding='utf-8') as f: f.write(text)
    print('Replaced everything correctly using AST logic script.')
else: print('old func not found in actual doc')
