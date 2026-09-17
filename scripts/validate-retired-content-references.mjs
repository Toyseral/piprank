import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SCAN_DIRS = ['api', 'src', 'scripts'];
const IGNORE = new Set([
  'scripts/validate-retired-content-references.mjs',
]);

const patterns = [
  { label: 'retired table: broker_content', re: /(?:from|into|update|delete\s+from)\s+['"]?broker_content\b|\.from\(['"]broker_content['"]\)/i },
  { label: 'retired runtime type: BrokerContent', re: /\bBrokerContent\b/ },
  { label: 'retired runtime helper: fetchBrokerContent', re: /\bfetchBrokerContent\b/ },
  { label: 'retired broker content API', re: /resource\s*=\s*['"]?content\b|resource=content\b/i },
  { label: 'retired table: country_best_for', re: /(?:from|into|update|delete\s+from)\s+['"]?country_best_for\b|\.from\(['"]country_best_for['"]\)/i },
  { label: 'retired table: localized_seo_pages', re: /(?:from|into|update|delete\s+from)\s+['"]?localized_seo_pages\b|\.from\(['"]localized_seo_pages['"]\)/i },
  { label: 'retired API: /api/guides', re: /\/api\/guides\b/ },
  { label: 'retired API: /api/country-best-for', re: /\/api\/country-best-for\b/ },
  { label: 'retired API: /api/localized-seo-pages', re: /\/api\/localized-seo-pages\b/ },
  { label: 'retired content type: country-topic', re: /['"`]country-topic['"`]/ },
  { label: 'retired content type: localized-seo', re: /['"`]localized-seo['"`]/ },
];

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (/\.(?:js|mjs|jsx|ts|tsx|json)$/.test(entry.name)) out.push(full);
  }
  return out;
}

const files = SCAN_DIRS.flatMap((dir) => fs.existsSync(dir) ? walk(path.join(ROOT, dir)) : []);
const failures = [];

for (const file of files) {
  const rel = path.relative(ROOT, file).replaceAll(path.sep, '/');
  if (IGNORE.has(rel)) continue;
  const text = fs.readFileSync(file, 'utf8');
  const lines = text.split(/\r?\n/);
  lines.forEach((line, index) => {
    for (const pattern of patterns) {
      if (pattern.re.test(line)) failures.push(`${rel}:${index + 1} — ${pattern.label}`);
    }
  });
}

if (failures.length) {
  console.error('Retired content references found:');
  for (const failure of failures) console.error(`  ${failure}`);
  process.exit(1);
}

console.log('[validate-retired-content] OK — no retired runtime/content references found');
