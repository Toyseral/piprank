import supabase from './_lib/db-client.js';

/**
 * Public content boundary used by canonical route resolution.
 * Draft/unpublished documents must never be routable from the public site.
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { key, country, topic, type, slug, id } = req.query || {};
  let query = supabase
    .from('content_documents')
    .select('*')
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
    return res.status(200).json(data || null);
  }

  const { data, error } = await query;
  if (error) throw error;
  return res.status(200).json(data || []);
}
