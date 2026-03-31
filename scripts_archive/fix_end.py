with open('docs/js/07-pdf-viewer.js', 'r', encoding='utf-8') as f:
    text = f.read()

# Replace the broken end with the correct one
correct_end = '''  } else if (!wasPlaying && currTime > 0) {
      setTimeout(() => {
         try {
             mainMidiPlayer.currentTime = currTime;
         } catch(e) {}
      }, 50);
  }
}
'''

# Find the last   } else if (!wasPlaying && currTime > 0) {
pos = text.rfind('  } else if (!wasPlaying && currTime > 0) {')
if pos != -1:
    text = text[:pos] + correct_end
    with open('docs/js/07-pdf-viewer.js', 'w', encoding='utf-8') as f:
        f.write(text)
    print("Fixed end of file.")
else:
    print("Could not find the block.")
