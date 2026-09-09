import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import type { Session } from '@supabase/supabase-js';
import { Loader2, Lock } from 'lucide-react';
import supabase from '../lib/supabase';
import AdminNext from './Admin.next';

export default function Admin() {
  const [session, setSession] = useState<Session | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setChecking(false);
    }).catch(() => {
      if (!active) return;
      setSession(null);
      setChecking(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      if (!active) return;
      setSession(next);
      setChecking(false);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink-950">
        <Loader2 className="animate-spin text-emerald-400" size={30} />
      </div>
    );
  }

  if (!session) return <AdminLogin />;

  return <AdminNext />;
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

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (signInError) setError(signInError.message);
    setBusy(false);
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-ink-950 px-4">
      <div className="absolute inset-0 bg-grid-dark" />
      <div className="absolute -top-24 left-1/2 h-64 w-[560px] -translate-x-1/2 rounded-full bg-emerald-500/10 blur-[130px]" />

      <div className="relative w-full max-w-sm">
        <div className="rounded-3xl border border-line bg-white p-8 shadow-soft-lg">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-ink-950 text-emerald-400">
            <Lock size={22} />
          </div>

          <h1 className="mt-5 font-display text-2xl font-bold text-ink-900">PipRank Content Management</h1>
          <p className="mt-1 text-sm text-slate-500">Sign in to manage brokers, pages, guides and localization.</p>

          <form onSubmit={submit} className="mt-6 space-y-3">
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Your email"
              autoComplete="username"
              required
              className="h-11 w-full rounded-xl border border-line bg-paper px-4 text-sm outline-none focus:border-emerald-500"
            />
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Password"
              autoComplete="current-password"
              required
              className="h-11 w-full rounded-xl border border-line bg-paper px-4 text-sm outline-none focus:border-emerald-500"
            />

            {error && <p className="text-sm font-medium text-rose-600">{error}</p>}

            <button
              type="submit"
              disabled={busy}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-ink-950 text-sm font-bold text-white transition hover:bg-ink-800 disabled:opacity-60"
            >
              {busy && <Loader2 size={15} className="animate-spin" />}
              Sign in
            </button>
          </form>

          <Link
            to="/"
            className="mt-4 block text-center text-xs font-semibold text-slate-400 transition hover:text-emerald-700"
          >
            ← Back to the site
          </Link>
        </div>
      </div>
    </div>
  );
}
