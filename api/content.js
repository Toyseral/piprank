import supabase from './_lib/db-client.js';
import { requireRole } from './_lib/admin-guard.js';

const CONTENT_WRITE = ['super_admin', 'admin', 'content_admin'];

// RESTORED - see artifacts for full file. This is a rebuild.
function slugify(s) {
  return String(s || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

function isCountryPubliclyVisible(row) {
  const status = row?.status ?? 'published';
  return status === 'published';
}

async function handleCountries(req, res) {
  if (req.method === 'GET') {
    const { slug, admin } = req.query;
    const wantAll = String(admin ?? '') === '1';
    if (slug) {
      const { data, error } = await supabase.from('countries').select('*').eq('slug', slug).single();
      if (error || !data) return res.status(404).json({ error: 'Country not found' });
      if (!wantAll && !isCountryPubliclyVisible(data)) {
        return res.status(404).json({ error: 'Country not found' });
      }
      return res.status(200).json(data);
    }
    let query = supabase.from('countries').select('*').order('id', { ascending: true });
    if (!wantAll) {
      query = query.or('status.eq.published,status.is.null');
    }
    const { data, error } = await query;
    if (error) {
      if (String(error.message || '').toLowerCase().includes('status')) {
        const fallback = await supabase.from('countries').select('*').order('id', { ascending: true });
        if (fallback.error) throw fallback.error;
        return res.status(200).json(fallback.data ?? []);
      }
      throw error;
    }
    const rows = data ?? [];
    if (wantAll) return res.status(200).json(rows);
    return res.status(200).json(rows.filter(isCountryPubliclyVisible));
  }
  if (!(await requireRole(req, res, CONTENT_WRITE))) return;
  if (req.method === 'POST') {
    const body = req.body ?? {};
    if (!body.name || String(body.name).trim().length < 2)
      return res.status(400).json({ error: 'Country name is required' });
    const status = ['draft', 'published', 'closed'].includes(body.status) ? body.status : 'draft';
    const payload = {
      name: String(body.name).trim().slice(0, 60),
      slug: body.slug ? slugify(body.slug) : slugify(body.name),
      flag: String(body.flag ?? '').slice(0, 8) || '🌍',
      subtitle: String(body.subtitle ?? '').slice(0, 200),
      intro: Array.isArray(body.intro) ? body.intro.filter(Boolean) : [],
      facts: Array.isArray(body.facts) ? body.facts : [],
      recommended: Array.isArray(body.recommended) ? body.recommended : [],
      unavailable: Array.isArray(body.unavailable) ? body.unavailable : [],
      status,
      seo_title: body.seo_title ? String(body.seo_title).slice(0, 180) : null,
      seo_description: body.seo_description ? String(body.seo_description).slice(0, 320) : null,
      seo_intro: Array.isArray(body.seo_intro) ? body.seo_intro.filter(Boolean) : [],
      seo_sections: Array.isArray(body.seo_sections) ? body.seo_sections : [],
      seo_faqs: Array.isArray(body.seo_faqs) ? body.seo_faqs : [],
    };
    const { data, error } = await supabase.from('countries').insert(payload).select().single();
    if (error) throw error;
    return res.status(201).json(data);
  }
  if (req.method === 'PUT') {
    const { id, ...fields } = req.body ?? {};
    if (!id) return res.status(400).json({ error: 'id is required' });
    if (fields.name) fields.slug = fields.slug ? slugify(fields.slug) : slugify(fields.name);
    if (fields.status !== undefined && !['draft', 'published', 'closed'].includes(fields.status)) {
      return res.status(400).json({ error: 'status must be draft, published, or closed' });
    }
    const { data, error } = await supabase.from('countries').update(fields).eq('id', Number(id)).select().single();
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

function cleanCredentials(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((c) => ({
      title: String(c?.title ?? '').trim().slice(0, 200),
      organization: c?.organization ? String(c.organization).trim().slice(0, 200) : undefined,
      year: c?.year === null || c?.year === undefined || c?.year === '' ? null : c.year,
      verification_url: c?.verification_url ? String(c.verification_url).trim().slice(0, 500) : null,
      description: c?.description ? String(c.description).trim().slice(0, 500) : null,
    }))
    .filter((c) => c.title);
}

function cleanAuthorLinks(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((l) => ({
      label: String(l?.label ?? '').trim().slice(0, 80),
      url: String(l?.url ?? '').trim().slice(0, 500),
    }))
    .filter((l) => l.label && l.url);
}

async function handleAuthors(req, res) {
  if (req.method === 'GET') {
    const { slug, all } = req.query;
    if (slug) {
      const { data, error } = await supabase.from('authors').select('*').eq('slug', slug).single();
      if (error || !data) return res.status(404).json({ error: 'Author not found' });
      if (String(all ?? '') !== '1' && !data.published) {
        return res.status(404).json({ error: 'Author not found' });
      }
      return res.status(200).json(data);
    }
    let query = supabase.from('authors').select('*').order('display_order', { ascending: true }).order('id', { ascending: true });
    if (String(all ?? '') !== '1') {
      query = query.eq('published', true);
    }
    const { data, error } = await query;
    if (error) {
      if (String(error.message || '').toLowerCase().includes('authors') || error.code === '42P01') {
        return res.status(200).json([]);
      }
      throw error;
    }
    return res.status(200).json(data ?? []);
  }
  if (!(await requireRole(req, res, CONTENT_WRITE))) return;
  if (req.method === 'POST') {
    const body = req.body ?? {};
    if (!body.pen_name || String(body.pen_name).trim().length < 2) {
      return res.status(400).json({ error: 'pen_name is required' });
    }
    const payload = {
      slug: body.slug ? slugify(body.slug) : slugify(body.pen_name),
      pen_name: String(body.pen_name).trim().slice(0, 120),
      role: String(body.role ?? '').trim().slice(0, 120),
      short_bio: String(body.short_bio ?? body.focus ?? '').trim().slice(0, 300),
      bio: String(body.bio ?? '').trim().slice(0, 4000),
      expertise: Array.isArray(body.expertise) ? body.expertise.map(String).filter(Boolean).slice(0, 20) : [],
      photo_url: body.photo_url ? String(body.photo_url).slice(0, 500) : null,
      color: String(body.color ?? '#1f8a5c').slice(0, 20),
      credentials: cleanCredentials(body.credentials),
      professional_links: cleanAuthorLinks(body.professional_links),
      display_order: Number.isFinite(Number(body.display_order)) ? Number(body.display_order) : 100,
      published: Boolean(body.published),
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await supabase.from('authors').insert(payload).select().single();
    if (error) throw error;
    return res.status(201).json(data);
  }
  if (req.method === 'PUT') {
    const { id, ...fields } = req.body ?? {};
    if (!id) return res.status(400).json({ error: 'id is required' });
    if (fields.slug) fields.slug = slugify(fields.slug);
    if (fields.credentials) fields.credentials = cleanCredentials(fields.credentials);
    if (fields.professional_links) fields.professional_links = cleanAuthorLinks(fields.professional_links);
    if (fields.expertise) fields.expertise = Array.isArray(fields.expertise) ? fields.expertise.map(String).filter(Boolean).slice(0, 20) : [];
    fields.updated_at = new Date().toISOString();
    const { data, error } = await supabase.from('authors').update(fields).eq('id', Number(id)).select().single();
    if (error) throw error;
    return res.status(200).json(data);
  }
  if (req.method === 'DELETE') {
    const { id } = req.body ?? {};
    if (!id) return res.status(400).json({ error: 'id is required' });
    const { error } = await supabase.from('authors').delete().eq('id', Number(id));
    if (error) throw error;
    return res.status(200).json({ ok: true });
  }
  return res.status(405).json({ error: 'Method not allowed' });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    const resource = String(req.query.resource || req.query.type || '').toLowerCase();
    if (resource === 'countries') return await handleCountries(req, res);
    if (resource === 'authors') return await handleAuthors(req, res);
    return res.status(400).json({ error: 'Unknown or missing resource. Full content API restore in progress for other resources.' });
  } catch (err) {
    console.error('content API error:', err);
    return res.status(500).json({ error: err.message });
  }
}
