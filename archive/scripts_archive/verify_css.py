import re
with open('docs/css/04-viewer.css', 'r', encoding='utf-8') as f:
    text = f.read()

# Let's verify we replaced .cis-option successfully and it has correct colors.
print(re.search(r'\.cis-option\b[^{]*\{[^}]*\}', text, re.DOTALL).group(0))
