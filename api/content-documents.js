import supabase from './_lib/db-client.js';
import { requireRole } from './_lib/admin-guard.js';

const CONTENT_WRITE = ['super_admin', 'admin', 'content_admin'];
const RETIRED_CONTENT_TYPES = new Set(['country-topic', 'localized-seo']);
const CANONICAL_CONTENT_TYPES = new Set(['guide', 'global-best-for', 'country-guide', 'country-best-for', 'localized-guide', 'localized-best-for', 'broker', 'country']);
const ALLOWED_TAGS = new Set(['p','br','strong','em','b','i','u','s','blockquote','ul','ol','li','h2','h3','h4','a','img','figure','figcaption','table','thead','tbody','tr','th','td','hr','code','pre','mark','span','div']);
const ALLOWED_ATTRS = new Set(['href','title','target','rel','src','alt','width','height','loading','colspan','rowspan','class']);
const PUBLIC_FIELDS = 'id,content_key,content_type,country_slug,topic_slug,slug,title,excerpt,html,blocks,settings,seo_title,seo_description,indexable,published,updated_at';
const BLOCK_TYPES = new Set(['richtext','heading','image','table','callout','divider','links','structured_broker_data','broker_card','broker_grid','comparison_table','broker_cta','piprank_verdict']);
const BLOCK_KEYS = {
  richtext: ['id','type','title','html'], heading: ['id','type','title'], image: ['id','type','title','src','alt'], table: ['id','type','title','rows'],
  callout: ['id','type','title','html','tone'], divider: ['id','type','title'], links: ['id','type','title','links'],
  structured_broker_data: ['id','type','title','brokerId','section'], broker_card: ['id','type','title','brokerId','variant'], broker_grid: ['id','type','title','brokerIds','variant'],
  comparison_table: ['id','type','title','brokerIds','fields','ctaLabel','showCta'], broker_cta: ['id','type','title','brokerId','variant','ctaLabel','ctaHref','headline','buttonLabel'], piprank_verdict: ['id','type','title','html'],
};
const PUBLIC_SETTING_KEYS = ['locale','languageCode','icon','label','criteria','sections','faqs','ranking_intent_slug','canonicalIntentSlug','image'];

