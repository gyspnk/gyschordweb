with open('docs/css/04-viewer.css', 'r', encoding='utf-8') as f:
    text = f.read()

# Fix the injected cis-menu block
text = text.replace('bottom: 100%;\n    left: 50%;\n    transform: translateX(-50%) translateY(10px)', 
                    'top: calc(100% + 8px);\n    left: 0;\n    transform: translateY(-10px)')

# Ensure active states translate normally
text = text.replace('transform: translateX(-50%) translateY(-10px) scale(1);', 
                    'transform: translateY(0) scale(1);')

with open('docs/css/04-viewer.css', 'w', encoding='utf-8') as f:
    f.write(text)
