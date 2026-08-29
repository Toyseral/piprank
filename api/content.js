import supabase from './_lib/db-client.js';
import { requireRole } from './_lib/admin-guard.js';

const CONTENT_WRITE = ['super_admin', 'admin', 'content_admin'];

// Merged from the former standalone /api/countries, /api/guides, /api/intents,
// /api/country-best-for, /api/content-documents, /api/content-assets and
// /api/seo-page-generator endpoints, consolidated to stay under Vercel's
// serverless function limit. Every original public URL still works exactly
// as before via vercel.json rewrites into ?resource=<name> on this file —
// no client code needed to change.

function slugify(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/* ============================== guides ============================== */

async function handleGuides(req, res) {
  if (req.method === 'GET') {
    const { slug } = req.query;
    if (slug) {
      const { data, error } = await supabase.from('guides').select('*').eq('slug', slug).single();
      if (error || !data) return res.status(404).json({ error: 'Guide not found' });
      return res.status(200).json(data);
    }
    const { data, error } = await supabase.from('guides').select('*').order('published', { ascending: false });
    if (error) throw error;
    return res.status(200).json(data);
  }
  if (!(await requireRole(req, res, CONTENT_WRITE))) return;
  if (req.method === 'POST') {
    const body = req.body ?? {};
    if (!body.title || String(body.title).trim().length < 4)
      return res.status(400).json({ error: 'Guide title is required' });
    const payload = {
      title: String(body.title).trim(),
      slug: body.slug ? slugify(body.slug) : slugify(body.title),
      excerpt: String(body.excerpt ?? ''),
      category: String(body.category ?? 'Basics'),
      level: String(body.level ?? 'Beginner'),
      minutes: Number(body.minutes) || 8,
      image: String(body.image ?? '/images/guides/basics.jpg'),
      sections: Array.isArray(body.sections) ? body.sections : [],
      published: String(body.published ?? new Date().toISOString().slice(0, 10)),
    };
    const { data, error } = await supabase.from('guides').insert(payload).select().single();
    if (error) throw error;
    return res.status(201).json(data);
  }
  if (req.method === 'PUT') {
    const { id, ...fields } = req.body ?? {};
    if (!id) return res.status(400).json({ error: 'id is required' });
    delete fields.slug;
    const { data, error } = await supabase.from('guides').update(fields).eq('id', Number(id)).select().single();
    if (error) throw error;
    return res.status(200).json(data);
  }
  if (req.method === 'DELETE') {
    const { id } = req.body ?? {};
    if (!id) return res.status(400).json({ error: 'id is required' });
    const { error } = await supabase.from('guides').delete().eq('id', Number(id));
    if (error) throw error;
    return res.status(200).json({ ok: true });
  }
  return res.status(405).json({ error: 'Method not allowed' });
}

/* ============================== intents ============================== */

async function handleIntents(req, res) {
  if (req.method === 'GET') {
    const { slug } = req.query;
    if (slug) {
      const { data, error } = await supabase.from('intents').select('*').eq('slug', slug).single();
      if (error || !data) return res.status(404).json({ error: 'Category not found' });
      return res.status(200).json(data);
    }
    const { data, error } = await supabase.from('intents').select('*').order('id', { ascending: true });
    if (error) throw error;
    return res.status(200).json(data);
  }
  if (!(await requireRole(req, res, CONTENT_WRITE))) return;
  if (req.method === 'POST') {
    const body = req.body ?? {};
    if (!body.label || String(body.label).trim().length < 2)
      return res.status(400).json({ error: 'Label is required' });
    const payload = {
      label: String(body.label).trim(),
      slug: body.slug ? slugify(body.slug) : slugify(body.label),
      title: String(body.title ?? `Best Forex Brokers for ${body.label} (2026)`),
      meta_title: body.meta_title ? String(body.meta_title).trim() : null,
      meta_description: body.meta_description ? String(body.meta_description).trim() : null,
      icon: String(body.icon ?? 'beginners'),
      intro: Array.isArray(body.intro) ? body.intro.filter(Boolean) : [],
      criteria: Array.isArray(body.criteria) ? body.criteria.filter(Boolean) : [],
      sections: Array.isArray(body.sections) ? body.sections : [],
      faqs: Array.isArray(body.faqs) ? body.faqs : [],
      indexable: body.indexable === undefined ? true : Boolean(body.indexable),
      sort_order: Number.isFinite(Number(body.sort_order)) ? Number(body.sort_order) : 0,
    };
    const { data, error } = await supabase.from('intents').insert(payload).select().single();
    if (error) throw error;
    return res.status(201).json(data);
  }
  if (req.method === 'PUT') {
    const { id, ...fields } = req.body ?? {};
    if (!id) return res.status(400).json({ error: 'id is required' });
    delete fields.slug;
    const { data, error } = await supabase.from('intents').update(fields).eq('id', Number(id)).select().single();
    if (error) throw error;
    return res.status(200).json(data);
  }
  if (req.method === 'DELETE') {
    const { id } = req.body ?? {};
    if (!id) return res.status(400).json({ error: 'id is required' });
    const { error } = await supabase.from('intents').delete().eq('id', Number(id));
    if (error) throw error;
    return res.status(200).json({ ok: true });
  }
  return res.status(405).json({ error: 'Method not allowed' });
}


function isMissingPublishingStateColumn(error) {
  return error && (error.code === 'PGRST204' || /publishing_state/i.test(String(error.message || error.details || '')));
}

async function insertCountryWithPublishingFallback(payload) {
  const result = await supabase.from('countries').insert(payload).select().single();
  if (!result.error || !isMissingPublishingStateColumn(result.error)) return result;
  const { publishing_state, ...safePayload } = payload;
  return supabase.from('countries').insert(safePayload).select().single();
}

async function updateCountryWithPublishingFallback(id, fields) {
  const result = await supabase.from('countries').update(fields).eq('id', Number(id)).select().single();
  if (!result.error || !isMissingPublishingStateColumn(result.error)) return result;
  const { publishing_state, ...safeFields } = fields;
  return supabase.from('countries').update(safeFields).eq('id', Number(id)).select().single();
}

/* ============================== countries ============================== */

async function handleCountries(req, res) {
  if (req.method === 'GET') {
    const { slug } = req.query;
    if (slug) {
      const { data, error } = await supabase.from('countries').select('*').eq('slug', slug).single();
      if (error || !data) return res.status(404).json({ error: 'Country not found' });
      return res.status(200).json(data);
    }
    const { data, error } = await supabase.from('countries').select('*').order('id', { ascending: true });
    if (error) throw error;
    return res.status(200).json(data);
  }
  if (!(await requireRole(req, res, CONTENT_WRITE))) return;
  if (req.method === 'POST') {
    const body = req.body ?? {};
    if (!body.name || String(body.name).trim().length < 2)
      return res.status(400).json({ error: 'Country name is required' });
    const payload = {
      name: String(body.name).trim().slice(0, 60),
      slug: body.slug ? slugify(body.slug) : slugify(body.name),
      flag: String(body.flag ?? '🌍').slice(0, 8),
      subtitle: String(body.subtitle ?? '').slice(0, 200),
      intro: Array.isArray(body.intro) ? body.intro.filter(Boolean) : [],
      facts: Array.isArray(body.facts) ? body.facts : [],
      recommended: Array.isArray(body.recommended) ? body.recommended : [],
      unavailable: Array.isArray(body.unavailable) ? body.unavailable : [],
      seo_title: body.seo_title ? String(body.seo_title).slice(0, 180) : null,
      seo_description: body.seo_description ? String(body.seo_description).slice(0, 320) : null,
      seo_intro: Array.isArray(body.seo_intro) ? body.seo_intro.filter(Boolean) : [],
      seo_sections: Array.isArray(body.seo_sections) ? body.seo_sections : [],
      seo_faqs: Array.isArray(body.seo_faqs) ? body.seo_faqs : [],
      publishing_state: ['draft','published','closed'].includes(body.publishing_state) ? body.publishing_state : 'published',
    };
    const { data, error } = await insertCountryWithPublishingFallback(payload);
    if (error) throw error;
    return res.status(201).json(data);
  }
  if (req.method === 'PUT') {
    const { id, ...fields } = req.body ?? {};
    if (!id) return res.status(400).json({ error: 'id is required' });
    if (fields.name) fields.slug = fields.slug ? slugify(fields.slug) : slugify(fields.name);
    const { data, error } = await updateCountryWithPublishingFallback(id, fields);
    if (error) throw error;
    return res.status(200).json(data);
  }
  if (req.method === 'DELETE') {
    const { id } = req.body ?? {};
    if (!id) return res.status(400).json({ error: 'id is required' });
    const { error } = await supabase.from('countries').delete().eq('id', Number(id));
    if (error) throw error;
    return res.status(200).json({ ok: true });
  }
  return res.status(405).json({ error: 'Method not allowed' });
}

/* ========================== country-best-for ========================== */

function cleanStringArray(value) {
  return Array.isArray(value) ? value.map(String).map((x) => x.trim()).filter(Boolean) : [];
}
function cleanSections(value) {
  if (!Array.isArray(value)) return [];
  return value.map((s) => ({
    heading: String(s?.heading ?? '').trim(),
    body: cleanStringArray(s?.body),
    bullets: cleanStringArray(s?.bullets),
  })).filter((s) => s.heading || s.body.length || s.bullets.length);
}
function cleanFaqs(value) {
  if (!Array.isArray(value)) return [];
  return value.map((f) => ({ q: String(f?.q ?? '').trim(), a: String(f?.a ?? '').trim() }))
    .filter((f) => f.q && f.a);
}
function bestForPayload(body, existing = {}) {
  return {
    country_id: Number(body.country_id ?? existing.country_id),
    intent_id: body.intent_id === null || body.intent_id === '' ? null : Number(body.intent_id ?? existing.intent_id) || null,
    slug: slugify(body.slug ?? body.label ?? existing.slug).slice(0, 90),
    label: String(body.label ?? existing.label ?? '').trim().slice(0, 120),
    title: String(body.title ?? existing.title ?? '').trim().slice(0, 180),
    meta_title: String(body.meta_title ?? existing.meta_title ?? '').trim().slice(0, 180) || null,
    meta_description: String(body.meta_description ?? existing.meta_description ?? '').trim().slice(0, 320) || null,
    intro: cleanStringArray(body.intro ?? existing.intro),
    icon: String(body.icon ?? existing.icon ?? 'beginners').slice(0, 40),
    criteria: cleanStringArray(body.criteria ?? existing.criteria),
    sections: cleanSections(body.sections ?? existing.sections),
    faqs: cleanFaqs(body.faqs ?? existing.faqs),
    indexable: body.indexable === undefined ? (existing.indexable ?? true) : Boolean(body.indexable),
    sort_order: Number.isFinite(Number(body.sort_order)) ? Number(body.sort_order) : Number(existing.sort_order ?? 0),
  };
}

async function handleCountryBestFor(req, res) {
  if (req.method === 'GET') {
    const { country, slug } = req.query;
    let query = supabase.from('country_best_for').select('*, countries!inner(name, slug)').order('sort_order', { ascending: true }).order('id', { ascending: true });
    if (country) query = query.eq('countries.slug', country);
    if (slug) query = query.eq('slug', slug);
    const { data, error } = await query;
    if (error) throw error;
    const rows = (data ?? []).map((r) => ({ ...r, country_name: r.countries?.name, country_slug: r.countries?.slug, countries: undefined }));
    if (slug && !rows[0]) return res.status(404).json({ error: 'Country best-for page not found' });
    return res.status(200).json(slug ? rows[0] : rows);
  }
  if (!(await requireRole(req, res, CONTENT_WRITE))) return;
  if (req.method === 'POST') {
    const body = req.body ?? {};
    const p = bestForPayload(body);
    if (!p.country_id || !p.label || !p.title) return res.status(400).json({ error: 'country_id, label and title are required' });
    const { data, error } = await supabase.from('country_best_for').insert(p).select('*').single();
    if (error) throw error;
    return res.status(201).json(data);
  }
  if (req.method === 'PUT') {
    const body = req.body ?? {};
    if (!body.id) return res.status(400).json({ error: 'id is required' });
    const { data: existing, error: readError } = await supabase.from('country_best_for').select('*').eq('id', Number(body.id)).single();
    if (readError || !existing) return res.status(404).json({ error: 'Country best-for page not found' });
    const p = bestForPayload(body, existing);
    delete p.country_id;
    const { data, error } = await supabase.from('country_best_for').update(p).eq('id', Number(body.id)).select('*').single();
    if (error) throw error;
    return res.status(200).json(data);
  }
  if (req.method === 'DELETE') {
    const { id } = req.body ?? {};
    if (!id) return res.status(400).json({ error: 'id is required' });
    const { error } = await supabase.from('country_best_for').delete().eq('id', Number(id));
    if (error) throw error;
    return res.status(200).json({ ok: true });
  }
  return res.status(405).json({ error: 'Method not allowed' });
}

/* ========================== content-documents ========================== */

// Strips executable content from arbitrary rich-text HTML. Applied to every
// field that ends up in dangerouslySetInnerHTML — both the legacy flat
// `html` string AND, critically, every individual block's `.html` field
// (richtext/callout blocks), since blocksToHtml() renders those directly
// with zero escaping. Skipping the latter was a real stored-XSS gap.
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
  return blocks.map((b) => {
    if (b && typeof b === 'object' && typeof b.html === 'string') {
      return { ...b, html: cleanHtml(b.html) };
    }
    return b;
  });
}

