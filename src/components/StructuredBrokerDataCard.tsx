import type { ReactNode } from 'react';
import type { Broker } from '../lib/types';
import type { StructuredBrokerSection } from './PageBuilder';
import { fmtHours, fmtMoney } from '../lib/format';

type Props = {
  broker: Broker;
  section?: StructuredBrokerSection;
  editorial?: ReactNode;
  editorialHtml?: string;
};

function DataRow({ label, value, emphasis = false }: { label: string; value: string; emphasis?: boolean }) {
  return <div className="flex items-start justify-between gap-5 border-b border-line/70 py-3 last:border-b-0"><span className="text-sm text-slate-500">{label}</span><span className={`max-w-[65%] text-right ${emphasis ? 'font-display text-lg font-bold text-ink-950' : 'font-semibold text-ink-900'}`}>{value || '—'}</span></div>;
}
function DataGrid({ children }: { children: ReactNode }) { return <div className="overflow-hidden rounded-2xl border border-line bg-paper px-4 sm:px-5">{children}</div>; }
function Shell({ eyebrow, title, children, editorial }: { eyebrow: string; title: string; children: ReactNode; editorial?: ReactNode }) {
  return <section className="rounded-3xl border border-line bg-white p-5 shadow-soft sm:p-7"><div className="flex items-center justify-between gap-4 border-b border-line pb-4"><div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-700">{eyebrow}</p><h2 className="mt-1 font-display text-2xl font-bold text-ink-950">{title}</h2></div><span className="hidden rounded-full border border-line bg-paper px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 sm:inline-flex">Broker data</span></div><div className="pt-5">{children}{editorial ? <div className="mt-6 border-t border-line pt-5">{editorial}</div> : null}</div></section>;
}
function HtmlEditorial({ html }: { html?: string }) { if (!html?.trim()) return null; return <div className="prose prose-slate max-w-none text-[15px] leading-7" dangerouslySetInnerHTML={{ __html: html }} />; }

export default function StructuredBrokerDataCard({ broker, section = 'overview', editorial, editorialHtml }: Props) {
  if (section === 'pricing') return <Shell eyebrow="Fees & spreads" title="Trading costs" editorial={editorial ?? <HtmlEditorial html={editorialHtml} />}><DataGrid><DataRow label="Minimum deposit" value={fmtMoney(broker.min_deposit)} emphasis /><DataRow label="EUR/USD spread" value={`${broker.spread_eurusd} pips`} emphasis /><DataRow label="Commission" value={broker.commission || '—'} /><DataRow label="Commission per lot" value={broker.commission_value === 0 ? 'None' : `$${broker.commission_value}/lot`} /><DataRow label="Maximum leverage" value={broker.max_leverage || '—'} /><DataRow label="Inactivity fee" value={broker.inactivity_fee || '—'} /></DataGrid></Shell>;
  if (section === 'trust') return <Shell eyebrow="Regulation & trust" title="Regulation and protection" editorial={editorial ?? <HtmlEditorial html={editorialHtml} />}><DataGrid>{broker.regulations.map((r) => <DataRow key={`${r.body}-${r.country}`} label={r.body} value={`${r.country} · Tier ${r.tier}`} />)}<DataRow label="Trust score" value={`${broker.trust_score}/100`} emphasis /><DataRow label="Segregated funds" value={broker.segregated ? 'Yes' : 'No'} /><DataRow label="Negative balance protection" value={broker.nbp ? 'Yes' : 'No'} /></DataGrid>{broker.risk_warning ? <p className="mt-4 text-xs leading-5 text-slate-500">Risk warning: {broker.risk_warning}</p> : null}</Shell>;
  if (section === 'platforms') return <Shell eyebrow="Trading platforms" title="Available platforms" editorial={editorial ?? <HtmlEditorial html={editorialHtml} />}><DataGrid>{broker.platforms.map((platform) => <DataRow key={platform} label="Platform" value={platform} />)}</DataGrid></Shell>;
  if (section === 'features') return <Shell eyebrow="Deposit & withdraw" title="Funding methods" editorial={editorial ?? <HtmlEditorial html={editorialHtml} />}><DataGrid><DataRow label="Payment methods" value={(broker.payments || []).join(' · ')} /><DataRow label="Typical withdrawal time" value={`~${fmtHours(broker.withdrawal_hours)}`} /><DataRow label="Minimum deposit" value={fmtMoney(broker.min_deposit)} /></DataGrid></Shell>;
  if (section === 'editorial') return <Shell eyebrow="Broker assessment" title={`What we like about ${broker.name}`} editorial={editorial ?? <HtmlEditorial html={editorialHtml} />}><div className="grid gap-6 md:grid-cols-2"><div className="rounded-2xl bg-paper p-5"><h3 className="font-display text-lg font-bold text-ink-950">Pros</h3><ul className="mt-4 space-y-3">{broker.pros.length ? broker.pros.map((item) => <li key={item} className="flex gap-3 text-sm leading-6 text-slate-700"><span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-emerald-600" />{item}</li>) : <li className="text-sm text-slate-500">No pros published yet.</li>}</ul></div><div className="rounded-2xl bg-paper p-5"><h3 className="font-display text-lg font-bold text-ink-950">Cons</h3><ul className="mt-4 space-y-3">{broker.cons.length ? broker.cons.map((item) => <li key={item} className="flex gap-3 text-sm leading-6 text-slate-700"><span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-slate-400" />{item}</li>) : <li className="text-sm text-slate-500">No cons published yet.</li>}</ul></div></div></Shell>;
  return <Shell eyebrow="Overview" title={`${broker.name} at a glance`} editorial={editorial ?? <HtmlEditorial html={editorialHtml} />}><DataGrid><DataRow label="Rating" value={`${broker.rating.toFixed(1)} / 5`} emphasis /><DataRow label="Trust score" value={`${broker.trust_score}/100`} emphasis /><DataRow label="Minimum deposit" value={fmtMoney(broker.min_deposit)} /><DataRow label="EUR/USD spread" value={`${broker.spread_eurusd} pips`} /><DataRow label="Commission" value={broker.commission || '—'} /><DataRow label="Platforms" value={broker.platforms.join(' · ')} /><DataRow label="Founded" value={String(broker.founded || '—')} /><DataRow label="Headquarters" value={broker.headquarters || '—'} /></DataGrid></Shell>;
}

export function structuredBrokerSectionLabels() {
  return { overview: 'Overview', pricing: 'Fees & spreads', trust: 'Regulation & Trust', platforms: 'Trading Platforms', features: 'Deposit & Withdraw', editorial: 'What we like' } as const;
}
