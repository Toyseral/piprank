import { useEffect, useMemo, useState } from 'react';
import type { Broker, CountryIntentBrokerRanking, CountryPage, Intent } from '../../lib/types';

const SLOT_COUNT = 9;

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
        `/api/country-intent-rankings?country=${encodeURIComponent(country)}&intent=${encodeURIComponent(intent)}&admin=true`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const data = await response.json();
      const nextRows = Array.isArray(data) ? data : [];
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
      setMsg('Could not load broker rankings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [country, intent, token]);

  const availableBrokers = useMemo(
    () => rows.filter((row: any) => row.availability_status === 'available').map((row) => row.broker).filter(Boolean) as Broker[],
    [rows],
  );

  const brokerById = useMemo(
    () => new Map(availableBrokers.map((broker) => [Number(broker.id), broker])),
    [availableBrokers],
  );

  const setSlot = (slot: number, brokerId: number) => {
    setSelection((current) => current.map((value, index) => {
      if (index === slot) return brokerId;
      return value === brokerId ? 0 : value;
    }));
  };

  const save = async () => {
    const c = countries.find((x) => x.slug === country);
    const i = intents.find((x) => x.slug === intent);
    if (!c || !i) return;

    const rankedIds = selection.filter(Boolean);
    if (new Set(rankedIds).size !== rankedIds.length) {
      setMsg('A broker can only occupy one rank');
      return;
    }

    setSaving(true);
    setMsg('');
    try {
      const current = new Map(rows.map((row) => [Number(row.broker_id), row]));
      const desired = new Set(rankedIds);

      for (const row of rows) {
        const brokerId = Number(row.broker_id);
        if (row.manual_rank && !desired.has(brokerId)) {
          await fetch('/api/country-intent-rankings', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({
              country_id: c.id,
              intent_id: i.id,
              broker_id: brokerId,
              force_include: row.force_include,
              force_exclude: false,
              manual_rank: null,
              score_adjustment: row.score_adjustment || 0,
              featured_override: row.featured_override,
              editorial_note: row.editorial_note,
            }),
          });
        }
      }

      for (let index = 0; index < SLOT_COUNT; index += 1) {
        const brokerId = selection[index];
        if (!brokerId) continue;
        const row = current.get(brokerId);
        const response = await fetch('/api/country-intent-rankings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            country_id: c.id,
            intent_id: i.id,
            broker_id: brokerId,
            force_include: row?.force_include ?? false,
            force_exclude: false,
            manual_rank: index + 1,
            score_adjustment: row?.score_adjustment ?? 0,
            featured_override: row?.featured_override ?? null,
            editorial_note: row?.editorial_note ?? null,
          }),
        });
        if (!response.ok) throw new Error('save failed');
      }

      setMsg('Saved 9-broker country ranking');
      await load();
    } catch {
      setMsg('Could not save ranking');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-2xl border border-line bg-white p-5">
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm font-semibold">
          Country
          <select className="mt-1 block rounded-lg border border-line p-2" value={country} onChange={(e) => setCountry(e.target.value)}>
            {countries.map((c) => <option key={c.id} value={c.slug}>{c.flag} {c.name}</option>)}
          </select>
        </label>
        <label className="text-sm font-semibold">
          Intent
          <select className="mt-1 block rounded-lg border border-line p-2" value={intent} onChange={(e) => setIntent(e.target.value)}>
            {intents.map((i) => <option key={i.id} value={i.slug}>{i.label}</option>)}
          </select>
        </label>
        <span className="text-xs text-slate-500">{msg}</span>
      </div>

      <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50/60 p-4">
        <p className="text-sm font-bold text-ink-900">Manual country ranking</p>
        <p className="mt-1 text-xs leading-5 text-slate-600">
          Choose up to 9 brokers from the country's available broker pool. Rank 1–9 is explicit editorial order.
          Brokers without an availability override are treated as available; restricted or unavailable brokers cannot be selected.
        </p>
      </div>

      {loading ? (
        <p className="mt-5 p-4 text-sm text-slate-500">Loading available brokers…</p>
      ) : (
        <>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {selection.map((brokerId, index) => (
              <label key={index} className="rounded-xl border border-line bg-paper p-3 text-sm font-semibold">
                <span className="text-xs font-bold uppercase tracking-wide text-slate-400">Rank {index + 1}</span>
                <select
                  className="mt-2 block w-full rounded-lg border border-line bg-white p-2"
                  value={brokerId || ''}
                  onChange={(e) => setSlot(index, Number(e.target.value))}
                >
                  <option value="">— Select broker —</option>
                  {availableBrokers.map((broker) => {
                    const occupiedAt = selection.findIndex((id) => id === Number(broker.id));
                    return (
                      <option key={broker.id} value={broker.id} disabled={occupiedAt !== -1 && occupiedAt !== index}>
                        {broker.name}
                      </option>
                    );
                  })}
                </select>
              </label>
            ))}
          </div>

          <div className="mt-4 flex items-center justify-between gap-3">
            <p className="text-xs text-slate-500">{availableBrokers.length} available brokers · {selection.filter(Boolean).length}/9 ranked</p>
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="rounded-xl bg-ink-950 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save ranking'}
            </button>
          </div>

          <div className="mt-5 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-slate-500">
                  <th className="py-2">Broker</th>
                  <th>Availability</th>
                  <th>Base score</th>
                  <th>Manual rank</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row: any) => (
                  <tr key={row.broker_id} className="border-b last:border-0">
                    <td className="py-3 font-semibold">{row.broker?.name || brokers.find((b) => b.id === row.broker_id)?.name}</td>
                    <td className="text-xs capitalize text-slate-500">{row.availability_status}</td>
                    <td>{Number(row.final_score ?? 0).toFixed(1)}</td>
                    <td>{row.manual_rank ? `#${row.manual_rank}` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
