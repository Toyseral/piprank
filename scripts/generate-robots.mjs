// Generate robots.txt at build time. The final production domain is configured
// via VITE_SITE_URL and is intentionally not hard-coded.

import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { requireSiteUrlForProduction } from './seo-config.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST = join(__dirname, '..', 'dist');
const vercelEnv = process.env.VERCEL_ENV;
const isProduction = vercelEnv === 'production';

let content;

if (isProduction) {
  const siteUrl = requireSiteUrlForProduction();
  content = `User-agent: *
Allow: /
Disallow: /archypage
Disallow: /archypage/
Disallow: /api/
Disallow: /go/
Disallow: /*?*

Sitemap: ${siteUrl}/sitemap.xml
`;
} else {
  content = `User-agent: *
Disallow: /
`;
}

writeFileSync(join(DIST, 'robots.txt'), content, 'utf-8');
console.log(`[generate-robots] Wrote ${isProduction ? 'production' : 'non-production'} robots.txt.`);
