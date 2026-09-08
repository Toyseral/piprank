import fs from 'node:fs';

const read = (p) => fs.readFileSync(p, 'utf8');
const checks = [
  ['canonical editor exists', 'src/components/admin/CanonicalPageEditor.tsx'],
  ['broker canonical editor exists', 'src/components/admin/CanonicalBrokerEditor.tsx'],
  ['country Best-For editor exists', 'src/components/admin/CanonicalCountryBestForEditor.tsx'],
  ['global Best-For hub exists', 'src/components/admin/CanonicalBestForHub.tsx'],
  ['guide visual editor exists', 'src/components/admin/GuideContentEditor.tsx'],
  ['broker-aware renderer exists', 'src/components/PageBlocksRenderer.tsx'],
  ['canonical country renderer exists', 'src/pages/CountrySeoTopic.tsx'],
  ['canonical global routes exist', 'src/App.tsx'],
];
for (const [label, path] of checks) {
  if (!fs.existsSync(path)) throw new Error(`Missing ${label}: ${path}`);
}
const app = read('src/App.tsx');
for (const slug of ['forex-brokers-for-beginners','mt5-forex-brokers','gold-forex-brokers']) {
  if (!app.includes(`/${slug}`)) throw new Error(`Missing canonical route /${slug}`);
}
const seo = read('src/lib/seo.ts');
if (!seo.includes("beginners: 'forex-brokers-for-beginners'")) throw new Error('Canonical SEO mapping missing beginners');
if (!seo.includes("mt5: 'mt5-forex-brokers'")) throw new Error('Canonical SEO mapping missing mt5');
if (!seo.includes("gold: 'gold-forex-brokers'")) throw new Error('Canonical SEO mapping missing gold');
const comparison = read('src/components/PipRankComparisonTable.tsx');
if (comparison.includes('ctaHref')) throw new Error('Comparison table must not use a shared ctaHref');
if (!comparison.includes('visitHref(b)')) throw new Error('Comparison table is missing per-broker CTA destinations');
console.log('Canonical editor architecture checks: OK');
