import supabase from './_lib/db-client.js';
import { requireRole } from './_lib/admin-guard.js';
import { exposeCanonicalBrokerIntents, normalizeBrokerIntentStorage } from './_lib/broker-intent-taxonomy.js';

const BROKER_WRITE = ['super_admin', 'admin', 'brokers_admin'];
const SITE_ORIGIN = 'https://piprank.com';
const PUBLIC_BROKER_FIELDS = 'id,name,slug,tagline,brand_color,logo_url,rating,trust_score,founded,headquarters,website,min_deposit,spread_eurusd,commission,commission_value,max_leverage,leverage_value,execution_ms,withdrawal_hours,deposit_time,uptime,withdrawal_fee,inactivity_fee,bonus,demo_account,islamic_account,copy_trading,scalping,hedging,nbp,segregated,support_channels,support_score,regulations,platforms,payments,account_types,assets,best_for,pros,cons,review,testing,faqs,health,featured';
const BROKER_MUTABLE_FIELDS = PUBLIC_BROKER_FIELDS.split(',').filter((field) => !['id', 'logo_url'].includes(field));
const BROKER_DEFAULTS = { tagline: 'New broker under review', brand_color: '#35a371', rating: 4.0, trust_score: 75, founded: new Date().getFullYear(), headquarters: '—', website: 'https://example.com', min_deposit: 100, spread_eurusd: 0.8, commission: 'None (spread-only)', commission_value: 0, max_leverage: '1:500', leverage_value: 500, execution_ms: 50, withdrawal_hours: 24, deposit_time: 'Instant', uptime: 99.9, withdrawal_fee: 0, inactivity_fee: 'None', bonus: null, demo_account: true, islamic_account: false, copy_trading: false, scalping: true, hedging: true, nbp: true, segregated: true, support_channels: ['Live chat', 'Email'], support_score: 80, regulations: [], platforms: ['MT4', 'MT5'], payments: ['Bank transfer', 'Visa', 'Mastercard'], account_types: ['Standard', 'Demo'], assets: { forex: 50, indices: 12, commodities: 10, crypto: 10, stocks: 500 }, best_for: [], pros: [], cons: [], review: ['Editorial review is being written.'], testing: [], faqs: [], health: { regulation: 80, longevity: 75, withdrawals: 80, execution: 78, support: 80, sentiment: 78 }, featured: false };
function pickBrokerFields(input) { const output = {}; for (const field of BROKER_MUTABLE_FIELDS) if (Object.prototype.hasOwnProperty.call(input, field)) output[field] = input[field]; if (Object.prototype.hasOwnProperty.call(output, 'best_for')) output.best_for = normalizeBrokerIntentStorage(output.best_for); return output; }
function slugify(name) { return String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''); }
function normalizePlatforms(value) {
  if (!Array.isArray(value)) return [];
  return value.map((platform) => {
    if (typeof platform === 'string') return { name: platform, summary: '', features: [] };
    if (!platform || typeof platform !== 'object') return null;
    const name = String(platform.name ?? '').trim();
    if (!name) return null;
    return { name, summary: typeof platform.summary === 'string' ? platform.summary : '', features: Array.isArray(platform.features) ? platform.features.map(String).filter(Boolean) : [] };
  }).filter(Boolean);
}
function normalizeBroker(data) { return data ? { ...data, platforms: normalizePlatforms(data.platforms), best_for: exposeCanonicalBrokerIntents(data.best_for) } : data; }
function setCors(res, methods) { res.setHeader('Access-Control-Allow-Origin', SITE_ORIGIN); res.setHeader('Vary', 'Origin'); res.setHeader('Access-Control-Allow-Methods', `${methods}, OPTIONS`); res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization'); }
export default async function handler(req, res) {
  setCors(res, 'GET, POST, PUT, DELETE');
  if (req.method === 'OPTIONS') return res.status(204).end();
  try {
    if (req.method === 'GET') {
      const requestedSlug = String(req.query?.slug ?? '').trim().toLowerCase();
      const { data: media, error: mediaError } = await supabase.from('broker_media').select('broker_id, logo_url');
      if (mediaError) throw mediaError;
      const logoMap = new Map((media ?? []).map((row) => [Number(row.broker_id), row.logo_url ?? null]));
      if (requestedSlug) {
        const { data, error } = await supabase.from('brokers').select(PUBLIC_BROKER_FIELDS).eq('slug', requestedSlug).maybeSingle();
        if (error) throw error;
        if (!data) return res.status(404).json({ error: 'Broker not found' });
        return res.status(200).json(normalizeBroker({ ...data, logo_url: logoMap.get(Number(data.id)) ?? data.logo_url ?? null }));
      }
      const { data, error } = await supabase.from('brokers').select(PUBLIC_BROKER_FIELDS).order('rating', { ascending: false });
      if (error) throw error;
      return res.status(200).json((data ?? []).map((broker) => normalizeBroker({ ...broker, logo_url: logoMap.get(Number(broker.id)) ?? broker.logo_url ?? null })));
    }
    if (!(await requireRole(req, res, BROKER_WRITE))) return;
    if (req.method === 'POST') { const body = req.body ?? {}; if (!body.name || String(body.name).trim().length < 2) return res.status(400).json({ error: 'Broker name is required' }); const payload = { ...BROKER_DEFAULTS, ...pickBrokerFields(body), name: String(body.name).trim(), slug: body.slug ? slugify(body.slug) : slugify(body.name), platforms: normalizePlatforms(body.platforms ?? BROKER_DEFAULTS.platforms) }; const { data, error } = await supabase.from('brokers').insert(payload).select().single(); if (error) throw error; return res.status(201).json(normalizeBroker(data)); }
    if (req.method === 'PUT') {
      const { id, ...input } = req.body ?? {};
      if (!id) return res.status(400).json({ error: 'id is required' });
      const brokerId = Number(id);
      if (!Number.isInteger(brokerId) || brokerId <= 0) return res.status(400).json({ error: 'A valid id is required' });
      const fields = pickBrokerFields(input);
      if (Object.prototype.hasOwnProperty.call(input, 'slug')) fields.slug = slugify(input.slug);
      if (Object.prototype.hasOwnProperty.call(input, 'name')) fields.name = String(input.name).trim();
      if (Object.prototype.hasOwnProperty.call(input, 'platforms')) fields.platforms = normalizePlatforms(input.platforms);
      if (Object.prototype.hasOwnProperty.call(fields, 'bonus') && !fields.bonus) fields.bonus = null;
      if (!Object.keys(fields).length) return res.status(400).json({ error: 'No valid broker fields supplied' });

      const { data: existingBroker, error: existingBrokerError } = await supabase
        .from('brokers').select('id,slug').eq('id', brokerId).maybeSingle();
      if (existingBrokerError) throw existingBrokerError;
      if (!existingBroker) return res.status(404).json({ error: 'Broker not found' });

      if (existingBroker.slug !== fields.slug && fields.slug) {
        const { data: conflictingContent, error: contentConflictError } = await supabase
          .from('content_documents')
          .select('id')
          .eq('content_type', 'broker')
          .or(`slug.eq.${fields.slug},content_key.like.broker:${fields.slug}:%`)
          .limit(1);
        if (contentConflictError) throw contentConflictError;
        if (conflictingContent?.length) {
          return res.status(409).json({ error: 'Broker content already exists for the requested slug' });
        }
      }

      const { data, error } = await supabase.from('brokers').update(fields).eq('id', brokerId).select().single();
      if (error) throw error;

      return res.status(200).json(normalizeBroker(data));
    }
    if (req.method === 'DELETE') {
      const brokerId = Number(req.body?.id); if (!Number.isInteger(brokerId) || brokerId <= 0) return res.status(400).json({ error: 'A valid id is required' });
      const { data: broker, error: brokerLookupError } = await supabase.from('brokers').select('id,slug').eq('id', brokerId).maybeSingle(); if (brokerLookupError) throw brokerLookupError; if (!broker) return res.status(404).json({ error: 'Broker not found' });
      // Dependent broker tables use ON DELETE CASCADE/SET NULL where appropriate.
      // Broker-owned rich content is removed by the database trigger in the same transaction.
      const { error } = await supabase.from('brokers').delete().eq('id', brokerId);
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) { console.error('brokers API error:', err); return res.status(500).json({ error: 'Unable to process broker request' }); }
}
