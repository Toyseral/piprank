import crypto from 'node:crypto';
import supabase from './_lib/db-client.js';
import { requireRole } from './_lib/admin-guard.js';
import { isoToSlug, slugToIso2, parseCookieCountry } from './_lib/geo-map.js';

const MANAGEABLE_ROLES = ['super_admin', 'admin', 'brokers_admin', 'content_admin', 'moderator'];
const MEDIA_WRITE = ['super_admin', 'admin', 'brokers_admin'];
const SUBSCRIBER_ACCESS = ['super_admin', 'admin', 'moderator'];
const PROMO_WRITE = ['super_admin', 'admin', 'content_admin'];

function cors(res, methods) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', `${methods}, OPTIONS`);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (res.req?.method === 'OPTIONS') return true;
  return false;
}

async function findAuthUserId(email) {
  const clean = String(email).toLowerCase();
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const found = data?.users?.find((u) => u.email?.toLowerCase() === clean);
    if (found) return found.id;
    if (!data?.users || data.users.length < 1000) break;
  }
  return null;
}


async function geo(req, res) {
  const cookieSlug = parseCookieCountry(req.headers.cookie);
  const ipIso = String(req.headers['x-vercel-ip-country'] ?? req.headers['cf-ipcountry'] ?? '').trim().toUpperCase() || null;
  const cookieIso = cookieSlug ? slugToIso2(cookieSlug) : null;
  const slug = cookieSlug || isoToSlug(ipIso);
  return res.status(200).json({
    slug: slug ?? null,
    iso2: cookieIso || ipIso || null,
    source: cookieSlug ? 'manual' : ipIso ? 'ip_geo' : 'none',
  });
}

