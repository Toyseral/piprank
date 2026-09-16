import { useEffect, useMemo, useState } from 'react';
import PageBuilder, { type BrokerEditorialSection, type PageBlock } from './PageBuilder';
import type { Broker } from '../lib/types';
import { fetchBrokers } from '../lib/api';
import { fmtMoney } from '../lib/format';

type Props = { value?: unknown[]; onChange: (blocks: PageBlock[]) => void; onUploadImage?: (file: File) => Promise<string> };

type Section = BrokerEditorialSection;
const SECTIONS: { key: Section; label: string; description: string; managedBy: string }[] = [
  { key: 'editorial', label: 'In-depth analysis', description: 'Main broker review and editorial analysis.', managedBy: 'Broker Editorial' },
  { key: 'pricing', label: 'Fees & Commissions', description: 'Editorial commentary after the pricing data card.', managedBy: 'Broker Editor → Pricing' },
  { key: 'platforms', label: 'Trading Platforms', description: 'Editorial commentary after the trading platforms card.', managedBy: 'Broker Editor → Platforms' },
  { key: 'trust', label: 'Trust & Regulation', description: 'Editorial commentary after the trust data.', managedBy: 'Broker Editor → Trust' },
  { key: 'accounts', label: 'Account Types', description: 'Editorial commentary after the account-type data.', managedBy: 'Broker Editor → Pricing' },
  { key: 'funding', label: 'Deposits & Withdrawals', description: 'Editorial commentary after funding data.', managedBy: 'Broker Editor → Pricing' },
];

const isStructured = (block: PageBlock) => block.type === 'structured_broker_data';
const isBrokerEditorialSection = (value: PageBlock['editorialSection']): value is BrokerEditorialSection => value === 'editorial' || value === 'pricing' || value === 'platforms' || value === 'trust' || value === 'accounts' || value === 'funding';
const sectionOf = (block: PageBlock): Section => isBrokerEditorialSection(block.editorialSection) ? block.editorialSection : 'editorial';

function brokerIdFrom(blocks: PageBlock[]) {
  const block = blocks.find(isStructured) as PageBlock | undefined;
  return block?.brokerId == null ? null : Number(block.brokerId);
}

function summaryRows(broker: Broker | null, section: Section): [string, string][] {
  if (!broker || section === 'editorial') return [];
  if (section === 'pricing') return [['Minimum deposit', fmtMoney(broker.min_deposit)], ['EUR/USD spread', `${broker.spread_eurusd} pips`], ['Commission', broker.commission || '—'], ['Maximum leverage', broker.max_leverage || '—']];
  if (section === 'platforms') return [['Platforms', broker.platforms?.join(' · ') || '—'], ['Copy trading', broker.copy_trading ? 'Available' : 'Not listed'], ['Islamic account', broker.islamic_account ? 'Available' : 'Not listed']];
  if (section === 'trust') return [['Regulation', broker.regulations?.map(r => r.body).filter(Boolean).join(' · ') || '—'], ['Trust score', String(broker.trust_score ?? '—')], ['Segregated funds', broker.segregated ? 'Yes' : 'No'], ['Negative balance protection', broker.nbp ? 'Yes' : 'No']];
  if (section === 'accounts') return [['Account types', broker.account_types?.join(' · ') || '—'], ['Demo account', broker.demo_account ? 'Available' : 'Not listed'], ['Islamic account', broker.islamic_account ? 'Available' : 'Not listed']];
  return [['Payment methods', broker.payments?.join(' · ') || '—'], ['Deposit time', broker.deposit_time || '—'], ['Withdrawal time', broker.withdrawal_hours != null ? `${broker.withdrawal_hours} hours` : '—'], ['Withdrawal fee', broker.withdrawal_fee != null ? String(broker.withdrawal_fee) : '—']];
}

