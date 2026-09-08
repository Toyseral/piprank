import supabase from './_lib/db-client.js';
import { requireRole } from './_lib/admin-guard.js';

const CONTENT_WRITE = ['super_admin', 'admin', 'content_admin'];
const TABLES = { guide: 'guides', intent: 'intents', country_best_for: 'country_best_for' };
const ALLOWED = new Set(['richtext','heading','image','table','callout','divider','links','broker_card','broker_grid','comparison_table','broker_cta']);

function cleanHtml(input = '') {
  return String(input)
    .replace(/<\s*(script|style|iframe|object|embed|form|input|button|textarea|select)[^>]*>[\s\S]*?<\/\s*\1\s*>/gi, '')
    .replace(/<(script|style|iframe|object|embed|form|input|button|textarea|select)[^>]*\/?>/gi, '')
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/javascript\s*:/gi, '').trim();
}
function cleanBlocks(value) {
  if (!Array.isArray(value)) return [];
  return value.filter(b => b && typeof b === 'object' && ALLOWED.has(String(b.type))).map(b => {
    const out = { ...b, id: String(b.id || `b_${Date.now()}_${Math.random().toString(36).slice(2,8)}`), type: String(b.type) };
    if (typeof out.html === 'string') out.html = cleanHtml(out.html);
    if (Array.isArray(out.links)) out.links = out.links.map(x => ({ label: String(x?.label ?? '').trim(), href: String(x?.href ?? '').trim() })).filter(x => x.label && x.href);
    if (Array.isArray(out.rows)) out.rows = out.rows.map(row => Array.isArray(row) ? row.map(String) : []).filter(row => row.length);
    if (Array.isArray(out.brokerIds)) out.brokerIds = out.brokerIds.map(Number).filter(Number.isFinite);
    if (out.brokerId !== undefined) out.brokerId = Number(out.brokerId) || null;
    if (Array.isArray(out.fields)) out.fields = out.fields.map(String);
    return out;
  });
}
export default async function handler(req, res) {
  const { type, id } = req.method === 'GET' ? req.query : (req.body || {});
  const table = TABLES[type];
  if (!table || !id) return res.status(400).json({ error: 'type and id are required' });
  if (req.method === 'GET') {
    const { data, error } = await supabase.from(table).select('id,blocks').eq('id', Number(id)).single();
    if (error || !data) return res.status(404).json({ error: 'Page not found' });
    return res.status(200).json(data);
  }
  if (!(await requireRole(req, res, CONTENT_WRITE))) return;
  if (req.method !== 'PUT') return res.status(405).json({ error: 'Method not allowed' });
  const { data, error } = await supabase.from(table).update({ blocks: cleanBlocks(req.body?.blocks) }).eq('id', Number(id)).select('*').single();
  if (error) throw error;
  return res.status(200).json(data);
}
