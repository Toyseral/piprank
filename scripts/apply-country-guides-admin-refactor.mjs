import fs from 'node:fs';

const path = 'src/pages/Admin.tsx';
const text = fs.readFileSync(path, 'utf8');

const importLine = "import CountryGuides from './admin/CountryGuides';\n";
const importAnchor = "import PageBuilder, { blocksToHtml, type PageBlock } from '../components/PageBuilder';\n";

let next = text;
if (!next.includes(importLine)) {
  if (!next.includes(importAnchor)) throw new Error('Could not find Admin.tsx import anchor.');
  next = next.replace(importAnchor, importAnchor + importLine);
}

const marker = '<div className="rounded-2xl border border-line bg-white p-5"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-display text-lg font-bold text-ink-900">Country guides and SEO content</h3>';
const start = next.indexOf(marker);
if (start < 0) throw new Error('Country Guides section marker not found.');

const end = next.indexOf('<CountryLanguagesPanel', start);
if (end < 0) throw new Error('CountryLanguagesPanel boundary not found.');

const replacement = `<CountryGuides
              country={selected}
              countries={countries}
              brokers={brokers}
              token={token}
              notify={notify}
            />`;

next = next.slice(0, start) + replacement + next.slice(end);

if (next === text) throw new Error('No changes were made.');
fs.writeFileSync(path, next);
console.log('Country Guides admin section wired to src/pages/admin/CountryGuides.tsx');
console.log('Run: npx tsc -b');
