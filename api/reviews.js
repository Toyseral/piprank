import supabase from './_lib/db-client.js';
import { requireRole } from './_lib/admin-guard.js';

const STAFF_ALL = ['super_admin', 'admin', 'brokers_admin', 'content_admin', 'moderator'];
const REVIEW_MODERATION = ['super_admin', 'admin', 'moderator'];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    if (req.method === 'GET') {
      const { broker_id } = req.query;
      if (broker_id) {
        const { data, error } = await supabase
          .from('reviews')
          .select('*')
          .eq('broker_id', Number(broker_id))
          .order('created_at', { ascending: false });
        if (error) throw error;
        return res.status(200).json(data);
      }
      // Staff: read all reviews across brokers (any admin role may read moderation lists)
      if (!(await requireRole(req, res, STAFF_ALL))) return;
      const { data, error } = await supabase
        .from('reviews')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      return res.status(200).json(data);
    }

    if (req.method === 'POST') {
      const { broker_id, author, country, rating, title, body } = req.body ?? {};
      // Authentication alone does not prove that a reviewer traded with the broker.
      // New reviews therefore remain unverified until a moderator verifies them.
      const verified = false;
      if (!broker_id || !author || !title || !body)
        return res.status(400).json({ error: 'broker_id, author, title and body are required' });
      const r = Number(rating);
      if (!Number.isInteger(r) || r < 1 || r > 5)
        return res.status(400).json({ error: 'rating must be an integer between 1 and 5' });
      if (String(author).trim().length < 2)
        return res.status(400).json({ error: 'Please add your name' });
      if (String(body).trim().length < 20)
        return res.status(400).json({ error: 'Review must be at least 20 characters' });

      const { data, error } = await supabase
        .from('reviews')
        .insert({
          broker_id: Number(broker_id),
          author: String(author).trim().slice(0, 40),
          country: String(country || 'Not specified').trim().slice(0, 40),
          rating: r,
          title: String(title).trim().slice(0, 90),
          body: String(body).trim().slice(0, 1200),
          verified,
          helpful: 0,
        })
        .select()
        .single();
      if (error) throw error;
      return res.status(201).json(data);
    }

    if (req.method === 'PUT') {
      const body = req.body ?? {};
      const { id } = body;
      if (!id) return res.status(400).json({ error: 'id is required' });

      // Verification toggle is moderation: super admin or moderator only
      if ('verified' in body) {
        if (!(await requireRole(req, res, REVIEW_MODERATION))) return;
        const { data, error } = await supabase
          .from('reviews')
          .update({ verified: !!body.verified })
          .eq('id', Number(id))
          .select()
          .single();
        if (error) throw error;
        return res.status(200).json(data);
      }

      // Public: helpful vote increment
      const { data: current, error: e1 } = await supabase
        .from('reviews')
        .select('id,helpful')
        .eq('id', Number(id))
        .single();
      if (e1 || !current) return res.status(404).json({ error: 'Review not found' });
      const { data, error } = await supabase
        .from('reviews')
        .update({ helpful: (current.helpful ?? 0) + 1 })
        .eq('id', Number(id))
        .select()
        .single();
      if (error) throw error;
      return res.status(200).json(data);
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
    return res.status(500).json({ error: err.message });
  }
}
