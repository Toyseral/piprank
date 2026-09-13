import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const scanRoots = ['src', 'api', 'scripts'];
const ignored = new Set(['node_modules', '.git', 'dist']);
const legacyPatterns = [
  /content_type\s*[:=]\s*['\"]country-topic['\"]/g,
  /content_type\s*[:=]\s*['\"]localized-seo-page['\"]/g,
  /country-topic:/g,
  /country_best_for/g,
];

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (/\.(ts|tsx|js|mjs)$/.test(entry.name)) files.push(full);
  }
  return files;
}

const hits = [];
for (const rootDir of scanRoots) {
  for (const file of walk(path.join(root, rootDir))) {
    const text = fs.readFileSync(file, 'utf8');
    for (const pattern of legacyPatterns) {
      pattern.lastIndex = 0;
      if (pattern.test(text)) {
        hits.push(path.relative(root, file));
        break;
      }
    }
  }
}

const uniqueHits = [...new Set(hits)].sort();
console.log(`Canonical ownership audit: ${uniqueHits.length} file(s) still reference legacy page ownership.`);
for (const file of uniqueHits) console.log(` - ${file}`);

// Advisory during migration. Once legacy systems are removed, change to
// exit(1) and keep it in the production build pipeline.
process.exit(0);
