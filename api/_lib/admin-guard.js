import supabase from './db-client.js';

/**
 * Verifies a Supabase session token, then resolves the caller's role from the
 * admin_users table. Returns { email, role } when authorized at one of the
 * allowed roles; otherwise writes the appropriate error response and returns null.
 */
export async function requireRole(req, res, allowed = ['super_admin']) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    res.status(401).json({ error: 'Unauthorized — sign in at /archypage' });
    return null;
  }
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user?.email) {
    res.status(401).json({ error: 'Invalid or expired session' });
    return null;
  }
  const email = data.user.email.toLowerCase();
  const { data: rows, error: e2 } = await supabase
    .from('admin_users')
    .select('role')
    .eq('email', email)
    .eq('active', true)
    .limit(1);
  if (e2) {
    res.status(500).json({ error: 'Role lookup failed' });
    return null;
  }
  const role = rows?.[0]?.role ?? null;
  if (!role) {
    res.status(403).json({ error: 'This account has no admin access' });
    return null;
  }
  if (!allowed.includes(role)) {
    res.status(403).json({ error: `Requires ${allowed.join(' or ')} access` });
    return null;
  }
  return { email, role };
}

/** Back-compat wrapper: any active admin role. */
export default async function requireAdmin(req, res) {
  return requireRole(req, res, ['super_admin', 'admin', 'brokers_admin', 'content_admin', 'moderator']);
}
