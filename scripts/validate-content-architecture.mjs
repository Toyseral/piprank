import fs from 'node:fs';
import path from 'node:path';
const root = process.cwd();
const failures = [];
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const assert = (ok, msg) => { if (!ok) failures.push(msg); };
const resolver = read('src/lib/canonicalHub/resolver.ts');
const hub = read('src/pages/CanonicalHub.tsx');
const guide = read('src/pages/GuideTopic.tsx');
const countryGuides = read('src/pages/admin/CountryGuides.tsx');
const types = read('src/lib/canonicalHub/types.ts');
const pageManager = read('src/components/PageManager.tsx');
assert(!types.includes("'country-topic'"), 'country-topic is still declared as canonical type');
assert(!resolver.includes('country-topic:'), 'resolver still resolves country-topic');
assert(resolver.includes('country-guide:${countrySlug}:${slug}'), 'country guide key missing');
assert(resolver.includes('country-best-for:${countrySlug}:${slug}'), 'country Best-For key missing');
assert(hub.includes("case 'country-guide'"), 'CanonicalHub does not own country guides');
assert(hub.includes("case 'country-best-for'"), 'CanonicalHub does not own country Best-For');
assert(guide.includes('country-guide:'), 'GuideTopic does not load canonical country-guide documents');
assert(countryGuides.includes('UnifiedGuideEditor'), 'Country Guides is not using UnifiedGuideEditor');
assert(!pageManager.includes("content_type:'country-topic'"), 'PageManager can still create retired country-topic documents');
const forbidden = [
  'src/pages/CountrySeoTopic.tsx',
  'src/pages/VietnameseCountrySeoTopic.tsx',
];
for (const file of forbidden) assert(!fs.existsSync(path.join(root, file)), `${file} remains as an active renderer`);
if (failures.length) { console.error('[validate-content-architecture] FAILED'); failures.forEach((x) => console.error(`- ${x}`)); process.exit(1); }
console.log('[validate-content-architecture] PASS');
