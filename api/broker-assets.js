import supabase from './_lib/db-client.js';
import { requireRole } from './_lib/admin-guard.js';

const MEDIA_WRITE = ['super_admin', 'admin', 'brokers_admin'];
const CONTENT_WRITE = ['super_admin', 'admin', 'brokers_admin', 'content_admin'];

// Merged from the former /api/broker-content and /api/broker-media endpoints,
// combined to stay under Vercel's Hobby-plan serverless function limit.
// Routed by the `resource` query param: ?resource=content or ?resource=media.

async function handleContent(req, res) {
  if (req.method === 'GET') {
    const { broker_id } = req.query;
    if (!broker_id) return res.status(400).json({ error: 'broker_id is required' });
    const { data, error } = await supabase
      .from('broker_content')
      .select('*')
      .eq('broker_id', Number(broker_id))
      .maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data ?? null);
  }
  if (!(await requireRole(req, res, CONTENT_WRITE))) return;
  if (req.method === 'PUT') {
    const body = req.body ?? {};
    const broker_id = Number(body.broker_id);
    if (!broker_id) return res.status(400).json({ error: 'broker_id is required' });
    const payload = {
      broker_id,
      overview: Array.isArray(body.overview) ? body.overview : [], verdict: Array.isArray(body.verdict) ? body.verdict : [],
      why_recommend: Array.isArray(body.why_recommend) ? body.why_recommend : [], best_for_detail: Array.isArray(body.best_for_detail) ? body.best_for_detail : [],
      avoid_if: Array.isArray(body.avoid_if) ? body.avoid_if : [], regulation_detail: Array.isArray(body.regulation_detail) ? body.regulation_detail : [],
      fees_detail: Array.isArray(body.fees_detail) ? body.fees_detail : [], platform_intro: Array.isArray(body.platform_intro) ? body.platform_intro : [],
      accounts_intro: Array.isArray(body.accounts_intro) ? body.accounts_intro : [], funding_intro: Array.isArray(body.funding_intro) ? body.funding_intro : [],
      faqs: Array.isArray(body.faqs) ? body.faqs : [], platforms: Array.isArray(body.platforms) ? body.platforms : [],
      accounts: Array.isArray(body.accounts) ? body.accounts : [], payments: Array.isArray(body.payments) ? body.payments : [], updated_at: new Date().toISOString(),
    };
    const { data, error } = await supabase.from('broker_content').upsert(payload, { onConflict: 'broker_id' }).select().single();
    if (error) throw error;
    return res.status(200).json(data);
  }
  return res.status(405).json({ error: 'Method not allowed' });
}

async function handleAvailability(req, res) {
  if (req.method === 'GET') {
    const { broker_id } = req.query;
    if (!broker_id) return res.status(400).json({ error: 'broker_id is required' });
    const { data, error } = await supabase.from('broker_country_availability')
      .select('id, broker_id, country_id, status, note, priority, updated_at, countries!inner(slug, name)')
      .eq('broker_id', Number(broker_id)).order('priority', { ascending: true });
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json((data ?? []).map((row) => ({ ...row, country_slug: row.countries?.slug, country_name: row.countries?.name, countries: undefined })));
  }
  if (!(await requireRole(req, res, CONTENT_WRITE))) return;
  if (req.method === 'PUT') {
    const body = req.body ?? {}; const broker_id = Number(body.broker_id);
    if (!broker_id) return res.status(400).json({ error: 'broker_id is required' });
    const rows = Array.isArray(body.rows) ? body.rows : [];
    const { error: delError } = await supabase.from('broker_country_availability').delete().eq('broker_id', broker_id); if (delError) throw delError;
    if (rows.length) {
      const payload = rows.filter((r) => r?.country_id).map((r) => ({ broker_id, country_id: Number(r.country_id), status: ['available','restricted','unavailable','unknown'].includes(r.status) ? r.status : 'unknown', note: r.note ? String(r.note).slice(0,500) : null, priority: Number.isFinite(Number(r.priority)) ? Number(r.priority) : 0 }));
      const { error } = await supabase.from('broker_country_availability').insert(payload); if (error) throw error;
    }
    return res.status(200).json({ ok: true });
  }
  return res.status(405).json({ error: 'Method not allowed' });
}


