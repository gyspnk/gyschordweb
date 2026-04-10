import re

with open('docs/js/13-playlist-ui.js', 'r', encoding='utf-8') as f:
    text = f.read()

injection = """
    // Sync mini player icon with main player icon via MutationObserver
    const miniPlayIcon = document.getElementById('mini-play-icon');
    if (typeof customPlayIcon !== 'undefined' && customPlayIcon && miniPlayIcon) {
      const observer = new MutationObserver(mutations => {
        mutations.forEach(mutation => {
          if (mutation.type === 'childList' || mutation.type === 'characterData') {
            miniPlayIcon.textContent = customPlayIcon.textContent;
          }
        });
      });
      observer.observe(customPlayIcon, { characterData: true, childList: true, subtree: true });
      // trigger original sync
      miniPlayIcon.textContent = customPlayIcon.textContent;
    }
"""

text = re.sub(r'(if \(miniPlayBtn\) \{)', injection.strip() + r'\n\n    \1', text)

with open('docs/js/13-playlist-ui.js', 'w', encoding='utf-8') as f:
    f.write(text)
