import supabase from './_lib/db-client.js';
import { requireRole } from './_lib/admin-guard.js';

const BROKER_WRITE = ['super_admin', 'admin', 'brokers_admin'];

const BROKER_DEFAULTS = {
  tagline: 'New broker under review',
  brand_color: '#35a371',
  rating: 4.0,
  trust_score: 75,
  founded: new Date().getFullYear(),
  headquarters: '—',
  website: 'https://example.com',
  affiliate_url: null,
  min_deposit: 100,
  spread_eurusd: 0.8,
  commission: 'None (spread-only)',
  commission_value: 0,
  max_leverage: '1:500',
  leverage_value: 500,
  execution_ms: 50,
  withdrawal_hours: 24,
  deposit_time: 'Instant',
  uptime: 99.9,
  withdrawal_fee: 0,
  inactivity_fee: 'None',
  demo_account: true,
  islamic_account: false,
  copy_trading: false,
  scalping: true,
  hedging: true,
  nbp: true,
  segregated: true,
  bonus: null,
  risk_warning: null,
  support_channels: ['Live chat', 'Email'],
  support_score: 80,
  regulations: [],
  platforms: ['MT4', 'MT5'],
  payments: ['Bank transfer', 'Visa', 'Mastercard'],
  account_types: ['Standard', 'Demo'],
  assets: { forex: 50, indices: 12, commodities: 10, crypto: 10, stocks: 500 },
  best_for: [],
  pros: [],
  cons: [],
  review: ['Editorial review is being written.'],
  testing: [],
  faqs: [],
  health: { regulation: 80, longevity: 75, withdrawals: 80, execution: 78, support: 80, sentiment: 78 },
  featured: false,
};

function slugify(name) {
  return String(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    // ---------- PUBLIC READ (logos merged from broker_media) ----------
    if (req.method === 'GET') {
      const { data: media } = await supabase.from('broker_media').select('broker_id, logo_url');
      const logoMap = new Map((media ?? []).map((m) => [m.broker_id, m.logo_url]));
      // affiliate_url is intentionally stripped from every public response —
      // the frontend routes through /go/{slug} instead of ever seeing the
      // raw tracked URL. `website` (the broker's own homepage) still passes
      // through since that's not a tracked/commission link.
      const withLogo = (b) => {
        const { affiliate_url, ...safe } = b;
        return { ...safe, logo_url: logoMap.get(b.id) ?? null };
      };

      const { slug } = req.query;
      if (slug) {
        const { data, error } = await supabase.from('brokers').select('*').eq('slug', slug).single();
        if (error || !data) return res.status(404).json({ error: 'Broker not found' });
        return res.status(200).json(withLogo(data));
      }
      const { data, error } = await supabase
        .from('brokers')
        .select('*')
        .order('rating', { ascending: false });
      if (error) throw error;
      return res.status(200).json((data ?? []).map(withLogo));
    }

    // ---------- BROKER WRITES: super admin or brokers manager ----------
    if (!(await requireRole(req, res, BROKER_WRITE))) return;

    if (req.method === 'POST') {
      const body = req.body ?? {};
      if (!body.name || String(body.name).trim().length < 2)
        return res.status(400).json({ error: 'Broker name is required' });
      const payload = {
        ...BROKER_DEFAULTS,
        ...body,
        slug: body.slug ? slugify(body.slug) : slugify(body.name),
        bonus: body.bonus || null,
      };
      delete payload.id;
      const { data, error } = await supabase.from('brokers').insert(payload).select().single();
      if (error) throw error;
      return res.status(201).json(data);
    }

    if (req.method === 'PUT') {
      const { id, ...fields } = req.body ?? {};
      if (!id) return res.status(400).json({ error: 'id is required' });
      if (fields.name && !fields.slug) fields.slug = slugify(fields.name);
      if ('bonus' in fields && !fields.bonus) fields.bonus = null;
      const { data, error } = await supabase
        .from('brokers')
        .update(fields)
        .eq('id', Number(id))
        .select()
        .single();
      if (error) throw error;
      return res.status(200).json(data);
    }

    if (req.method === 'DELETE') {
      const { id } = req.body ?? {};
      if (!id) return res.status(400).json({ error: 'id is required' });
      await supabase.from('reviews').delete().eq('broker_id', Number(id));
      await supabase.from('clicks').delete().eq('broker_id', Number(id));
      await supabase.from('broker_content').delete().eq('broker_id', Number(id));
      const { error } = await supabase.from('brokers').delete().eq('id', Number(id));
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('brokers API error:', err);
    return res.status(500).json({ error: err.message });
  }
}
