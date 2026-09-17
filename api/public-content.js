import supabase from './_lib/db-client.js';

const CANONICAL_CONTENT_TYPES = ['guide', 'global-best-for', 'country-guide', 'country-best-for', 'localized-guide', 'localized-best-for', 'broker', 'country'];
const PUBLIC_COLUMNS = ['content_key','content_type','country_slug','topic_slug','slug','title','excerpt','html','blocks','seo_title','seo_description','indexable','published','updated_at','settings'].join(',');
const PUBLIC_SETTING_KEYS = ['locale','languageCode','icon','label','criteria','sections','faqs','ranking_intent_slug','canonicalIntentSlug','image','rankingMode','pinnedBrokerSlugs','excludedBrokerSlugs','comparisonFields'];
const COMPARISON_SETTING_FIELDS = new Set(['min_deposit','spread_eurusd','commission','max_leverage','platforms','payments','regulations']);
function cleanText(value, max) { return String(value ?? '').slice(0, max); }
function cleanHtml(value) { return String(value ?? '').replace(/<!--[\s\S]*?-->/g, '').replace(/<\s*script\b[^>]*>[\s\S]*?<\s*\/script\s*>/gi, '').replace(/\bon[a-z]+\s*=\s*("[^"]*"|'[^']*')/gi, '').slice(0, 100000); }
function cleanStringArray(value, max = 100, itemMax = 300) { return Array.isArray(value) ? value.filter((item) => typeof item === 'string').map((item) => cleanText(item, itemMax)).filter(Boolean).slice(0, max) : []; }
function sanitizePublicSettings(settings) {
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) return {};
  const output = {};
  for (const key of PUBLIC_SETTING_KEYS) {
    const value = settings[key]; if (value === undefined || value === null) continue;
    if (key === 'rankingMode') { output[key] = value === 'manual' ? 'manual' : 'auto'; continue; }
    if (key === 'pinnedBrokerSlugs' || key === 'excludedBrokerSlugs') { output[key] = cleanStringArray(value, 100, 160); continue; }
    if (key === 'comparisonFields') { output[key] = Array.isArray(value) ? value.filter((item) => typeof item === 'string' && COMPARISON_SETTING_FIELDS.has(item)).slice(0, 20) : []; continue; }
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') { output[key] = typeof value === 'string' ? cleanText(value, 500) : value; continue; }
    if (key === 'criteria') { output[key] = cleanStringArray(value, 100, 300); continue; }
    if (key === 'sections') { output[key] = Array.isArray(value) ? value.filter((item) => item && typeof item === 'object' && !Array.isArray(item)).map((item) => ({ title: item.title ? cleanText(item.title, 300) : undefined, html: item.html ? cleanHtml(item.html) : undefined })).slice(0, 100) : []; continue; }
    if (key === 'faqs') { output[key] = Array.isArray(value) ? value.filter((item) => item && typeof item === 'object' && !Array.isArray(item)).map((item) => ({ q: cleanText(item.q, 500), a: cleanText(item.a, 2000) })).filter((item) => item.q && item.a).slice(0, 100) : []; }
  }
  return output;
}
function sanitizePublicDocument(document) { if (!document) return null; return { ...document, settings: sanitizePublicSettings(document.settings), html: cleanHtml(document.html), blocks: Array.isArray(document.blocks) ? document.blocks.slice(0, 200) : [] }; }

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const { key, country, topic, type, slug, id } = req.query || {}; const requestedType = String(type || '').trim().toLowerCase();
  if (requestedType && !CANONICAL_CONTENT_TYPES.includes(requestedType)) return res.status(400).json({ error: 'Unsupported content type' });
  if (String(key || '').startsWith('country-topic:')) return res.status(410).json({ error: 'Retired content type.' });
  try {
    let query = supabase.from('content_documents').select(PUBLIC_COLUMNS).in('content_type', CANONICAL_CONTENT_TYPES).eq('published', true).order('updated_at', { ascending: false });
    if (id) query = query.eq('id', Number(id)); if (key) query = query.eq('content_key', String(key)); if (country) query = query.eq('country_slug', String(country)); if (topic) query = query.eq('topic_slug', String(topic)); if (type) query = query.eq('content_type', requestedType); if (slug) query = query.eq('slug', String(slug));
    if (key || id) { const { data, error } = await query.maybeSingle(); if (error) throw error; return res.status(200).json(sanitizePublicDocument(data)); }
    const { data, error } = await query; if (error) throw error; return res.status(200).json((data || []).map(sanitizePublicDocument));
  } catch (error) {
    console.error('public-content API error:', error); return res.status(500).json({ error: 'Unable to load public content' });
  }
}