function normalizeContentDoc(body) {
  const contentType = String(body.content_type || 'page').slice(0, 40);
  const countrySlug = body.country_slug ? slugify(body.country_slug) : null;
  const topicSlug = body.topic_slug ? slugify(body.topic_slug) : null;
  const contentKey = String(body.content_key || [contentType, countrySlug, topicSlug, body.slug].filter(Boolean).join(':')).slice(0, 180);
  return {
    content_key: contentKey,
    content_type: contentType,
    country_slug: countrySlug,
    topic_slug: topicSlug,
    slug: body.slug ? slugify(body.slug) : null,
    title: String(body.title || '').slice(0, 180),
    excerpt: String(body.excerpt || '').slice(0, 600),
    html: cleanHtml(body.html || ''),
    blocks: cleanBlocks(Array.isArray(body.blocks) ? body.blocks : []),
    settings: body.settings && typeof body.settings === 'object' && !Array.isArray(body.settings) ? body.settings : {},
    seo_title: body.seo_title ? String(body.seo_title).slice(0, 180) : null,
    seo_description: body.seo_description ? String(body.seo_description).slice(0, 320) : null,
    indexable: body.indexable === undefined ? true : Boolean(body.indexable),
    published: body.published === undefined ? true : Boolean(body.published),
  };
}

