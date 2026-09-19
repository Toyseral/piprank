import crypto from 'node:crypto';
import supabase from './_lib/db-client.js';
import { requireRole } from './_lib/admin-guard.js';

const SITE_ORIGIN = 'https://piprank.com';
const STAFF_ALL = ['super_admin', 'admin', 'brokers_admin', 'content_admin', 'moderator'];
const REVIEW_MODERATION = ['super_admin', 'admin', 'moderator'];
const recentReviewSubmissions = new Map();
const recentHelpfulVotes = new Map();

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', SITE_ORIGIN);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}
function clientKey(req) {
  return String(req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'unknown').split(',')[0].trim().slice(0, 80);
}
function voterFingerprint(req) {
  const ip = clientKey(req) || 'unknown';
  const ua = String(req.headers['user-agent'] || 'unknown').slice(0, 300);
  const secret = process.env.REVIEW_VOTE_HASH_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || SITE_ORIGIN;
  return crypto.createHash('sha256').update(`${secret}:${ip}:${ua}`).digest('hex');
}
function ipHash(req) {
  const secret = process.env.REVIEW_VOTE_HASH_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || SITE_ORIGIN;
  return crypto.createHash('sha256').update(`${secret}:${clientKey(req) || 'unknown'}`).digest('hex');
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    if (req.method === 'GET') {
      const { broker_id } = req.query;
      if (broker_id) {
        const { data, error } = await supabase.from('reviews').select('*').eq('broker_id', Number(broker_id)).eq('verified', true).order('created_at', { ascending: false });
        if (error) throw error;
        return res.status(200).json(data);
      }
      if (!(await requireRole(req, res, STAFF_ALL))) return;
      const { data, error } = await supabase.from('reviews').select('*').order('created_at', { ascending: false }).limit(500);
      if (error) throw error;
      return res.status(200).json(data);
    }

    if (req.method === 'POST') {
      if (JSON.stringify(req.body ?? {}).length > 20_000) return res.status(413).json({ error: 'Review submission is too large' });
      const { broker_id, author, country, rating, title, body, website } = req.body ?? {};
      if (website) return res.status(400).json({ error: 'Unable to submit review' });
      if (!broker_id || !author || !title || !body) return res.status(400).json({ error: 'broker_id, author, title and body are required' });
      const r = Number(rating);
      if (!Number.isInteger(r) || r < 1 || r > 5) return res.status(400).json({ error: 'rating must be an integer between 1 and 5' });
      if (String(author).trim().length < 2 || String(author).trim().length > 40) return res.status(400).json({ error: 'Please add a valid name' });
      if (String(title).trim().length < 4 || String(title).trim().length > 90) return res.status(400).json({ error: 'Please add a valid review title' });
      if (String(body).trim().length < 20 || String(body).trim().length > 1200) return res.status(400).json({ error: 'Review must be between 20 and 1200 characters' });

      const key = clientKey(req);
      const now = Date.now();
      const previous = recentReviewSubmissions.get(key) || 0;
      if (now - previous < 30_000) return res.status(429).json({ error: 'Please wait before submitting another review' });
      recentReviewSubmissions.set(key, now);
      for (const [k, timestamp] of recentReviewSubmissions) if (now - timestamp > 10 * 60_000) recentReviewSubmissions.delete(k);

      const brokerId = Number(broker_id);
      const normalizedAuthor = String(author).trim().slice(0, 40);
      const normalizedTitle = String(title).trim().slice(0, 90);
      const normalizedBody = String(body).trim().slice(0, 1200);
      const { data: broker } = await supabase.from('brokers').select('id').eq('id', brokerId).maybeSingle();
      if (!broker) return res.status(404).json({ error: 'Broker not found' });
      const { data: duplicate } = await supabase.from('reviews').select('id').eq('broker_id', brokerId).eq('author', normalizedAuthor).eq('title', normalizedTitle).eq('body', normalizedBody).limit(1);
      if (duplicate?.length) return res.status(409).json({ error: 'This review has already been submitted' });

      const { data, error } = await supabase.from('reviews').insert({
        broker_id: brokerId, author: normalizedAuthor, country: String(country || 'Not specified').trim().slice(0, 40), rating: r,
        title: normalizedTitle, body: normalizedBody, verified: false, helpful: 0,
      }).select().single();
      if (error) throw error;
      return res.status(201).json(data);
    }

    if (req.method === 'PUT') {
      const body = req.body ?? {};
      const { id } = body;
      if (!id) return res.status(400).json({ error: 'id is required' });
      if ('verified' in body) {
        if (!(await requireRole(req, res, REVIEW_MODERATION))) return;
        const { data, error } = await supabase.from('reviews').update({ verified: !!body.verified }).eq('id', Number(id)).select().single();
        if (error) throw error;
        return res.status(200).json(data);
      }

      // Do not trust a client-supplied voter key for abuse prevention: an attacker
      // could generate a new key for every request and bypass the per-voter constraint.
      // Bind the vote to a server-derived fingerprint instead.
      const voterKey = voterFingerprint(req);
      const fingerprint = ipHash(req);
      const rateKey = `${fingerprint}:${voterKey}`;
      const now = Date.now();
      const previous = recentHelpfulVotes.get(rateKey) || 0;
      if (now - previous < 5_000) return res.status(429).json({ error: 'Please wait before voting again' });
      recentHelpfulVotes.set(rateKey, now);
      for (const [k, timestamp] of recentHelpfulVotes) if (now - timestamp > 10 * 60_000) recentHelpfulVotes.delete(k);

      const { data: rpcResult, error: rpcError } = await supabase.rpc('increment_review_helpful', {
        p_review_id: Number(id),
        p_voter_key: voterKey,
        p_ip_hash: fingerprint,
      });
      if (rpcError) {
        console.error('review helpful RPC error:', rpcError);
        return res.status(500).json({ error: 'Unable to record helpful vote' });
      }
      return res.status(200).json(rpcResult);
    }

    if (req.method === 'DELETE') {
      if (!(await requireRole(req, res, REVIEW_MODERATION))) return;
      const { id } = req.body ?? {};
      if (!id) return res.status(400).json({ error: 'id is required' });
      const { error } = await supabase.from('reviews').delete().eq('id', Number(id));
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('reviews API error:', err);
    return res.status(500).json({ error: 'Unable to process review request' });
  }
}
