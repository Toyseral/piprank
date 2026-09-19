import supabase from './_lib/db-client.js';
import { requireRole } from './_lib/admin-guard.js';

const MEDIA_WRITE = ['super_admin', 'admin', 'brokers_admin'];
const CONTENT_WRITE = ['super_admin', 'admin', 'brokers_admin', 'content_admin'];

async function handleAvailability(req, res) {
  if (req.method === 'GET') {
    const { broker_id, country_slug } = req.query;
    let query = supabase
      .from('broker_country_availability')
      .select('id, broker_id, country_id, is_available, status, notes, note, source_url, verified, verified_at, priority, updated_at, countries!inner(slug, name)')
      .order('priority', { ascending: true });
    if (broker_id) query = query.eq('broker_id', Number(broker_id));
    if (country_slug) query = query.eq('countries.slug', String(country_slug));
    if (!broker_id && !country_slug) return res.status(400).json({ error: 'broker_id or country_slug is required' });
    const { data, error } = await query;
    if (error) throw error;

    // Country availability is an override model: every broker is available by
    // default, and only an explicit country row changes that state. Returning
    // the complete country matrix keeps the admin editor and ranking engine on
    // the same source of truth without requiring N x M seed rows in the DB.
    if (broker_id) {
      const { data: countries, error: countryError } = await supabase
        .from('countries')
        .select('id,slug,name')
        .order('name', { ascending: true });
      if (countryError) throw countryError;
      const byCountry = new Map((data ?? []).map((row) => [Number(row.country_id), row]));
      return res.status(200).json((countries ?? []).map((country) => {
        const row = byCountry.get(Number(country.id));
        return row
          ? { ...row, note: row.note ?? row.notes ?? '', country_slug: country.slug, country_name: country.name, countries: undefined }
          : {
              id: 0,
              broker_id: Number(broker_id),
              country_id: Number(country.id),
              is_available: true,
              status: 'available',
              notes: null,
              note: '',
              source_url: null,
              verified: false,
              verified_at: null,
              priority: 0,
              updated_at: null,
              country_slug: country.slug,
              country_name: country.name,
            };
      }));
    }

    return res.status(200).json((data ?? []).map((row) => ({
      ...row,
      note: row.note ?? row.notes ?? '',
      country_slug: row.countries?.slug,
      country_name: row.countries?.name,
      countries: undefined,
    })));
  }

  if (!(await requireRole(req, res, CONTENT_WRITE))) return;
  if (req.method === 'PUT') {
    const body = req.body ?? {};
    const broker_id = Number(body.broker_id);
    if (!Number.isInteger(broker_id) || broker_id <= 0) return res.status(400).json({ error: 'broker_id is required' });
    const rows = Array.isArray(body.rows) ? body.rows : [];

    // Validate the complete payload before changing any rows. The database RPC
    // performs the replacement inside one transaction, so a failed insert
    // cannot leave the broker with an empty availability matrix.
    const payload = rows.map((r) => {
      const countryId = Number(r?.country_id);
      const status = String(r?.status ?? 'available').trim().toLowerCase();
      const priority = r?.priority === undefined || r?.priority === null || r?.priority === '' ? 0 : Number(r.priority);
      return {
        country_id: countryId,
        status,
        note: r?.note ? String(r.note).slice(0, 500) : null,
        priority,
      };
    });

    if (payload.some((row) => !Number.isInteger(row.country_id) || row.country_id <= 0)) {
      return res.status(400).json({ error: 'Every availability row must include a valid country_id' });
    }
    if (payload.some((row) => !['available', 'restricted', 'unavailable'].includes(row.status))) {
      return res.status(400).json({ error: 'Availability status must be available, restricted or unavailable' });
    }
    if (payload.some((row) => !Number.isInteger(row.priority) || row.priority < 0)) {
      return res.status(400).json({ error: 'Availability priority must be a non-negative integer' });
    }

    const { error } = await supabase.rpc('replace_broker_country_availability', {
      p_broker_id: broker_id,
      p_rows: payload,
    });
    if (error) throw error;

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
    if (error) throw error;
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
    const body = req.body ?? {};
    const broker_id = Number(body.broker_id);
    const country_id = Number(body.country_id);
    if (!broker_id || !country_id) return res.status(400).json({ error: 'broker_id and country_id are required' });
    const payload = {
      broker_id,
      country_id,
      availability_verified: Boolean(body.availability_verified),
      local_authorisation_status: ['authorised', 'not_authorised', 'not_applicable', 'not_verified'].includes(body.local_authorisation_status) ? body.local_authorisation_status : 'not_verified',
      client_entity: body.client_entity ? String(body.client_entity).slice(0, 200) : null,
      regulator: body.regulator ? String(body.regulator).slice(0, 200) : null,
      affiliate_eligible: body.affiliate_eligible === null || body.affiliate_eligible === undefined ? null : Boolean(body.affiliate_eligible),
      verification_date: body.verification_date || null,
      source_url: body.source_url ? String(body.source_url).slice(0, 500) : null,
      notes: body.notes ? String(body.notes).slice(0, 1000) : null,
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await supabase.from('broker_country_verification').upsert(payload, { onConflict: 'broker_id,country_id' }).select().single();
    if (error) throw error;
    return res.status(200).json(data);
  }
  return res.status(405).json({ error: 'Method not allowed' });
}

async function handleMedia(req, res) {
  if (req.method === 'GET') {
    const { data, error } = await supabase.from('broker_media').select('broker_id, logo_url').order('broker_id', { ascending: true });
    if (error) throw error;
    return res.status(200).json(data ?? []);
  }
  if (!(await requireRole(req, res, MEDIA_WRITE))) return;
  if (req.method === 'PUT') {
    const { broker_id, logo_url } = req.body ?? {};
    if (!broker_id) return res.status(400).json({ error: 'broker_id is required' });
    const { data: existing } = await supabase.from('broker_media').select('id').eq('broker_id', Number(broker_id)).limit(1);
    if (existing?.length) {
      const { data, error } = await supabase.from('broker_media').update({ logo_url: logo_url ?? null, updated_at: new Date().toISOString() }).eq('id', existing[0].id).select().single();
      if (error) throw error;
      return res.status(200).json(data);
    }
    const { data, error } = await supabase.from('broker_media').insert({ broker_id: Number(broker_id), logo_url: logo_url ?? null }).select().single();
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
  const resource = String(req.query?.resource ?? '');
  try {
    if (resource === 'verification') return await handleVerification(req, res);
    if (resource === 'availability') return await handleAvailability(req, res);
    if (resource === 'media') return await handleMedia(req, res);
    return res.status(400).json({ error: "Missing or unknown 'resource' query param (expected 'availability', 'verification' or 'media')" });
  } catch (err) {
    console.error('broker-assets API error:', err);
    return res.status(500).json({ error: 'Unable to process broker asset request' });
  }
}