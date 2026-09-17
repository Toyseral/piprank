import supabase from './_lib/db-client.js';
import { sanitizeHtml, sanitizeBlocks, sanitizePublicSettings } from './_lib/content-sanitizer.js';

const CANONICAL_CONTENT_TYPES = ['guide', 'global-best-for', 'country-guide', 'country-best-for', 'localized-guide', 'localized-best-for', 'broker', 'country'];
const PUBLIC_COLUMNS = ['content_key','content_type','country_slug','topic_slug','slug','title','excerpt','html','blocks','seo_title','seo_description','indexable','published','updated_at','settings'].join(',');

function sanitizePublicDocument(document) {
  if (!document) return null;
  return {
    ...document,
    settings: sanitizePublicSettings(document.settings),
    html: sanitizeHtml(document.html),
    blocks: sanitizeBlocks(document.blocks),
  };
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const { key, country, topic, type, slug, id } = req.query || {};
  const requestedType = String(type || '').trim().toLowerCase();
  if (requestedType && !CANONICAL_CONTENT_TYPES.includes(requestedType)) return res.status(400).json({ error: 'Unsupported content type' });
  if (String(key || '').startsWith('country-topic:')) return res.status(410).json({ error: 'Retired content type.' });
  try {
    let query = supabase.from('content_documents').select(PUBLIC_COLUMNS).in('content_type', CANONICAL_CONTENT_TYPES).eq('published', true).order('updated_at', { ascending: false });
    if (id) query = query.eq('id', Number(id));
    if (key) query = query.eq('content_key', String(key));
    if (country) query = query.eq('country_slug', String(country));
    if (topic) query = query.eq('topic_slug', String(topic));
    if (type) query = query.eq('content_type', requestedType);
    if (slug) query = query.eq('slug', String(slug));
    if (key || id) {
      const { data, error } = await query.maybeSingle();
      if (error) throw error;
      return res.status(200).json(sanitizePublicDocument(data));
    }
    const { data, error } = await query;
    if (error) throw error;
    return res.status(200).json((data || []).map(sanitizePublicDocument));
  } catch (error) {
    console.error('public-content API error:', error);
    return res.status(500).json({ error: 'Unable to load public content' });
  }
}
