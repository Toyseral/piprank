import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Check, Loader2, RotateCcw } from 'lucide-react';
import type { Broker, CountryIntentBrokerRanking, CountryPage, Intent } from '../../lib/types';
import supabase from '../../lib/supabase';

type RankingMode = 'automatic' | 'manual';
type Props = { countries: CountryPage[]; intents: Intent[]; brokers: Broker[]; token: string };

async function readJson<T>(response: Response, fallback: T): Promise<T> {
  try {
    if (!response.ok) return fallback;
    return (await response.json()) as T;
  } catch {
    return fallback;
  }
}

export default function RankingWorkspace({ countries, intents, brokers, token }: Props) {
  const [country, setCountry] = useState('');
  const [intent, setIntent] = useState('');
  const [mode, setMode] = useState<RankingMode>('automatic');
  const [rows, setRows] = useState<CountryIntentBrokerRanking[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingMode, setSavingMode] = useState(false);
  const [savingRank, setSavingRank] = useState<number | null>(null);
  const [message, setMessage] = useState('');
  const requestId = useRef(0);

  useEffect(() => {
    if (!country && countries[0]) setCountry(countries[0].slug);
    if (!intent && intents[0]) setIntent(intents[0].slug);
  }, [countries, intents, country, intent]);

  const selectedCountry = useMemo(() => countries.find((item) => item.slug === country) ?? null, [countries, country]);
  const selectedIntent = useMemo(() => intents.find((item) => item.slug === intent) ?? null, [intents, intent]);

  const load = useCallback(async () => {
    if (!selectedCountry || !selectedIntent) return;
    const currentRequest = ++requestId.current;
    setLoading(true);
    setMessage('');
    try {
      const [rankingResponse, modeResponse] = await Promise.all([
        fetch(`/api/country-intent-rankings?country=${encodeURIComponent(country)}&intent=${encodeURIComponent(intent)}`),
        supabase.rpc('get_country_intent_ranking_mode', { p_country_id: selectedCountry.id, p_intent_id: selectedIntent.id }),
      ]);
      if (currentRequest !== requestId.current) return;

      const rankingRows = await readJson<CountryIntentBrokerRanking[]>(rankingResponse, []);
      if (Array.isArray(rankingRows)) setRows(rankingRows);

      const returnedMode = modeResponse.data;
      if (!modeResponse.error && (returnedMode === 'automatic' || returnedMode === 'manual')) {
        setMode(returnedMode);
      } else if (modeResponse.error) {
        setMessage(modeResponse.error.message || 'Could not read ranking mode.');
      }
    } finally {
      if (currentRequest === requestId.current) setLoading(false);
    }
  }, [country, intent, selectedCountry, selectedIntent]);

  useEffect(() => { void load(); }, [load]);

  const brokerName = useMemo(() => {
    const map = new Map<number, string>();
    brokers.forEach((broker) => map.set(broker.id, broker.name));
    return map;
  }, [brokers]);

  const setRankingMode = async (nextMode: RankingMode) => {
    if (!selectedCountry || !selectedIntent || nextMode === mode || savingMode) return;
    setSavingMode(true);
    setMessage('Saving ranking mode…');

    const { error } = await supabase.rpc('set_country_intent_ranking_mode', {
      p_country_id: selectedCountry.id,
      p_intent_id: selectedIntent.id,
      p_ranking_mode: nextMode,
    });

    if (error) {
      setMessage(error.message || 'Could not change ranking mode.');
      setSavingMode(false);
      return;
    }

    // Do not call load() here. A concurrent/stale mode read can overwrite the
    // just-saved value and make the UI appear to revert to Automatic.
    setMode(nextMode);
    setMessage(nextMode === 'manual' ? 'Manual ranking enabled. The current automatic order was seeded.' : 'Automatic ranking restored.');
    setSavingMode(false);

    // Refresh broker rows only; the successful RPC is the source of truth for mode.
    const response = await fetch(`/api/country-intent-rankings?country=${encodeURIComponent(country)}&intent=${encodeURIComponent(intent)}`);
    const rankingRows = await readJson<CountryIntentBrokerRanking[]>(response, []);
    if (Array.isArray(rankingRows)) setRows(rankingRows);
  };

  const putManualRank = async (row: CountryIntentBrokerRanking, nextRank: number) => {
    if (!selectedCountry || !selectedIntent) return false;
    const safeRank = Math.max(1, Math.min(rows.length, Math.round(nextRank)));
    const response = await fetch('/api/country-intent-rankings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        country_id: selectedCountry.id,
        intent_id: selectedIntent.id,
        broker_id: row.broker_id,
        force_include: !!row.force_include,
        force_exclude: !!row.force_exclude,
        manual_rank: safeRank,
        score_adjustment: Number(row.score_adjustment || 0),
        featured_override: row.featured_override ?? null,
        editorial_note: row.editorial_note ?? null,
      }),
    });
    return response.ok;
  };

  const saveManualRank = async (row: CountryIntentBrokerRanking, nextRank: number) => {
    if (mode !== 'manual') return;
    setSavingRank(row.broker_id);
    setMessage('');
    const ok = await putManualRank(row, nextRank);
    if (!ok) setMessage('Could not save manual rank.');
    else setMessage('Manual order saved.');
    setSavingRank(null);
    if (ok) await load();
  };

  const move = async (index: number, direction: -1 | 1) => {
    if (mode !== 'manual' || savingRank !== null) return;
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= rows.length) return;
    const current = rows[index];
    const target = rows[nextIndex];
    const currentRank = current.manual_rank ?? current.final_rank;
    const targetRank = target.manual_rank ?? target.final_rank;
    setSavingRank(current.broker_id);
    setMessage('');
    const firstOk = await putManualRank(current, targetRank);
    const secondOk = firstOk ? await putManualRank(target, currentRank) : false;
    if (!firstOk || !secondOk) setMessage('Could not save the new broker order.');
    else setMessage('Manual order saved.');
    setSavingRank(null);
    await load();
  };

  return (
    <section className="space-y-5">
      <div className="rounded-3xl border border-line bg-white p-5 shadow-sm sm:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-700">Ranking control</p>
            <h2 className="mt-1 font-display text-2xl font-bold text-ink-900">Country × Intent ranking</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Choose a country and intent, then decide whether the public broker order is calculated automatically or controlled manually for that exact pair.</p>
          </div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
            {savingMode || loading ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} className="text-emerald-600" />}
            {message || 'Changes apply only to the selected country + intent.'}
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <label className="text-sm font-semibold text-ink-900">Country
            <select className="mt-2 block h-11 w-full rounded-xl border border-line bg-paper px-3 text-sm" value={country} onChange={(event) => setCountry(event.target.value)}>
              {countries.map((item) => <option key={item.id} value={item.slug}>{item.flag} {item.name}</option>)}
            </select>
          </label>
          <label className="text-sm font-semibold text-ink-900">Intent
            <select className="mt-2 block h-11 w-full rounded-xl border border-line bg-paper px-3 text-sm" value={intent} onChange={(event) => setIntent(event.target.value)}>
              {intents.map((item) => <option key={item.id} value={item.slug}>{item.label}</option>)}
            </select>
          </label>
        </div>

        <div className="mt-6 rounded-2xl border border-line bg-paper p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-bold text-ink-900">Ranking mode</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">Automatic uses the scoring engine. Manual uses the broker order below. Other country + intent pairs are unaffected.</p>
            </div>
            <div className="inline-flex rounded-xl border border-line bg-white p-1">
              <button type="button" onClick={() => void setRankingMode('automatic')} disabled={savingMode} className={`rounded-lg px-4 py-2 text-xs font-bold ${mode === 'automatic' ? 'bg-ink-950 text-white' : 'text-slate-500 hover:bg-paper'}`}>Automatic</button>
              <button type="button" onClick={() => void setRankingMode('manual')} disabled={savingMode} className={`rounded-lg px-4 py-2 text-xs font-bold ${mode === 'manual' ? 'bg-emerald-600 text-white' : 'text-slate-500 hover:bg-paper'}`}>Manual</button>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-line bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-line p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div>
            <h3 className="font-display text-lg font-bold text-ink-900">{selectedCountry?.name ?? 'Country'} · {selectedIntent?.label ?? 'Intent'}</h3>
            <p className="mt-1 text-xs text-slate-500">{mode === 'manual' ? 'Manual order is active for this pair.' : 'Automatic order is active. Manual ordering is disabled.'}</p>
          </div>
          {mode === 'manual' && <button type="button" onClick={() => void setRankingMode('automatic')} disabled={savingMode} className="inline-flex items-center justify-center gap-2 rounded-xl border border-line bg-white px-3.5 py-2 text-xs font-bold text-slate-600 hover:bg-paper disabled:opacity-50"><RotateCcw size={14} /> Restore automatic</button>}
        </div>

        {loading ? (
          <div className="flex min-h-48 items-center justify-center"><Loader2 className="animate-spin text-emerald-600" size={24} /></div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-sm text-slate-500">No broker rankings exist for this country and intent yet.</div>
        ) : (
          <div className="divide-y divide-line">
            {rows.map((row, index) => (
              <div key={row.broker_id} className="flex items-center gap-3 px-4 py-4 sm:px-6">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-paper text-sm font-black text-ink-900">{index + 1}</div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-ink-900">{row.broker?.name || brokerName.get(row.broker_id) || `Broker #${row.broker_id}`}</p>
                  <p className="mt-0.5 text-xs text-slate-400">Automatic score {Number(row.final_score).toFixed(1)} · {row.eligibility_status}</p>
                </div>
                {mode === 'manual' ? <>
                  <button type="button" aria-label="Move broker up" onClick={() => void move(index, -1)} disabled={index === 0 || savingRank !== null} className="rounded-lg border border-line p-2 text-slate-500 hover:bg-paper disabled:opacity-30"><ArrowUp size={15} /></button>
                  <button type="button" aria-label="Move broker down" onClick={() => void move(index, 1)} disabled={index === rows.length - 1 || savingRank !== null} className="rounded-lg border border-line p-2 text-slate-500 hover:bg-paper disabled:opacity-30"><ArrowDown size={15} /></button>
                  <input aria-label={`Manual rank for ${row.broker?.name || brokerName.get(row.broker_id) || row.broker_id}`} type="number" min={1} max={rows.length} value={row.manual_rank ?? index + 1} onChange={(event) => void saveManualRank(row, Number(event.target.value))} disabled={savingRank !== null} className="h-9 w-16 rounded-lg border border-line bg-white px-2 text-center text-sm font-bold" />
                </> : <span className="rounded-full bg-paper px-3 py-1 text-xs font-bold text-slate-500">#{row.final_rank}</span>}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