function slugify(value) { return String(value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''); }
function safeUrl(value, { image = false } = {}) {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  if (/^(https:\/\/|\/|#)/i.test(raw)) return raw;
  if (image && /^data:image\/(png|jpe?g|gif|webp);base64,/i.test(raw)) return raw;
  return null;
}
function sanitizeTag(raw) {
  const match = raw.match(/^<\s*(\/?)\s*([a-z0-9]+)([^>]*)>$/i); if (!match) return '';
  const closing = Boolean(match[1]); const tag = match[2].toLowerCase(); if (!ALLOWED_TAGS.has(tag)) return ''; if (closing) return `</${tag}>`;
  const attrs = []; const attrRe = /([:\w-]+)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/g; let attr;
  while ((attr = attrRe.exec(match[3] || ''))) { const name = attr[1].toLowerCase(); if (!ALLOWED_ATTRS.has(name) || name.startsWith('on') || name === 'style') continue; const value = attr[2].replace(/^['"]|['"]$/g, '');
    if (name === 'href') { const safe = safeUrl(value); if (safe) attrs.push(`href="${safe.replaceAll('"', '&quot;')}"`); continue; }
    if (name === 'src') { const safe = safeUrl(value, { image: true }); if (safe) attrs.push(`src="${safe.replaceAll('"', '&quot;')}"`); continue; }
    attrs.push(`${name}="${value.replaceAll('"', '&quot;')}"`);
  }
  if (tag === 'a' && !attrs.some((x) => x.startsWith('rel='))) attrs.push('rel="noopener noreferrer"');
  return `<${tag}${attrs.length ? ` ${attrs.join(' ')}` : ''}>`;
}
function cleanHtml(input = '') { return String(input).replace(/<!--[\s\S]*?-->/g, '').replace(/<[^>]*>/g, sanitizeTag).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim(); }
function cleanText(value, max = 500) { return String(value ?? '').trim().slice(0, max); }
function cleanStringArray(value, max = 100, itemMax = 300) { return Array.isArray(value) ? value.filter((item) => typeof item === 'string').map((item) => cleanText(item, itemMax)).filter(Boolean).slice(0, max) : []; }
function cleanRows(value) { return Array.isArray(value) ? value.slice(0, 100).map((row) => Array.isArray(row) ? row.slice(0, 20).map((cell) => cleanText(cell, 500)) : []).filter((row) => row.length) : []; }
function cleanLinks(value) { return Array.isArray(value) ? value.slice(0, 100).map((link) => ({ label: cleanText(link?.label, 180), href: safeUrl(link?.href) || '#' })).filter((link) => link.label) : []; }
function cleanBlock(block) {
  if (!block || typeof block !== 'object' || Array.isArray(block)) return null;
  const type = String(block.type || '').trim(); if (!BLOCK_TYPES.has(type)) return null;
  const output = {}; for (const key of BLOCK_KEYS[type]) if (block[key] !== undefined) output[key] = block[key];
  output.id = cleanText(output.id || `block_${Math.random().toString(36).slice(2, 10)}`, 120); output.type = type;
  if ('title' in output) output.title = cleanText(output.title, 300); if ('html' in output) output.html = cleanHtml(output.html); if ('src' in output) output.src = safeUrl(output.src, { image: true }); if ('alt' in output) output.alt = cleanText(output.alt, 300);
  if ('rows' in output) output.rows = cleanRows(output.rows); if ('links' in output) output.links = cleanLinks(output.links);
  if ('tone' in output && !['neutral','success','warning','dark'].includes(output.tone)) output.tone = 'neutral'; if ('section' in output && !['overview','pricing','trust','platforms','features','editorial'].includes(output.section)) output.section = 'overview';
  if ('variant' in output && !['default','compact','featured','primary','dark','soft'].includes(output.variant)) delete output.variant; if ('brokerId' in output) output.brokerId = Number.isFinite(Number(output.brokerId)) ? Number(output.brokerId) : null;
  if ('brokerIds' in output) output.brokerIds = Array.isArray(output.brokerIds) ? output.brokerIds.map(Number).filter(Number.isFinite).slice(0, 20) : []; if ('fields' in output) output.fields = cleanStringArray(output.fields, 20, 80);
  if ('ctaLabel' in output) output.ctaLabel = cleanText(output.ctaLabel, 180); if ('ctaHref' in output) output.ctaHref = safeUrl(output.ctaHref) || null; if ('headline' in output) output.headline = cleanText(output.headline, 300); if ('buttonLabel' in output) output.buttonLabel = cleanText(output.buttonLabel, 180); if ('showCta' in output) output.showCta = Boolean(output.showCta);
  return output;
}
function cleanBlocks(blocks) { return Array.isArray(blocks) ? blocks.map(cleanBlock).filter(Boolean).slice(0, 200) : []; }
function sanitizePublicSettings(settings) {
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) return {};
  const output = {};
  for (const key of PUBLIC_SETTING_KEYS) {
    const value = settings[key]; if (value === undefined || value === null) continue;
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') { output[key] = typeof value === 'string' ? value.slice(0, 500) : value; continue; }
    if (key === 'criteria') { output[key] = cleanStringArray(value, 100, 300); continue; }
    if (key === 'sections') { output[key] = Array.isArray(value) ? value.filter((item) => item && typeof item === 'object' && !Array.isArray(item)).map((item) => ({ title: item.title ? cleanText(item.title, 300) : undefined, html: item.html ? cleanHtml(item.html) : undefined })).slice(0, 100) : []; continue; }
    if (key === 'faqs') { output[key] = Array.isArray(value) ? value.filter((item) => item && typeof item === 'object' && !Array.isArray(item)).map((item) => ({ q: cleanText(item.q, 500), a: cleanText(item.a, 2000) })).filter((item) => item.q && item.a).slice(0, 100) : []; }
  }
  return output;
}
function toPublicDocument(document) { if (!document || typeof document !== 'object') return document; return { id: document.id, content_key: document.content_key, content_type: document.content_type, country_slug: document.country_slug, topic_slug: document.topic_slug, slug: document.slug, title: document.title, excerpt: document.excerpt, html: document.html, blocks: document.blocks, settings: sanitizePublicSettings(document.settings), seo_title: document.seo_title, seo_description: document.seo_description, indexable: document.indexable, published: document.published, updated_at: document.updated_at }; }
function canonicalKey({ contentType, countrySlug, slug, locale }) {
  if (!slug) return null;
  if (contentType === 'guide') return `guide:${slug}`;
  if (contentType === 'global-best-for') return `best-for:${slug}`;
  if (contentType === 'country-guide') return countrySlug ? `country-guide:${countrySlug}:${slug}` : null;
  if (contentType === 'country-best-for') return countrySlug ? `country-best-for:${countrySlug}:${slug}` : null;
  if (contentType === 'localized-guide') return countrySlug && locale ? `localized-guide:${countrySlug}:${locale}:${slug}` : null;
  if (contentType === 'localized-best-for') return countrySlug && locale ? `localized-best-for:${countrySlug}:${locale}:${slug}` : null;
  if (contentType === 'broker') return `broker:${slug}:main`;
  if (contentType === 'country') return `country:${slug}:hub`;
  return null;
}
function normalize(body, existing = null) {
  const contentType = existing?.content_type || String(body.content_type || '').trim(); const countrySlug = existing?.country_slug ?? (body.country_slug ? slugify(body.country_slug) : null); const topicSlug = existing?.topic_slug ?? (body.topic_slug ? slugify(body.topic_slug) : null); const slug = existing?.slug ?? (body.slug ? slugify(body.slug) : (topicSlug || slugify(body.title || '') || null));
  const locale = String(existing?.settings?.locale || existing?.settings?.languageCode || body.settings?.locale || body.settings?.languageCode || '').trim().slice(0, 40); const contentKey = existing?.content_key || canonicalKey({ contentType, countrySlug, slug, locale });
  return { content_key: contentKey, content_type: contentType, country_slug: countrySlug, topic_slug: topicSlug, slug, title: String(body.title ?? existing?.title ?? '').slice(0, 180), excerpt: String(body.excerpt ?? existing?.excerpt ?? '').slice(0, 600), html: cleanHtml(body.html ?? existing?.html ?? ''), blocks: cleanBlocks(body.blocks ?? existing?.blocks ?? []), settings: body.settings && typeof body.settings === 'object' && !Array.isArray(body.settings) ? body.settings : (existing?.settings || {}), seo_title: body.seo_title !== undefined ? (body.seo_title ? String(body.seo_title).slice(0, 180) : null) : (existing?.seo_title ?? null), seo_description: body.seo_description !== undefined ? (body.seo_description ? String(body.seo_description).slice(0, 320) : null) : (existing?.seo_description ?? null), indexable: body.indexable === undefined ? (existing?.indexable ?? true) : Boolean(body.indexable), published: body.published === undefined ? (existing?.published ?? true) : Boolean(body.published) };
}
function rejectInvalidType(payload, res) {
  const type = String(payload.content_type || '').trim().toLowerCase(); if (RETIRED_CONTENT_TYPES.has(type)) { res.status(410).json({ error: `${type} is retired. Use the canonical content type.` }); return true; }
  if (!CANONICAL_CONTENT_TYPES.has(type)) { res.status(400).json({ error: 'Unsupported content type' }); return true; }
  if (String(payload.content_key || '').startsWith('country-topic:')) { res.status(410).json({ error: 'country-topic content keys are retired.' }); return true; }
  return false;
}

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const wantsAdmin = String(req.query?.admin || '').toLowerCase() === 'true'; if (wantsAdmin && !(await requireRole(req, res, CONTENT_WRITE))) return;
      const { key, country, topic, type, slug, id } = req.query || {}; const requestedType = String(type || '').trim().toLowerCase();
      if (RETIRED_CONTENT_TYPES.has(requestedType) || String(key || '').startsWith('country-topic:')) return res.status(410).json({ error: 'Retired content type.' }); if (requestedType && !CANONICAL_CONTENT_TYPES.has(requestedType)) return res.status(400).json({ error: 'Unsupported content type' });
      let query = supabase.from('content_documents').select(wantsAdmin ? '*' : PUBLIC_FIELDS).in('content_type', [...CANONICAL_CONTENT_TYPES]).order('updated_at', { ascending: false }); if (!wantsAdmin) query = query.eq('published', true);
      if (id) query = query.eq('id', Number(id)); if (key) query = query.eq('content_key', String(key)); if (country) query = query.eq('country_slug', String(country)); if (topic) query = query.eq('topic_slug', String(topic)); if (type) query = query.eq('content_type', requestedType); if (slug) query = query.eq('slug', String(slug));
      if (key || id) { const { data, error } = await query.maybeSingle(); if (error) throw error; return res.status(200).json(wantsAdmin ? (data || null) : toPublicDocument(data || null)); }
      const { data, error } = await query; if (error) throw error; return res.status(200).json(wantsAdmin ? (data || []) : (data || []).map(toPublicDocument));
    }
    const actor = await requireRole(req, res, CONTENT_WRITE); if (!actor) return;
    if (req.method === 'POST') {
      const payload = normalize(req.body || {}); if (rejectInvalidType(payload, res)) return; if (!payload.content_key || !payload.slug) return res.status(400).json({ error: 'Canonical content identity is required' });
      const { data, error } = await supabase.from('content_documents').insert({ ...payload, updated_by: actor.email }).select().single(); if (error) throw error; return res.status(201).json(data);
    }
    if (req.method === 'PUT') {
      const { id, ...rest } = req.body || {}; if (!id) return res.status(400).json({ error: 'id is required' });
      const { data: existing, error: lookupError } = await supabase.from('content_documents').select('id,content_key,content_type,country_slug,topic_slug,slug,title,excerpt,html,blocks,settings,seo_title,seo_description,indexable,published').eq('id', Number(id)).maybeSingle(); if (lookupError) throw lookupError; if (!existing) return res.status(404).json({ error: 'Content document not found' });
      const payload = { ...normalize(rest, existing), updated_by: actor.email }; if (rejectInvalidType(payload, res)) return;
      if (payload.content_key !== existing.content_key || payload.content_type !== existing.content_type || payload.country_slug !== existing.country_slug || payload.slug !== existing.slug) return res.status(409).json({ error: 'Canonical identity is immutable. Create a new canonical document to change its URL.' });
      delete payload.topic_slug; delete payload.content_key; delete payload.content_type; delete payload.country_slug; delete payload.slug;
      const { data, error } = await supabase.from('content_documents').update(payload).eq('id', Number(id)).select().single(); if (error) throw error; return res.status(200).json(data);
    }
    if (req.method === 'DELETE') { const { id } = req.body || {}; if (!id) return res.status(400).json({ error: 'id is required' }); const { error } = await supabase.from('content_documents').delete().eq('id', Number(id)); if (error) throw error; return res.status(200).json({ ok: true }); }
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('content-documents API error:', err); return res.status(500).json({ error: 'Unable to process content document request' });
  }
}
