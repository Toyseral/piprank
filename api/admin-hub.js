import supabase from './_lib/db-client.js';
import { requireRole } from './_lib/admin-guard.js';

const CONTENT = ['super_admin', 'admin', 'content_admin', 'brokers_admin'];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (!(await requireRole(req, res, CONTENT))) return;
  if (String(req.query?.resource ?? '') !== 'broker-country') return res.status(400).json({ error: 'Unknown resource' });

  try {
    if (req.method === 'GET') {
      let query = supabase.from('broker_country_availability')
        .select('id, broker_id, country_id, status, note, priority, updated_at, countries!inner(slug, name, flag), brokers!inner(slug, name)')
        .order('priority', { ascending: true });
      if (req.query?.broker_id) query = query.eq('broker_id', Number(req.query.broker_id));
      if (req.query?.country_id) query = query.eq('country_id', Number(req.query.country_id));
      const { data, error } = await query;
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

    if (req.method === 'PUT') {
      const body = req.body ?? {};
      const broker_id = Number(body.broker_id);
      const country_id = Number(body.country_id);
      if (!broker_id || !country_id) return res.status(400).json({ error: 'broker_id and country_id are required' });
      const status = ['available', 'restricted', 'unavailable', 'unknown'].includes(body.status) ? body.status : 'unknown';
      const { data, error } = await supabase.from('broker_country_availability').upsert({
        broker_id,
        country_id,
        status,
        note: body.note ? String(body.note).slice(0, 500) : null,
        priority: Number(body.priority) || 0,
      }, { onConflict: 'broker_id,country_id' }).select().single();
      if (error) throw error;

      const verification = {
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
      const { error: verificationError } = await supabase.from('broker_country_verification').upsert(verification, { onConflict: 'broker_id,country_id' });
      if (verificationError) throw verificationError;
      return res.status(200).json(data);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('admin-hub broker-country error:', error);
    return res.status(500).json({ error: error.message });
  }
}
