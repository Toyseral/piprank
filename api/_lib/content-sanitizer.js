const ALLOWED_TAGS = new Set(['p','br','strong','em','b','i','u','s','blockquote','ul','ol','li','h2','h3','h4','a','img','figure','figcaption','table','thead','tbody','tr','th','td','hr','code','pre','mark','span','div']);
const ALLOWED_ATTRS = new Set(['href','title','target','rel','src','alt','width','height','loading','colspan','rowspan','class']);
const BLOCK_TYPES = new Set(['richtext','heading','image','table','callout','divider','links','structured_broker_data','broker_card','broker_grid','comparison_table','broker_cta','piprank_verdict']);
const EDITORIAL_SECTIONS = new Set(['editorial','pricing','platforms','trust','accounts','funding','introduction','why_these_brokers','who_its_for','who_its_not_for','detailed_analysis','methodology']);
const BLOCK_KEYS = {
  richtext: ['id','type','title','html','editorialSection'], heading: ['id','type','title','editorialSection'], image: ['id','type','title','src','alt','editorialSection'], table: ['id','type','title','rows','editorialSection'], callout: ['id','type','title','html','tone','editorialSection'], divider: ['id','type','title','editorialSection'], links: ['id','type','title','links','editorialSection'], structured_broker_data: ['id','type','title','brokerId','section','editorialSection'], broker_card: ['id','type','title','brokerId','variant','editorialSection'], broker_grid: ['id','type','title','brokerIds','variant','editorialSection'], comparison_table: ['id','type','title','brokerIds','fields','ctaLabel','showCta','editorialSection'], broker_cta: ['id','type','title','brokerId','variant','ctaLabel','ctaHref','headline','buttonLabel','editorialSection'], piprank_verdict: ['id','type','title','html','editorialSection'],
};
const COMPARISON_SETTING_FIELDS = new Set(['rating','trust_score','min_deposit','spread_eurusd','commission','max_leverage','platforms','payments','regulations']);

