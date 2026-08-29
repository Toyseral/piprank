import supabase from './_lib/db-client.js';
import { requireRole } from './_lib/admin-guard.js';

const CONTENT_ROLES = ['super_admin', 'admin', 'content_admin', 'brokers_admin'];
const SEO_ROLES = ['super_admin', 'admin', 'content_admin'];

async function countries(req, res) {
  const admin = req.query?.admin === '1';
  if (admin && !(await requireRole(req, res, CONTENT_ROLES))) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  let query = supabase.from('countries').select('*').order('id', { ascending: true });
  if (!admin) query = query.eq('status', 'published');
  if (req.query?.slug) query = query.eq('slug', String(req.query.slug));
  const { data, error } = await query;
  if (error) throw error;
  if (req.query?.slug && !data?.[0]) return res.status(404).json({ error: 'Country not found' });
  return res.status(200).json(req.query?.slug ? data[0] : data ?? []);
}

async function bestFor(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const admin = req.query?.admin === '1';
  if (admin && !(await requireRole(req, res, CONTENT_ROLES))) return;
  let query = supabase.from('country_best_for').select('*, countries!inner(name, slug, status)').order('sort_order', { ascending: true }).order('id', { ascending: true });
  if (req.query?.country) query = query.eq('countries.slug', String(req.query.country));
  if (req.query?.slug) query = query.eq('slug', String(req.query.slug));
  if (!admin) query = query.eq('countries.status', 'published').eq('indexable', true);
  const { data, error } = await query;
  if (error) throw error;
  const rows = (data ?? []).map((row) => ({ ...row, country_name: row.countries?.name, country_slug: row.countries?.slug, countries: undefined }));
  if (req.query?.slug && !rows[0]) return res.status(404).json({ error: 'Country Best-For page not found' });
  return res.status(200).json(req.query?.slug ? rows[0] : rows);
}

async function documents(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const admin = req.query?.admin === '1';
  if (admin && !(await requireRole(req, res, SEO_ROLES))) return;
  let query = supabase.from('content_documents').select('*').order('updated_at', { ascending: false });
  if (req.query?.country) query = query.eq('country_slug', String(req.query.country));
  if (!admin) query = query.eq('published', true).eq('indexable', true);
  const { data, error } = await query;
  if (error) throw error;
  let rows = data ?? [];
  if (!admin) {
    const slugs = [...new Set(rows.map((row) => row.country_slug).filter(Boolean))];
    if (slugs.length) {
      const { data: published } = await supabase.from('countries').select('slug').in('slug', slugs).eq('status', 'published');
      const allowed = new Set((published ?? []).map((row) => row.slug));
      rows = rows.filter((row) => !row.country_slug || allowed.has(row.country_slug));
    }
  }
  return res.status(200).json(rows);
}

async function localized(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const admin = req.query?.admin === '1';
  if (admin && !(await requireRole(req, res, SEO_ROLES))) return;
  let query = supabase.from('localized_seo_pages').select('*, countries!inner(slug, status), country_languages!inner(locale, active, url_prefix)').order('updated_at', { ascending: false });
  if (req.query?.country) query = query.eq('countries.slug', String(req.query.country));
  if (!admin) query = query.eq('published', true).eq('indexable', true).eq('countries.status', 'published').eq('country_languages.active', true);
  const { data, error } = await query;
  if (error) throw error;
  return res.status(200).json((data ?? []).map((row) => ({ ...row, country_slug: row.countries?.slug, language_code: row.country_languages?.locale, countries: undefined, country_languages: undefined })));
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  try {
    const resource = String(req.query?.resource ?? 'countries');
    if (resource === 'countries') return countries(req, res);
    if (resource === 'country-best-for') return bestFor(req, res);
    if (resource === 'content-documents') return documents(req, res);
    if (resource === 'localized-seo-pages') return localized(req, res);
    return res.status(400).json({ error: 'Unknown resource' });
  } catch (error) {
    console.error('public-country API error:', error);
    return res.status(500).json({ error: error.message });
  }
}
