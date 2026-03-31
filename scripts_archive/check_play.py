with open('docs/js/05-events.js', 'r', encoding='utf-8') as f:
    text = f.read()

import re
matches = re.finditer(r'customPlayBtn\.addEventListener\(\"click\"[\s\S]{0,500}', text)
for m in matches:
    print(m.group(0))
