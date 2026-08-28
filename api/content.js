import supabase from './_lib/db-client.js';
import { requireRole } from './_lib/admin-guard.js';

// Temporary stub — full content.js with country visibility + authors will replace this.
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  return res.status(503).json({
    error: 'content API restore in progress — redeploy after full content.js push',
  });
}