async function handleVerification(req, res) {
  if (req.method === 'GET') {
    const { broker_id, country_slug } = req.query;
    let query = supabase.from('broker_country_verification').select('*, countries!inner(slug, name), brokers!inner(slug, name)');
    if (broker_id) query = query.eq('broker_id', Number(broker_id));
    if (country_slug) query = query.eq('countries.slug', String(country_slug));
    const { data, error } = await query.order('verification_date', { ascending: false, nullsFirst: false });
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json((data ?? []).map((row) => ({
      ...row,
      country_slug: row.countries?.slug,
      country_name: row.countries?.name,
      broker_slug: row.brokers?.slug,
      broker_name: row.brokers?.name,
      countries: undefined,
      brokers: undefined,
    })));
  }
  if (!(await requireRole(req, res, CONTENT_WRITE))) return;
  if (req.method === 'PUT') {
    const body=req.body ?? {};
    const broker_id=Number(body.broker_id), country_id=Number(body.country_id);
    if (!broker_id || !country_id) return res.status(400).json({error:'broker_id and country_id are required'});
    const payload={
      broker_id, country_id,
      availability_verified:Boolean(body.availability_verified),
      local_authorisation_status:['authorised','not_authorised','not_applicable','not_verified'].includes(body.local_authorisation_status) ? body.local_authorisation_status : 'not_verified',
      client_entity: body.client_entity ? String(body.client_entity).slice(0,200) : null,
      regulator: body.regulator ? String(body.regulator).slice(0,200) : null,
      affiliate_eligible: body.affiliate_eligible === null || body.affiliate_eligible === undefined ? null : Boolean(body.affiliate_eligible),
      verification_date: body.verification_date || null,
      source_url: body.source_url ? String(body.source_url).slice(0,500) : null,
      notes: body.notes ? String(body.notes).slice(0,1000) : null,
      updated_at:new Date().toISOString(),
    };
    const {data,error}=await supabase.from('broker_country_verification').upsert(payload,{onConflict:'broker_id,country_id'}).select().single();
    if(error) return res.status(500).json({error:error.message});
    return res.status(200).json(data);
  }
  return res.status(405).json({error:'Method not allowed'});
}

async function handleMedia(req, res) {
  // Public: id → logo map (merged into brokers by /api/brokers too)
  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('broker_media')
      .select('broker_id, logo_url')
      .order('broker_id', { ascending: true });
    if (error) throw error;
    return res.status(200).json(data ?? []);
  }

  if (!(await requireRole(req, res, MEDIA_WRITE))) return;

  if (req.method === 'PUT') {
    const { broker_id, logo_url } = req.body ?? {};
    if (!broker_id) return res.status(400).json({ error: 'broker_id is required' });
    const { data: existing } = await supabase
      .from('broker_media')
      .select('id')
      .eq('broker_id', Number(broker_id))
      .limit(1);
    if (existing && existing.length > 0) {
      const { data, error } = await supabase
        .from('broker_media')
        .update({ logo_url: logo_url ?? null, updated_at: new Date().toISOString() })
        .eq('id', existing[0].id)
        .select()
        .single();
      if (error) throw error;
      return res.status(200).json(data);
    }
    const { data, error } = await supabase
      .from('broker_media')
      .insert({ broker_id: Number(broker_id), logo_url: logo_url ?? null })
      .select()
      .single();
    if (error) throw error;
    return res.status(201).json(data);
  }

  if (req.method === 'DELETE') {
    const { broker_id } = req.body ?? {};
    if (!broker_id) return res.status(400).json({ error: 'broker_id is required' });
    const { error } = await supabase.from('broker_media').delete().eq('broker_id', Number(broker_id));
    if (error) throw error;
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const resource = String(req.query?.resource ?? '');

  try {
    if (resource === 'content') return await handleContent(req, res);
    if (resource === 'verification') return await handleVerification(req, res);
    if (resource === 'availability') return await handleAvailability(req, res);
    if (resource === 'media') return await handleMedia(req, res);
    return res.status(400).json({ error: "Missing or unknown 'resource' query param (expected 'content', 'availability' or 'media')" });
  } catch (err) {
    console.error('broker-assets API error:', err);
    return res.status(500).json({ error: err.message });
  }
}
