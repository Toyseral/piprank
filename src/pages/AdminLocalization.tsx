import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { ContentDocument, CountryLanguage, CountryPage, LocalizedSeoPage } from '../lib/types';
import supabase from '../lib/supabase';
import LocalizationWorkspace from '../components/admin/LocalizationWorkspace';

type Mutate = (path: string, method: string, body: unknown, msg: string) => Promise<void>;

export default function AdminLocalization() {
  const [token, setToken] = useState('');
  const [countries, setCountries] = useState<CountryPage[]>([]);
  const [languages, setLanguages] = useState<CountryLanguage[]>([]);
  const [pages, setPages] = useState<LocalizedSeoPage[]>([]);
  const [contentDocs, setContentDocs] = useState<ContentDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const reload = useCallback(async (accessToken: string) => {
    const headers = { Authorization: `Bearer ${accessToken}` };
    const safe = async <T,>(url: string, fallback: T): Promise<T> => {
      try { const r = await fetch(url, { headers }); if (!r.ok) return fallback; return await r.json() as T; } catch { return fallback; }
    };
    const [co, la, pa, docs] = await Promise.all([
      safe('/api/countries', [] as CountryPage[]),
      safe('/api/country-languages?admin=true', [] as CountryLanguage[]),
      safe('/api/localized-seo-pages?admin=true', [] as LocalizedSeoPage[]),
      safe('/api/content-documents', [] as ContentDocument[]),
    ]);
    setCountries(Array.isArray(co) ? co : []);
    setLanguages(Array.isArray(la) ? la : []);
    setPages(Array.isArray(pa) ? pa : []);
    setContentDocs(Array.isArray(docs) ? docs : []);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      const accessToken = data.session?.access_token || '';
      if (!accessToken) { setError('Please sign in to the admin console first.'); setLoading(false); return; }
      setToken(accessToken);
      try { await reload(accessToken); } catch (e) { setError(e instanceof Error ? e.message : 'Could not load localization'); } finally { setLoading(false); }
    });
  }, [reload]);

  const mutate: Mutate = async (path, method, body, msg) => {
    const res = await fetch(path, { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `${msg} failed`);
    await reload(token);
  };

  return <div className="min-h-screen bg-paper"><header className="sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur"><div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-4 sm:px-8"><Link to="/archypage" className="rounded-xl border border-line p-2 text-slate-500 hover:bg-paper" title="Back to Admin"><ArrowLeft size={16}/></Link><div><p className="font-display text-lg font-bold text-ink-950">PipRank Admin</p><p className="text-xs text-slate-400">Localization</p></div></div></header><main className="mx-auto max-w-6xl px-4 py-7 sm:px-8">{error && <div className="mb-5 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>}{loading ? <div className="flex min-h-[50vh] items-center justify-center"><Loader2 size={28} className="animate-spin text-emerald-600"/></div> : <LocalizationWorkspace countries={countries} languages={languages} pages={pages} contentDocs={contentDocs} mutate={mutate} accessToken={token}/>}</main></div>;
}
