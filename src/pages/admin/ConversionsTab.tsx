import { useEffect, useMemo, useState } from 'react';

interface DashboardData {
  total: number;
  windowDays: number;
  byBroker: Record<string, number>;
  byCountry: Record<string, number>;
  byPageType: Record<string, number>;
  bySourcePage: Record<string, number>;
  byBestFor: Record<string, number>;
  byComparisonPair: Record<string, number>;
  byReferrer: Record<string, number>;
  byUtmSource: Record<string, number>;
  byDevice: Record<string, number>;
  byDay: Record<string, number>;
}

function BreakdownList({ title, data }: { title: string; data: Record<string, number> }) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]).slice(0, 10);
  const max = Math.max(1, ...entries.map(([, n]) => n));

  return (
    <div className="rounded-2xl border border-line bg-white p-5 shadow-soft">
      <p className="font-display text-sm font-bold text-ink-900">{title}</p>

      {entries.length === 0 ? (
        <p className="mt-3 text-xs text-slate-400">No data in this window yet.</p>
      ) : (
        <div className="mt-3 space-y-2">
          {entries.map(([label, n]) => (
            <div key={label} className="flex items-center gap-2">
              <span
                className="w-28 shrink-0 truncate text-xs text-slate-600"
                title={label}
              >
                {label}
              </span>

              <div className="h-2 flex-1 overflow-hidden rounded-full bg-paper">
                <div
                  className="h-full rounded-full bg-emerald-500"
                  style={{ width: `${(n / max) * 100}%` }}
                />
              </div>

              <span className="tnum w-8 shrink-0 text-right text-xs font-bold text-ink-900">
                {n}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ConversionsTab({ token }: { token: string }) {
  const [days, setDays] = useState<7 | 30 | 90>(30);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  useEffect(() => {
    setLoading(true);

    fetch(`/api/affiliate-links?resource=dashboard&days=${days}`, { headers })
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [days, headers]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-white p-5 shadow-soft">
        <div>
          <p className="font-display text-base font-bold text-ink-900">Click-through funnel</p>

          <p className="mt-1 max-w-xl text-xs text-slate-500">
            Every hit on{' '}
            <code className="rounded bg-paper px-1 py-0.5">
              /go/&#123;broker&#125;
            </code>
            , before the visitor lands on the broker's site. This is{' '}
            <strong>not</strong> confirmed conversion data — there's no signup or FTD
            postback from any affiliate network wired up yet, so treat this as
            routing/interest volume, not revenue.
          </p>
        </div>

        <div className="flex gap-1 rounded-xl bg-paper p-1">
          {([7, 30, 90] as const).map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                days === d
                  ? 'bg-ink-950 text-white shadow-sm'
                  : 'text-slate-500 hover:text-ink-900'
              }`}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="h-96 animate-pulse rounded-2xl border border-line bg-white" />
      ) : !data ? (
        <p className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          Failed to load click data.
        </p>
      ) : (
        <>
          <div className="rounded-2xl border border-line bg-white p-5 shadow-soft">
            <p className="tnum font-display text-3xl font-bold text-ink-900">
              {data.total.toLocaleString()}
            </p>

            <p className="text-xs font-bold text-slate-500">
              Total /go/ redirects in the last {data.windowDays} days
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <BreakdownList title="By broker" data={data.byBroker} />
            <BreakdownList title="By country" data={data.byCountry} />
            <BreakdownList title="By page type" data={data.byPageType} />
            <BreakdownList title="By best-for category" data={data.byBestFor} />
            <BreakdownList title="By comparison pair" data={data.byComparisonPair} />
            <BreakdownList title="By source page" data={data.bySourcePage} />
            <BreakdownList title="By referrer" data={data.byReferrer} />
            <BreakdownList title="By UTM source" data={data.byUtmSource} />
            <BreakdownList title="By device" data={data.byDevice} />
          </div>
        </>
      )}
    </div>
  );
}
