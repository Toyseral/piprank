import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const failures = [];

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function assert(condition, message) {
  if (!condition) failures.push(message);
}

const types = read('src/lib/canonicalHub/types.ts');
const resolver = read('src/lib/canonicalHub/resolver.ts');
const hubCandidates = [
  'src/lib/canonicalHub/CanonicalHub.tsx',
  'src/components/CanonicalHub.tsx',
  'src/CanonicalHub.tsx',
];
const hub = hubCandidates.find((file) => fs.existsSync(path.join(root, file)));

assert(types.includes("'country-guide'"), 'country-guide must remain a canonical content type');
assert(types.includes("'country-best-for'"), 'country-best-for must remain a canonical content type');
assert(!types.includes("'country-topic'"), 'country-topic must not be a canonical content type');
assert(!resolver.includes('country-topic:'), 'resolver must not resolve retired country-topic documents');
assert(!resolver.includes("type: 'country-topic'"), 'resolver must not emit country-topic routes');
assert(resolver.includes('country-guide:${countrySlug}:${slug}'), 'country guide resolver must use the canonical content key');
assert(resolver.includes('country-best-for:${countrySlug}:${slug}'), 'country Best-For resolver must use the canonical content key');
assert(!resolver.includes('countryGuide &&'), 'two-segment country URLs must never be claimed by country guides');

if (hub) {
  const hubText = read(hub);
  assert(hubText.includes("case 'country-guide'"), `${hub} must route country-guide to its informational renderer`);
  assert(hubText.includes("case 'country-best-for'"), `${hub} must route country-best-for to the Best-For renderer`);
}

const sql = read('sql/PHASE-17-CANONICAL-OWNERSHIP.sql');
assert(sql.includes("new.content_type = 'country-topic'"), 'SQL must reject new country-topic documents');
assert(sql.includes('content_documents_content_key_uidx'), 'SQL must enforce unique content keys');

if (failures.length) {
  console.error('Canonical ownership validation failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Canonical ownership validation passed.');
