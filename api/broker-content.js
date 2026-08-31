import supabase from './_lib/db-client.js';
import { requireRole } from './_lib/admin-guard.js';

const WRITE = ['super_admin', 'admin', 'content_admin', 'brokers_admin'];
const ARRAY_FIELDS = ['overview','verdict','why_recommend','best_for_detail','avoid_if','regulation_detail','fees_detail','platform_intro','accounts_intro','funding_intro','faqs','platforms','accounts','payments'];
const cleanArray = (v) => Array.isArray(v) ? v : [];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  try {
    if (req.method === 'GET') {
      const brokerId = Number(req.query?.broker_id || 0);
      if (!brokerId) return res.status(400).json({ error: 'broker_id is required' });
      const { data, error } = await supabase.from('broker_content').select('*').eq('broker_id', brokerId).maybeSingle();
      if (error) throw error;
      return res.status(200).json(data || { broker_id: brokerId, overview: [], verdict: [], why_recommend: [], best_for_detail: [], avoid_if: [], regulation_detail: [], fees_detail: [], platform_intro: [], accounts_intro: [], funding_intro: [], faqs: [], platforms: [], accounts: [], payments: [] });
    }
    const actor = await requireRole(req, res, WRITE);
    if (!actor) return;
    const body = req.body || {};
    const brokerId = Number(body.broker_id || body.id || 0);
    if (!brokerId) return res.status(400).json({ error: 'broker_id is required' });
    const payload = { broker_id: brokerId, updated_at: new Date().toISOString() };
    for (const key of ARRAY_FIELDS) if (body[key] !== undefined) payload[key] = cleanArray(body[key]);
    const { data: existing } = await supabase.from('broker_content').select('id').eq('broker_id', brokerId).maybeSingle();
    const query = existing
      ? supabase.from('broker_content').update(payload).eq('broker_id', brokerId).select().single()
      : supabase.from('broker_content').insert(payload).select().single();
    const { data, error } = await query;
    if (error) throw error;
    return res.status(existing ? 200 : 201).json(data);
  } catch (err) {
    console.error('broker-content API error:', err);
    return res.status(500).json({ error: err.message });
  }
}
