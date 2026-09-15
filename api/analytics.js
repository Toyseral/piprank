import supabase from './_lib/db-client.js';
import { requireRole } from './_lib/admin-guard.js';

const ANALYTICS_READ = ['super_admin', 'admin', 'brokers_admin', 'content_admin', 'moderator'];
const AFFILIATE_ADMIN = ['super_admin', 'admin'];
const ALLOWED_EVENT_TYPES = new Set(['cta_click','affiliate_click','broker_click','broker_view','comparison_run','quiz_start','quiz_step','quiz_answer','quiz_complete','results_view','signup','intent_view','country_view']);
const PUBLIC_WINDOW_MS = 60 * 1000;
const PUBLIC_MAX_WRITES = 60;
const buckets = new Map();
const TRACKING_KEY = /^[A-Za-z][A-Za-z0-9_-]{0,39}$/;

function clientKey(req) { return String(req.headers['x-forwarded-for'] ?? req.headers['x-real-ip'] ?? 'unknown').split(',')[0].trim().slice(0, 80); }
function limited(req) {
  const now = Date.now(); const key = clientKey(req); const b = buckets.get(key) ?? { started: now, count: 0 };
  if (now - b.started >= PUBLIC_WINDOW_MS) { b.started = now; b.count = 0; }
  b.count += 1; buckets.set(key, b);
  if (buckets.size > 5000) for (const [k, v] of buckets) if (now - v.started > PUBLIC_WINDOW_MS) buckets.delete(k);
  return b.count > PUBLIC_MAX_WRITES;
}
function cleanMeta(meta) {
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return {};
  const entries = Object.entries(meta).slice(0, 30);
  const out = {};
  for (const [key, value] of entries) {
    if (!TRACKING_KEY.test(key)) continue;
    if (typeof value === 'string') out[key] = value.slice(0, 500);
    else if (typeof value === 'number' || typeof value === 'boolean') out[key] = value;
  }
  return out;
}
function cleanTrackingParams(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const out = {};
  for (const [key, raw] of Object.entries(value).slice(0, 30)) {
    if (!TRACKING_KEY.test(key)) return null;
    if (typeof raw !== 'string' && typeof raw !== 'number') return null;
    out[key] = String(raw).slice(0, 200);
  }
  return out;
}

async function clicks(req, res) {
  if (req.method === 'POST') {
    if (limited(req)) return res.status(429).json({ error: 'Too many analytics requests. Please try again later.' });
    const { broker_id, page } = req.body ?? {};
    const brokerId = Number(broker_id); const cleanPage = String(page ?? '').trim().slice(0, 200);
    if (!Number.isInteger(brokerId) || brokerId <= 0 || !cleanPage) return res.status(400).json({ error: 'broker_id and page are required' });
    const { error } = await supabase.from('clicks').insert({ broker_id: brokerId, page: cleanPage });
    if (error) throw error;
    return res.status(201).json({ ok: true });
  }
  if (!(await requireRole(req, res, ANALYTICS_READ))) return;
  if (req.method === 'GET') {
    const daysRaw = Number(req.query?.days); const days = Number.isFinite(daysRaw) && daysRaw > 0 && daysRaw <= 365 ? daysRaw : null;
    const cutoff = days ? new Date(Date.now() - days * 86400000).toISOString() : null;
    let query = supabase.from('clicks').select('*').order('created_at', { ascending: false }).limit(2000);
    if (cutoff) query = query.gte('created_at', cutoff);
    const { data: allRows, error: e1 } = await supabase.from('clicks').select('id'); if (e1) throw e1;
    const { data, error } = await query; if (error) throw error;
    const byBroker = {}, byPage = {}, byDay = {};
    for (const row of data ?? []) { byBroker[row.broker_id] = (byBroker[row.broker_id] ?? 0) + 1; byPage[row.page || '(unknown)'] = (byPage[row.page || '(unknown)'] ?? 0) + 1; const day = String(row.created_at).slice(0, 10); byDay[day] = (byDay[day] ?? 0) + 1; }
    return res.status(200).json({ total: data?.length ?? 0, allTimeTotal: allRows?.length ?? 0, byBroker, byPage, byDay, recent: (data ?? []).slice(0, 25) });
  }
  return res.status(405).json({ error: 'Method not allowed' });
}

