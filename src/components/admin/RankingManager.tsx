import { useEffect, useMemo, useState } from 'react';
import type { Broker, CountryIntentBrokerRanking, CountryPage, Intent } from '../../lib/types';

export default function RankingManager({ countries, intents, brokers, token }: { countries: CountryPage[]; intents: Intent[]; brokers: Broker[]; token: string }) {
  const [country, setCountry] = useState('');
  const [intent, setIntent] = useState('');
  const [rows, setRows] = useState<CountryIntentBrokerRanking[]>([]);
  const [manualIds, setManualIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (!country && countries[0]) setCountry(countries[0].slug);
    if (!intent && intents[0]) setIntent(intents[0].slug);
  }, [countries, intents, country, intent]);

  const reload = async () => {
    if (!country || !intent) return;
    setLoading(true);
    try {
      const data = await fetch(`/api/country-intent-rankings?country=${encodeURIComponent(country)}&intent=${encodeURIComponent(intent)}`).then(r => r.json());
      const next = Array.isArray(data) ? data : [];
      setRows(next);
      setManualIds(next.filter((r: CountryIntentBrokerRanking) => r.manual_rank != null || r.force_include).sort((a: CountryIntentBrokerRanking, b: CountryIntentBrokerRanking) => (a.manual_rank ?? a.final_rank) - (b.manual_rank ?? b.final_rank)).map((r: CountryIntentBrokerRanking) => r.broker_id));
    } finally { setLoading(false); }
  };

  useEffect(() => { reload().catch(() => setRows([])); }, [country, intent]);

  const currentCountry = countries.find(c => c.slug === country);
  const countryBrokerIds = useMemo(() => {
    const recommendedSlugs = new Set((currentCountry?.recommended ?? []).map((r: any) => typeof r === 'string' ? r : r.slug));
    return brokers.filter(b => recommendedSlugs.has(b.slug)).map(b => b.id);
  }, [brokers, currentCountry]);

  const candidates = useMemo(() => {
    const ids = new Set([...countryBrokerIds, ...rows.map(r => r.broker_id)]);
    return brokers.filter(b => ids.has(b.id));
  }, [brokers, countryBrokerIds, rows]);

  const saveOverride = async (brokerId: number, patch: Record<string, unknown>) => {
    const c = countries.find(x => x.slug === country);
    const i = intents.find(x => x.slug === intent);
    const existing = rows.find(r => r.broker_id === brokerId);
    if (!c || !i) return;
    const res = await fetch('/api/country-intent-rankings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        country_id: c.id,
        intent_id: i.id,
        broker_id: brokerId,
        force_include: existing?.force_include ?? false,
        force_exclude: existing?.force_exclude ?? false,
        manual_rank: existing?.manual_rank ?? null,
        score_adjustment: existing?.score_adjustment || 0,
        featured_override: existing?.featured_override ?? null,
        editorial_note: existing?.editorial_note ?? null,
        ...patch,
      }),
    });
    if (!res.ok) throw new Error('Could not save broker override');
  };

  const addBroker = (id: number) => {
    if (!manualIds.includes(id)) setManualIds([...manualIds, id]);
  };
  const removeBroker = (id: number) => setManualIds(manualIds.filter(x => x !== id));
  const move = (index: number, direction: -1 | 1) => {
    const next = [...manualIds];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setManualIds(next);
  };

  const saveManualOrder = async () => {
    setSaving(true); setMsg('');
    try {
      // The existing ranking engine remains the source of eligibility/scoring.
      // manual_rank + force_include only overrides which eligible brokers appear and their order.
      for (let index = 0; index < manualIds.length; index++) {
        await saveOverride(manualIds[index], { manual_rank: index + 1, force_include: true, force_exclude: false });
      }
      // Clear manual ordering from brokers that were removed from the editorial list.
      for (const row of rows) {
        if ((row.manual_rank != null || row.force_include) && !manualIds.includes(row.broker_id)) {
          await saveOverride(row.broker_id, { manual_rank: null, force_include: false });
        }
      }
      await reload();
      setMsg('Manual broker order saved.');
    } catch (e) { setMsg(e instanceof Error ? e.message : 'Could not save manual order.'); }
    finally { setSaving(false); }
  };

  const switchToAutomatic = async () => {
    setSaving(true); setMsg('');
    try {
      for (const row of rows) {
        if (row.manual_rank != null || row.force_include) await saveOverride(row.broker_id, { manual_rank: null, force_include: false });
      }
      await reload();
      setManualIds([]);
      setMsg('Automatic ranking restored.');
    } catch (e) { setMsg(e instanceof Error ? e.message : 'Could not restore automatic ranking.'); }
    finally { setSaving(false); }
  };

  const save = async (r: CountryIntentBrokerRanking, patch: Record<string, unknown>) => {
    try { await saveOverride(r.broker_id, patch); setMsg('Saved'); await reload(); }
    catch { setMsg('Could not save'); }
  };

  return (
    <section className="rounded-2xl border border-line bg-white p-5">
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm font-semibold">Country<select className="mt-1 block rounded-lg border border-line p-2" value={country} onChange={e => setCountry(e.target.value)}>{countries.map(c => <option key={c.id} value={c.slug}>{c.flag} {c.name}</option>)}</select></label>
        <label className="text-sm font-semibold">Best-For<select className="mt-1 block rounded-lg border border-line p-2" value={intent} onChange={e => setIntent(e.target.value)}>{intents.map(i => <option key={i.id} value={i.slug}>{i.label}</option>)}</select></label>
        <span className="text-xs text-slate-500">{msg}</span>
      </div>

      <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-emerald-700">Broker display order</p>
            <h3 className="mt-1 font-display text-lg font-bold text-ink-900">Choose the brokers and order for this country + Best-For</h3>
            <p className="mt-1 max-w-2xl text-sm text-slate-600">Automatic ranking stays active by default. Manual mode lets you select eligible country brokers and put them in the exact order shown on the public page.</p>
          </div>
          <button type="button" onClick={switchToAutomatic} disabled={saving} className="rounded-lg border border-line bg-white px-3 py-2 text-xs font-bold text-slate-700 disabled:opacity-50">Use automatic ranking</button>
        </div>

        <div className="mt-4 space-y-2">
          {manualIds.length === 0 && <p className="rounded-lg border border-dashed border-emerald-300 bg-white p-3 text-sm text-slate-500">No manual brokers selected. The public page is using the automatic ranking.</p>}
          {manualIds.map((id, index) => {
            const b = candidates.find(x => x.id === id);
            if (!b) return null;
            return <div key={id} className="flex items-center gap-2 rounded-lg border border-line bg-white p-2.5">
              <span className="w-7 text-center text-sm font-bold text-slate-400">{index + 1}</span>
              <span className="flex-1 text-sm font-bold text-ink-900">{b.name}</span>
              <button type="button" onClick={() => move(index, -1)} disabled={index === 0} className="rounded border px-2 py-1 text-xs disabled:opacity-30">↑</button>
              <button type="button" onClick={() => move(index, 1)} disabled={index === manualIds.length - 1} className="rounded border px-2 py-1 text-xs disabled:opacity-30">↓</button>
              <button type="button" onClick={() => removeBroker(id)} className="rounded border border-rose-200 px-2 py-1 text-xs font-semibold text-rose-600">Remove</button>
            </div>;
          })}
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {candidates.filter(b => !manualIds.includes(b.id)).map(b => <button key={b.id} type="button" onClick={() => addBroker(b.id)} className="rounded-full border border-emerald-200 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:border-emerald-400">+ {b.name}</button>)}
        </div>
        <button type="button" onClick={saveManualOrder} disabled={saving || manualIds.length === 0} className="mt-4 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{saving ? 'Saving…' : 'Save manual order'}</button>
      </div>

      <p className="mt-4 text-sm text-slate-600">Automatic ranking remains the base scoring system. The controls below continue to provide individual editorial adjustments without changing broker source data.</p>
      <div className="mt-5 overflow-x-auto">
        <table className="w-full text-sm"><thead><tr className="border-b text-left text-slate-500"><th>Final</th><th>Broker</th><th>Score</th><th>Manual rank</th><th>Adjust</th><th>Exclude</th><th>Feature</th><th>Note</th></tr></thead>
          <tbody>{loading ? <tr><td colSpan={8} className="p-4">Loading…</td></tr> : rows.map(r => <tr key={r.broker_id} className="border-b"><td className="py-3 font-bold">#{r.final_rank}</td><td>{r.broker?.name || brokers.find(b => b.id === r.broker_id)?.name}</td><td>{Number(r.final_score).toFixed(1)}</td><td><input className="w-16 rounded border p-1" type="number" value={r.manual_rank ?? ''} onChange={e => save(r, { manual_rank: e.target.value === '' ? null : Number(e.target.value) })} /></td><td><input className="w-16 rounded border p-1" type="number" value={r.score_adjustment || 0} onChange={e => save(r, { score_adjustment: Number(e.target.value) })} /></td><td><input type="checkbox" checked={!!r.force_exclude} onChange={e => save(r, { force_exclude: e.target.checked, force_include: false })} /></td><td><input type="checkbox" checked={!!r.featured} onChange={e => save(r, { featured_override: e.target.checked })} /></td><td><input className="min-w-48 rounded border p-1" defaultValue={r.editorial_note || ''} onBlur={e => save(r, { editorial_note: e.target.value })} /></td></tr>)}</tbody>
        </table>
      </div>
    </section>
  );
}
