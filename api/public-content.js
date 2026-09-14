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

const PUBLIC_SETTING_KEYS = [
  'locale',
  'languageCode',
  'icon',
  'label',
  'criteria',
  'sections',
  'faqs',
  'ranking_intent_slug',
  'canonicalIntentSlug',
  'image',
];

function sanitizePublicSettings(settings) {
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) return {};
  const output = {};
  for (const key of PUBLIC_SETTING_KEYS) {
    const value = settings[key];
    if (value === undefined || value === null) continue;
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      output[key] = typeof value === 'string' ? value.slice(0, 500) : value;
      continue;
    }
    if (key === 'criteria' && Array.isArray(value)) {
      output[key] = value.filter((item) => typeof item === 'string').map((item) => item.slice(0, 300)).slice(0, 100);
      continue;
    }
    if (key === 'sections' && Array.isArray(value)) {
      output[key] = value.filter((item) => item && typeof item === 'object' && !Array.isArray(item)).slice(0, 100);
      continue;
    }
    if (key === 'faqs' && Array.isArray(value)) {
      output[key] = value
        .filter((item) => item && typeof item === 'object' && !Array.isArray(item))
        .map((item) => ({
          q: typeof item.q === 'string' ? item.q.slice(0, 500) : '',
          a: typeof item.a === 'string' ? item.a.slice(0, 2000) : '',
        }))
        .filter((item) => item.q && item.a)
        .slice(0, 100);
    }
  }
  return output;
}

function sanitizePublicDocument(document) {
  if (!document) return null;
  return {
    ...document,
    settings: sanitizePublicSettings(document.settings),
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
