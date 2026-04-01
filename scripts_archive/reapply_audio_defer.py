import re

with open("docs/js/07-pdf-viewer.js", "r", encoding="utf-8") as f:
    text = f.read()

text = re.sub(
    r'(async function preloadAllTransposes\(seq, opts = \{\}\) \{\s*if \(!seq\) return;\s*const \{ forceStart = false, startTranspose = 0 \} = opts;)',
    r'''\1

    if (window.Tone && window.Tone.context.state !== 'running') {
        window._midiPendingPreloadSeq = seq;
        window._midiPendingPreloadOpts = opts;

        const knownDuration = seq.totalTime || 0;
        window._midiKnownDuration = knownDuration;
        if (typeof MidiTimeAuthority !== 'undefined') MidiTimeAuthority.setDuration(knownDuration);
        activeMidiPlayer = MIDI_PLAYER_POOL[startTranspose];
        return;
    }
    window._midiPendingPreloadSeq = null;''',
    text
)

text = text.replace('async function preloadAllTransposes(seq, opts = {}) {', 'window.preloadAllTransposes = async function(seq, opts = {}) {')
text = text.replace('preloadAllTransposes(seq, {', 'window.preloadAllTransposes(seq, {')
text = text.replace('preloadAllTransposes(_midiOriginalSeq, {', 'window.preloadAllTransposes(_midiOriginalSeq, {')

with open("docs/js/07-pdf-viewer.js", "w", encoding="utf-8") as f:
    f.write(text)

with open("docs/js/05-events.js", "r", encoding="utf-8") as f:
    text2 = f.read()

text2 = re.sub(
    r'(if \(window\.Tone && window\.Tone\.start\) \{\s*try \{ await window\.Tone\.start\(\);\s*\} catch \(e\) \{\}\s*\})',
    r'''\1
        if (typeof window.preloadAllTransposes === 'function' && window._midiPendingPreloadSeq) {
          const seq = window._midiPendingPreloadSeq;
          const opts = window._midiPendingPreloadOpts || {};
          window._midiPendingPreloadSeq = null;
          await window.preloadAllTransposes(seq, opts);
        }''',
    text2
)

with open("docs/js/05-events.js", "w", encoding="utf-8") as f:
    f.write(text2)
