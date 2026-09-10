import fs from 'node:fs';

const path = 'src/pages/Admin.tsx';
const text = fs.readFileSync(path, 'utf8');

const importLine = "import CountryGuides from './admin/CountryGuides';";
const importAnchor = "import PageBuilder, { blocksToHtml, type PageBlock } from '../components/PageBuilder';";

let next = text;
if (!next.includes(importLine)) {
  if (!next.includes(importAnchor)) throw new Error('Could not find Admin.tsx import anchor.');
  next = next.replace(importAnchor, `${importAnchor}\n${importLine}`);
}

const heading = 'Country guides and SEO content';
const headingIndex = next.indexOf(heading);
if (headingIndex < 0) throw new Error('Country Guides section heading not found.');

const sectionStart = next.lastIndexOf('<div className="rounded-2xl border border-line bg-white p-5">', headingIndex);
if (sectionStart < 0) throw new Error('Country Guides section start not found.');

const end = next.indexOf('<CountryLanguagesPanel', headingIndex);
if (end < 0) throw new Error('CountryLanguagesPanel boundary not found.');

const replacement = `<CountryGuides
              country={selected}
              countries={countries}
              brokers={brokers}
              token={token}
              notify={notify}
            />`;

next = next.slice(0, sectionStart) + replacement + next.slice(end);

if (next === text) throw new Error('No changes were made.');
fs.writeFileSync(path, next);
console.log('Country Guides admin section wired to src/pages/admin/CountryGuides.tsx');
console.log('Run: npx tsc -b');
