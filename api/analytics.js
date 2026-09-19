import supabase from './_lib/db-client.js';
import { requireRole } from './_lib/admin-guard.js';

const SITE_ORIGIN = 'https://piprank.com';
const ANALYTICS_READ = ['super_admin', 'admin', 'brokers_admin', 'content_admin', 'moderator'];
const AFFILIATE_ADMIN = ['super_admin', 'admin'];
const ALLOWED_EVENT_TYPES = new Set(['cta_click','affiliate_click','broker_click','broker_view','comparison_run','quiz_start','quiz_step','quiz_answer','quiz_complete','results_view','signup','intent_view','country_view']);
const publicRate = new Map();

function setCors(res) { res.setHeader('Access-Control-Allow-Origin', SITE_ORIGIN); res.setHeader('Vary', 'Origin'); res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS'); res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization'); }
function clientKey(req) { return String(req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'unknown').split(',')[0].trim().slice(0, 80); }
function rateLimit(req, limit = 60, windowMs = 60_000) {
  const key = clientKey(req); const now = Date.now(); const previous = publicRate.get(key) || { started: now, count: 0 };
  if (now - previous.started >= windowMs) { previous.started = now; previous.count = 0; }
  previous.count += 1; publicRate.set(key, previous);
  for (const [k, v] of publicRate) if (now - v.started > windowMs * 2) publicRate.delete(k);
  return previous.count <= limit;
}
function positiveInt(value) { const n = Number(value); return Number.isInteger(n) && n > 0 ? n : null; }
function httpsUrl(value) { try { const u = new URL(String(value ?? '').trim()); return u.protocol === 'https:' && !!u.hostname ? u.toString() : null; } catch { return null; } }
function cleanTrackingParams(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).filter(([k, v]) => /^[A-Za-z0-9_.-]{1,40}$/.test(k) && (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean')).slice(0, 20).map(([k, v]) => [k, String(v).slice(0, 200)]));
}

async function clicks(req, res) {
  if (req.method === 'POST') {
    if (!rateLimit(req, 60)) return res.status(429).json({ error: 'Too many analytics requests' });
    if (JSON.stringify(req.body ?? {}).length > 4000) return res.status(413).json({ error: 'Analytics payload is too large' });
    const { broker_id, page } = req.body ?? {};
    const brokerId = positiveInt(broker_id);
    if (!brokerId) return res.status(400).json({ error: 'broker_id must be a positive integer' });
    const pageValue = String(page ?? '').trim(); if (pageValue.length > 200) return res.status(400).json({ error: 'page is too long' });
    const { data: broker } = await supabase.from('brokers').select('id').eq('id', brokerId).maybeSingle(); if (!broker) return res.status(404).json({ error: 'Broker not found' });
    const { error } = await supabase.from('clicks').insert({ broker_id: brokerId, page: pageValue }); if (error) throw error;
    return res.status(201).json({ ok: true });
  }
  if (!(await requireRole(req, res, ANALYTICS_READ))) return;
  if (req.method === 'GET') {
    const daysRaw = Number(req.query?.days); const days = Number.isFinite(daysRaw) && daysRaw > 0 && daysRaw <= 365 ? daysRaw : null; const cutoff = days ? new Date(Date.now() - days * 86400000).toISOString() : null;
    let query = supabase.from('clicks').select('*').order('created_at', { ascending: false }).limit(2000); if (cutoff) query = query.gte('created_at', cutoff);
    const { data: allRows, error: e1 } = await supabase.from('clicks').select('id'); if (e1) throw e1; const { data, error } = await query; if (error) throw error;
    const byBroker = {}, byPage = {}, byDay = {}; for (const row of data ?? []) { byBroker[row.broker_id] = (byBroker[row.broker_id] ?? 0) + 1; byPage[row.page || '(unknown)'] = (byPage[row.page || '(unknown)'] ?? 0) + 1; const day = String(row.created_at).slice(0, 10); byDay[day] = (byDay[day] ?? 0) + 1; }
    return res.status(200).json({ total: data?.length ?? 0, allTimeTotal: allRows?.length ?? 0, byBroker, byPage, byDay, recent: (data ?? []).slice(0, 25) });
  }
  return res.status(405).json({ error: 'Method not allowed' });
}

async function events(req, res) {
  if (req.method === 'POST') {
    if (!rateLimit(req, 120)) return res.status(429).json({ error: 'Too many analytics requests' });
    if (JSON.stringify(req.body ?? {}).length > 10_000) return res.status(413).json({ error: 'Analytics payload is too large' });
    const { type, session, meta } = req.body ?? {}; const cleanType = String(type ?? '').trim().slice(0, 40); if (!ALLOWED_EVENT_TYPES.has(cleanType)) return res.status(400).json({ error: 'Unknown event type' });
    const cleanSession = String(session ?? '').trim().slice(0, 64); if (cleanSession && !/^[A-Za-z0-9._:-]+$/.test(cleanSession)) return res.status(400).json({ error: 'Invalid session id' });
    const cleanMeta = meta && typeof meta === 'object' && !Array.isArray(meta) ? Object.fromEntries(Object.entries(meta).slice(0, 40).map(([k, v]) => [String(k).slice(0, 60), typeof v === 'string' ? v.slice(0, 500) : typeof v === 'number' || typeof v === 'boolean' ? v : null])) : {};
    const { error } = await supabase.from('events').insert({ type: cleanType, session: cleanSession || null, meta: cleanMeta }); if (error) throw error;
    return res.status(201).json({ ok: true });
  }
  if (!(await requireRole(req, res, ANALYTICS_READ))) return;
  if (req.method === 'GET') { const daysRaw = Number(req.query?.days); const days = Number.isFinite(daysRaw) && daysRaw > 0 && daysRaw <= 365 ? daysRaw : null; const cutoff = days ? new Date(Date.now() - days * 86400000).toISOString() : null; let query = supabase.from('events').select('*').order('created_at', { ascending: false }).limit(8000); if (cutoff) query = query.gte('created_at', cutoff); const { data, error } = await query; if (error) throw error; return res.status(200).json(data ?? []); }
  return res.status(405).json({ error: 'Method not allowed' });
}

async function affiliateLinks(req, res) {
  if (!(await requireRole(req, res, AFFILIATE_ADMIN))) return;
  if (req.method === 'GET') { const brokerId = req.query?.broker_id ? positiveInt(req.query.broker_id) : null; if (req.query?.broker_id && !brokerId) return res.status(400).json({ error: 'broker_id must be a positive integer' }); let query = supabase.from('affiliate_links').select('*').order('broker_id').order('country_code', { nullsFirst: true }); if (brokerId) query = query.eq('broker_id', brokerId); const { data, error } = await query; if (error) throw error; return res.status(200).json(data ?? []); }
  if (req.method === 'POST') {
    const body = req.body ?? {}; const brokerId = positiveInt(body.broker_id);
    if (!brokerId) return res.status(400).json({ error: 'broker_id must be a positive integer' });
    const affiliateUrl = httpsUrl(body.affiliate_url);
    if (!affiliateUrl) return res.status(400).json({ error: 'A valid HTTPS affiliate_url is required' });
    const country = body.country_code ? String(body.country_code).trim().toUpperCase() : null; if (country && !/^[A-Z]{2}$/.test(country)) return res.status(400).json({ error: 'country_code must be a 2-letter ISO code' });
    const tracking = cleanTrackingParams(body.tracking_params); const direct = body.direct_url ? String(body.direct_url).trim().slice(0, 2000) : null; if (direct && !/^https:\/\//i.test(direct)) return res.status(400).json({ error: 'direct_url must be HTTPS' });
    const payload = { broker_id: brokerId, country_code: country, affiliate_url: affiliateUrl.slice(0, 2000), direct_url: direct, tracking_params: tracking, network: body.network ? String(body.network).trim().slice(0, 120) : null, active: body.active !== false, cpa_notes: body.cpa_notes ? String(body.cpa_notes).slice(0, 4000) : null };
    const { data, error } = await supabase.from('affiliate_links').insert(payload).select().single(); if (error) throw error; return res.status(201).json(data);
  }
  if (req.method === 'PUT') {
    const { id, ...input } = req.body ?? {}; const linkId = positiveInt(id); if (!linkId) return res.status(400).json({ error: 'id must be a positive integer' }); const fields = {};
    for (const key of ['country_code','affiliate_url','direct_url','tracking_params','network','active','cpa_notes']) if (key in input) fields[key] = input[key];
    if ('affiliate_url' in fields) { const parsed = httpsUrl(fields.affiliate_url); if (!parsed) return res.status(400).json({ error: 'A valid HTTPS affiliate_url is required' }); fields.affiliate_url = parsed.slice(0, 2000); } if ('direct_url' in fields && fields.direct_url) { const parsed = httpsUrl(fields.direct_url); if (!parsed) return res.status(400).json({ error: 'direct_url must be HTTPS' }); fields.direct_url = parsed.slice(0, 2000); }
    if ('country_code' in fields) { const code = fields.country_code ? String(fields.country_code).trim().toUpperCase() : null; if (code && !/^[A-Z]{2}$/.test(code)) return res.status(400).json({ error: 'country_code must be a 2-letter ISO code' }); fields.country_code = code; }
    if ('tracking_params' in fields) fields.tracking_params = cleanTrackingParams(fields.tracking_params); if ('network' in fields) fields.network = fields.network ? String(fields.network).trim().slice(0, 120) : null; if ('cpa_notes' in fields) fields.cpa_notes = fields.cpa_notes ? String(fields.cpa_notes).slice(0, 4000) : null; if ('active' in fields) fields.active = !!fields.active;
    const { data, error } = await supabase.from('affiliate_links').update(fields).eq('id', linkId).select().single(); if (error) throw error; return res.status(200).json(data);
  }
  if (req.method === 'DELETE') { const { id } = req.body ?? {}; if (!id) return res.status(400).json({ error: 'id is required' }); const { error } = await supabase.from('affiliate_links').delete().eq('id', linkId); if (error) throw error; return res.status(200).json({ ok: true }); }
  return res.status(405).json({ error: 'Method not allowed' });
}

async function affiliateDashboard(req, res) {
  if (!(await requireRole(req, res, AFFILIATE_ADMIN))) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' }); const daysRaw = Number(req.query?.days); const days = Number.isFinite(daysRaw) && daysRaw > 0 && daysRaw <= 365 ? daysRaw : 30; const cutoff = new Date(Date.now() - days * 86400000).toISOString();
  const { data, error } = await supabase.from('redirect_clicks').select('broker_id, broker_slug, country, source_page, page_type, best_for_category, comparison_pair, referrer, utm_source, device_type, created_at').gte('created_at', cutoff).order('created_at', { ascending: false }).limit(5000); if (error) throw error;
  const rows = data ?? []; const agg = (key) => rows.reduce((out, r) => { const k = r[key] || '(none)'; out[k] = (out[k] ?? 0) + 1; return out; }, {}); const byDay = rows.reduce((out, r) => { const d = String(r.created_at).slice(0, 10); out[d] = (out[d] ?? 0) + 1; return out; }, {});
  return res.status(200).json({ total: rows.length, windowDays: days, byBroker: agg('broker_slug'), byCountry: agg('country'), byPageType: agg('page_type'), bySourcePage: agg('source_page'), byBestFor: agg('best_for_category'), byComparisonPair: agg('comparison_pair'), byReferrer: agg('referrer'), byUtmSource: agg('utm_source'), byDevice: agg('device_type'), byDay, recent: rows.slice(0, 50) });
}

export default async function handler(req, res) {
  setCors(res); if (req.method === 'OPTIONS') return res.status(204).end(); const resource = String(req.query?.resource ?? '');
  try { if (resource === 'clicks') return await clicks(req, res); if (resource === 'events') return await events(req, res); if (resource === 'links') return await affiliateLinks(req, res); if (resource === 'dashboard') return await affiliateDashboard(req, res); return res.status(400).json({ error: "Missing or unknown 'resource'" }); }
  catch (err) { console.error(`analytics API (${resource}) error:`, err); return res.status(500).json({ error: 'Unable to process analytics request' }); }
}
