const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.join(__dirname, '..', 'docs', 'cnc-makromintak');
const dir = path.join(root, 'eredeti', 'KOMPONENSEK');
const files = fs.readdirSync(dir).filter(n => n.endsWith('.pgm')).sort();
const manifest = [];
for (const name of files) {
  const data = fs.readFileSync(path.join(dir, name));
  const text = new TextDecoder('windows-1250').decode(data);
  const lines = text.match(/[\x20-\x7e\u00a0-\u017f]{5,}/g) || [];
  const commands = lines.filter(s => /^(?:H DX=|;|(?:XFALC|ELF\w*|LAPA|LAPF|XBO|REF|POLC|PANT\w*)\s)/i.test(s));
  fs.writeFileSync(path.join(root, name + '.txt'), commands.join('\n') + '\n');
  manifest.push({file: 'eredeti/KOMPONENSEK/' + name, bytes: data.length, sha256: crypto.createHash('sha256').update(data).digest('hex')});
}
fs.writeFileSync(path.join(root, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
