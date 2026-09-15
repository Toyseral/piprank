import supabase from './_lib/db-client.js';
import { requireRole } from './_lib/admin-guard.js';

const CONTENT_WRITE = ['super_admin', 'admin', 'content_admin'];

function slugify(value) {
  return String(value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const { country, admin } = req.query;
      if (admin === 'true' && !(await requireRole(req, res, CONTENT_WRITE))) return;

      let query = supabase
        .from('country_languages')
        .select('*, countries!inner(name,slug)')
        .order('id', { ascending: true });

      if (country) query = query.eq('countries.slug', String(country));
      if (admin !== 'true') query = query.eq('active', true);

      const { data, error } = await query;
      if (error) throw error;

      return res.status(200).json((data ?? []).map((row) => ({
        ...row,
        country_name: row.countries?.name,
        country_slug: row.countries?.slug,
        countries: undefined,
      })));
    }

    const actor = await requireRole(req, res, CONTENT_WRITE);
    if (!actor) return;

    if (req.method === 'POST') {
      const body = req.body ?? {};
      if (!body.country_id || !body.name || !body.native_name || !body.code || !body.locale) {
        return res.status(400).json({ error: 'country_id, name, native_name, code and locale are required' });
      }

      const payload = {
        country_id: Number(body.country_id),
        name: String(body.name).trim().slice(0, 80),
        native_name: String(body.native_name).trim().slice(0, 80),
        code: String(body.code).trim().toLowerCase().slice(0, 10),
        locale: String(body.locale).trim().slice(0, 20),
        url_prefix: slugify(body.url_prefix || body.code).slice(0, 20),
        is_default: Boolean(body.is_default),
        active: body.active === undefined ? true : Boolean(body.active),
        updated_by: actor.email,
      };

      const { data, error } = await supabase.from('country_languages').insert(payload).select().single();
      if (error) throw error;
      return res.status(201).json({ language: data, pages: [] });
    }

    if (req.method === 'PUT') {
      const body = req.body ?? {};
      if (!body.id) return res.status(400).json({ error: 'id is required' });
      const fields = { updated_by: actor.email };
      for (const key of ['name', 'native_name', 'code', 'locale', 'url_prefix', 'is_default', 'active']) {
        if (body[key] !== undefined) fields[key] = body[key];
      }
      if (fields.code) fields.code = String(fields.code).toLowerCase().trim();
      if (fields.url_prefix) fields.url_prefix = slugify(fields.url_prefix).slice(0, 20);

      const { data, error } = await supabase.from('country_languages').update(fields).eq('id', Number(body.id)).select().single();
      if (error) throw error;
      return res.status(200).json(data);
    }

    if (req.method === 'DELETE') {
      const { id } = req.body ?? {};
      if (!id) return res.status(400).json({ error: 'id is required' });

      const { error } = await supabase.from('country_languages').delete().eq('id', Number(id));
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('canonical country languages API error:', error);
    return res.status(500).json({ error: error.message });
  }
}
