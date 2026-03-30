import re
with open('docs/js/05-events.js', 'r', encoding='utf-8') as f:
    text = f.read()

# We need to completely rewrite the MIDI control events to support the new IDs and play logic.
# The previous IDs were customInstrumentSelect, cisMenu, customPlayBtn. We kept them!
# customInstrumentSelect is now the instrument-toggle-btn which toggles the is-open class on custom-midi-player.

print(re.search(r'// Custom MIDI Controls Logic.*?// Seek bar formatting helper', text, re.DOTALL).group(0))
