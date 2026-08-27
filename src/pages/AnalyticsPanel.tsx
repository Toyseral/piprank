import { useEffect, useMemo, useState } from 'react';
import { BarChart3, Check, ClipboardList, Gauge, Landmark, MousePointerClick, Percent, Scale, Sparkles } from 'lucide-react';
import type { Broker } from '../lib/types';
import Monogram from '../components/Monogram';

interface EventRow {
  id: number;
  type: string;
  session: string | null;
  meta: Record<string, any>;
  created_at: string;
}

const RANGES = [
  { key: '1', label: 'Today' },
  { key: '7', label: '7 days' },
  { key: '30', label: '30 days' },
  { key: 'all', label: 'All time' },
] as const;

const FUNNEL_STEPS = ['Country', 'Experience', 'Style', 'Platform', 'Priority', 'Extras'];

const TYPE_META: Record<string, { label: string; chip: string }> = {
  cta_click: { label: 'CTA click', chip: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  affiliate_click: { label: 'Affiliate click', chip: 'bg-emerald-600 text-white' },
  broker_click: { label: 'Broker click', chip: 'bg-sky-50 text-sky-700 ring-sky-200' },
  broker_view: { label: 'Broker view', chip: 'bg-slate-100 text-slate-600 ring-line' },
  comparison_run: { label: 'Comparison', chip: 'bg-violet-50 text-violet-700 ring-violet-200' },
  quiz_start: { label: 'Quiz start', chip: 'bg-amber-50 text-amber-700 ring-amber-200' },
  quiz_step: { label: 'Quiz step', chip: 'bg-amber-50/70 text-amber-700 ring-amber-100' },
  quiz_answer: { label: 'Quiz answer', chip: 'bg-amber-50/50 text-amber-700 ring-amber-100' },
  quiz_complete: { label: 'Quiz complete', chip: 'bg-emerald-100 text-emerald-700 ring-emerald-300' },
  results_view: { label: 'Results viewed', chip: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  signup: { label: 'Newsletter signup', chip: 'bg-pink-50 text-pink-700 ring-pink-200' },
  intent_view: { label: 'Rankings page', chip: 'bg-indigo-50 text-indigo-700 ring-indigo-200' },
  country_view: { label: 'Country page', chip: 'bg-teal-50 text-teal-700 ring-teal-200' },
};

function timeAgo(iso: string): string {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function AnalyticsPanel({
  token,
  brokers,
}: {
  token: string;
  brokers: Broker[];
}) {
  const [range, setRange] = useState<'1' | '7' | '30' | 'all'>('30');
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    fetch(range === 'all' ? '/api/track?resource=events' : `/api/track?resource=events&days=${range}`, {
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    })
      .then((x) => (x.ok ? x.json() : Promise.reject(new Error('Unauthorized'))))
      .then((d) => setEvents(Array.isArray(d) ? d : []))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed'))
      .finally(() => setLoading(false));
  }, [range, token]);

  const byType = useMemo(() => {
    const m: Record<string, number> = {};
    for (const e of events) m[e.type] = (m[e.type] ?? 0) + 1;
    return m;
  }, [events]);

  // quiz funnel per session
  const funnel = useMemo(() => {
    const sessions = new Map<string, { maxStep: number; completed: boolean }>();
    for (const e of events) {
      if (!e.session) continue;
      if (e.type === 'quiz_start') sessions.set(e.session, { maxStep: 0, completed: false });
      const s = sessions.get(e.session);
      if (!s) continue;
      if (e.type === 'quiz_step') s.maxStep = Math.max(s.maxStep, Number(e.meta?.step) || 0);
      if (e.type === 'quiz_complete') s.completed = true;
    }
    const arr = [...sessions.values()];
    const reached = (i: number) => arr.filter((s) => s.maxStep >= i).length;
    const completedCount = arr.filter((s) => s.completed).length;
    return {
      total: arr.length,
      steps: FUNNEL_STEPS.map((label, i) => ({ label, n: reached(i) })),
      completed: completedCount,
      rate: arr.length ? Math.round((completedCount / arr.length) * 100) : 0,
    };
  }, [events]);

  // CTA performance by page (layout visibility)
  const pagePerf = useMemo(() => {
    const m: Record<string, { cta: number; affiliate: number }> = {};
    for (const e of events) {
      if (e.type !== 'cta_click' && e.type !== 'affiliate_click') continue;
      const p = String(e.meta?.page ?? '(unknown)');
      m[p] ??= { cta: 0, affiliate: 0 };
      if (e.type === 'cta_click') m[p].cta++;
      else m[p].affiliate++;
    }
    return Object.entries(m).sort((a, b) => b[1].affiliate - a[1].affiliate || b[1].cta - a[1].cta).slice(0, 8);
  }, [events]);

  // recommendation presentation: per-broker view → click → affiliate funnel
  const brokerPerf = useMemo(() => {
    const m = new Map<string, { views: number; clicks: number; affiliate: number }>();
    for (const e of events) {
      const slug = String(e.meta?.broker ?? e.meta?.slug ?? '');
      if (!slug) continue;
      if (!m.has(slug)) m.set(slug, { views: 0, clicks: 0, affiliate: 0 });
      const r = m.get(slug)!;
      if (e.type === 'broker_view') r.views++;
      if (e.type === 'broker_click') r.clicks++;
      if (e.type === 'affiliate_click') r.affiliate++;
    }
    return [...m.entries()].sort((a, b) => b[1].affiliate - a[1].affiliate).slice(0, 8);
  }, [events]);

  // daily chart
  const daySeries = useMemo(() => {
    const byDay: Record<string, number> = {};
    for (const e of events) {
      const d = e.created_at.slice(0, 10);
      byDay[d] = (byDay[d] ?? 0) + 1;
    }
    const len = range === '1' ? 1 : range === '7' ? 7 : 30;
    const out: { label: string; n: number }[] = [];
    const now = Date.now();
    for (let i = len - 1; i >= 0; i--) {
      const d = new Date(now - i * 86400000);
      const key = d.toISOString().slice(0, 10);
      out.push({ label: d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }), n: byDay[key] ?? 0 });
    }
    return out;
  }, [events, range]);
  const maxDay = Math.max(1, ...daySeries.map((d) => d.n));

  const brokerBySlug = useMemo(() => new Map(brokers.map((b) => [b.slug, b])), [brokers]);

  const kpis = [
    { icon: MousePointerClick, label: 'CTA clicks', value: byType.cta_click ?? 0, sub: 'Visit button opens' },
    { icon: Percent, label: 'Affiliate clicks', value: byType.affiliate_click ?? 0, sub: 'Confirmed outbound' },
    { icon: Landmark, label: 'Broker views', value: byType.broker_view ?? 0, sub: 'Review pages read' },
    { icon: Sparkles, label: 'Quiz starts', value: byType.quiz_start ?? 0, sub: `${funnel.total} tracked sessions` },
    { icon: Check, label: 'Quiz completion', value: `${funnel.rate}%`, sub: `${funnel.completed} finished` },
    { icon: Scale, label: 'Comparisons', value: byType.comparison_run ?? 0, sub: 'Unique matchups run' },
    { icon: ClipboardList, label: 'Signups', value: byType.signup ?? 0, sub: 'Newsletter conversions' },
  ];

  const maxPageClicks = Math.max(1, ...pagePerf.map(([, p]) => p.cta + p.affiliate));
  const maxBrokerRow = Math.max(1, ...brokerPerf.map(([, r]) => r.views));

  return (
    <div className="space-y-6">
      {/* header + range */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
            <BarChart3 size={17} />
          </div>
          <div>
            <p className="font-display text-base font-bold text-ink-900">Product analytics</p>
            <p className="text-xs text-slate-500">CTAs, layouts, quiz flow and recommendation presentation</p>
          </div>
        </div>
        <div className="flex gap-1 rounded-xl bg-white p-1 shadow-soft ring-1 ring-line">
          {RANGES.map((r) => (
            <button
              key={r.key}
              onClick={() => setRange(r.key)}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                range === r.key ? 'bg-ink-950 text-white shadow-sm' : 'text-slate-500 hover:text-ink-900'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>}
      {loading ? (
        <div className="h-96 animate-pulse rounded-2xl border border-line bg-white" />
      ) : (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-7">
            {kpis.map((k) => (
              <div key={k.label} className="rounded-2xl border border-line bg-white p-4 shadow-soft">
                <k.icon size={16} className="text-emerald-600" />
                <p className="tnum mt-2.5 font-display text-2xl font-bold text-ink-900">{k.value}</p>
                <p className="text-[11px] font-bold text-slate-600">{k.label}</p>
                <p className="text-[10px] text-slate-400">{k.sub}</p>
              </div>
            ))}
          </div>

          {/* daily activity */}
          <div className="rounded-2xl border border-line bg-white p-5 shadow-soft">
            <p className="font-display text-base font-bold text-ink-900">Events per day</p>
            <div className="mt-4 flex h-28 items-end gap-[3px]">
              {daySeries.map((d) => (
                <div
                  key={d.label}
                  className="group relative flex-1 rounded-t-md bg-gradient-to-t from-emerald-600/50 to-emerald-400 transition hover:from-emerald-500"
                  style={{ height: `${Math.max(d.n > 0 ? 6 : 2, (d.n / maxDay) * 100)}%` }}
                >
                  <div className="pointer-events-none absolute -top-9 left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-ink-950 px-2 py-1 text-[10px] font-bold text-white group-hover:block">
                    {d.label}: {d.n}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-1.5 flex justify-between text-[10px] font-semibold text-slate-400">
              <span>{daySeries[0]?.label}</span>
              <span>{daySeries[daySeries.length - 1]?.label}</span>
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            {/* quiz funnel / quiz length */}
            <div className="rounded-2xl border border-line bg-white p-5 shadow-soft">
              <p className="flex items-center gap-2 font-display text-base font-bold text-ink-900">
                <Gauge size={16} className="text-emerald-600" /> Quiz funnel — where users drop off
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {funnel.total} sessions · {funnel.rate}% complete · average drop-off shown per question
              </p>
              <div className="mt-4 space-y-2">
                {funnel.steps.map((s, i) => {
                  const prev = i === 0 ? funnel.total : funnel.steps[i - 1].n;
                  const drop = prev > 0 ? Math.round(((prev - s.n) / prev) * 100) : 0;
                  const pct = funnel.total ? (s.n / funnel.total) * 100 : 0;
                  return (
                    <div key={s.label} className="flex items-center gap-3">
                      <span className="w-24 shrink-0 text-xs font-semibold text-slate-600">{s.label}</span>
                      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-paper">
                        <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.max(s.n > 0 ? 4 : 0, pct)}%` }} />
                      </div>
                      <span className="tnum w-9 text-right text-xs font-bold text-ink-900">{s.n}</span>
                      <span className={`w-14 shrink-0 rounded-full px-1.5 py-0.5 text-center text-[10px] font-bold ${drop > 25 ? 'bg-rose-50 text-rose-600' : 'bg-paper text-slate-400'}`}>
                        {i === 0 ? 'start' : `-${drop}%`}
                      </span>
                    </div>
                  );
                })}
                <div className="flex items-center gap-3 border-t border-line pt-2.5">
                  <span className="w-24 shrink-0 text-xs font-bold text-ink-900">Completed</span>
                  <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-paper">
                    <div
                      className="h-full rounded-full bg-ink-950"
                      style={{ width: `${funnel.total ? (funnel.completed / funnel.total) * 100 : 0}%` }}
                    />
                  </div>
                  <span className="tnum w-9 text-right text-xs font-bold text-ink-900">{funnel.completed}</span>
                  <span className="w-14 shrink-0 rounded-full bg-emerald-50 px-1.5 py-0.5 text-center text-[10px] font-bold text-emerald-700">
                    {funnel.rate}%
                  </span>
                </div>
              </div>
              <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
                High drop-off on a step = that question's friction (wording, options or quiz length) is costing you completions.
              </p>
            </div>

            {/* CTA by page — layout effectiveness */}
            <div className="rounded-2xl border border-line bg-white p-5 shadow-soft">
              <p className="flex items-center gap-2 font-display text-base font-bold text-ink-900">
                <MousePointerClick size={16} className="text-emerald-600" /> CTA performance by page
              </p>
              <p className="mt-1 text-xs text-slate-500">Which layouts convert — CTA opens vs confirmed outbound clicks</p>
              <div className="mt-4 space-y-2.5">
                {pagePerf.length === 0 && (
                  <p className="rounded-xl border border-dashed border-line p-5 text-center text-xs text-slate-400">
                    No CTA events yet in this range.
                  </p>
                )}
                {pagePerf.map(([page, p]) => (
                  <div key={page}>
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span className="truncate font-mono text-xs font-semibold text-ink-900">{page}</span>
                      <span className="text-[11px] font-bold text-slate-500">
                        {p.cta} opens · <span className="text-emerald-700">{p.affiliate} sent</span>
                      </span>
                    </div>
                    <div className="flex h-2 overflow-hidden rounded-full bg-paper">
                      <div className="h-full bg-emerald-300" style={{ width: `${(p.cta / maxPageClicks) * 100}%` }} />
                      <div className="h-full bg-emerald-600" style={{ width: `${(p.affiliate / maxPageClicks) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex gap-3 text-[10px] font-semibold text-slate-400">
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-300" /> CTA opens</span>
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-600" /> Confirmed outbound</span>
              </div>
            </div>
          </div>

          {/* recommendation presentation */}
          <div className="rounded-2xl border border-line bg-white p-5 shadow-soft">
            <p className="flex items-center gap-2 font-display text-base font-bold text-ink-900">
              <Sparkles size={16} className="text-emerald-600" /> Recommendation → conversion
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Per broker: review views → card clicks → confirmed affiliate clicks. Low CTR = presentation problem.
            </p>
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="border-b border-line bg-paper/60">
                  <tr>
                    <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-slate-400">Broker</th>
                    <th className="px-4 py-2.5 text-right text-[10px] font-bold uppercase tracking-widest text-slate-400">Views</th>
                    <th className="px-4 py-2.5 text-right text-[10px] font-bold uppercase tracking-widest text-slate-400">Clicks</th>
                    <th className="px-4 py-2.5 text-right text-[10px] font-bold uppercase tracking-widest text-slate-400">Outbound</th>
                    <th className="px-4 py-2.5 text-right text-[10px] font-bold uppercase tracking-widest text-slate-400">CTR</th>
                  </tr>
                </thead>
                <tbody>
                  {brokerPerf.map(([slug, r]) => {
                    const b = brokerBySlug.get(slug);
                    const ctr = r.views > 0 ? ((r.affiliate / r.views) * 100).toFixed(1) : '0.0';
                    return (
                      <tr key={slug} className="border-b border-line last:border-0">
                        <td className="px-4 py-3">
                          <span className="flex items-center gap-2.5 text-sm font-semibold text-ink-900">
                            {b && <Monogram name={b.name} logoUrl={b.logo_url} color={b.brand_color} size={22} className="rounded-md" />}
                            {b?.name ?? slug}
                          </span>
                        </td>
                        <td className="tnum px-4 py-3 text-right text-xs font-semibold">{r.views}</td>
                        <td className="tnum px-4 py-3 text-right text-xs font-semibold">{r.clicks}</td>
                        <td className="tnum px-4 py-3 text-right text-xs font-bold text-emerald-700">{r.affiliate}</td>
                        <td className="px-4 py-3 text-right">
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${Number(ctr) >= 5 ? 'bg-emerald-50 text-emerald-700' : 'bg-paper text-slate-500'}`}>
                            {ctr}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  {brokerPerf.length === 0 && (
                    <tr><td colSpan={5} className="p-6 text-center text-xs text-slate-400">No broker events yet in this range.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
              Rule of thumb: under ~3% view→outbound CTR means the review page presentation needs work — stickier CTAs, better verdict placement.
            </p>
          </div>

          {/* recent stream */}
          <div className="rounded-2xl border border-line bg-white p-5 shadow-soft">
            <p className="font-display text-base font-bold text-ink-900">Live event stream</p>
            <div className="mt-3 max-h-80 overflow-y-auto">
              {events.length === 0 ? (
                <p className="rounded-xl border border-dashed border-line p-5 text-center text-xs text-slate-400">No events yet.</p>
              ) : (
                <table className="w-full text-xs">
                  <tbody>
                    {events.slice(0, 40).map((e) => {
                      const m = TYPE_META[e.type] ?? { label: e.type, chip: 'bg-paper text-slate-500 ring-line' };
                      const broker = e.meta?.broker ? String(e.meta.broker) : e.meta?.intent ?? e.meta?.country ?? '';
                      return (
                        <tr key={e.id} className="border-b border-line last:border-0">
                          <td className="py-2.5 pr-2">
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ${m.chip}`}>{m.label}</span>
                          </td>
                          <td className="py-2.5 pr-2 font-mono text-[11px] text-slate-600">
                            {broker || (e.meta?.page ?? '') || '—'}
                          </td>
                          <td className="py-2.5 text-right text-slate-400">{timeAgo(e.created_at)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
