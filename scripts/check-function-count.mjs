import fs from 'node:fs';
import path from 'node:path';

const apiDir = path.resolve('api');
const files = fs.readdirSync(apiDir, { withFileTypes: true })
  .filter((e) => e.isFile() && /\.(js|ts|mjs|cjs)$/.test(e.name))
  .map((e) => e.name)
  .sort();
const count = files.length;
const max = 12;
console.log(`[function-count] top-level /api functions: ${count} (${files.join(', ')})`);
if (count > max) {
  console.error(`[function-count] ERROR: ${count} top-level API functions exceed the Hobby deployment ceiling of ${max}. Consolidate routes before deploying.`);
  process.exit(1);
}