async function adminUsers(req, res) {
  if (req.method === 'GET' && req.query.self === '1') {
    const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user?.email) return res.status(401).json({ error: 'Invalid session' });
    const { data: rows } = await supabase.from('admin_users').select('role').eq('email', data.user.email.toLowerCase()).eq('active', true).limit(1);
    return res.status(200).json({ email: data.user.email, role: rows?.[0]?.role ?? null });
  }

  const me = await requireRole(req, res, ['super_admin']);
  if (!me) return;
  if (req.method === 'GET') {
    const { data, error } = await supabase.from('admin_users').select('*').order('email', { ascending: true });
    if (error) throw error;
    return res.status(200).json(data ?? []);
  }
  if (req.method === 'POST') {
    const { email, role, password } = req.body ?? {};
    const clean = String(email ?? '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) return res.status(400).json({ error: 'Enter a valid email address' });
    if (!MANAGEABLE_ROLES.includes(role)) return res.status(400).json({ error: `Role must be one of: ${MANAGEABLE_ROLES.join(', ')}` });
    const pwd = String(password ?? '');
    if (pwd.length < 8) return res.status(400).json({ error: 'Set an initial password of at least 8 characters' });
    const { data: existing } = await supabase.from('admin_users').select('id').eq('email', clean).limit(1);
    if (existing?.length) return res.status(400).json({ error: 'That email already has admin access' });
    const { error: createErr } = await supabase.auth.admin.createUser({ email: clean, password: pwd, email_confirm: true });
    if (createErr) {
      if (/already|exists|registered|duplicate/i.test(String(createErr.message ?? ''))) {
        const uid = await findAuthUserId(clean);
        if (!uid) return res.status(500).json({ error: 'Auth account exists but could not be resolved' });
        const { error: upErr } = await supabase.auth.admin.updateUserById(uid, { password: pwd });
        if (upErr) return res.status(500).json({ error: upErr.message });
      } else return res.status(500).json({ error: `Could not create login: ${createErr.message}` });
    }
    const { data, error } = await supabase.from('admin_users').insert({ email: clean, role, active: true }).select().single();
    if (error) throw error;
    return res.status(201).json(data);
  }
  if (req.method === 'PUT') {
    const { id, role, active, password } = req.body ?? {};
    if (!id) return res.status(400).json({ error: 'id is required' });
    const fields = {};
    if (role !== undefined) { if (!MANAGEABLE_ROLES.includes(role)) return res.status(400).json({ error: 'Unknown role' }); fields.role = role; }
    if (active !== undefined) fields.active = !!active;
    const { data: target } = await supabase.from('admin_users').select('email,role').eq('id', Number(id)).single();
    if (!target) return res.status(404).json({ error: 'User not found' });
    if (target.email === me.email && (fields.active === false || (fields.role && fields.role !== 'super_admin'))) return res.status(400).json({ error: "You can't demote or suspend your own account" });
    let data = target;
    if (Object.keys(fields).length) {
      const upd = await supabase.from('admin_users').update(fields).eq('id', Number(id)).select().single();
      if (upd.error) throw upd.error;
      data = upd.data;
    }
    if (password !== undefined) {
      const pwd = String(password);
      if (pwd.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters', user: data });
      const uid = await findAuthUserId(target.email);
      if (uid) { const { error } = await supabase.auth.admin.updateUserById(uid, { password: pwd }); if (error) return res.status(500).json({ error: error.message }); }
    }
    return res.status(200).json(data);
  }
  if (req.method === 'DELETE') {
    const { id } = req.body ?? {};
    if (!id) return res.status(400).json({ error: 'id is required' });
    const { data: target } = await supabase.from('admin_users').select('email').eq('id', Number(id)).single();
    if (!target) return res.status(404).json({ error: 'User not found' });
    if (target.email === me.email) return res.status(400).json({ error: "You can't remove your own super admin access" });
    const { error } = await supabase.from('admin_users').delete().eq('id', Number(id));
    if (error) throw error;
    const uid = await findAuthUserId(target.email);
    if (uid) await supabase.auth.admin.deleteUser(uid);
    return res.status(200).json({ ok: true });
  }
  return res.status(405).json({ error: 'Method not allowed' });
}

async function logoUpload(req, res) {
  const allowed = await requireRole(req, res, MEDIA_WRITE);
  if (!allowed) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { brokerId, fileName, fileBase64, contentType } = req.body ?? {};
  if (!brokerId || !fileBase64 || !fileName) return res.status(400).json({ error: 'brokerId, fileName and fileBase64 are required' });
  const ext = String(fileName).split('.').pop()?.toLowerCase() || 'png';
  if (!['png', 'jpg', 'jpeg', 'svg', 'webp'].includes(ext)) return res.status(400).json({ error: 'Only PNG, JPG, SVG or WebP images are allowed' });
  if (String(fileBase64).length > 700_000) return res.status(400).json({ error: 'Logo too large — keep under ~500 KB' });
  const path = `broker-${Number(brokerId)}-${Date.now()}.${ext}`;
  const buffer = Buffer.from(String(fileBase64), 'base64');
  const { error: upErr } = await supabase.storage.from('broker-logos').upload(path, buffer, { contentType: contentType || `image/${ext === 'jpg' ? 'jpeg' : ext}`, upsert: true });
  if (upErr) throw upErr;
  const { data: urlData } = supabase.storage.from('broker-logos').getPublicUrl(path);
  const url = urlData.publicUrl;
  const { data: existing } = await supabase.from('broker_media').select('id').eq('broker_id', Number(brokerId)).limit(1);
  if (existing?.length) await supabase.from('broker_media').update({ logo_url: url, updated_at: new Date().toISOString() }).eq('id', existing[0].id);
  else await supabase.from('broker_media').insert({ broker_id: Number(brokerId), logo_url: url });
  return res.status(201).json({ url });
}

async function newsletter(req, res) {
  if (req.method === 'POST') {
    const { email } = req.body ?? {};
    const clean = String(email ?? '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) return res.status(400).json({ error: 'Please enter a valid email address' });
    const { data: existing } = await supabase.from('newsletter').select('id').eq('email', clean).limit(1);
    if (existing?.length) return res.status(200).json({ ok: true, duplicate: true });
    const { error } = await supabase.from('newsletter').insert({ email: clean.slice(0, 120) });
    if (error) throw error;
    return res.status(201).json({ ok: true });
  }
  if (!(await requireRole(req, res, SUBSCRIBER_ACCESS))) return;
  if (req.method === 'GET') {
    const { data, error } = await supabase.from('newsletter').select('*').order('created_at', { ascending: false }).limit(500);
    if (error) throw error;
    return res.status(200).json(data ?? []);
  }
  if (req.method === 'DELETE') {
    const { id } = req.body ?? {};
    if (!id) return res.status(400).json({ error: 'id is required' });
    const { error } = await supabase.from('newsletter').delete().eq('id', Number(id));
    if (error) throw error;
    return res.status(200).json({ ok: true });
  }
  return res.status(405).json({ error: 'Method not allowed' });
}

async function promotions(req, res) {
  if (req.method === 'GET') {
    if (req.query.all === '1') {
      if (!(await requireRole(req, res, PROMO_WRITE))) return;
      const { data, error } = await supabase.from('promotions').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return res.status(200).json(data ?? []);
    }
    const { data, error } = await supabase.from('promotions').select('*').eq('active', true).order('created_at', { ascending: false });
    if (error) throw error;
    return res.status(200).json(data ?? []);
  }
  if (!(await requireRole(req, res, PROMO_WRITE))) return;
  if (req.method === 'POST') {
    const body = req.body ?? {};
    if (!body.broker_id) return res.status(400).json({ error: 'Pick a broker' });
    if (!body.title || String(body.title).trim().length < 4) return res.status(400).json({ error: 'Promotion title is required' });
    const payload = { broker_id: Number(body.broker_id), title: String(body.title).trim().slice(0, 120), description: String(body.description ?? '').slice(0, 600), badge: String(body.badge ?? 'Promotion').slice(0, 40), terms: String(body.terms ?? '').slice(0, 600), ends_on: body.ends_on ? String(body.ends_on) : null, active: body.active !== false };
    const { data, error } = await supabase.from('promotions').insert(payload).select().single();
    if (error) throw error;
    return res.status(201).json(data);
  }
  if (req.method === 'PUT') {
    const { id, ...input } = req.body ?? {};
    if (!id) return res.status(400).json({ error: 'id is required' });
    const fields = {};
    for (const key of ['broker_id','title','description','badge','terms','ends_on','active']) if (key in input) fields[key] = input[key];
    if ('broker_id' in fields) fields.broker_id = Number(fields.broker_id);
    if ('title' in fields) fields.title = String(fields.title).trim().slice(0, 120);
    if ('description' in fields) fields.description = String(fields.description ?? '').slice(0, 600);
    if ('badge' in fields) fields.badge = String(fields.badge ?? '').slice(0, 40);
    if ('terms' in fields) fields.terms = String(fields.terms ?? '').slice(0, 600);
    if ('active' in fields) fields.active = !!fields.active;
    if ('ends_on' in fields && !fields.ends_on) fields.ends_on = null;
    const { data, error } = await supabase.from('promotions').update(fields).eq('id', Number(id)).select().single();
    if (error) throw error;
    return res.status(200).json(data);
  }
  if (req.method === 'DELETE') {
    const { id } = req.body ?? {};
    if (!id) return res.status(400).json({ error: 'id is required' });
    const { error } = await supabase.from('promotions').delete().eq('id', Number(id));
    if (error) throw error;
    return res.status(200).json({ ok: true });
  }
  return res.status(405).json({ error: 'Method not allowed' });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  const resource = String(req.query?.resource ?? '');
  if (req.method === 'OPTIONS') return res.status(204).end();
  try {
    if (resource === 'geo') return await geo(req, res);
    if (resource === 'admin-users') return await adminUsers(req, res);
    if (resource === 'logo-upload') return await logoUpload(req, res);
    if (resource === 'newsletter') return await newsletter(req, res);
    if (resource === 'promotions') return await promotions(req, res);
    return res.status(400).json({ error: 'Unknown resource' });
  } catch (err) {
    console.error(`site API (${resource}) error:`, err);
    return res.status(500).json({ error: err.message });
  }
}
