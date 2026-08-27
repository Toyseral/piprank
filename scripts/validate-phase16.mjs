import fs from 'node:fs';
import path from 'node:path';
const root = process.cwd();
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const checks = [];
const check = (name, ok) => checks.push([name, Boolean(ok)]);

const sql = read('sql/PHASE-16-ADMIN-LOCALIZATION.sql');
check('SQL localization_ui_packs', sql.includes('localization_ui_packs'));
check('SQL localization_glossary', sql.includes('localization_glossary'));
check('SQL workflow_status', sql.includes('workflow_status'));

const api = read('api/content.js');
check('API UI packs handler', api.includes('handleLocalizationUiPacks'));
check('API glossary handler', api.includes('handleLocalizationGlossary'));
check('API health handler', api.includes('handleLocalizationHealth'));
check('API preview gate', api.includes("preview === 'true'") || api.includes("preview === '1'"));
check('API ready quality guard', api.includes('Meta description is required'));

const mgr = read('src/components/admin/LocalizationManager.tsx');
check('Health panel', mgr.includes('LocalizationHealthPanel'));
check('UI pack editor', mgr.includes('LocalizationUiPackEditor'));
check('Glossary editor', mgr.includes('LocalizationGlossaryEditor'));
check('Draft preview link', mgr.includes('preview=1'));
check('Ready issues checklist', mgr.includes('localizationReadyIssues') || mgr.includes('readyIssues'));

const page = read('src/pages/LocalizedCountrySeoTopic.tsx');
check('Preview mode', page.includes('preview'));
check('UI pack fetch', page.includes('fetchLocalizationUiPack'));
check('mergeLocalizationUi', page.includes('mergeLocalizationUi'));

const hub = read('src/pages/CountryDetail.tsx');
check('Hub hreflang alts', hub.includes('localizedAlts') && hub.includes('x-default'));

const sm = read('scripts/generate-sitemap.mjs');
check('Sitemap prefers DB locs', sm.includes('localizedLocs'));
check('Sitemap lastmod dedupe', sm.includes('byLoc'));

const pr = read('scripts/prerender.mjs');
check('Prerender skips writtenPaths for VI', pr.includes('writtenPaths.has(path)'));

const vercel = read('vercel.json');
check('Vercel UI packs rewrite', vercel.includes('localization-ui-packs'));
check('Vercel Cache-Control', vercel.includes('stale-while-revalidate'));

const failed = checks.filter(([, ok]) => !ok).map(([n]) => n);
if (failed.length) {
  console.error('Phase 16 validation failed:', failed.join(', '));
  process.exit(1);
}
console.log('Phase 16 validation passed:', checks.map(([n]) => n).join(', '));