async function events(req, res) {
  if (req.method === 'POST') {
    if (limited(req)) return res.status(429).json({ error: 'Too many analytics requests. Please try again later.' });
    const { type, session, meta } = req.body ?? {};
    const cleanType = String(type ?? '').trim().slice(0, 40);
    if (!ALLOWED_EVENT_TYPES.has(cleanType)) return res.status(400).json({ error: 'Unknown event type' });
    const cleanSession = String(session ?? '').slice(0, 64) || null;
    const cleanMeta = cleanMetaObject(meta);
    const { error } = await supabase.from('events').insert({ type: cleanType, session: cleanSession, meta: cleanMeta });
    if (error) throw error;
    return res.status(201).json({ ok: true });
  }
  if (!(await requireRole(req, res, ANALYTICS_READ))) return;
  if (req.method === 'GET') {
    const daysRaw = Number(req.query?.days); const days = Number.isFinite(daysRaw) && daysRaw > 0 && daysRaw <= 365 ? daysRaw : null;
    const cutoff = days ? new Date(Date.now() - days * 86400000).toISOString() : null;
    let query = supabase.from('events').select('*').order('created_at', { ascending: false }).limit(8000); if (cutoff) query = query.gte('created_at', cutoff);
    const { data, error } = await query; if (error) throw error; return res.status(200).json(data ?? []);
  }
  return res.status(405).json({ error: 'Method not allowed' });
}
function cleanMetaObject(meta) { return cleanMeta(meta); }

