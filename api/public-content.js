import supabase from './_lib/db-client.js';

const PUBLIC_COLUMNS = [
  'content_key',
  'content_type',
  'country_slug',
  'topic_slug',
  'slug',
  'title',
  'excerpt',
  'html',
  'blocks',
  'seo_title',
  'seo_description',
  'indexable',
  'published',
  'updated_at',
  'settings',
].join(',');

function sanitizePublicDocument(document) {
  if (!document) return null;
  const settings = document.settings && typeof document.settings === 'object'
    ? document.settings
    : {};

  return {
    ...document,
    // Only expose settings required for public routing/localization.
    // Internal generator/audit metadata must never cross the public boundary.
    settings: {
      ...(typeof settings.locale === 'string' ? { locale: settings.locale } : {}),
      ...(typeof settings.languageCode === 'string' ? { languageCode: settings.languageCode } : {}),
    },
  };
}

/**
 * Public content boundary used by canonical route resolution.
 * Draft/unpublished documents must never be routable from the public site.
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { key, country, topic, type, slug, id } = req.query || {};
  let query = supabase
    .from('content_documents')
    .select(PUBLIC_COLUMNS)
    .eq('published', true)
    .order('updated_at', { ascending: false });

  if (id) query = query.eq('id', Number(id));
  if (key) query = query.eq('content_key', String(key));
  if (country) query = query.eq('country_slug', String(country));
  if (topic) query = query.eq('topic_slug', String(topic));
  if (type) query = query.eq('content_type', String(type));
  if (slug) query = query.eq('slug', String(slug));

  if (key || id) {
    const { data, error } = await query.maybeSingle();
    if (error) throw error;
    return res.status(200).json(sanitizePublicDocument(data));
  }

  const { data, error } = await query;
  if (error) throw error;
  return res.status(200).json((data || []).map(sanitizePublicDocument));
}
