import fs from 'node:fs';

const path = 'src/pages/Admin.tsx';
const text = fs.readFileSync(path, 'utf8');
const pattern = /onSave=\{async \(content\) => \{[\s\S]*?\}\}\s*\/>/;
const match = text.match(pattern);
if (!match) {
  if (!text.includes('/api/broker-assets?resource=content')) process.exit(0);
  throw new Error('Could not locate the broker editor parent onSave callback.');
}
const replacement = 'onSave={async () => {}} />';
fs.writeFileSync(path, text.replace(pattern, replacement), 'utf8');