export default function BrokerEditorialPageBuilder({ value, onChange, onUploadImage }: Props) {
  const allBlocks = Array.isArray(value) ? value as PageBlock[] : [];
  const [activeSection, setActiveSection] = useState<Section>('editorial');
  const brokerId = useMemo(() => brokerIdFrom(allBlocks), [allBlocks]);
  const [broker, setBroker] = useState<Broker | null>(null);
  const activeBlocks = allBlocks.filter(b => !isStructured(b) && sectionOf(b) === activeSection);
  const current = SECTIONS.find(s => s.key === activeSection) || SECTIONS[0];

  useEffect(() => {
    let alive = true;
    if (brokerId == null) { setBroker(null); return () => { alive = false; }; }
    fetchBrokers().then(list => { if (alive) setBroker(list.find(b => Number(b.id) === brokerId) || null); }).catch(() => { if (alive) setBroker(null); });
    return () => { alive = false; };
  }, [brokerId]);

  const replaceActiveSection = (next: PageBlock[]) => {
    const preserved = allBlocks.filter(b => isStructured(b) || sectionOf(b) !== activeSection);
    const scoped = next.map(b => ({ ...b, editorialSection: activeSection }));
    onChange([...preserved, ...scoped]);
  };

  const rows = summaryRows(broker, activeSection);
  return <div className="space-y-4">
    <div className="overflow-hidden rounded-2xl border border-emerald-200 bg-white shadow-sm">
      <div className="border-b border-emerald-100 bg-emerald-50/70 px-4 py-3.5 sm:px-5">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-emerald-700">Broker page editorial sections</p>
        <h3 className="mt-1 font-display text-lg font-bold text-ink-950 sm:text-xl">{broker?.name || 'Broker'} editorial content</h3>
        <p className="mt-1 text-xs leading-relaxed text-slate-500">Select the page section whose editorial content you want to edit. Structured broker data remains managed in Broker Editor.</p>
      </div>
      <div className="border-b border-line bg-white p-2 sm:p-3"><div className="flex gap-1 overflow-x-auto pb-1">
        {SECTIONS.map(section => { const count = allBlocks.filter(b => !isStructured(b) && sectionOf(b) === section.key).length; const selected = activeSection === section.key; return <button key={section.key} type="button" onClick={() => setActiveSection(section.key)} className={`shrink-0 rounded-xl px-3 py-2.5 text-left transition ${selected ? 'bg-ink-950 text-white shadow-soft' : 'text-slate-600 hover:bg-paper'}`}><span className="block text-xs font-bold">{section.label}</span><span className={`mt-0.5 block text-[10px] ${selected ? 'text-slate-300' : 'text-slate-400'}`}>{count} editorial block{count === 1 ? '' : 's'}</span></button>; })}
      </div></div>
      <div className="grid gap-3 p-3 sm:p-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 px-3.5 py-3"><p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-emerald-700">Currently editing</p><p className="mt-1 text-sm font-bold text-ink-900">{current.label}</p><p className="mt-0.5 text-xs leading-relaxed text-slate-500">{current.description}</p></div>
        <div className="rounded-xl border border-line bg-paper px-3.5 py-3">
          <div className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-slate-400">{activeSection === 'editorial' ? 'Public placement' : 'Canonical structured data'}</p><p className="mt-1 text-sm font-bold text-ink-900">{current.label}</p></div>{activeSection !== 'editorial' && <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700">Read only</span>}</div>
          {activeSection === 'editorial' ? <p className="mt-2 text-[11px] leading-relaxed text-slate-500">Main editorial analysis after the PipRank Verdict.</p> : <><div className="mt-3 overflow-hidden rounded-lg border border-line bg-white">{rows.map(([label, val]) => <div key={label} className="flex items-start justify-between gap-3 border-b border-line px-3 py-2 last:border-0"><span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</span><span className="max-w-[62%] text-right text-xs font-bold text-ink-900">{val}</span></div>)}</div><p className="mt-2 text-[10px] leading-relaxed text-slate-400">Facts are managed in {current.managedBy}. Use the builder below for editorial content only.</p></>}
        </div>
      </div>
    </div>
    <div className="rounded-2xl border border-line bg-white p-3 sm:p-4"><div className="mb-3 flex flex-wrap items-center justify-between gap-2"><div><p className="text-sm font-bold text-ink-900">{current.label} — editorial content</p><p className="text-xs text-slate-500">Add and reorder text, headings, broker cards, comparisons, CTAs, verdicts, images and other editorial blocks for this section.</p></div><span className="rounded-full border border-slate-200 bg-paper px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">{activeSection}</span></div><PageBuilder key={activeSection} value={activeBlocks} onChange={replaceActiveSection} onUploadImage={onUploadImage} context="broker-editorial" editorialSection={activeSection}/></div>
  </div>;
}
