import { useEffect, useState, type FormEvent } from 'react';
import type { Session } from '@supabase/supabase-js';
import supabase from '../lib/supabase';
import AdminCountryWorkspace from './AdminCountryWorkspace';

export default function AdminHub() {
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<string>('checking');

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) { setRole('none'); return; }
    setRole('checking');
    fetch('/api/admin-users?self=1', { headers: { Authorization: `Bearer ${session.access_token}` } })
      .then((r) => (r.ok ? r.json() : {}))
      .then((data: { role?: string }) => setRole(data.role ?? 'none'))
      .catch(() => setRole('none'));
  }, [session]);

  if (role === 'checking') return <div className="flex min-h-screen items-center justify-center bg-paper">Loading admin…</div>;
  if (!session) return <AdminLogin />;
  if (role === 'none') return <div className="mx-auto max-w-md px-6 py-24 text-center"><h1 className="font-display text-2xl font-bold">No admin access</h1><p className="mt-2 text-sm text-slate-500">This account is not on the PipRank admin team.</p></div>;
  return <AdminCountryWorkspace session={session} role={role} />;
}

function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) setError(authError.message);
    setBusy(false);
  };
  return <div className="flex min-h-screen items-center justify-center bg-ink-950 px-4"><form onSubmit={submit} className="w-full max-w-sm rounded-3xl bg-white p-8"><h1 className="font-display text-2xl font-bold">PipRank Admin</h1><p className="mt-1 text-sm text-slate-500">Sign in to the Country Hub.</p><input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="mt-5 h-11 w-full rounded-xl border border-line px-3 text-sm"/><input required type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" className="mt-3 h-11 w-full rounded-xl border border-line px-3 text-sm"/>{error && <p className="mt-2 text-sm text-rose-600">{error}</p>}<button disabled={busy} className="mt-4 w-full rounded-xl bg-ink-950 py-3 text-sm font-bold text-white">{busy ? 'Signing in…' : 'Sign in'}</button></form></div>;
}
