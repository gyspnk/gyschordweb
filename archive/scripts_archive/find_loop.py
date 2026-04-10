import os
from pathlib import Path
import re

history_dir = os.path.expandvars(r'%APPDATA%\Code\User\History')
matches = []
for p in Path(history_dir).rglob('*'):
    if p.is_file():
        try:
            with open(p, 'r', encoding='utf-8') as f:
                content = f.read()
                if 'custom-loop-btn' in content and 'autonext-btn' in content:
                    matches.append((p.stat().st_mtime, p))
        except:
            pass

matches.sort(reverse=True)
if matches:
    with open(matches[0][1], 'r', encoding='utf-8') as f:
        text = f.read()
        btn = re.search(r'<button[^>]*id="custom-loop-btn".*?</button>', text, re.DOTALL)
        if btn:
            print("CUSTOM LOOP:\n" + btn.group(0))
        btn2 = re.search(r'<button[^>]*id="mini-loop-btn".*?</button>', text, re.DOTALL)
        if btn2:
            print("MINI LOOP:\n" + btn2.group(0))
