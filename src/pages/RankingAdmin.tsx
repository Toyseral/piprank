import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { ArrowLeft, Loader2, LogOut } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import supabase from '../lib/supabase';
import type { Broker, CountryPage, Intent } from '../lib/types';
import RankingWorkspace from './admin/RankingWorkspace';

export default function RankingAdmin() {
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<string>('checking');
  const [countries, setCountries] = useState<CountryPage[]>([]);
  const [intents, setIntents] = useState<Intent[]>([]);
  const [brokers, setBrokers] = useState<Broker[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) {
      setRole('none');
      setLoading(false);
      return;
    }
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const [roleResponse, countriesResponse, intentsResponse, brokersResponse] = await Promise.all([
          fetch('/api/admin-users?self=1', { headers: { Authorization: `Bearer ${session.access_token}` } }),
          fetch('/api/countries'),
          fetch('/api/intents'),
          fetch('/api/brokers'),
        ]);
        const roleData = roleResponse.ok ? await roleResponse.json() : {};
        const [countryData, intentData, brokerData] = await Promise.all([
          countriesResponse.ok ? countriesResponse.json() : [],
          intentsResponse.ok ? intentsResponse.json() : [],
          brokersResponse.ok ? brokersResponse.json() : [],
        ]);
        if (cancelled) return;
        setRole(roleData?.role ?? 'none');
        if (Array.isArray(countryData)) setCountries(countryData);
        if (Array.isArray(intentData)) setIntents(intentData);
        if (Array.isArray(brokerData)) setBrokers(brokerData);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [session?.user?.id, session?.access_token]);

  if (loading || role === 'checking') {
    return <div className="flex min-h-screen items-center justify-center bg-paper"><Loader2 className="animate-spin text-emerald-600" size={28} /></div>;
  }

  if (!session || role === 'none') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink-950 px-4">
        <div className="w-full max-w-md rounded-3xl bg-white p-8 text-center shadow-xl">
          <h1 className="font-display text-2xl font-bold text-ink-900">No admin access</h1>
          <p className="mt-2 text-sm text-slate-500">Sign in with an authorized PipRank admin account to manage rankings.</p>
          <Link to="/archypage" className="mt-6 inline-flex rounded-xl bg-ink-950 px-4 py-2.5 text-sm font-bold text-white">Open Admin</Link>
        </div>
      </div>
    );
  }

  const canManage = ['super_admin', 'admin', 'content_admin'].includes(role);
  if (!canManage) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper px-4">
        <div className="w-full max-w-md rounded-3xl border border-line bg-white p-8 text-center shadow-sm">
          <h1 className="font-display text-2xl font-bold text-ink-900">Ranking access restricted</h1>
          <p className="mt-2 text-sm text-slate-500">Your current role does not have permission to change country + intent ranking modes.</p>
          <Link to="/archypage" className="mt-6 inline-flex rounded-xl border border-line px-4 py-2.5 text-sm font-bold text-ink-900">Back to Admin</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper text-ink-900">
      <header className="sticky top-0 z-30 border-b border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-4 sm:px-6">
          <button type="button" onClick={() => navigate('/archypage')} className="rounded-xl p-2 text-slate-500 hover:bg-paper hover:text-ink-900" aria-label="Back to Admin"><ArrowLeft size={18} /></button>
          <div className="min-w-0 flex-1">
            <p className="font-display text-lg font-bold">PipRank <span className="text-emerald-600">Admin</span></p>
            <p className="text-xs text-slate-500">Manual Ranking</p>
          </div>
          <button type="button" onClick={() => supabase.auth.signOut()} className="rounded-xl p-2 text-slate-400 hover:bg-paper hover:text-rose-600" title="Sign out"><LogOut size={17} /></button>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        <RankingWorkspace countries={countries} intents={intents} brokers={brokers} token={session.access_token} />
      </main>
    </div>
  );
}
