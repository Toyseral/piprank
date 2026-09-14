import supabase from './_lib/db-client.js';
import { requireRole } from './_lib/admin-guard.js';

const CONTENT_WRITE = ['super_admin', 'admin', 'content_admin'];
const RETIRED_CONTENT_TYPES = new Set(['country-topic']);
const ALLOWED_TAGS = new Set(['p','br','strong','em','b','i','u','s','blockquote','ul','ol','li','h2','h3','h4','a','img','figure','figcaption','table','thead','tbody','tr','th','td','hr','code','pre','mark','span','div']);
const ALLOWED_ATTRS = new Set(['href','title','target','rel','src','alt','width','height','loading','colspan','rowspan','class']);
const PUBLIC_FIELDS = 'id,content_key,content_type,country_slug,topic_slug,slug,title,excerpt,html,blocks,settings,seo_title,seo_description,indexable,published,updated_at';

function slugify(value) { return String(value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''); }
function safeUrl(value, { image = false } = {}) {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  if (/^(https?:|mailto:|tel:|\/|#)/i.test(raw)) return raw;
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
function cleanBlocks(blocks) {
  if (!Array.isArray(blocks)) return [];
  return blocks.map((block) => {
    if (!block || typeof block !== 'object') return block;
    const next = { ...block };
    if (typeof next.html === 'string') next.html = cleanHtml(next.html);
    if (typeof next.src === 'string') next.src = safeUrl(next.src, { image: true });
    if (typeof next.href === 'string') next.href = safeUrl(next.href);
    if (Array.isArray(next.links)) {
      next.links = next.links
        .filter((link) => link && typeof link === 'object')
        .map((link) => ({
          ...link,
          label: String(link.label ?? '').slice(0, 180),
          href: safeUrl(link.href) || '#',
        }));
    }
    return next;
  });
}
function sanitizePublicSettings(settings) {
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) return {};
  return {
    ...(typeof settings.locale === 'string' ? { locale: settings.locale.slice(0, 20) } : {}),
    ...(typeof settings.languageCode === 'string' ? { languageCode: settings.languageCode.slice(0, 20) } : {}),
  };
}
function toPublicDocument(document) {
  if (!document || typeof document !== 'object') return document;
  return {
    id: document.id,
    content_key: document.content_key,
    content_type: document.content_type,
    country_slug: document.country_slug,
    topic_slug: document.topic_slug,
    slug: document.slug,
    title: document.title,
    excerpt: document.excerpt,
    html: document.html,
    blocks: document.blocks,
    settings: sanitizePublicSettings(document.settings),
    seo_title: document.seo_title,
    seo_description: document.seo_description,
    indexable: document.indexable,
    published: document.published,
    updated_at: document.updated_at,
  };
}
function normalize(body) {
  const contentType = String(body.content_type || 'page').slice(0, 40);
  const countrySlug = body.country_slug ? slugify(body.country_slug) : null;
  const topicSlug = body.topic_slug ? slugify(body.topic_slug) : null;
  const slug = body.slug ? slugify(body.slug) : (topicSlug || slugify(body.title || body.content_key || '') || null);
  const contentKey = String(body.content_key || [contentType, countrySlug, topicSlug, slug].filter(Boolean).join(':')).slice(0, 180);
  return {
    content_key: contentKey, content_type: contentType, country_slug: countrySlug, topic_slug: topicSlug, slug,
    title: String(body.title || '').slice(0, 180), excerpt: String(body.excerpt || '').slice(0, 600), html: cleanHtml(body.html || ''), blocks: cleanBlocks(body.blocks),
    settings: body.settings && typeof body.settings === 'object' && !Array.isArray(body.settings) ? body.settings : {},
    seo_title: body.seo_title ? String(body.seo_title).slice(0, 180) : null, seo_description: body.seo_description ? String(body.seo_description).slice(0, 320) : null,
    indexable: body.indexable === undefined ? true : Boolean(body.indexable), published: body.published === undefined ? true : Boolean(body.published),
  };
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