async function affiliateLinks(req, res) {
  if (!(await requireRole(req, res, AFFILIATE_ADMIN))) return;
  if (req.method === 'GET') {
    const brokerId = req.query?.broker_id ? Number(req.query.broker_id) : null; let query = supabase.from('affiliate_links').select('*').order('broker_id').order('country_code', { nullsFirst: true });
    if (brokerId) query = query.eq('broker_id', brokerId); const { data, error } = await query; if (error) throw error; return res.status(200).json(data ?? []);
  }
  if (req.method === 'POST') {
    const body = req.body ?? {};
    if (!body.broker_id) return res.status(400).json({ error: 'broker_id is required' });
    const affiliateUrl = String(body.affiliate_url ?? '').trim();
    if (!/^https:\/\//i.test(affiliateUrl)) return res.status(400).json({ error: 'A valid HTTPS affiliate_url is required' });
    const country = body.country_code ? String(body.country_code).trim().toUpperCase() : null;
    if (country && !/^[A-Z]{2}$/.test(country)) return res.status(400).json({ error: 'country_code must be a 2-letter ISO code' });
    const tracking = cleanTrackingParams(body.tracking_params); if (tracking === null && body.tracking_params !== undefined) return res.status(400).json({ error: 'tracking_params contains an invalid key or value' });
    const direct = body.direct_url ? String(body.direct_url).trim().slice(0, 2000) : null;
    if (direct && !/^https:\/\//i.test(direct)) return res.status(400).json({ error: 'direct_url must be HTTPS' });
    const payload = { broker_id: Number(body.broker_id), country_code: country, affiliate_url: affiliateUrl.slice(0, 2000), direct_url: direct, tracking_params: tracking ?? {}, network: body.network ? String(body.network).trim().slice(0, 120) : null, active: body.active !== false, cpa_notes: body.cpa_notes ? String(body.cpa_notes).slice(0, 4000) : null };
    const { data, error } = await supabase.from('affiliate_links').insert(payload).select().single(); if (error) throw error; return res.status(201).json(data);
  }
  if (req.method === 'PUT') {
    const { id, ...input } = req.body ?? {}; if (!id) return res.status(400).json({ error: 'id is required' }); const fields = {};
    for (const key of ['country_code','affiliate_url','direct_url','tracking_params','network','active','cpa_notes']) if (key in input) fields[key] = input[key];
    if ('affiliate_url' in fields && !/^https:\/\//i.test(String(fields.affiliate_url))) return res.status(400).json({ error: 'A valid HTTPS affiliate_url is required' });
    if ('direct_url' in fields && fields.direct_url && !/^https:\/\//i.test(String(fields.direct_url))) return res.status(400).json({ error: 'direct_url must be HTTPS' });
    if ('country_code' in fields) { const code = fields.country_code ? String(fields.country_code).trim().toUpperCase() : null; if (code && !/^[A-Z]{2}$/.test(code)) return res.status(400).json({ error: 'country_code must be a 2-letter ISO code' }); fields.country_code = code; }
    if ('tracking_params' in fields) { const tracking = cleanTrackingParams(fields.tracking_params); if (tracking === null) return res.status(400).json({ error: 'tracking_params contains an invalid key or value' }); fields.tracking_params = tracking; }
    if ('network' in fields) fields.network = fields.network ? String(fields.network).trim().slice(0, 120) : null;
    if ('cpa_notes' in fields) fields.cpa_notes = fields.cpa_notes ? String(fields.cpa_notes).slice(0, 4000) : null;
    if ('active' in fields) fields.active = !!fields.active;
    const { data, error } = await supabase.from('affiliate_links').update(fields).eq('id', Number(id)).select().single(); if (error) throw error; return res.status(200).json(data);
  }
  if (req.method === 'DELETE') { const { id } = req.body ?? {}; if (!id) return res.status(400).json({ error: 'id is required' }); const { error } = await supabase.from('affiliate_links').delete().eq('id', Number(id)); if (error) throw error; return res.status(200).json({ ok: true }); }
  return res.status(405).json({ error: 'Method not allowed' });
}

async function affiliateDashboard(req, res) {
  if (!(await requireRole(req, res, AFFILIATE_ADMIN))) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const daysRaw = Number(req.query?.days); const days = Number.isFinite(daysRaw) && daysRaw > 0 && daysRaw <= 365 ? daysRaw : 30; const cutoff = new Date(Date.now() - days * 86400000).toISOString();
  const { data, error } = await supabase.from('redirect_clicks').select('broker_id, broker_slug, country, source_page, page_type, best_for_category, comparison_pair, referrer, utm_source, device_type, created_at').gte('created_at', cutoff).order('created_at', { ascending: false }).limit(5000); if (error) throw error;
  const rows = data ?? []; const agg = (key) => rows.reduce((out, r) => { const k = r[key] || '(none)'; out[k] = (out[k] ?? 0) + 1; return out; }, {}); const byDay = rows.reduce((out, r) => { const d = String(r.created_at).slice(0, 10); out[d] = (out[d] ?? 0) + 1; return out; }, {});
  return res.status(200).json({ total: rows.length, windowDays: days, byBroker: agg('broker_slug'), byCountry: agg('country'), byPageType: agg('page_type'), bySourcePage: agg('source_page'), byBestFor: agg('best_for_category'), byComparisonPair: agg('comparison_pair'), byReferrer: agg('referrer'), byUtmSource: agg('utm_source'), byDevice: agg('device_type'), byDay, recent: rows.slice(0, 50) });
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(204).end();
  const resource = String(req.query?.resource ?? '');
  try {
    if (resource === 'clicks') return await clicks(req, res);
    if (resource === 'events') return await events(req, res);
    if (resource === 'links') return await affiliateLinks(req, res);
    if (resource === 'dashboard') return await affiliateDashboard(req, res);
    return res.status(400).json({ error: "Missing or unknown 'resource'" });
  } catch (err) {
    console.error(`analytics API (${resource}) error:`, err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
