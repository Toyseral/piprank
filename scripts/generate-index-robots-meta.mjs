import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST = join(__dirname, '..', 'dist');
const file = join(DIST, 'index.html');
const isProduction = process.env.VERCEL_ENV === 'production';
let html = readFileSync(file, 'utf-8');
const robots = isProduction ? 'index, follow, max-image-preview:large' : 'noindex, nofollow, noarchive';
html = html.replace(/<meta name="robots" content="[^"]*"\s*\/>/, `<meta name="robots" content="${robots}" />`);
writeFileSync(file, html, 'utf-8');
console.log(`[generate-index-robots-meta] ${isProduction ? 'indexable' : 'noindex'} default shell.`);
