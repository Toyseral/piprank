import supabase from './_lib/db-client.js';
import { requireRole } from './_lib/admin-guard.js';
import { sanitizeBlocks } from './_lib/content-sanitizer.js';

const MEDIA_WRITE = ['super_admin', 'admin', 'brokers_admin'];
const CONTENT_WRITE = ['super_admin', 'admin', 'brokers_admin', 'content_admin'];

const EDITORIAL_FIELDS = [
  ['overview', 'Overview'],
  ['verdict', 'Our verdict'],
  ['why_recommend', 'Why we recommend this broker'],
  ['best_for_detail', 'Best for'],
  ['avoid_if', 'Consider avoiding if'],
  ['regulation_detail', 'Regulation'],
  ['fees_detail', 'Fees & costs'],
  ['platform_intro', 'Trading platforms'],
  ['accounts_intro', 'Account types'],
  ['funding_intro', 'Deposits & withdrawals'],
];

const LEGACY_BLOCK_PREFIX = 'legacy-';

function escapeHtml(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\"/g, '&quot;');
}
function paragraphsToHtml(values) {
  return (Array.isArray(values) ? values : []).filter((value) => String(value ?? '').trim()).map((value) => `<p>${escapeHtml(value)}</p>`).join('\n');
}
function editorialSectionFor(field) {
  if (['overview', 'verdict', 'why_recommend', 'best_for_detail', 'avoid_if'].includes(field)) return 'editorial';
  if (field === 'regulation_detail') return 'trust';
  if (field === 'fees_detail') return 'pricing';
  if (field === 'platform_intro') return 'platforms';
  if (field === 'accounts_intro') return 'accounts';
  return 'funding';
}
function legacyContentFromDocument(document, broker) {
  const result = { broker_id: Number(broker.id), overview: [], verdict: [], why_recommend: [], best_for_detail: [], avoid_if: [], regulation_detail: [], fees_detail: [], platform_intro: [], accounts_intro: [], funding_intro: [], faqs: Array.isArray(broker.faqs) ? broker.faqs : [], platforms: Array.isArray(broker.platforms) ? broker.platforms.map((name) => ({ name })) : [], accounts: Array.isArray(broker.account_types) ? broker.account_types.map((name) => ({ name })) : [], payments: Array.isArray(broker.payments) ? broker.payments : [] };
  const headings = new Map(EDITORIAL_FIELDS.map(([field, heading]) => [String(heading).toLowerCase(), field]));
  let section = 'overview';
  for (const raw of Array.isArray(document?.blocks) ? document.blocks : []) {
    const block = raw && typeof raw === 'object' ? raw : {};
    if (block.type === 'heading') { section = headings.get(String(block.title || '').trim().toLowerCase()) || section; continue; }
    if (block.type === 'richtext' && typeof block.html === 'string' && Object.prototype.hasOwnProperty.call(result, section)) {
      const text = block.html.replace(/<br\s*\/?>(?=.)/gi, '\n').replace(/<\/(p|li|div|h[1-6])>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>');
      result[section].push(...text.split(/\n+/).map((value) => value.trim()).filter(Boolean));
    }
  }
  return result;
}

async function getBrokerWithDocument(brokerId) {
  const { data: broker, error: brokerError } = await supabase.from('brokers').select('*').eq('id', Number(brokerId)).maybeSingle();
  if (brokerError) throw brokerError;
  if (!broker) return null;
  const { data: document, error: documentError } = await supabase.from('content_documents').select('*').eq('content_key', `broker:${broker.slug}:main`).maybeSingle();
  if (documentError) throw documentError;
  return { broker, document };
}

function buildCompatibilityBlocks(existingBlocks, body) {
  const legacyIds = new Set();
  for (const [field] of EDITORIAL_FIELDS) {
    legacyIds.add(`legacy-${field}`);
    legacyIds.add(`legacy-${field}-body`);
  }

  // Compatibility saves are allowed to update only the old generated blocks.
  // Preserve every canonical block created by the visual PageBuilder, including
  // broker cards, comparison tables, CTAs, verdicts, images and custom rich text.
  const preserved = (Array.isArray(existingBlocks) ? existingBlocks : []).filter((block) => {
    const id = String(block?.id ?? '');
    return !legacyIds.has(id) && !id.startsWith(LEGACY_BLOCK_PREFIX);
  });

  const generated = [];
  for (const [field, heading] of EDITORIAL_FIELDS) {
    const html = paragraphsToHtml(body[field]);
    if (!html) continue;
    generated.push(
      { id: `legacy-${field}`, type: 'heading', title: heading, editorialSection: editorialSectionFor(field) },
      { id: `legacy-${field}-body`, type: 'richtext', html, editorialSection: editorialSectionFor(field) },
    );
  }

  return sanitizeBlocks([...preserved, ...generated]);
}

async function handleContent(req, res) {
  if (req.method === 'GET') {
    const brokerId = Number(req.query?.broker_id);
    if (!Number.isInteger(brokerId) || brokerId <= 0) return res.status(400).json({ error: 'broker_id is required' });
    const record = await getBrokerWithDocument(brokerId);
    if (!record) return res.status(404).json({ error: 'Broker not found' });
    return res.status(200).json(legacyContentFromDocument(record.document, record.broker));
  }
  if (!(await requireRole(req, res, CONTENT_WRITE))) return;
  if (req.method === 'PUT') {
    const body = req.body ?? {};
    const brokerId = Number(body.broker_id);
    if (!Number.isInteger(brokerId) || brokerId <= 0) return res.status(400).json({ error: 'broker_id is required' });
    const record = await getBrokerWithDocument(brokerId);
    if (!record) return res.status(404).json({ error: 'Broker not found' });

    const blocks = buildCompatibilityBlocks(record.document?.blocks, body);
    const payload = { title: record.document?.title || `${record.broker.name} review`, excerpt: record.document?.excerpt || record.broker.tagline || '', html: record.document?.html || '', blocks, settings: record.document?.settings || { brokerId: brokerId }, seo_title: record.document?.seo_title || `${record.broker.name} review`, seo_description: record.document?.seo_description || record.broker.tagline || '', indexable: record.document?.indexable ?? true, published: record.document?.published ?? true };
    let document = record.document;
    if (document?.id) {
      const { data, error } = await supabase.from('content_documents').update(payload).eq('id', document.id).select().single();
      if (error) throw error;
      document = data;
    } else {
      const { data, error } = await supabase.from('content_documents').insert({ ...payload, content_key: `broker:${record.broker.slug}:main`, content_type: 'broker', country_slug: null, topic_slug: null, slug: record.broker.slug }).select().single();
      if (error) throw error;
      document = data;
    }
    return res.status(200).json(legacyContentFromDocument(document, record.broker));
  }
  return res.status(405).json({ error: 'Method not allowed' });
}

async function handleAvailability(req, res) {
  if (req.method === 'GET') {
    const { broker_id, country_slug } = req.query;
    let query = supabase.from('broker_country_availability').select('id, broker_id, country_id, is_available, status, notes, note, source_url, verified, verified_at, priority, updated_at, countries!inner(slug, name)').order('priority', { ascending: true });
    if (broker_id) query = query.eq('broker_id', Number(broker_id));
    if (country_slug) query = query.eq('countries.slug', String(country_slug));
    if (!broker_id && !country_slug) return res.status(400).json({ error: 'broker_id or country_slug is required' });
    const { data, error } = await query; if (error) throw error;
    return res.status(200).json((data ?? []).map((row) => ({ ...row, note: row.note ?? row.notes ?? '', country_slug: row.countries?.slug, country_name: row.countries?.name, countries: undefined })));
  }
  if (!(await requireRole(req, res, CONTENT_WRITE))) return;
  if (req.method === 'PUT') {
    const body = req.body ?? {}; const broker_id = Number(body.broker_id); if (!broker_id) return res.status(400).json({ error: 'broker_id is required' }); const rows = Array.isArray(body.rows) ? body.rows : [];
    const { error: delError } = await supabase.from('broker_country_availability').delete().eq('broker_id', broker_id); if (delError) throw delError;
    if (rows.length) { const payload = rows.filter((r) => r?.country_id).map((r) => ({ broker_id, country_id: Number(r.country_id), is_available: !['unavailable'].includes(r.status), status: ['available', 'restricted', 'unavailable', 'unknown'].includes(r.status) ? r.status : 'unknown', notes: r.note ? String(r.note).slice(0, 500) : null, note: r.note ? String(r.note).slice(0, 500) : null, priority: Number.isFinite(Number(r.priority)) ? Number(r.priority) : 0, updated_at: new Date().toISOString() })); const { error } = await supabase.from('broker_country_availability').insert(payload); if (error) throw error; }
    return res.status(200).json({ ok: true });
  }
  return res.status(405).json({ error: 'Method not allowed' });
}

async function handleVerification(req, res) {
  if (req.method === 'GET') {
    const { broker_id, country_slug } = req.query; let query = supabase.from('broker_country_verification').select('*, countries!inner(slug, name), brokers!inner(slug, name)'); if (broker_id) query = query.eq('broker_id', Number(broker_id)); if (country_slug) query = query.eq('countries.slug', String(country_slug)); const { data, error } = await query.order('verification_date', { ascending: false, nullsFirst: false }); if (error) throw error; return res.status(200).json((data ?? []).map((row) => ({ ...row, country_slug: row.countries?.slug, country_name: row.countries?.name, broker_slug: row.brokers?.slug, broker_name: row.brokers?.name, countries: undefined, brokers: undefined })));
  }
  if (!(await requireRole(req, res, CONTENT_WRITE))) return;
  if (req.method === 'PUT') { const body = req.body ?? {}; const broker_id = Number(body.broker_id), country_id = Number(body.country_id); if (!broker_id || !country_id) return res.status(400).json({ error: 'broker_id and country_id are required' }); const payload = { broker_id, country_id, availability_verified: Boolean(body.availability_verified), local_authorisation_status: ['authorised', 'not_authorised', 'not_applicable', 'not_verified'].includes(body.local_authorisation_status) ? body.local_authorisation_status : 'not_verified', client_entity: body.client_entity ? String(body.client_entity).slice(0, 200) : null, regulator: body.regulator ? String(body.regulator).slice(0, 200) : null, affiliate_eligible: body.affiliate_eligible === null || body.affiliate_eligible === undefined ? null : Boolean(body.affiliate_eligible), verification_date: body.verification_date || null, source_url: body.source_url ? String(body.source_url).slice(0, 500) : null, notes: body.notes ? String(body.notes).slice(0, 1000) : null, updated_at: new Date().toISOString() }; const { data, error } = await supabase.from('broker_country_verification').upsert(payload, { onConflict: 'broker_id,country_id' }).select().single(); if (error) throw error; return res.status(200).json(data); }
  return res.status(405).json({ error: 'Method not allowed' });
}

async function handleMedia(req, res) {
  if (req.method === 'GET') { const { data, error } = await supabase.from('broker_media').select('broker_id, logo_url').order('broker_id', { ascending: true }); if (error) throw error; return res.status(200).json(data ?? []); }
  if (!(await requireRole(req, res, MEDIA_WRITE))) return;
  if (req.method === 'PUT') { const { broker_id, logo_url } = req.body ?? {}; if (!broker_id) return res.status(400).json({ error: 'broker_id is required' }); const { data: existing } = await supabase.from('broker_media').select('id').eq('broker_id', Number(broker_id)).limit(1); if (existing?.length) { const { data, error } = await supabase.from('broker_media').update({ logo_url: logo_url ?? null, updated_at: new Date().toISOString() }).eq('id', existing[0].id).select().single(); if (error) throw error; return res.status(200).json(data); } const { data, error } = await supabase.from('broker_media').insert({ broker_id: Number(broker_id), logo_url: logo_url ?? null }).select().single(); if (error) throw error; return res.status(201).json(data); }
  if (req.method === 'DELETE') { const { broker_id } = req.body ?? {}; if (!broker_id) return res.status(400).json({ error: 'broker_id is required' }); const { error } = await supabase.from('broker_media').delete().eq('broker_id', Number(broker_id)); if (error) throw error; return res.status(200).json({ ok: true }); }
  return res.status(405).json({ error: 'Method not allowed' });
}

export default async function handler(req, res) {
  const resource = String(req.query?.resource ?? '');
  try { if (resource === 'content') return await handleContent(req, res); if (resource === 'verification') return await handleVerification(req, res); if (resource === 'availability') return await handleAvailability(req, res); if (resource === 'media') return await handleMedia(req, res); return res.status(400).json({ error: "Missing or unknown 'resource' query param (expected 'content', 'availability', 'verification' or 'media')" }); }
  catch (err) { console.error('broker-assets API error:', err); return res.status(500).json({ error: 'Unable to process broker asset request' }); }
}