function cleanText(value, max = 500) { return String(value ?? '').trim().slice(0, max); }
function safeUrl(value, { image = false } = {}) {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  if (/^(https:\/\/|\/|#)/i.test(raw)) return raw;
  if (image && /^data:image\/(png|jpe?g|gif|webp);base64,/i.test(raw)) return raw;
  return null;
}
function sanitizeTag(raw) {
  const match = raw.match(/^<\s*(\/?)\s*([a-z0-9]+)([^>]*)>$/i);
  if (!match) return '';
  const closing = Boolean(match[1]);
  const tag = match[2].toLowerCase();
  if (!ALLOWED_TAGS.has(tag)) return '';
  if (closing) return `</${tag}>`;
  const attrs = [];
  const attrRe = /([:\w-]+)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/g;
  let attr;
  while ((attr = attrRe.exec(match[3] || ''))) {
    const name = attr[1].toLowerCase();
    if (!ALLOWED_ATTRS.has(name) || name.startsWith('on') || name === 'style') continue;
    const value = attr[2].replace(/^['"]|['"]$/g, '');
    if (name === 'href') { const safe = safeUrl(value); if (safe) attrs.push(`href="${safe.replaceAll('"', '&quot;')}"`); continue; }
    if (name === 'src') { const safe = safeUrl(value, { image: true }); if (safe) attrs.push(`src="${safe.replaceAll('"', '&quot;')}"`); continue; }
    attrs.push(`${name}="${value.replaceAll('"', '&quot;')}"`);
  }
  if (tag === 'a' && !attrs.some((x) => x.startsWith('rel='))) attrs.push('rel="noopener noreferrer"');
  return `<${tag}${attrs.length ? ` ${attrs.join(' ')}` : ''}>`;
}
export function sanitizeHtml(input = '') { return String(input).replace(/<!--[\s\S]*?-->/g, '').replace(/<[^>]*>/g, sanitizeTag).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim(); }
function cleanStringArray(value, max = 100, itemMax = 300) { return Array.isArray(value) ? value.filter((item) => typeof item === 'string').map((item) => cleanText(item, itemMax)).filter(Boolean).slice(0, max) : []; }
function cleanRows(value) { return Array.isArray(value) ? value.slice(0, 100).map((row) => Array.isArray(row) ? row.slice(0, 20).map((cell) => cleanText(cell, 500)) : []).filter((row) => row.length) : []; }
function cleanLinks(value) { return Array.isArray(value) ? value.slice(0, 100).map((link) => ({ label: cleanText(link?.label, 180), href: safeUrl(link?.href) || '#' })).filter((link) => link.label) : []; }
export function sanitizeBlock(block) {
  if (!block || typeof block !== 'object' || Array.isArray(block)) return null;
  const type = String(block.type || '').trim();
  if (!BLOCK_TYPES.has(type)) return null;
  const output = {};
  for (const key of BLOCK_KEYS[type]) if (block[key] !== undefined) output[key] = block[key];
  output.id = cleanText(output.id || `block_${Math.random().toString(36).slice(2, 10)}`, 120); output.type = type;
  if ('title' in output) output.title = cleanText(output.title, 300); if ('html' in output) output.html = sanitizeHtml(output.html); if ('src' in output) output.src = safeUrl(output.src, { image: true }); if ('alt' in output) output.alt = cleanText(output.alt, 300); if ('rows' in output) output.rows = cleanRows(output.rows); if ('links' in output) output.links = cleanLinks(output.links);
  if ('tone' in output && !['neutral','success','warning','dark'].includes(output.tone)) output.tone = 'neutral';
  if ('section' in output && !['overview','pricing','trust','platforms','features','editorial'].includes(output.section)) output.section = 'overview';
  if ('editorialSection' in output && !EDITORIAL_SECTIONS.has(output.editorialSection)) delete output.editorialSection;
  if ('variant' in output && !['default','compact','featured','primary','dark','soft'].includes(output.variant)) delete output.variant;
  if ('brokerId' in output) output.brokerId = Number.isFinite(Number(output.brokerId)) ? Number(output.brokerId) : null;
  if ('brokerIds' in output) output.brokerIds = Array.isArray(output.brokerIds) ? output.brokerIds.map(Number).filter(Number.isFinite).slice(0, 20) : [];
  if ('fields' in output) output.fields = cleanStringArray(output.fields, 20, 80).filter((field) => COMPARISON_SETTING_FIELDS.has(field));
  if ('ctaLabel' in output) output.ctaLabel = cleanText(output.ctaLabel, 180); if ('ctaHref' in output) output.ctaHref = safeUrl(output.ctaHref) || null; if ('headline' in output) output.headline = cleanText(output.headline, 300); if ('buttonLabel' in output) output.buttonLabel = cleanText(output.buttonLabel, 180); if ('showCta' in output) output.showCta = Boolean(output.showCta);
  return output;
}
export function sanitizeBlocks(blocks) { return Array.isArray(blocks) ? blocks.map(sanitizeBlock).filter(Boolean).slice(0, 200) : []; }

export function sanitizePublicSettings(settings) {
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) return {};
  const output = {};
  const keys = ['locale','languageCode','icon','label','criteria','sections','faqs','ranking_intent_slug','canonicalIntentSlug','image','rankingMode','pinnedBrokerSlugs','excludedBrokerSlugs','comparisonFields','role','short_bio','expertise','credentials','links','photo_url','display_order','author_slug','reviewed_by_slug','fact_checked_by_slug'];
  for (const key of keys) {
    const value = settings[key]; if (value === undefined || value === null) continue;
    if (key === 'rankingMode') { output[key] = value === 'manual' ? 'manual' : 'auto'; continue; }
    if (key === 'pinnedBrokerSlugs' || key === 'excludedBrokerSlugs' || key === 'expertise' || key === 'credentials') { output[key] = cleanStringArray(value, 100, 500); continue; }
    if (key === 'links') { output[key] = Array.isArray(value) ? value.slice(0, 20).map((item) => ({ label: cleanText(item?.label, 120), href: safeUrl(item?.href) || '#' })).filter((item) => item.label) : []; continue; }
    if (key === 'author_slug' || key === 'reviewed_by_slug' || key === 'fact_checked_by_slug') { output[key] = cleanText(value, 80).toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 80); continue; }
    if (key === 'display_order') { output[key] = Number.isFinite(Number(value)) ? Math.max(0, Math.min(10000, Number(value))) : 0; continue; }
    if (key === 'photo_url') { output[key] = safeUrl(value, { image: true }); continue; }
    if (key === 'comparisonFields') { output[key] = Array.isArray(value) ? value.filter((item) => typeof item === 'string' && COMPARISON_SETTING_FIELDS.has(item)).slice(0, 20) : []; continue; }
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') { output[key] = typeof value === 'string' ? cleanText(value, key === 'short_bio' ? 2000 : 500) : value; continue; }
    if (key === 'criteria') { output[key] = cleanStringArray(value, 100, 300); continue; }
    if (key === 'sections') { output[key] = Array.isArray(value) ? value.filter((item) => item && typeof item === 'object' && !Array.isArray(item)).map((item) => ({ title: item.title ? cleanText(item.title, 300) : undefined, html: item.html ? sanitizeHtml(item.html) : undefined })).slice(0, 100) : []; continue; }
    if (key === 'faqs') { output[key] = Array.isArray(value) ? value.filter((item) => item && typeof item === 'object' && !Array.isArray(item)).map((item) => ({ q: cleanText(item.q, 500), a: cleanText(item.a, 2000) })).filter((item) => item.q && item.a).slice(0, 100) : []; }
  }
  return output;
}
