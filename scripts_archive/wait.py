import re
with open('docs/js/05-events.js', 'r', encoding='utf-8') as f:
    text = f.read()

# Replace the Custom MIDI Controls Logic block completely to reset it to a clean working state.
old_logic_pattern = r'// Custom MIDI Controls Logic.*?if \(!isDraggingSeekbar[^\)]*\)'
# Actually, the file has standard code and the intervals. 
# We'll just replace the whole section starting from "if (customInstrumentSelect" up to the setInterval formatting chunk.
