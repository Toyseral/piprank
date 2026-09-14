import fs from 'node:fs';
import path from 'node:path';
const root = process.cwd();
const failures = [];
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const assert = (ok, msg) => { if (!ok) failures.push(msg); };
const types = read('src/lib/canonicalHub/types.ts');
const resolver = read('src/lib/canonicalHub/resolver.ts');
const hubCandidates = ['src/pages/CanonicalHub.tsx','src/lib/canonicalHub/CanonicalHub.tsx','src/components/CanonicalHub.tsx','src/CanonicalHub.tsx'];
const hub = hubCandidates.find((p) => fs.existsSync(path.join(root, p)));
assert(types.includes("'country-guide'"), 'country-guide must remain a canonical type');
assert(types.includes("'country-best-for'"), 'country-best-for must remain a canonical type');
assert(!types.includes("'country-topic'"), 'country-topic must not be a canonical type');
assert(!resolver.includes('country-topic:'), 'resolver must not resolve country-topic documents');
assert(!resolver.includes("type: 'country-topic'"), 'resolver must not emit country-topic routes');
assert(resolver.includes('country-guide:${countrySlug}:${slug}'), 'country-guide key missing');
assert(resolver.includes('country-best-for:${countrySlug}:${slug}'), 'country-best-for key missing');
assert(resolver.includes("type: 'legacy-country-guide'"), 'legacy guide redirect route missing');
assert(!resolver.includes('countryGuide &&'), 'two-segment country URLs must not claim country-guide');
if (hub) {
  const text = read(hub);
  assert(text.includes("case 'country-guide'"), `${hub} must route country guides`);
  assert(text.includes("case 'country-best-for'"), `${hub} must route country Best-For`);
}
const sql = read('sql/PHASE-17-CANONICAL-OWNERSHIP.sql');
assert(sql.includes("new.content_type = 'country-topic'"), 'SQL must reject new country-topic documents');
assert(sql.includes('content_documents_content_key_uidx'), 'SQL must enforce unique content keys');
if (failures.length) { console.error('Canonical ownership validation failed:'); failures.forEach((x) => console.error(`- ${x}`)); process.exit(1); }
console.log('Canonical ownership validation passed.');
