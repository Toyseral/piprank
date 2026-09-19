import { useEffect, useMemo, useState } from 'react';
import type { Broker, CountryIntentBrokerRanking, CountryPage, Intent } from '../../lib/types';

const SLOT_COUNT = 9;
type RankingMode = 'automatic' | 'manual';

export default function RankingManager({ countries, intents, brokers, token }: {
  countries: CountryPage[];
  intents: Intent[];
  brokers: Broker[];
  token: string;
}) {
  const [country, setCountry] = useState('');
  const [intent, setIntent] = useState('');
  const [rows, setRows] = useState<CountryIntentBrokerRanking[]>([]);
  const [selection, setSelection] = useState<number[]>(Array(SLOT_COUNT).fill(0));
  const [mode, setMode] = useState<RankingMode>('automatic');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (!country && countries[0]) setCountry(countries[0].slug);
    if (!intent && intents[0]) setIntent(intents[0].slug);
  }, [countries, intents, country, intent]);

  const load = async () => {
    if (!country || !intent) return;
    setLoading(true);
    setMsg('');
    try {
      const response = await fetch(
        `/api/content?resource=country-intent-rankings?country=${encodeURIComponent(country)}&intent=${encodeURIComponent(intent)}&admin=true`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!response.ok) throw new Error('load failed');
      const data = await response.json();
      const nextRows = Array.isArray(data) ? data : Array.isArray(data.rows) ? data.rows : [];
      setMode(data?.ranking_mode === 'manual' ? 'manual' : 'automatic');
      setRows(nextRows);
      const next = Array(SLOT_COUNT).fill(0);
      nextRows.forEach((row: CountryIntentBrokerRanking) => {
        const rank = Number(row.manual_rank);
        if (rank >= 1 && rank <= SLOT_COUNT) next[rank - 1] = Number(row.broker_id);
      });
      setSelection(next);
    } catch {
      setRows([]);
      setSelection(Array(SLOT_COUNT).fill(0));
      setMode('automatic');
      setMsg('Could not load broker rankings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [country, intent, token]);

  const availableBrokers = useMemo(
    () => rows.filter((row) => row.availability_status === 'available').map((row) => row.broker).filter(Boolean) as Broker[],
    [rows],
  );

  const setSlot = (slot: number, brokerId: number) => {
    setSelection((current) => current.map((value, index) => index === slot ? brokerId : value === brokerId ? 0 : value));
  };

  const removeBroker = (slot: number) => {
    setSelection((current) => current.map((value, index) => index === slot ? 0 : value));
  };

  const saveMode = async (nextMode: RankingMode) => {
    const response = await fetch(`/api/content?resource=country-intent-rankings?country=${encodeURIComponent(country)}&intent=${encodeURIComponent(intent)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ country, intent, ranking_mode: nextMode }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || 'Could not save ranking mode');
    }
    setMode(nextMode);
  };

  const handleModeChange = async (nextMode: RankingMode) => {
    if (nextMode === mode) return;
    setSaving(true);
    setMsg('');
    try {
      await saveMode(nextMode);
      setMsg(nextMode === 'automatic' ? 'Automatic ranking is now active' : 'Manual ranking is now active');
      await load();
    } catch (error) {
      setMsg(error instanceof Error ? error.message : 'Could not change ranking mode');
    } finally {
      setSaving(false);
    }
  };

  const saveManualRanking = async () => {
    if (selection.some((id) => !id)) {
      setMsg('Select exactly 9 brokers before saving a manual ranking');
      return;
    }
    const rankedIds = selection;
    if (new Set(rankedIds).size !== SLOT_COUNT) {
      setMsg('A broker can only occupy one rank');
      return;
    }
    setSaving(true);
    setMsg('');
    try {
      if (mode !== 'manual') await saveMode('manual');
      const current = new Map(rows.map((row) => [Number(row.broker_id), row]));
      const selectedSet = new Set(rankedIds);

      // Clear ranks for brokers that were previously in the manual list but
      // have now been removed/replaced. Without this, an old broker could stay
      // manually ranked in the database even after disappearing from the UI.
      for (const row of rows) {
        const brokerId = Number(row.broker_id);
        if (!row.manual_rank || selectedSet.has(brokerId)) continue;
        const response = await fetch(
          `/api/content?resource=country-intent-rankings?country=${encodeURIComponent(country)}&intent=${encodeURIComponent(intent)}`,
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({
              country,
              intent,
              broker_id: brokerId,
              force_include: row.force_include ?? false,
              force_exclude: false,
              manual_rank: null,
              score_adjustment: row.score_adjustment ?? 0,
              featured_override: row.featured_override ?? null,
              editorial_note: row.editorial_note ?? null,
            }),
          },
        );
        if (!response.ok) throw new Error('Could not remove broker from manual ranking');
      }

      for (let index = 0; index < SLOT_COUNT; index += 1) {
        const brokerId = rankedIds[index];
        const row = current.get(brokerId);
        const response = await fetch(`/api/content?resource=country-intent-rankings?country=${encodeURIComponent(country)}&intent=${encodeURIComponent(intent)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            country,
            intent,
            broker_id: brokerId,
            force_include: row?.force_include ?? false,
            force_exclude: false,
            manual_rank: index + 1,
            score_adjustment: row?.score_adjustment ?? 0,
            featured_override: row?.featured_override ?? null,
            editorial_note: row?.editorial_note ?? null,
          }),
        });
        if (!response.ok) throw new Error('Could not save broker rank');
      }
      setMode('manual');
      setMsg('Saved manual ranking: 9 brokers');
      await load();
    } catch (error) {
      setMsg(error instanceof Error ? error.message : 'Could not save ranking');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-2xl border border-line bg-white p-5">
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm font-semibold">Country
          <select className="mt-1 block rounded-lg border border-line p-2" value={country} onChange={(e) => setCountry(e.target.value)}>
            {countries.map((c) => <option key={c.id} value={c.slug}>{c.flag} {c.name}</option>)}
          </select>
        </label>
        <label className="text-sm font-semibold">Intent
          <select className="mt-1 block rounded-lg border border-line p-2" value={intent} onChange={(e) => setIntent(e.target.value)}>
            {intents.map((i) => <option key={i.id} value={i.slug}>{i.label}</option>)}
          </select>
        </label>
        <span className="text-xs text-slate-500">{msg}</span>
      </div>

      <div className="mt-5 rounded-2xl border border-line bg-paper p-4">
        <p className="text-sm font-bold text-ink-900">Ranking mode</p>
        <p className="mt-1 text-xs leading-5 text-slate-500">
          Choose how this country + intent page determines its broker order. Automatic uses the calculated ranking;
          Manual uses the 9 brokers you explicitly select below.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {(['automatic', 'manual'] as RankingMode[]).map((option) => (
            <button key={option} type="button" disabled={saving} onClick={() => handleModeChange(option)}
              className={`rounded-xl border p-4 text-left transition ${mode === option ? 'border-emerald-500 bg-emerald-50' : 'border-line bg-white hover:border-emerald-300'}`}>
              <span className="block text-sm font-bold">{option === 'automatic' ? 'Automatic ranking' : 'Manual ranking'}</span>
              <span className="mt-1 block text-xs leading-5 text-slate-500">
                {option === 'automatic' ? 'PipRank calculates the top 9 from eligible brokers.' : 'Admin selects and orders exactly 9 eligible brokers.'}
              </span>
            </button>
          ))}
        </div>
      </div>

      {loading ? <p className="mt-5 p-4 text-sm text-slate-500">Loading available brokers…</p> : (
        <>
          {mode === 'manual' && (
            <div className="mt-5">
              <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-4">
                <p className="text-sm font-bold text-ink-900">Manual broker order</p>
                <p className="mt-1 text-xs leading-5 text-slate-600">
                  Select exactly 9 brokers from the country’s available pool. Missing availability rows mean available;
                  restricted, unavailable and unknown brokers cannot be selected.
                </p>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                {selection.map((brokerId, index) => (
                  <div key={index} className="rounded-xl border border-line bg-paper p-3 text-sm font-semibold">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold uppercase tracking-wide text-slate-400">Rank {index + 1}</span>
                      {brokerId ? (
                        <button type="button" onClick={() => removeBroker(index)} disabled={saving}
                          className="text-xs font-semibold text-red-600 hover:underline disabled:opacity-50">
                          Remove
                        </button>
                      ) : null}
                    </div>
                    <select className="mt-2 block w-full rounded-lg border border-line bg-white p-2" value={brokerId || ''} onChange={(e) => setSlot(index, Number(e.target.value))}>
                      <option value="">— Select broker —</option>
                      {availableBrokers.map((broker) => {
                        const occupiedAt = selection.findIndex((id) => id === Number(broker.id));
                        return <option key={broker.id} value={broker.id} disabled={occupiedAt !== -1 && occupiedAt !== index}>{broker.name}</option>;
                      })}
                    </select>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex items-center justify-between gap-3">
                <p className="text-xs text-slate-500">{availableBrokers.length} available brokers · {selection.filter(Boolean).length}/9 ranked · any available broker can be added</p>
                <button type="button" onClick={saveManualRanking} disabled={saving || selection.some((id) => !id)}
                  className="rounded-xl bg-ink-950 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">
                  {saving ? 'Saving…' : 'Save 9-broker ranking'}
                </button>
              </div>
            </div>
          )}

          <div className="mt-5 overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b text-left text-slate-500"><th className="py-2">Broker</th><th>Availability</th><th>Base score</th><th>Manual rank</th></tr></thead>
              <tbody>{rows.map((row) => (
                <tr key={row.broker_id} className="border-b last:border-0">
                  <td className="py-3 font-semibold">{row.broker?.name || brokers.find((b) => b.id === row.broker_id)?.name}</td>
                  <td className="text-xs capitalize text-slate-500">{row.availability_status}</td>
                  <td>{Number(row.final_score ?? 0).toFixed(1)}</td>
                  <td>{row.manual_rank ? `#${row.manual_rank}` : '—'}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
