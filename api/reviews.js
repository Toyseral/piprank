import crypto from 'node:crypto';
import supabase from './_lib/db-client.js';
import { requireRole } from './_lib/admin-guard.js';

const STAFF_ALL = ['super_admin', 'admin', 'brokers_admin', 'content_admin', 'moderator'];
const REVIEW_MODERATION = ['super_admin', 'admin', 'moderator'];
const WINDOW_MS = 10 * 60 * 1000;
const MAX_POSTS_PER_WINDOW = 5;
const rateBuckets = new Map();

function clientKey(req) { return String(req.headers['x-forwarded-for'] ?? req.headers['x-real-ip'] ?? 'unknown').split(',')[0].trim().slice(0, 80); }
function rateLimited(req) {
  const now = Date.now(); const key = clientKey(req); const bucket = rateBuckets.get(key) ?? { started: now, count: 0 };
  if (now - bucket.started >= WINDOW_MS) { bucket.started = now; bucket.count = 0; }
  bucket.count += 1; rateBuckets.set(key, bucket);
  if (rateBuckets.size > 5000) for (const [k, v] of rateBuckets) if (now - v.started > WINDOW_MS) rateBuckets.delete(k);
  return bucket.count > MAX_POSTS_PER_WINDOW;
}
function hashVoter(req) { return crypto.createHash('sha256').update(`${clientKey(req)}|${String(req.headers['user-agent'] ?? '').slice(0, 200)}`).digest('hex'); }

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(204).end();
  try {
    if (req.method === 'GET') {
      const { broker_id } = req.query;
      if (broker_id) {
        const { data, error } = await supabase.from('reviews').select('*').eq('broker_id', Number(broker_id)).order('created_at', { ascending: false });
        if (error) throw error;
        res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
        return res.status(200).json(data);
      }
      if (!(await requireRole(req, res, STAFF_ALL))) return;
      const { data, error } = await supabase.from('reviews').select('*').order('created_at', { ascending: false }).limit(500);
      if (error) throw error;
      return res.status(200).json(data);
    }

    if (req.method === 'POST') {
      if (rateLimited(req)) return res.status(429).json({ error: 'Too many review submissions. Please try again later.' });
      const { broker_id, author, country, rating, title, body } = req.body ?? {};
      const brokerId = Number(broker_id); const cleanAuthor = String(author ?? '').trim(); const cleanTitle = String(title ?? '').trim(); const cleanBody = String(body ?? '').trim();
      if (!Number.isInteger(brokerId) || brokerId <= 0 || !cleanAuthor || !cleanTitle || !cleanBody) return res.status(400).json({ error: 'broker_id, author, title and body are required' });
      const r = Number(rating);
      if (!Number.isInteger(r) || r < 1 || r > 5) return res.status(400).json({ error: 'rating must be an integer between 1 and 5' });
      if (cleanAuthor.length < 2 || cleanAuthor.length > 40) return res.status(400).json({ error: 'Please enter a name between 2 and 40 characters' });
      if (cleanTitle.length > 90) return res.status(400).json({ error: 'Review title is too long' });
      if (cleanBody.length < 20 || cleanBody.length > 1200) return res.status(400).json({ error: 'Review must be between 20 and 1200 characters' });
      const { data: recent, error: duplicateError } = await supabase.from('reviews').select('id').eq('broker_id', brokerId).eq('author', cleanAuthor).eq('title', cleanTitle).gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()).limit(1);
      if (duplicateError) throw duplicateError;
      if (recent?.length) return res.status(200).json({ ok: true, duplicate: true });
      const { data, error } = await supabase.from('reviews').insert({ broker_id: brokerId, author: cleanAuthor, country: String(country || 'Not specified').trim().slice(0, 40), rating: r, title: cleanTitle, body: cleanBody, verified: false, helpful: 0 }).select().single();
      if (error) throw error;
      return res.status(201).json(data);
    }

    if (req.method === 'PUT') {
      const body = req.body ?? {}; const { id } = body;
      if (!id) return res.status(400).json({ error: 'id is required' });
      if ('verified' in body) {
        if (!(await requireRole(req, res, REVIEW_MODERATION))) return;
        const { data, error } = await supabase.from('reviews').update({ verified: !!body.verified }).eq('id', Number(id)).select().single();
        if (error) throw error;
        return res.status(200).json(data);
      }
      if (rateLimited(req)) return res.status(429).json({ error: 'Too many vote requests. Please try again later.' });
      const { data, error } = await supabase.rpc('increment_review_helpful', { review_id: Number(id), voter_hash: hashVoter(req) });
      if (error) {
        if (error.code === 'PGRST202' || /increment_review_helpful/i.test(String(error.message ?? ''))) return res.status(503).json({ error: 'Voting is temporarily unavailable' });
        throw error;
      }
      return res.status(200).json(data);
    }

    if (req.method === 'DELETE') {
      if (!(await requireRole(req, res, REVIEW_MODERATION))) return;
      const { id } = req.body ?? {}; if (!id) return res.status(400).json({ error: 'id is required' });
      const { error } = await supabase.from('reviews').delete().eq('id', Number(id)); if (error) throw error;
      return res.status(200).json({ ok: true });
    }
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('reviews API error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
