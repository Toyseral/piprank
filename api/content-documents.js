import supabase from './_lib/db-client.js';
import { requireRole } from './_lib/admin-guard.js';

const CONTENT_WRITE = ['super_admin', 'admin', 'content_admin'];
const RETIRED_CONTENT_TYPES = new Set(['country-topic']);
const ALLOWED_TAGS = new Set(['p','br','strong','em','b','i','u','s','blockquote','ul','ol','li','h2','h3','h4','a','img','figure','figcaption','table','thead','tbody','tr','th','td','hr','code','pre','mark','span','div']);
const ALLOWED_ATTRS = new Set(['href','title','target','rel','src','alt','width','height','loading','colspan','rowspan','class']);
const PUBLIC_FIELDS = 'id,content_key,content_type,country_slug,topic_slug,slug,title,excerpt,html,blocks,settings,seo_title,seo_description,indexable,published,updated_at';
const BLOCK_TYPES = new Set(['richtext','heading','image','table','callout','divider','links','structured_broker_data','broker_card','broker_grid','comparison_table','broker_cta','piprank_verdict']);
const BLOCK_KEYS = {
  richtext: ['id','type','title','html'],
  heading: ['id','type','title'],
  image: ['id','type','title','src','alt'],
  table: ['id','type','title','rows'],
  callout: ['id','type','title','html','tone'],
  divider: ['id','type','title'],
  links: ['id','type','title','links'],
  structured_broker_data: ['id','type','title','brokerId','section'],
  broker_card: ['id','type','title','brokerId','variant'],
  broker_grid: ['id','type','title','brokerIds','variant'],
  comparison_table: ['id','type','title','brokerIds','fields','ctaLabel','showCta'],
  broker_cta: ['id','type','title','brokerId','variant','ctaLabel','ctaHref','headline','buttonLabel'],
  piprank_verdict: ['id','type','title','html'],
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
    if (name === 'href') {
      const safe = safeUrl(value);
      if (safe) attrs.push(`href="${safe.replaceAll('"', '&quot;')}"`);
      continue;
    }
    if (name === 'src') {
      const safe = safeUrl(value, { image: true });
      if (safe) attrs.push(`src="${safe.replaceAll('"', '&quot;')}"`);
      continue;
    }
    attrs.push(`${name}="${value.replaceAll('"', '&quot;')}"`);
  }
  if (tag === 'a' && !attrs.some((x) => x.startsWith('rel='))) attrs.push('rel="noopener noreferrer"');
  return `<${tag}${attrs.length ? ` ${attrs.join(' ')}` : ''}>`;
}
function cleanHtml(input = '') {
  const html = String(input).replace(/<!--[\s\S]*?-->/g, '');
  return html.replace(/<[^>]*>/g, sanitizeTag).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim();
}
function cleanText(value, max = 500) { return String(value ?? '').trim().slice(0, max); }
function cleanStringArray(value, max = 100, itemMax = 300) {
  return Array.isArray(value) ? value.filter((item) => typeof item === 'string').map((item) => cleanText(item, itemMax)).filter(Boolean).slice(0, max) : [];
}
function cleanRows(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 100).map((row) => Array.isArray(row) ? row.slice(0, 20).map((cell) => cleanText(cell, 500)) : []).filter((row) => row.length);
}
function cleanLinks(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 100).map((link) => ({ label: cleanText(link?.label, 180), href: safeUrl(link?.href) || '#' })).filter((link) => link.label);
}
function cleanBlock(block) {
  if (!block || typeof block !== 'object' || Array.isArray(block)) return null;
  const type = String(block.type || '').trim();
  if (!BLOCK_TYPES.has(type)) return null;
  const output = {};
  for (const key of BLOCK_KEYS[type]) {
    if (block[key] !== undefined) output[key] = block[key];
  }
  output.id = cleanText(output.id || `block_${Math.random().toString(36).slice(2, 10)}`, 120);
  output.type = type;
  if ('title' in output) output.title = cleanText(output.title, 300);
  if ('html' in output) output.html = cleanHtml(output.html);
  if ('src' in output) output.src = safeUrl(output.src, { image: true });
  if ('alt' in output) output.alt = cleanText(output.alt, 300);
  if ('rows' in output) output.rows = cleanRows(output.rows);
  if ('links' in output) output.links = cleanLinks(output.links);
  if ('tone' in output && !['neutral','success','warning','dark'].includes(output.tone)) output.tone = 'neutral';
  if ('section' in output && !['overview','pricing','trust','platforms','features','editorial'].includes(output.section)) output.section = 'overview';
  if ('variant' in output && !['default','compact','featured','primary','dark','soft'].includes(output.variant)) delete output.variant;
  if ('brokerId' in output) output.brokerId = Number.isFinite(Number(output.brokerId)) ? Number(output.brokerId) : null;
  if ('brokerIds' in output) output.brokerIds = Array.isArray(output.brokerIds) ? output.brokerIds.map(Number).filter(Number.isFinite).slice(0, 20) : [];
  if ('fields' in output) output.fields = cleanStringArray(output.fields, 20, 80);
  if ('ctaLabel' in output) output.ctaLabel = cleanText(output.ctaLabel, 180);
  if ('ctaHref' in output) output.ctaHref = safeUrl(output.ctaHref) || null;
  if ('headline' in output) output.headline = cleanText(output.headline, 300);
  if ('buttonLabel' in output) output.buttonLabel = cleanText(output.buttonLabel, 180);
  if ('showCta' in output) output.showCta = Boolean(output.showCta);
  return output;
}
function cleanBlocks(blocks) {
  if (!Array.isArray(blocks)) return [];
  return blocks.map(cleanBlock).filter(Boolean).slice(0, 200);
}
function sanitizePublicSettings(settings) {
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) return {};
  const output = {};
  for (const key of PUBLIC_SETTING_KEYS) {
    const value = settings[key];
    if (value === undefined || value === null) continue;
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') { output[key] = typeof value === 'string' ? value.slice(0, 500) : value; continue; }
    if (key === 'criteria' && Array.isArray(value)) { output[key] = value.filter((item) => typeof item === 'string').map((item) => item.slice(0, 300)).slice(0, 100); continue; }
    if (key === 'sections' && Array.isArray(value)) { output[key] = value.filter((item) => item && typeof item === 'object' && !Array.isArray(item)).slice(0, 100); continue; }
    if (key === 'faqs' && Array.isArray(value)) { output[key] = value.filter((item) => item && typeof item === 'object' && !Array.isArray(item)).map((item) => ({ q: typeof item.q === 'string' ? item.q.slice(0, 500) : '', a: typeof item.a === 'string' ? item.a.slice(0, 2000) : '' })).filter((item) => item.q && item.a).slice(0, 100); }
  }
  return output;
}
function toPublicDocument(document) {
  if (!document || typeof document !== 'object') return document;
  return { id: document.id, content_key: document.content_key, content_type: document.content_type, country_slug: document.country_slug, topic_slug: document.topic_slug, slug: document.slug, title: document.title, excerpt: document.excerpt, html: document.html, blocks: document.blocks, settings: sanitizePublicSettings(document.settings), seo_title: document.seo_title, seo_description: document.seo_description, indexable: document.indexable, published: document.published, updated_at: document.updated_at };
}
function normalize(body) {
  const contentType = String(body.content_type || 'page').slice(0, 40);
  const countrySlug = body.country_slug ? slugify(body.country_slug) : null;
  const topicSlug = body.topic_slug ? slugify(body.topic_slug) : null;
  const slug = body.slug ? slugify(body.slug) : (topicSlug || slugify(body.title || body.content_key || '') || null);
  const contentKey = String(body.content_key || [contentType, countrySlug, topicSlug, slug].filter(Boolean).join(':')).slice(0, 180);
  return { content_key: contentKey, content_type: contentType, country_slug: countrySlug, topic_slug: topicSlug, slug, title: String(body.title || '').slice(0, 180), excerpt: String(body.excerpt || '').slice(0, 600), html: cleanHtml(body.html || ''), blocks: cleanBlocks(body.blocks), settings: body.settings && typeof body.settings === 'object' && !Array.isArray(body.settings) ? body.settings : {}, seo_title: body.seo_title ? String(body.seo_title).slice(0, 180) : null, seo_description: body.seo_description ? String(body.seo_description).slice(0, 320) : null, indexable: body.indexable === undefined ? true : Boolean(body.indexable), published: body.published === undefined ? true : Boolean(body.published) };
}
function rejectRetiredType(payload, res) {
  if (RETIRED_CONTENT_TYPES.has(String(payload.content_type || '').trim().toLowerCase())) { res.status(410).json({ error: 'country-topic is retired. Use country-guide for guides or country-best-for for commercial pages.' }); return true; }
  if (String(payload.content_key || '').startsWith('country-topic:')) { res.status(410).json({ error: 'country-topic content keys are retired. Use country-guide:* or country-best-for:*.' }); return true; }
  return false;
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const wantsAdmin = String(req.query?.admin || '').toLowerCase() === 'true';
    if (wantsAdmin && !(await requireRole(req, res, CONTENT_WRITE))) return;
    const { key, country, topic, type, slug, id } = req.query || {};
    if (String(type || '').toLowerCase() === 'country-topic' || String(key || '').startsWith('country-topic:')) return res.status(410).json({ error: 'country-topic is retired. Use country-guide or country-best-for.' });
    let query = supabase.from('content_documents').select(wantsAdmin ? '*' : PUBLIC_FIELDS).order('updated_at', { ascending: false });
    if (!wantsAdmin) query = query.eq('published', true);
    if (id) query = query.eq('id', Number(id)); if (key) query = query.eq('content_key', String(key)); if (country) query = query.eq('country_slug', String(country)); if (topic) query = query.eq('topic_slug', String(topic)); if (type) query = query.eq('content_type', String(type)); if (slug) query = query.eq('slug', String(slug));
    if (key || id) { const { data, error } = await query.maybeSingle(); if (error) throw error; return res.status(200).json(wantsAdmin ? (data || null) : toPublicDocument(data || null)); }
    const { data, error } = await query; if (error) throw error; return res.status(200).json(wantsAdmin ? (data || []) : (data || []).map(toPublicDocument));
  }
  const actor = await requireRole(req, res, CONTENT_WRITE); if (!actor) return;
  if (req.method === 'POST') { const payload = normalize(req.body || {}); if (rejectRetiredType(payload, res)) return; if (!payload.content_key) return res.status(400).json({ error: 'content_key is required' }); const { data, error } = await supabase.from('content_documents').insert({ ...payload, updated_by: actor.email }).select().single(); if (error) throw error; return res.status(201).json(data); }
  if (req.method === 'PUT') { const { id, ...rest } = req.body || {}; if (!id) return res.status(400).json({ error: 'id is required' }); const payload = { ...normalize(rest), updated_by: actor.email }; if (rejectRetiredType(payload, res)) return; delete payload.content_key; const { data, error } = await supabase.from('content_documents').update(payload).eq('id', Number(id)).select().single(); if (error) throw error; return res.status(200).json(data); }
  if (req.method === 'DELETE') { const { id } = req.body || {}; if (!id) return res.status(400).json({ error: 'id is required' }); const { error } = await supabase.from('content_documents').delete().eq('id', Number(id)); if (error) throw error; return res.status(200).json({ ok: true }); }
  return res.status(405).json({ error: 'Method not allowed' });
}