async function handleContentDocuments(req, res) {
  if (req.method === 'GET') {
    const { key, country, topic, type, slug, id } = req.query || {};
    let query = supabase.from('content_documents').select('*').order('updated_at', { ascending: false });
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
    const payload = normalizeContentDoc(req.body || {});
    if (!payload.content_key) return res.status(400).json({ error: 'content_key is required' });
    const { data, error } = await supabase.from('content_documents').insert({ ...payload, updated_by: actor.email }).select().single();
    if (error) throw error;
    return res.status(201).json(data);
  }
  if (req.method === 'PUT') {
    const { id, ...rest } = req.body || {};
    if (!id) return res.status(400).json({ error: 'id is required' });
    const payload = { ...normalizeContentDoc(rest), updated_by: actor.email };
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

/* ============================ content-assets ============================ */

async function handleContentAssets(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const actor = await requireRole(req, res, CONTENT_WRITE);
  if (!actor) return;
  const { filename, contentType, dataBase64 } = req.body || {};
  if (!filename || !dataBase64) return res.status(400).json({ error: 'filename and dataBase64 are required' });
  const safeName = String(filename).toLowerCase().replace(/[^a-z0-9._-]+/g, '-').slice(-120);
  const type = String(contentType || 'image/jpeg');
  if (!/^image\/(jpeg|png|webp|gif|svg\+xml)$/.test(type)) return res.status(400).json({ error: 'Only JPEG, PNG, WebP, GIF or SVG images are allowed' });
  const raw = String(dataBase64).replace(/^data:[^;]+;base64,/, '');
  const buffer = Buffer.from(raw, 'base64');
  if (buffer.length > 4 * 1024 * 1024) return res.status(413).json({ error: 'Image must be 4 MB or smaller' });
  const path = `content/${Date.now()}-${safeName}`;
  const { error } = await supabase.storage.from('content-media').upload(path, buffer, { contentType: type, upsert: false });
  if (error) throw error;
  const { data } = supabase.storage.from('content-media').getPublicUrl(path);
  return res.status(201).json({ url: data.publicUrl, uploaded_by: actor.email });
}

/* ========================== seo-page-generator ========================== */

const TOPICS = {
  'eur-usd-forex-brokers': { key: 'eur-usd', title: 'EUR/USD Forex Brokers', short: 'EUR/USD', criteria: 'EUR/USD trading' },
  'gold-forex-brokers': { key: 'gold', title: 'Gold Forex Brokers', short: 'Gold', criteria: 'gold and commodity trading' },
  'mt5-forex-brokers': { key: 'mt5', title: 'MT5 Forex Brokers', short: 'MT5', criteria: 'MetaTrader 5 trading' },
  'low-spread-forex-brokers': { key: 'low-spread', title: 'Low Spread Forex Brokers', short: 'Low Spread', criteria: 'competitive EUR/USD spreads' },
  'forex-brokers-for-beginners': { key: 'beginners', title: 'Forex Brokers for Beginners', short: 'Beginners', criteria: 'beginner-friendly trading' },
  'forex-brokers-for-scalping': { key: 'scalping', title: 'Forex Brokers for Scalping', short: 'Scalping', criteria: 'scalping' },
  'islamic-forex-brokers': { key: 'islamic', title: 'Islamic Forex Brokers', short: 'Islamic / Swap-Free', criteria: 'Islamic or swap-free accounts' },
  'low-minimum-deposit-forex-brokers': { key: 'low-deposit', title: 'Low Minimum Deposit Forex Brokers', short: 'Low Minimum Deposit', criteria: 'low minimum deposits' },
  'copy-trading-forex-brokers': { key: 'copy-trading', title: 'Copy Trading Forex Brokers', short: 'Copy Trading', criteria: 'copy trading' },
  'forex-brokers-with-demo-accounts': { key: 'demo', title: 'Forex Brokers with Demo Accounts', short: 'Demo Accounts', criteria: 'demo account availability' },
  'forex-brokers-for-hedging': { key: 'hedging', title: 'Forex Brokers for Hedging', short: 'Hedging', criteria: 'hedging' },
  'raw-spread-forex-brokers': { key: 'raw-spread', title: 'Raw Spread Forex Brokers', short: 'Raw Spread', criteria: 'raw-spread accounts' },
  'ecn-forex-brokers': { key: 'ecn', title: 'ECN Forex Brokers', short: 'ECN', criteria: 'ECN-style accounts' },
  'standard-account-forex-brokers': { key: 'standard', title: 'Standard Account Forex Brokers', short: 'Standard Accounts', criteria: 'standard accounts' },
  'forex-brokers-for-swing-trading': { key: 'swing-trading', title: 'Forex Brokers for Swing Trading', short: 'Swing Trading', criteria: 'swing trading' },
  'high-leverage-forex-brokers': { key: 'high-leverage', title: 'High Leverage Forex Brokers', short: 'High Leverage', criteria: 'high-leverage trading' },
  'eur-usd-mt5-forex-brokers': { key: 'eur-usd-mt5', title: 'EUR/USD MT5 Forex Brokers', short: 'EUR/USD MT5', criteria: 'EUR/USD trading on MT5', requirements: ['eur-usd', 'mt5'] },
  'eur-usd-forex-brokers-for-scalping': { key: 'eur-usd-scalping', title: 'EUR/USD Forex Brokers for Scalping', short: 'EUR/USD Scalping', criteria: 'EUR/USD scalping', requirements: ['eur-usd', 'scalping'] },
  'mt5-gold-forex-brokers': { key: 'gold-mt5', title: 'MT5 Gold Forex Brokers', short: 'MT5 Gold', criteria: 'gold trading on MT5', requirements: ['gold', 'mt5'] },
  'gold-forex-brokers-for-scalping': { key: 'gold-scalping', title: 'Gold Forex Brokers for Scalping', short: 'Gold Scalping', criteria: 'gold scalping', requirements: ['gold', 'scalping'] },
  'mt5-forex-brokers-for-scalping': { key: 'mt5-scalping', title: 'MT5 Forex Brokers for Scalping', short: 'MT5 Scalping', criteria: 'MT5 scalping', requirements: ['mt5', 'scalping'] },
  'low-spread-mt5-forex-brokers': { key: 'low-spread-mt5', title: 'Low Spread MT5 Forex Brokers', short: 'Low Spread MT5', criteria: 'low-spread MT5 trading', requirements: ['low-spread', 'mt5'] },
  'low-spread-forex-brokers-for-scalping': { key: 'low-spread-scalping', title: 'Low Spread Forex Brokers for Scalping', short: 'Low Spread Scalping', criteria: 'low-spread scalping', requirements: ['low-spread', 'scalping'] },
  'islamic-mt5-forex-brokers': { key: 'islamic-mt5', title: 'Islamic MT5 Forex Brokers', short: 'Islamic MT5', criteria: 'Islamic trading on MT5', requirements: ['islamic', 'mt5'] },
  'mt5-forex-brokers-for-beginners': { key: 'beginner-mt5', title: 'MT5 Forex Brokers for Beginners', short: 'MT5 for Beginners', criteria: 'beginner-friendly MT5 trading', requirements: ['beginners', 'mt5'] },
  'low-spread-gold-forex-brokers': { key: 'gold-low-spread', title: 'Low Spread Gold Forex Brokers', short: 'Low Spread Gold', criteria: 'low-spread gold trading', requirements: ['gold', 'low-spread'] },
};

function matches(b, key) {
  const checks = {
    'eur-usd': () => Number.isFinite(Number(b.spread_eurusd)) && Number(b.spread_eurusd) >= 0,
    gold: () => Number(b.assets?.commodities ?? 0) > 0,
    mt5: () => Array.isArray(b.platforms) && b.platforms.some((p) => String(p).toLowerCase() === 'mt5'),
    'low-spread': () => Number.isFinite(Number(b.spread_eurusd)),
    beginners: () => Boolean(b.demo_account) || Number(b.min_deposit ?? 999999) <= 100 || (b.best_for ?? []).includes('beginners'),
    scalping: () => Boolean(b.scalping),
    islamic: () => Boolean(b.islamic_account),
    'low-deposit': () => Number(b.min_deposit ?? 999999) <= 100,
    'copy-trading': () => Boolean(b.copy_trading),
    demo: () => Boolean(b.demo_account),
    hedging: () => Boolean(b.hedging),
    'raw-spread': () => (b.account_types ?? []).some((a) => /raw|raw spread/i.test(String(a))),
    ecn: () => (b.account_types ?? []).some((a) => /ecn/i.test(String(a))),
    standard: () => (b.account_types ?? []).some((a) => /standard/i.test(String(a))),
    'swing-trading': () => (b.best_for ?? []).includes('swing-trading'),
    'high-leverage': () => (b.best_for ?? []).includes('high-leverage'),
  };
  return Boolean(checks[key]?.());
}

// FIXED: previously emitted { type: 'paragraph' | 'bullets', text/items }
// shapes that do not exist in PageBuilder's PageBlock union (only
// 'richtext' | 'heading' | 'image' | 'table' | 'callout' | 'divider' |
// 'links' are recognized), and headings used `text` instead of the `title`
// field blocksToHtml() actually reads. The practical effect: every
// bulk-generated page rendered as a handful of literal "Section heading"
// placeholders with all real paragraph/bullet content silently missing,
// while the admin tool reported success. Now emits real PageBlock shapes.
function makeBlocks(country, topic, qualifying) {
  const brokerNames = qualifying.slice(0, 5).map((b) => b.name).join(', ');
  const uid = () => `b_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const richtext = (html) => ({ id: uid(), type: 'richtext', html });
  const heading = (title) => ({ id: uid(), type: 'heading', title });
  const bullets = (items) => `<ul>${items.map((i) => `<li>${i}</li>`).join('')}</ul>`;
  return [
    heading(`Best ${topic.title} in ${country.name}`),
    richtext(`<p>This PipRank page compares ${topic.title.toLowerCase()} available to traders in ${country.name}. The shortlist starts with brokers recommended for ${country.name}, then applies the ${topic.criteria} criteria for this page.</p>`),
    richtext(`<p>Broker availability, legal entities, spreads, leverage, payment methods and account conditions can differ by country. Always confirm the current terms that apply to residents of ${country.name} before opening an account.</p>`),
    heading(`What to look for when choosing a ${topic.short} broker in ${country.name}`),
    richtext(bullets(['Availability to residents of the country', `Competitive conditions for ${topic.criteria}`, 'Relevant regulation and client protections', 'Platforms and account types that fit your trading style', 'Deposits, withdrawals and fees that work for your market'])),
    heading('PipRank broker shortlist'),
    richtext(`<p>${qualifying.length ? `The current qualifying broker pool includes ${brokerNames}${qualifying.length > 5 ? ' and other eligible brokers.' : '.'}` : 'No broker currently meets the page eligibility threshold. Review the broker data before publishing this page.'}</p>`),
    heading('Is this page right for you?'),
    richtext(`<p>Use the comparison above if your priority is ${topic.criteria}. If your needs are different, explore the other broker categories for ${country.name} or use PipRank BrokerMatch to get a recommendation based on your preferences.</p>`),
  ];
}

function makeFaqs(country, topic) {
  return [
    { q: `What are the best ${topic.short} forex brokers in ${country.name}?`, a: `PipRank starts with brokers recommended for traders in ${country.name}, then filters them against the ${topic.criteria} criteria. The best choice can still depend on your trading style, costs, platform and account preferences.` },
    { q: `How does PipRank rank ${topic.short.toLowerCase()} brokers in ${country.name}?`, a: `We first establish the country-specific broker pool, then apply the page criteria and compare relevant broker data such as spreads, platforms, account features, minimum deposits and overall broker quality.` },
    { q: `Can forex broker conditions differ in ${country.name}?`, a: `Yes. The legal entity, regulator, leverage, payment methods, account types and available instruments can differ by country. Confirm the current terms for residents of ${country.name} before opening an account.` },
  ];
}

async function handleSeoPageGenerator(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const actor = await requireRole(req, res, CONTENT_WRITE);
  if (!actor) return;
  const countrySlug = slugify(req.body?.country_slug || '');
  const topicSlug = slugify(req.body?.topic_slug || '');
  const topic = TOPICS[topicSlug];
  if (!countrySlug || !topic) return res.status(400).json({ error: 'Valid country_slug and supported topic_slug are required' });

  const [{ data: country, error: ce }, { data: brokers, error: be }, { data: existing, error: xe }] = await Promise.all([
    supabase.from('countries').select('*').eq('slug', countrySlug).maybeSingle(),
    supabase.from('brokers').select('*'),
    supabase.from('content_documents').select('id,content_key').eq('content_key', `country-topic:${countrySlug}:${topicSlug}`).maybeSingle(),
  ]);
  if (ce) throw ce;
  if (be) throw be;
  if (xe) throw xe;
  if (!country) return res.status(404).json({ error: `Country not found: ${countrySlug}` });
  if (existing) return res.status(409).json({ error: 'This SEO page already exists', document: existing });

  const recommended = Array.isArray(country.recommended)
    ? country.recommended.map((x) => (typeof x === 'string' ? x : x?.slug)).filter(Boolean)
    : [];
  const unavailable = new Set(Array.isArray(country.unavailable) ? country.unavailable.map(String) : []);
  const countryPool = (brokers || []).filter((b) => recommended.includes(b.slug) && !unavailable.has(b.slug));
  const qualifying = countryPool.filter((b) => (topic.requirements || [topic.key]).every((key) => matches(b, key)));
  const minBrokers = 2;
  const eligible = qualifying.length >= minBrokers;
  const year = new Date().getFullYear();
  const title = `${topic.title} in ${country.name}`;
  const blocks = makeBlocks(country, topic, qualifying);
  const faqs = makeFaqs(country, topic);
  const payload = {
    content_key: `country-topic:${countrySlug}:${topicSlug}`,
    content_type: 'country-topic', country_slug: countrySlug, topic_slug: topicSlug, slug: topicSlug,
    title, excerpt: `Compare ${topic.title.toLowerCase()} available to traders in ${country.name}.`,
    html: '', blocks,
    seo_title: `Best ${topic.title} in ${country.name} ${year} | PipRank`,
    seo_description: `Compare ${topic.title.toLowerCase()} available to traders in ${country.name}, including country-specific broker recommendations, costs, platforms and key trading features.`,
    indexable: eligible, published: false,
    settings: {
      rankingMode: 'auto', pinnedBrokerSlugs: [], excludedBrokerSlugs: [], faqs, internalLinks: [
        { label: `Best Forex Brokers in ${country.name}`, href: `/${countrySlug}` },
        { label: 'Find My Best Broker', href: '/quiz' },
      ], generator: { version: 1, generatedAt: new Date().toISOString(), qualifyingBrokerCount: qualifying.length, minBrokers, eligibleForIndexing: eligible, actor: actor.email },
    },
    updated_by: actor.email,
  };
  const { data, error } = await supabase.from('content_documents').insert(payload).select().single();
  if (error) {
    if (error.code === '23505') {
      const { data: duplicate } = await supabase.from('content_documents').select('id,content_key').eq('content_key', payload.content_key).maybeSingle();
      return res.status(409).json({ error: 'This SEO page already exists', document: duplicate || null });
    }
    throw error;
  }
  return res.status(201).json({ document: data, qualifyingBrokerCount: qualifying.length, eligibleForIndexing: eligible });
}


/* ========================== localization manager ========================== */

const LOCALIZATION_TOPICS = [
  { key: 'all', defaultSlug: 'best-forex-brokers', defaultTitle: 'Best Forex Brokers' },
  { key: 'beginners', defaultSlug: 'best-forex-brokers-for-beginners', defaultTitle: 'Best Forex Brokers for Beginners' },
  { key: 'mt4', defaultSlug: 'best-mt4-brokers', defaultTitle: 'Best MT4 Forex Brokers' },
  { key: 'mt5', defaultSlug: 'best-mt5-brokers', defaultTitle: 'Best MT5 Forex Brokers' },
  { key: 'gold', defaultSlug: 'best-gold-brokers', defaultTitle: 'Best Gold Forex Brokers' },
  { key: 'low-spread', defaultSlug: 'low-spread-forex-brokers', defaultTitle: 'Low Spread Forex Brokers' },
];

const MIN_LOCALIZED_CONTENT_LENGTH = 40;

/** Per-language editorial defaults (keep aligned with src/lib/localization.ts). */
const LANGUAGE_TOPIC_TEMPLATES = {
  vi: {
    all: { slug: 'broker-forex-tot-nhat', title: 'Broker Forex Tốt Nhất' },
    beginners: { slug: 'broker-forex-tot-nhat-cho-nguoi-moi', title: 'Broker Forex Tốt Nhất Cho Người Mới' },
    mt4: { slug: 'broker-mt4-tot-nhat', title: 'Broker MT4 Tốt Nhất' },
    mt5: { slug: 'broker-mt5-tot-nhat', title: 'Broker MT5 Tốt Nhất' },
    gold: { slug: 'broker-giao-dich-vang-tot-nhat', title: 'Broker Forex Tốt Nhất Để Giao Dịch Vàng' },
    'low-spread': { slug: 'broker-forex-spread-thap', title: 'Broker Forex Có Spread Thấp' },
  },
  ms: {
    all: { slug: 'broker-forex-terbaik', title: 'Broker Forex Terbaik' },
    beginners: { slug: 'broker-forex-untuk-pemula', title: 'Broker Forex untuk Pemula' },
    mt4: { slug: 'broker-mt4-terbaik', title: 'Broker MT4 Terbaik' },
    mt5: { slug: 'broker-mt5-terbaik', title: 'Broker MT5 Terbaik' },
    gold: { slug: 'broker-emas-terbaik', title: 'Broker Emas Terbaik' },
    'low-spread': { slug: 'broker-spread-rendah', title: 'Broker Forex Spread Rendah' },
  },
};

function templateFor(languageCode, topicKey, countryName, fallbackSlug, fallbackTitle) {
  const pack = LANGUAGE_TOPIC_TEMPLATES[String(languageCode || '').toLowerCase()] || {};
  const t = pack[topicKey];
  if (t) {
    const joiner = String(languageCode).toLowerCase() === 'vi' ? ' tại ' : ' di ';
    const title = countryName && !t.title.includes(countryName) ? `${t.title}${joiner}${countryName}` : t.title;
    return { slug: t.slug, title };
  }
  const title = countryName ? `${fallbackTitle} in ${countryName}` : fallbackTitle;
  return { slug: fallbackSlug, title };
}

function localizedPagePayload(body, existing = {}) {
  const content = String(body.content ?? existing.content ?? '');
  let indexable = body.indexable === undefined ? Boolean(existing.indexable ?? false) : Boolean(body.indexable);
  let published = body.published === undefined ? Boolean(existing.published ?? false) : Boolean(body.published);
  let workflow_status = body.workflow_status !== undefined
    ? String(body.workflow_status)
    : (existing.workflow_status || 'draft');
  if (published) workflow_status = 'published';
  else if (workflow_status === 'published') workflow_status = 'ready';

  return {
    country_id: Number(body.country_id ?? existing.country_id),
    language_id: Number(body.language_id ?? existing.language_id),
    topic_key: String(body.topic_key ?? existing.topic_key ?? 'all').trim(),
    slug: slugify(body.slug ?? existing.slug ?? '').slice(0, 120),
    title: String(body.title ?? existing.title ?? '').trim().slice(0, 180),
    meta_title: String(body.meta_title ?? existing.meta_title ?? '').trim().slice(0, 180) || null,
    meta_description: String(body.meta_description ?? existing.meta_description ?? '').trim().slice(0, 320) || null,
    h1: String(body.h1 ?? existing.h1 ?? '').trim().slice(0, 180) || null,
    content,
    content_document_id: body.content_document_id === null || body.content_document_id === ''
      ? null
      : (body.content_document_id !== undefined
          ? Number(body.content_document_id)
          : (existing.content_document_id != null ? Number(existing.content_document_id) : null)),
    faqs: Array.isArray(body.faqs) ? body.faqs : (existing.faqs ?? []),
    indexable,
    published,
    workflow_status,
  };
}

function assertPublishableMeta(p) {
  if (p.published || p.workflow_status === 'ready') {
    if (!String(p.meta_description || '').trim()) {
      return 'Meta description is required before marking Ready or Published';
    }
    const faqs = Array.isArray(p.faqs) ? p.faqs : [];
    if (faqs.length < 1) {
      return 'At least one FAQ is required before marking Ready or Published';
    }
    if (!String(p.h1 || p.title || '').trim()) {
      return 'H1 or title is required before marking Ready or Published';
    }
  }
  return null;
}

function bodyMeetsMinimum(content, doc) {
  const contentLen = String(content || '').trim().length;
  if (contentLen >= MIN_LOCALIZED_CONTENT_LENGTH) return true;
  if (!doc) return false;
  if (doc.published === false) return false;
  const htmlLen = String(doc.html || '').trim().length;
  if (htmlLen >= MIN_LOCALIZED_CONTENT_LENGTH) return true;
  if (Array.isArray(doc.blocks) && doc.blocks.length > 0) return true;
  return false;
}

async function assertPublishableContent(p) {
  const metaErr = assertPublishableMeta(p);
  if (metaErr) return metaErr;
  if (!(p.published || p.indexable || p.workflow_status === 'ready')) return null;
  let doc = null;
  if (p.content_document_id) {
    const { data } = await supabase
      .from('content_documents')
      .select('id,html,blocks,published,title')
      .eq('id', Number(p.content_document_id))
      .maybeSingle();
    doc = data;
    if (!doc) return 'Linked Content Studio document was not found';
    if (doc.published === false) return 'Linked Content Studio document must be published before going live';
  }
  if ((p.published || p.indexable) && !bodyMeetsMinimum(p.content, doc)) {
    return `Body must be at least ${MIN_LOCALIZED_CONTENT_LENGTH} characters in plain content, or a published Content Studio document must be linked`;
  }
  return null;
}


async function triggerLocalizationDeployHook(reason) {
  const url = process.env.VERCEL_DEPLOY_HOOK_URL || process.env.PIPRANK_DEPLOY_HOOK_URL;
  if (!url) return { skipped: true, reason: 'no_deploy_hook' };
  try {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason: reason || 'localization_publish' }) });
    return { ok: res.ok, status: res.status };
  } catch (e) {
    console.error('Deploy hook failed', e);
    return { ok: false, error: e.message };
  }
}

async function publishLinkedContentDocument(docId, actorEmail) {
  if (!docId) return null;
  const { data, error } = await supabase
    .from('content_documents')
    .update({ published: true, indexable: true, updated_by: actorEmail })
    .eq('id', Number(docId))
    .select('id,published,title')
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function handleLocalization(req, res) {
  if (req.method === 'GET') {
    const { country, language, slug, admin, preview } = req.query;
    const wantsAdmin = admin === 'true' || preview === 'true' || preview === '1';
    if (wantsAdmin) { const actor = await requireRole(req, res, CONTENT_WRITE); if (!actor) return; }
    let query = supabase
      .from('localized_seo_pages')
      .select('*, countries!inner(name,slug), country_languages!inner(name,native_name,code,locale,url_prefix,active)')
      .order('id', { ascending: true });
    if (country) query = query.eq('countries.slug', country);
    if (language) query = query.eq('country_languages.code', language);
    if (slug) query = query.eq('slug', slug);
    // Public: published+indexable only. Admin list or draft preview: all matching rows.
    if (!wantsAdmin) query = query.eq('published', true).eq('indexable', true);
    const { data, error } = await query;
    if (error) throw error;
    const rows = (data ?? []).map((r) => ({
      ...r,
      country_name: r.countries?.name,
      country_slug: r.countries?.slug,
      language_name: r.country_languages?.name,
      language_native_name: r.country_languages?.native_name,
      language_code: r.country_languages?.code,
      locale: r.country_languages?.locale,
      url_prefix: r.country_languages?.url_prefix,
      countries: undefined,
      country_languages: undefined,
    }));
    return res.status(200).json(slug ? (rows[0] ?? null) : rows);
  }

  const actor = await requireRole(req, res, CONTENT_WRITE);
  if (!actor) return;

  if (req.method === 'POST') {
    const body = req.body ?? {};
    const p = localizedPagePayload(body);
    if (!p.country_id || !p.language_id || !p.topic_key || !p.slug || !p.title)
      return res.status(400).json({ error: 'country_id, language_id, topic_key, slug and title are required' });
    const guard = await assertPublishableContent(p);
    if (guard) return res.status(400).json({ error: guard });
    const { data, error } = await supabase.from('localized_seo_pages').insert({ ...p, updated_by: actor.email }).select().single();
    if (error) throw error;
    return res.status(201).json(data);
  }
  if (req.method === 'PUT') {
    const body = req.body ?? {};
    if (!body.id) return res.status(400).json({ error: 'id is required' });
    const { data: existing, error: readError } = await supabase.from('localized_seo_pages').select('*').eq('id', Number(body.id)).single();
    if (readError || !existing) return res.status(404).json({ error: 'Localized page not found' });
    const p = localizedPagePayload(body, existing);
    // Optionally publish linked Studio doc in the same request (confirm-publish-both)
    if (body.publish_studio_document && p.content_document_id) {
      await publishLinkedContentDocument(p.content_document_id, actor.email);
    }
    const guard = await assertPublishableContent(p);
    if (guard) return res.status(400).json({ error: guard });
    const { data, error } = await supabase.from('localized_seo_pages').update({ ...p, updated_by: actor.email }).eq('id', Number(body.id)).select().single();
    if (error) throw error;
    const newlyPublished = Boolean(p.published && !existing.published);
    const contentTouchedWhileLive = Boolean(
      existing.published &&
      p.published &&
      (body.content !== undefined ||
        body.content_document_id !== undefined ||
        body.publish_studio_document ||
        body.title !== undefined ||
        body.slug !== undefined ||
        body.meta_title !== undefined ||
        body.meta_description !== undefined ||
        body.h1 !== undefined ||
        body.faqs !== undefined)
    );
    if (newlyPublished || contentTouchedWhileLive) {
      const hook = await triggerLocalizationDeployHook(`localized_page_${data.id}`);
      return res.status(200).json({ ...data, deploy_hook: hook });
    }
    return res.status(200).json(data);
  }
  if (req.method === 'DELETE') {
    const { id } = req.body ?? {};
    if (!id) return res.status(400).json({ error: 'id is required' });
    const { error } = await supabase.from('localized_seo_pages').delete().eq('id', Number(id));
    if (error) throw error;
    return res.status(200).json({ ok: true });
  }
  return res.status(405).json({ error: 'Method not allowed' });
}

async function handleCountryLanguages(req, res) {
  if (req.method === 'GET') {
    const { country, admin } = req.query;
    // Public callers only see active languages. Admin UI passes admin=true with auth.
    if (admin === 'true') {
      const actor = await requireRole(req, res, CONTENT_WRITE);
      if (!actor) return;
    }
    let query = supabase.from('country_languages').select('*, countries!inner(name,slug)').order('id', { ascending: true });
    if (country) query = query.eq('countries.slug', country);
    if (admin !== 'true') query = query.eq('active', true);
    const { data, error } = await query;
    if (error) throw error;
    return res.status(200).json((data ?? []).map((r) => ({ ...r, country_name: r.countries?.name, country_slug: r.countries?.slug, countries: undefined })));
  }

  const actor = await requireRole(req, res, CONTENT_WRITE);
  if (!actor) return;

  if (req.method === 'POST') {
    const b = req.body ?? {};
    if (!b.country_id || !b.name || !b.native_name || !b.code || !b.locale)
      return res.status(400).json({ error: 'country_id, name, native_name, code and locale are required' });
    const payload = {
      country_id: Number(b.country_id),
      name: String(b.name).trim().slice(0,80),
      native_name: String(b.native_name).trim().slice(0,80),
      code: String(b.code).trim().toLowerCase().slice(0,10),
      locale: String(b.locale).trim().slice(0,20),
      url_prefix: slugify(b.url_prefix || b.code).slice(0,20),
      is_default: Boolean(b.is_default),
      active: b.active === undefined ? true : Boolean(b.active),
      updated_by: actor.email,
    };
    const { data: lang, error } = await supabase.from('country_languages').insert(payload).select().single();
    if (error) throw error;

    // Create a draft shell for every supported commercial intent. Admin can
    // translate/edit these before enabling indexation.
    const country = await supabase.from('countries').select('name,slug').eq('id', payload.country_id).single();
    const countryName = country.data?.name || '';
    const pages = LOCALIZATION_TOPICS.map((t) => {
      const seeded = templateFor(payload.code, t.key, countryName, t.defaultSlug, t.defaultTitle);
      return {
        country_id: payload.country_id,
        language_id: lang.id,
        topic_key: t.key,
        slug: seeded.slug,
        title: seeded.title,
        meta_title: null,
        meta_description: null,
        h1: seeded.title,
        content: '',
        faqs: [],
        indexable: false,
        published: false,
        workflow_status: 'draft',
        updated_by: actor.email,
      };
    });
    const { data: createdPages, error: pe } = await supabase.from('localized_seo_pages').insert(pages).select();
    if (pe) throw pe;
    return res.status(201).json({ language: lang, pages: createdPages, country: country.data ?? null });
  }

  if (req.method === 'PUT') {
    const b = req.body ?? {};
    if (!b.id) return res.status(400).json({ error: 'id is required' });
    const fields = {};
    for (const k of ['name','native_name','code','locale','url_prefix','is_default','active']) if (b[k] !== undefined) fields[k] = b[k];
    if (fields.code) fields.code = String(fields.code).toLowerCase().trim();
    if (fields.url_prefix) fields.url_prefix = slugify(fields.url_prefix).slice(0,20);
    fields.updated_by = actor.email;
    const { data, error } = await supabase.from('country_languages').update(fields).eq('id', Number(b.id)).select().single();
    if (error) throw error;
    return res.status(200).json(data);
  }
  if (req.method === 'DELETE') {
    const { id } = req.body ?? {};
    if (!id) return res.status(400).json({ error: 'id is required' });
    await supabase.from('localized_seo_pages').delete().eq('language_id', Number(id));
    const { error } = await supabase.from('country_languages').delete().eq('id', Number(id));
    if (error) throw error;
    return res.status(200).json({ ok: true });
  }
  return res.status(405).json({ error: 'Method not allowed' });
}



/* ========================== ui packs + glossary + health ========================== */

const DEFAULT_UI_STRING_KEYS = [
  'home', 'recommendations', 'methodologyTitle', 'methodologyAvailability',
  'methodologyIntent', 'methodologyAffiliate', 'findBroker', 'findBrokerBlurb',
  'insufficientData', 'reviewedBy',
];

async function handleLocalizationUiPacks(req, res) {
  if (req.method === 'GET') {
    const { language } = req.query;
    let query = supabase.from('localization_ui_packs').select('*').order('language_code');
    if (language) query = query.eq('language_code', String(language).toLowerCase());
    const { data, error } = await query;
    if (error) {
      // Table may not exist yet on older deploys
      if (String(error.message || '').includes('does not exist')) return res.status(200).json(language ? null : []);
      throw error;
    }
    if (language) return res.status(200).json(data?.[0] ?? null);
    return res.status(200).json(data ?? []);
  }
  const actor = await requireRole(req, res, CONTENT_WRITE);
  if (!actor) return;
  if (req.method === 'POST' || req.method === 'PUT') {
    const b = req.body ?? {};
    const code = String(b.language_code || '').trim().toLowerCase().slice(0, 10);
    if (!code) return res.status(400).json({ error: 'language_code is required' });
    const strings = b.strings && typeof b.strings === 'object' ? b.strings : {};
    const row = { language_code: code, strings, updated_by: actor.email, updated_at: new Date().toISOString() };
    const { data, error } = await supabase.from('localization_ui_packs').upsert(row, { onConflict: 'language_code' }).select().single();
    if (error) throw error;
    return res.status(200).json(data);
  }
  if (req.method === 'DELETE') {
    const code = String(req.body?.language_code || req.query?.language || '').toLowerCase();
    if (!code) return res.status(400).json({ error: 'language_code is required' });
    const { error } = await supabase.from('localization_ui_packs').delete().eq('language_code', code);
    if (error) throw error;
    return res.status(200).json({ ok: true });
  }
  return res.status(405).json({ error: 'Method not allowed' });
}

async function handleLocalizationGlossary(req, res) {
  if (req.method === 'GET') {
    const { language } = req.query;
    let query = supabase.from('localization_glossary').select('*').order('term_en');
    if (language) query = query.eq('language_code', String(language).toLowerCase());
    const { data, error } = await query;
    if (error) {
      if (String(error.message || '').includes('does not exist')) return res.status(200).json([]);
      throw error;
    }
    return res.status(200).json(data ?? []);
  }
  const actor = await requireRole(req, res, CONTENT_WRITE);
  if (!actor) return;
  if (req.method === 'POST') {
    const b = req.body ?? {};
    const language_code = String(b.language_code || '').trim().toLowerCase().slice(0, 10);
    const term_en = String(b.term_en || '').trim().slice(0, 120);
    const term_local = String(b.term_local || '').trim().slice(0, 120);
    if (!language_code || !term_en || !term_local) return res.status(400).json({ error: 'language_code, term_en and term_local are required' });
    const { data, error } = await supabase.from('localization_glossary').upsert({
      language_code, term_en, term_local, notes: b.notes ? String(b.notes).slice(0, 300) : null, updated_by: actor.email,
    }, { onConflict: 'language_code,term_en' }).select().single();
    if (error) throw error;
    return res.status(201).json(data);
  }
  if (req.method === 'PUT') {
    const b = req.body ?? {};
    if (!b.id) return res.status(400).json({ error: 'id is required' });
    const fields = { updated_by: actor.email };
    for (const k of ['term_en', 'term_local', 'notes', 'language_code']) if (b[k] !== undefined) fields[k] = b[k];
    const { data, error } = await supabase.from('localization_glossary').update(fields).eq('id', Number(b.id)).select().single();
    if (error) throw error;
    return res.status(200).json(data);
  }
  if (req.method === 'DELETE') {
    const id = req.body?.id;
    if (!id) return res.status(400).json({ error: 'id is required' });
    const { error } = await supabase.from('localization_glossary').delete().eq('id', Number(id));
    if (error) throw error;
    return res.status(200).json({ ok: true });
  }
  return res.status(405).json({ error: 'Method not allowed' });
}

async function handleLocalizationHealth(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const actor = await requireRole(req, res, CONTENT_WRITE);
  if (!actor) return;
  const { data: pages, error } = await supabase.from('localized_seo_pages').select('id,country_id,language_id,topic_key,slug,title,content,faqs,meta_description,h1,published,indexable,workflow_status,updated_at');
  if (error) throw error;
  const { data: countries } = await supabase.from('countries').select('id,slug,name,recommended');
  const countryById = new Map((countries ?? []).map((c) => [Number(c.id), c]));
  const issues = [];
  for (const p of pages ?? []) {
    const contentLen = String(p.content || '').trim().length;
    const faqCount = Array.isArray(p.faqs) ? p.faqs.length : 0;
    const c = countryById.get(Number(p.country_id));
    const recCount = Array.isArray(c?.recommended) ? c.recommended.length : 0;
    if (p.published && contentLen < 40) issues.push({ id: p.id, type: 'thin_published', message: 'Published with thin body content', slug: p.slug, country: c?.slug });
    if (p.published && p.indexable && recCount < 1) issues.push({ id: p.id, type: 'no_brokers', message: 'Published/indexable but country has no recommended brokers', slug: p.slug, country: c?.slug });
    if ((p.workflow_status === 'ready' || p.published) && !p.meta_description) issues.push({ id: p.id, type: 'missing_meta', message: 'Ready/published without meta description', slug: p.slug, country: c?.slug });
    if ((p.workflow_status === 'ready' || p.published) && faqCount < 1) issues.push({ id: p.id, type: 'missing_faq', message: 'Ready/published without FAQs', slug: p.slug, country: c?.slug });
  }
  return res.status(200).json({
    totals: { pages: (pages ?? []).length, published: (pages ?? []).filter((p) => p.published).length, issues: issues.length },
    issues,
  });
}



/* ======================= country-intent-rankings ======================= */
async function handleCountryIntentRankings(req, res) {
  if (req.method === 'GET') {
    const { country, intent } = req.query;
    let query = supabase.from('country_intent_broker_final_rankings')
      .select('*, countries!inner(slug,name), intents!inner(slug,label), brokers!inner(id,name,slug,rating,trust_score,brand_color,logo_url)')
      .order('final_rank', { ascending: true });
    if (country) query = query.eq('countries.slug', String(country));
    if (intent) query = query.eq('intents.slug', String(intent));
    const { data, error } = await query;
    if (error) throw error;
    return res.status(200).json((data ?? []).map((r) => ({ ...r, countries: undefined, intents: undefined, broker: r.brokers, brokers: undefined })));
  }
  if (!(await requireRole(req, res, CONTENT_WRITE))) return;
  if (req.method === 'PUT') {
    const b=req.body ?? {};
    if (!b.country_id || !b.intent_id || !b.broker_id) return res.status(400).json({error:'country_id, intent_id and broker_id are required'});
    const payload={
      country_id:Number(b.country_id), intent_id:Number(b.intent_id), broker_id:Number(b.broker_id),
      force_include:Boolean(b.force_include), force_exclude:Boolean(b.force_exclude),
      manual_rank:b.manual_rank === null || b.manual_rank === '' ? null : Number(b.manual_rank),
      score_adjustment:Number(b.score_adjustment || 0),
      featured_override:b.featured_override === null || b.featured_override === '' ? null : Boolean(b.featured_override),
      editorial_note:b.editorial_note ? String(b.editorial_note).slice(0,2000) : null,
      updated_at:new Date().toISOString(),
    };
    if (payload.force_include && payload.force_exclude) return res.status(400).json({error:'A broker cannot be both force included and force excluded'});
    const {data,error}=await supabase.from('country_intent_broker_overrides').upsert(payload,{onConflict:'country_id,intent_id,broker_id'}).select().single();
    if(error) throw error; return res.status(200).json(data);
  }
  if (req.method === 'DELETE') {
    const b=req.body ?? {};
    const {error}=await supabase.from('country_intent_broker_overrides').delete().match({country_id:Number(b.country_id),intent_id:Number(b.intent_id),broker_id:Number(b.broker_id)});
    if(error) throw error; return res.status(200).json({ok:true});
  }
  return res.status(405).json({error:'Method not allowed'});
}

/* ================================ router ================================ */

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const resource = String(req.query?.resource ?? '');

  try {
    if (resource === 'guides') return await handleGuides(req, res);
    if (resource === 'intents') return await handleIntents(req, res);
    if (resource === 'countries') return await handleCountries(req, res);
    if (resource === 'country-best-for') return await handleCountryBestFor(req, res);
    if (resource === 'content-documents') return await handleContentDocuments(req, res);
    if (resource === 'content-assets') return await handleContentAssets(req, res);
    if (resource === 'seo-page-generator') return await handleSeoPageGenerator(req, res);
    if (resource === 'country-languages') return await handleCountryLanguages(req, res);
    if (resource === 'localized-seo-pages') return await handleLocalization(req, res);
    if (resource === 'localization-ui-packs') return await handleLocalizationUiPacks(req, res);
    if (resource === 'localization-glossary') return await handleLocalizationGlossary(req, res);
    if (resource === 'localization-health') return await handleLocalizationHealth(req, res);
    if (resource === 'country-intent-rankings') return await handleCountryIntentRankings(req, res);
    return res.status(400).json({ error: "Unknown 'resource' query param" });
  } catch (err) {
    console.error('content API error:', err);
    return res.status(500).json({ error: err.message });
  }
}
