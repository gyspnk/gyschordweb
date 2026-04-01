const fs = require('fs');
let c = fs.readFileSync('docs/js/07-pdf-viewer.js', 'utf-8');

c = c.replace(
  /window\.core[\s\n]*\.urlToNoteSequence\(encodeURI\(rawUrl\)\)[\s\n]*\.then\(\(seq\) => \{/,
  `window.core
            .urlToNoteSequence(encodeURI(rawUrl))
            .then((seq) => {
              if (!seq || !seq.notes || !Array.isArray(seq.notes) || seq.notes.length === 0) {
                console.warn('Empty or invalid sequence, aborting load.');
                window.isMidiSwitching = false;
                return;
              }`
);

fs.writeFileSync('docs/js/07-pdf-viewer.js', c);
console.log('patched');