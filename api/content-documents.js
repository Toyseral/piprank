import supabase from './_lib/db-client.js';
import { requireRole } from './_lib/admin-guard.js';

const CONTENT_WRITE = ['super_admin', 'admin', 'content_admin'];
const RETIRED_CONTENT_TYPES = new Set(['country-topic']);

function slugify(value) {
  return String(value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function cleanHtml(input = '') {
  let html = String(input);
  html = html.replace(/<\s*(script|style|iframe|object|embed|form|input|button|textarea|select)[^>]*>[\s\S]*?<\/\s*\1\s*>/gi, '');
  html = html.replace(/<(script|style|iframe|object|embed|form|input|button|textarea|select)[^>]*\/?>/gi, '');
  html = html.replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  html = html.replace(/javascript\s*:/gi, '');
  return html.trim();
}

function cleanBlocks(blocks) {
  if (!Array.isArray(blocks)) return [];
  return blocks.map((block) => {
    if (!block || typeof block !== 'object') return block;
    return typeof block.html === 'string' ? { ...block, html: cleanHtml(block.html) } : block;
  });
}

function normalize(body) {
  const contentType = String(body.content_type || 'page').slice(0, 40);
  const countrySlug = body.country_slug ? slugify(body.country_slug) : null;
  const topicSlug = body.topic_slug ? slugify(body.topic_slug) : null;
  const slug = body.slug ? slugify(body.slug) : (topicSlug || slugify(body.title || body.content_key || '') || null);
  const contentKey = String(body.content_key || [contentType, countrySlug, topicSlug, slug].filter(Boolean).join(':')).slice(0, 180);
  return {
    content_key: contentKey,
    content_type: contentType,
    country_slug: countrySlug,
    topic_slug: topicSlug,
    slug,
    title: String(body.title || '').slice(0, 180),
    excerpt: String(body.excerpt || '').slice(0, 600),
    html: cleanHtml(body.html || ''),
    blocks: cleanBlocks(body.blocks),
    settings: body.settings && typeof body.settings === 'object' && !Array.isArray(body.settings) ? body.settings : {},
    seo_title: body.seo_title ? String(body.seo_title).slice(0, 180) : null,
    seo_description: body.seo_description ? String(body.seo_description).slice(0, 320) : null,
    indexable: body.indexable === undefined ? true : Boolean(body.indexable),
    published: body.published === undefined ? true : Boolean(body.published),
  };
}

function rejectRetiredType(payload, res) {
  if (RETIRED_CONTENT_TYPES.has(String(payload.content_type || '').trim().toLowerCase())) {
    res.status(410).json({
      error: 'country-topic is retired. Use country-guide for guides or country-best-for for commercial pages.',
    });
    return true;
  }
  if (String(payload.content_key || '').startsWith('country-topic:')) {
    res.status(410).json({
      error: 'country-topic content keys are retired. Use country-guide:* or country-best-for:*.',
    });
    return true;
  }
  return false;
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const wantsAdmin = String(req.query?.admin || '').toLowerCase() === 'true';
    if (wantsAdmin && !(await requireRole(req, res, CONTENT_WRITE))) return;

    const { key, country, topic, type, slug, id } = req.query || {};
    if (String(type || '').toLowerCase() === 'country-topic' || String(key || '').startsWith('country-topic:')) {
      return res.status(410).json({
        error: 'country-topic is retired. Use country-guide or country-best-for.',
      });
    }

    let query = supabase.from('content_documents').select('*').order('updated_at', { ascending: false });
    if (!wantsAdmin) query = query.eq('published', true);
    if (id) query = query.eq('id', Number(id));
    if (key) query = query.eq('content_key', String(key));
    if (country) query = query.eq('country_slug', String(country));
    if (topic) query = query.eq('topic_slug', String(topic));
    if (type) query = query.eq('content_type', String(type));
    if (slug) query = query.eq('slug', String(slug));

    if (key || id) {
      const { data, error } = await query.maybeSingle();
      if (error) throw error;
      return res.status(200).json(data || null);
    }

    const { data, error } = await query;
    if (error) throw error;
    return res.status(200).json(data || []);
  }

  const actor = await requireRole(req, res, CONTENT_WRITE);
  if (!actor) return;

  if (req.method === 'POST') {
    const payload = normalize(req.body || {});
    if (rejectRetiredType(payload, res)) return;
    if (!payload.content_key) return res.status(400).json({ error: 'content_key is required' });
    const { data, error } = await supabase.from('content_documents').insert({ ...payload, updated_by: actor.email }).select().single();
    if (error) throw error;
    return res.status(201).json(data);
  }

  if (req.method === 'PUT') {
    const { id, ...rest } = req.body || {};
    if (!id) return res.status(400).json({ error: 'id is required' });
    const payload = { ...normalize(rest), updated_by: actor.email };
    if (rejectRetiredType(payload, res)) return;
    delete payload.content_key;
    const { data, error } = await supabase.from('content_documents').update(payload).eq('id', Number(id)).select().single();
    if (error) throw error;
    return res.status(200).json(data);
  }

  if (req.method === 'DELETE') {
    const { id } = req.body || {};
    if (!id) return res.status(400).json({ error: 'id is required' });
    const { error } = await supabase.from('content_documents').delete().eq('id', Number(id));
    if (error) throw error;
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
