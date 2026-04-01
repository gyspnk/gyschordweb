const fs = require('fs');
let c = fs.readFileSync('docs/index.html', 'utf-8');

c = c.replace(
  /id="custom-loop-btn"[\s\S]*?style="padding-left: 12px; padding-right: 12px"/,
  'id="custom-loop-btn"\n                      type="button"\n                      aria-label="Loop Mode"\n                      style="padding: 0; width: 40px; justify-content: center;"'
);

c = c.replace(
  /id="autonext-btn"[\s\S]*?style="padding-left: 12px; padding-right: 12px"/,
  'id="autonext-btn"\n                      type="button"\n                      aria-haspopup="dialog"\n                      aria-expanded="false"\n                      title="Pengaturan Auto Next"\n                      style="padding: 0; width: 40px; justify-content: center;"'
);

fs.writeFileSync('docs/index.html', c);
console.log('patched');