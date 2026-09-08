import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Copy, Database, Eye, GripVertical, Image as ImageIcon, Link2, Plus, Quote, Save, Table2, Trash2, Type } from 'lucide-react';
import RichTextEditor from './RichTextEditor';
import BrokerCard from './BrokerCard';
import type { Broker } from '../lib/types';
import { fetchBrokers } from '../lib/api';
import { fmtMoney } from '../lib/format';
import { INTENT_LABELS, pipRankScore, scoreColors } from '../lib/score';

export type StructuredBrokerSection = 'overview' | 'pricing' | 'trust' | 'platforms' | 'features' | 'editorial';
export type BrokerCardVariant = 'default' | 'compact' | 'featured';
export type BrokerCtaVariant = 'primary' | 'dark' | 'soft';
export type ComparisonField = 'rating' | 'trust_score' | 'min_deposit' | 'spread_eurusd' | 'commission' | 'max_leverage' | 'platforms' | 'payments' | 'regulations';

export type PageBlock = {
  id: string;
  type: 'richtext' | 'heading' | 'image' | 'table' | 'callout' | 'divider' | 'links' | 'structured_broker_data' | 'broker_card' | 'broker_grid' | 'comparison_table' | 'broker_cta' | 'piprank_verdict';
  title?: string;
  html?: string;
  src?: string;
  alt?: string;
  rows?: string[][];
  tone?: 'neutral' | 'success' | 'warning' | 'dark';
  links?: { label: string; href: string }[];
  brokerId?: number;
  brokerIds?: number[];
  section?: StructuredBrokerSection;
  variant?: BrokerCardVariant | BrokerCtaVariant;
  fields?: ComparisonField[];
  ctaLabel?: string;
  ctaHref?: string;
  headline?: string;
  buttonLabel?: string;
  showCta?: boolean;
};

type Props = { value?: unknown[]; onChange: (blocks: PageBlock[]) => void; onUploadImage?: (file: File) => Promise<string> };

const uid = () => `b_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const esc = (v: unknown) => String(v ?? '').replace(/[&<>\"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;', "'": '&#039;' }[c] as string));

const legacyHtmlToBlocks = (html: string): PageBlock[] => {
  if (!html?.trim() || typeof DOMParser === 'undefined') return [];
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return Array.from(doc.body.childNodes).filter(n => n.nodeType === 1 || !!n.textContent?.trim()).map((node: any): PageBlock => {
    const tag = String(node.tagName || '').toLowerCase();
    if (/^h[1-6]$/.test(tag)) return { id: uid(), type: 'heading', title: node.textContent?.trim() || 'Section heading' };
    return { id: uid(), type: 'richtext', html: node.outerHTML || node.textContent || '' };
  });
};

const norm = (value?: unknown[]): PageBlock[] => {
  if (!Array.isArray(value)) return [];
  if (value.length === 1 && (value[0] as any)?.type === 'richtext' && typeof (value[0] as any)?.html === 'string') {
    const legacy = legacyHtmlToBlocks((value[0] as any).html);
    if (legacy.length > 1) return legacy;
  }
  return value.map((b: any) => ({ id: b.id || uid(), type: b.type || 'richtext', ...b }));
};

const sectionLabel = (s: StructuredBrokerSection) => ({ overview: 'Overview', pricing: 'Pricing & trading costs', trust: 'Trust & regulation', platforms: 'Trading platforms', features: 'Features & payments', editorial: 'Editorial highlights' }[s]);
const fieldLabel = (f: ComparisonField) => ({ rating: 'Rating', trust_score: 'Trust score', min_deposit: 'Min. deposit', spread_eurusd: 'EUR/USD spread', commission: 'Commission', max_leverage: 'Max leverage', platforms: 'Platforms', payments: 'Payment methods', regulations: 'Regulation' }[f]);

const brokerField = (b: Broker, f: ComparisonField): string => {
  if (f === 'rating') return `${b.rating ?? ''}/5`;
  if (f === 'trust_score') return String(b.trust_score ?? '');
  if (f === 'min_deposit') return fmtMoney(b.min_deposit);
  if (f === 'spread_eurusd') return `${b.spread_eurusd ?? ''} pips`;
  if (f === 'commission') return String(b.commission ?? '');
  if (f === 'max_leverage') return String(b.max_leverage ?? '');
  if (f === 'platforms') return (b.platforms || []).join(', ') || 'Not listed';
  if (f === 'payments') return (b.payments || []).join(', ') || 'Not listed';
  return (b.regulations || []).map(r => r.body || r.country).filter(Boolean).join(', ') || 'Not listed';
};

function visitHref(b: Broker) {
  return `/go/${encodeURIComponent(b.slug)}?src=${encodeURIComponent(typeof window !== 'undefined' ? window.location.pathname : '')}&page_type=other`;
}

function structuredBrokerHtml(block: PageBlock, brokers: Broker[]) {
  const b = brokers.find(x => x.id === Number(block.brokerId));
  if (!b) return '';
  const s = block.section || 'overview';
  const rows: [string, string][] = s === 'overview'
    ? [['Broker', b.name], ['Rating', `${b.rating}/5`], ['Trust score', String(b.trust_score)], ['Founded', String(b.founded || '')], ['Headquarters', b.headquarters || '']]
    : s === 'pricing'
      ? [['Minimum deposit', fmtMoney(b.min_deposit)], ['EUR/USD spread', `${b.spread_eurusd} pips`], ['Commission', b.commission || ''], ['Maximum leverage', b.max_leverage || '']]
      : s === 'trust'
        ? [['Trust score', String(b.trust_score)], ['Regulation', (b.regulations || []).map(r => r.body || r.country).filter(Boolean).join(', ') || 'Not listed'], ['Segregated funds', b.segregated ? 'Yes' : 'No'], ['Negative balance protection', b.nbp ? 'Yes' : 'No'], ['Risk warning', b.risk_warning || '']]
        : s === 'platforms'
          ? [['Platforms', (b.platforms || []).join(', ') || 'Not listed']]
          : s === 'features'
            ? [['Demo account', b.demo_account ? 'Yes' : 'No'], ['Islamic account', b.islamic_account ? 'Yes' : 'No'], ['Copy trading', b.copy_trading ? 'Yes' : 'No'], ['Scalping', b.scalping ? 'Yes' : 'No'], ['Hedging', b.hedging ? 'Yes' : 'No'], ['Payment methods', (b.payments || []).join(', ') || 'Not listed']]
            : [['Best for', (b.best_for || []).map(x => INTENT_LABELS[x] ?? x).join(', ')], ['Pros', (b.pros || []).join(' • ')], ['Cons', (b.cons || []).join(' • ')]];
  return `<section class="piprank-structured-broker-data rounded-2xl border border-line bg-white p-5 shadow-sm" data-broker-id="${Number(b.id)}" data-section="${esc(s)}"><h3 class="font-display text-xl font-bold text-ink-950">${esc(b.name)} — ${esc(sectionLabel(s))}</h3><div class="mt-4 overflow-x-auto"><table class="w-full border-collapse"><tbody>${rows.filter(([, v]) => v !== '').map(([k, v]) => `<tr><th class="w-1/3 border-b border-line bg-paper px-4 py-3 text-left text-xs font-bold text-ink-900">${esc(k)}</th><td class="border-b border-line px-4 py-3 text-sm font-medium text-slate-700">${esc(v)}</td></tr>`).join('')}</tbody></table></div></section>`;
}

function shortList(values: string[], max = 3) {
  if (!values?.length) return '—';
  const shown = values.slice(0, max);
  return values.length > max ? `${shown.join(' · ')} +${values.length - max}` : shown.join(' · ');
}
function regulationLabel(broker: Broker) { return broker.regulations?.length ? shortList(broker.regulations.map(r => r.body).filter(Boolean)) : 'Not listed'; }

function brokerCardHtml(b: Broker, variant: BrokerCardVariant = 'default') {
  const href = visitHref(b);
  const score = pipRankScore(b);
  const tone = scoreColors(b.trust_score);
  const featured = variant === 'featured';
  const initials = b.name.split(/\s+/).map(x => x[0]).join('').slice(0, 2).toUpperCase();
  const logo = b.logo_url ? `<img src="${esc(b.logo_url)}" alt="${esc(b.name)} logo" class="h-11 w-11 rounded-xl object-contain" loading="lazy" />` : `<span class="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-sm font-bold text-ink-900">${esc(initials)}</span>`;
  const metrics = [
    ['Min deposit', fmtMoney(b.min_deposit)], ['EUR/USD spread', `${b.spread_eurusd} pips`], ['Regulation', regulationLabel(b)], ['Max leverage', b.max_leverage]
  ].map(([l, v]) => `<div class="min-w-0 rounded-xl bg-paper px-3 py-2"><p class="text-[10px] font-semibold uppercase tracking-wide text-slate-400">${esc(l)}</p><p class="mt-0.5 truncate text-[12px] font-bold leading-tight text-ink-900 sm:text-sm">${esc(v)}</p></div>`).join('');
  return `<article class="group relative flex h-full flex-col rounded-2xl border bg-white p-4 shadow-soft transition duration-300 hover:-translate-y-1 hover:shadow-soft-lg sm:p-5 ${featured ? 'border-emerald-300 ring-2 ring-emerald-500/25' : 'border-line'}" data-broker-id="${Number(b.id)}"><div class="flex items-start gap-3">${logo}<div class="min-w-0 flex-1"><h3 class="truncate font-display text-base font-bold text-ink-900">${esc(b.name)}</h3><p class="truncate text-xs text-slate-500">${esc(b.tagline || '')}</p><div class="mt-1.5 flex items-center gap-1.5"><span class="text-amber-500" aria-label="Rating ${esc(b.rating)} out of 5">★★★★★</span><span class="tnum text-xs font-bold text-ink-900">${Number(b.rating || 0).toFixed(1)}</span></div></div></div><div class="mt-3 flex items-center justify-between rounded-xl border border-emerald-100 bg-emerald-50/40 px-3 py-2.5"><div><p class="text-[10px] font-bold uppercase tracking-wider text-emerald-700">PipRank Score</p><p class="mt-0.5 text-xs font-medium text-slate-700">Overall decision fit</p></div><p class="tnum font-display text-xl font-bold text-emerald-700">${score}<span class="text-xs font-semibold text-slate-500">/100</span></p></div><div class="mt-4 grid gap-2 min-[380px]:grid-cols-2">${metrics}</div><div class="mt-3 flex flex-wrap gap-1.5"><span class="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-bold ${tone.bg} ${tone.border} ${tone.text}">✓ Trust ${esc(b.trust_score)}</span>${(b.best_for || []).slice(0, 2).map(slug => `<span class="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700">${esc(INTENT_LABELS[slug] ?? slug)}</span>`).join('')}</div><div class="mt-auto pt-4"><a href="${esc(href)}" target="_blank" rel="nofollow sponsored noopener noreferrer" class="inline-flex w-full items-center justify-center rounded-xl bg-ink-950 px-4 py-3 text-sm font-bold text-white">Open Account</a><a href="/brokers/${esc(b.slug)}" class="mt-3 inline-flex w-full items-center justify-center gap-1 text-xs font-bold text-slate-600 hover:text-emerald-700">Read full review →</a></div></article>`;
}

function comparisonHtml(block: PageBlock, brokers: Broker[]) {
  const selected = (block.brokerIds || []).map(id => brokers.find(b => b.id === Number(id))).filter(Boolean) as Broker[];
  if (selected.length < 2) return '';
  const fields = block.fields?.length ? block.fields : ['rating', 'trust_score', 'min_deposit', 'spread_eurusd'] as ComparisonField[];
  const rows = fields.map(f => `<tr><th>${esc(fieldLabel(f))}</th>${selected.map(b => `<td>${esc(brokerField(b, f))}</td>`).join('')}</tr>`).join('');
  const showCta = block.showCta === true || Boolean(block.ctaLabel);
  const ctaRow = showCta ? `<tr class="piprank-comparison-cta-row"><th>Action</th>${selected.map(b => `<td><a href="${esc(visitHref(b))}" target="_blank" rel="nofollow sponsored noopener noreferrer" class="inline-flex w-full items-center justify-center rounded-xl bg-ink-950 px-3 py-2.5 text-xs font-bold text-white">${esc(block.ctaLabel || 'Open Account')}</a></td>`).join('')}</tr>` : '';
  return `<section class="piprank-comparison-table rounded-2xl border border-line bg-white shadow-soft overflow-hidden"><div class="border-b border-line bg-ink-950 px-5 py-4"><h3 class="font-display text-xl font-bold text-white">${esc(block.title || 'Broker comparison')}</h3></div><div class="overflow-x-auto"><table class="w-full min-w-[680px] border-collapse"><thead><tr><th>Broker</th>${selected.map(b => `<th>${esc(b.name)}</th>`).join('')}</tr></thead><tbody>${rows}${ctaRow}</tbody></table></div></section>`;
}

function ctaHtml(block: PageBlock, brokers: Broker[]) {
  const b = brokers.find(x => x.id === Number(block.brokerId));
  if (!b) return '';
  const href = visitHref(b);
  const headline = block.headline ?? block.title ?? `Trade with ${b.name}`;
  const label = block.buttonLabel ?? block.ctaLabel ?? 'Open Account';
  return `<aside class="piprank-broker-cta rounded-2xl border border-emerald-200 bg-emerald-50 p-5 sm:p-6"><div class="flex flex-wrap items-center justify-between gap-4"><div><strong class="block font-display text-lg font-bold text-ink-950">${esc(headline)}</strong><span class="mt-1 block text-sm text-slate-700">Review ${esc(b.name)}'s current pricing, regulation and trading conditions.</span></div><a href="${esc(href)}" target="_blank" rel="nofollow sponsored noopener noreferrer" class="inline-flex items-center justify-center rounded-xl bg-ink-950 px-4 py-2.5 text-sm font-bold text-white shadow-sm">${esc(label)}</a></div></aside>`;
}

export function blocksToHtml(blocks: PageBlock[], brokers: Broker[] = []) {
  const seen = new Map<string, number>();
  const slug = (s: string) => { const base = s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-') || 'section'; const n = (seen.get(base) || 0) + 1; seen.set(base, n); return n > 1 ? `${base}-${n}` : base; };
  return blocks.map(b => {
    if (b.type === 'structured_broker_data') return structuredBrokerHtml(b, brokers);
    if (b.type === 'broker_card') { const x = brokers.find(v => v.id === Number(b.brokerId)); return x ? brokerCardHtml(x, (b.variant as BrokerCardVariant) || 'default') : ''; }
    if (b.type === 'broker_grid') return `<div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">${(b.brokerIds || []).map(id => brokers.find(x => x.id === Number(id))).filter(Boolean).map(x => brokerCardHtml(x as Broker, (b.variant as BrokerCardVariant) || 'compact')).join('')}</div>`;
    if (b.type === 'comparison_table') return comparisonHtml(b, brokers);
    if (b.type === 'broker_cta') return ctaHtml(b, brokers);
    if (b.type === 'piprank_verdict') { const bkr = brokers.find(x => x.id === Number(b.brokerId)); const text = b.html || ''; return bkr ? `<section class="piprank-verdict rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm"><div class="flex items-center justify-between gap-3"><h3 class="font-display text-xl font-bold text-ink-950">${esc(b.headline || `PipRank Verdict: ${bkr.name}`)}</h3><span class="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">${pipRankScore(bkr)}/100</span></div>${text ? `<div class="mt-3 text-sm leading-7 text-slate-700">${text}</div>` : ''}${b.showCta !== false ? `<div class="mt-4"><a href="${esc(visitHref(bkr))}" target="_blank" rel="nofollow sponsored noopener noreferrer" class="inline-flex rounded-xl bg-ink-950 px-4 py-2.5 text-sm font-bold text-white">Open Account</a></div>` : ''}</section>` : ''; }
    if (b.type === 'heading') return `<h2 id="${slug(b.title || 'section-heading')}">${esc(b.title || 'Section heading')}</h2>`;
    if (b.type === 'image') return `<figure><img src="${esc(b.src || '')}" alt="${esc(b.alt || '')}" loading="lazy" /><figcaption>${esc(b.alt || '')}</figcaption></figure>`;
    if (b.type === 'table') { const r = b.rows || [['Feature', 'Details'], ['', '']]; return `<div class="overflow-x-auto"><table><thead><tr>${r[0].map(c => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${r.slice(1).map(x => `<tr>${x.map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`; }
    if (b.type === 'callout') return `<aside class="piprank-callout piprank-callout-${esc(b.tone || 'neutral')}">${b.html || ''}</aside>`;
    if (b.type === 'links') return `<nav class="piprank-internal-links"><ul>${(b.links || []).map(x => `<li><a href="${esc(x.href)}">${esc(x.label)}</a></li>`).join('')}</ul></nav>`;
    if (b.type === 'divider') return '<hr />';
    return b.html || '';
  }).join('\n');
}

const ALL_FIELDS: ComparisonField[] = ['rating', 'trust_score', 'min_deposit', 'spread_eurusd', 'commission', 'max_leverage', 'platforms', 'payments', 'regulations'];
const INSERT_TYPES: { type: PageBlock['type']; label: string; icon: typeof Type }[] = [
  { type: 'richtext', label: 'Text', icon: Type }, { type: 'heading', label: 'Heading', icon: Type }, { type: 'structured_broker_data', label: 'Broker data', icon: Database }, { type: 'broker_card', label: 'Broker card', icon: Database }, { type: 'broker_grid', label: 'Broker grid', icon: Database }, { type: 'comparison_table', label: 'Compare', icon: Table2 }, { type: 'broker_cta', label: 'Broker CTA', icon: Link2 }, { type: 'piprank_verdict', label: 'PipRank Verdict', icon: Database }, { type: 'image', label: 'Image', icon: ImageIcon }, { type: 'table', label: 'Table', icon: Table2 }, { type: 'callout', label: 'Callout', icon: Quote }, { type: 'links', label: 'Links', icon: Link2 }, { type: 'divider', label: 'Divider', icon: Plus },
];

function makeBlock(type: PageBlock['type'], brokers: Broker[]): PageBlock {
  const first = brokers[0]?.id;
  if (type === 'table') return { id: uid(), type, rows: [['Feature', 'Details', 'Notes'], ['', '', '']] };
  if (type === 'image') return { id: uid(), type, src: '', alt: '' };
  if (type === 'heading') return { id: uid(), type, title: 'New heading' };
  if (type === 'callout') return { id: uid(), type, html: '<p>Add an important note.</p>', tone: 'neutral' };
  if (type === 'links') return { id: uid(), type, links: [{ label: 'Related PipRank page', href: '/' }] };
  if (type === 'structured_broker_data') return { id: uid(), type, brokerId: first, section: 'overview' };
  if (type === 'broker_card') return { id: uid(), type, brokerId: first, variant: 'default' };
  if (type === 'broker_grid') return { id: uid(), type, brokerIds: brokers.slice(0, 3).map(x => x.id), variant: 'compact' };
  if (type === 'comparison_table') return { id: uid(), type, brokerIds: brokers.slice(0, 3).map(x => x.id), fields: ['rating', 'trust_score', 'min_deposit', 'spread_eurusd'], title: 'Broker comparison', showCta: true, ctaLabel: 'Open Account' };
  if (type === 'broker_cta') return { id: uid(), type, brokerId: first, variant: 'primary', headline: 'Ready to compare?', buttonLabel: 'Open Account' };
  if (type === 'piprank_verdict') return { id: uid(), type, brokerId: first, headline: '', html: '', showCta: true };
  if (type === 'divider') return { id: uid(), type };
  return { id: uid(), type: 'richtext', html: '<p>Start writing…</p>' };
}

export default function PageBuilder({ value, onChange, onUploadImage }: Props) {
  const [blocks, setBlocks] = useState<PageBlock[]>(() => norm(value));
  const [brokers, setBrokers] = useState<Broker[]>([]);
  const [preview, setPreview] = useState(false);
  const [insertAt, setInsertAt] = useState<number | null>(null);
  useEffect(() => { fetchBrokers().then(setBrokers).catch(() => setBrokers([])); }, []);
  useEffect(() => { setBlocks(norm(value)); }, [value]);
  const emit = (next: PageBlock[]) => { setBlocks(next); onChange(next); };
  const update = (i: number, patch: Partial<PageBlock>) => emit(blocks.map((b, n) => n === i ? { ...b, ...patch } : b));
  const insert = (index: number, type: PageBlock['type']) => { const next = [...blocks]; next.splice(index, 0, makeBlock(type, brokers)); emit(next); setInsertAt(null); };
  const add = (type: PageBlock['type']) => insert(blocks.length, type);
  const move = (i: number, d: number) => { const j = i + d; if (j < 0 || j >= blocks.length) return; const next = [...blocks]; [next[i], next[j]] = [next[j], next[i]]; emit(next); };
  const duplicate = (i: number) => { const next = [...blocks]; next.splice(i + 1, 0, { ...blocks[i], id: uid() }); emit(next); };
  const remove = (i: number) => emit(blocks.filter((_, n) => n !== i));
  if (preview) return <div className="rounded-2xl border border-line bg-white"><div className="flex items-center justify-between border-b border-line p-3"><b className="text-sm">Page preview</b><button onClick={() => setPreview(false)} className="rounded-xl border border-line px-3 py-2 text-xs font-bold">Back to editor</button></div><div className="piprank-rich-content p-6 sm:p-10" dangerouslySetInnerHTML={{ __html: blocksToHtml(blocks, brokers) }} /></div>;
  return <div className="rounded-2xl border border-line bg-slate-50 p-3 sm:p-4"><div className="sticky top-0 z-20 mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-line bg-white p-2 shadow-sm"><span className="mr-1 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-slate-400"><GripVertical size={13}/> Page Builder</span>{INSERT_TYPES.map(({ type, label, icon: Icon }) => <button key={type} onClick={() => add(type)} className="tool"><Icon size={14}/>{label}</button>)}<span className="flex-1"/><button onClick={() => setPreview(true)} className="tool"><Eye size={14}/> Preview</button><span className="text-[10px] text-slate-400">{blocks.length} blocks</span></div><div className="rounded-xl border border-emerald-200 bg-emerald-50/70 px-3 py-2 text-[11px] font-medium text-emerald-900 mb-3">Continuous document: existing content stays in place. Use <b>+ Add Element</b> between any two blocks to insert new content exactly there.</div><div>{blocks.length === 0 && <div className="mb-2"><InsertBar onOpen={() => setInsertAt(insertAt === 0 ? null : 0)} /></div>}{blocks.map((b, i) => <div key={b.id}>{insertAt === i ? <InsertPicker onPick={type => insert(i, type)} onClose={() => setInsertAt(null)} /> : <InsertBar onOpen={() => setInsertAt(i)} />}<BlockEditor block={b} index={i} total={blocks.length} brokers={brokers} onChange={patch => update(i, patch)} onMove={move} onDuplicate={duplicate} onRemove={remove} onUploadImage={onUploadImage}/></div>)}{blocks.length > 0 && (insertAt === blocks.length ? <InsertPicker onPick={type => insert(blocks.length, type)} onClose={() => setInsertAt(null)} /> : <InsertBar onOpen={() => setInsertAt(blocks.length)} />)}</div><div className="mt-4 flex items-center justify-between rounded-xl bg-ink-950 px-3 py-2 text-white"><span className="text-[11px] text-slate-400">Blocks are saved in document order; broker blocks store broker IDs, not copied broker facts.</span><button onClick={() => onChange(blocks)} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-400 px-3 py-1.5 text-xs font-bold text-ink-950"><Save size={13}/> Save builder state</button></div><style>{`.tool{display:inline-flex;align-items:center;gap:.3rem;border:1px solid #e2e8f0;border-radius:.65rem;padding:.45rem .65rem;font-size:.7rem;font-weight:700;background:white;color:#0f172a}.iconbtn{padding:.35rem;border-radius:.5rem;color:#64748b}.iconbtn:disabled{opacity:.25}.label{display:block;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#64748b;margin-bottom:.35rem}.input{width:100%;border:1px solid #e2e8f0;border-radius:.75rem;padding:.6rem .75rem;font-size:.8rem;color:#0f172a;background:white}.insert-row{display:flex;align-items:center;gap:8px;min-height:42px}.insert-row>span{height:1px;flex:1;background:#cbd5e1}.insert-button{display:inline-flex;align-items:center;gap:5px;border:1px solid #cbd5e1;border-radius:999px;background:white;padding:6px 11px;font-size:10px;font-weight:800;color:#475569;box-shadow:0 2px 8px rgba(15,23,42,.05)}.insert-button:hover{border-color:#10b981;color:#047857;background:#ecfdf5}.insert-picker{display:flex;flex-wrap:wrap;gap:5px;align-items:center;border:1px solid #a7f3d0;border-radius:14px;background:#f0fdf4;padding:8px;margin:3px 0}.insert-picker button{display:inline-flex;align-items:center;gap:4px;border:1px solid #d1fae5;border-radius:9px;background:white;padding:6px 8px;font-size:10px;font-weight:700;color:#334155}.insert-picker button:hover{background:#ecfdf5;color:#047857}.comparison-editor{border:1px solid #e2e8f0;border-radius:12px;background:#f8fafc;padding:12px}`}</style></div>;
}

function InsertBar({ onOpen }: { onOpen: () => void }) { return <div className="insert-row"><span/><button type="button" className="insert-button" onClick={onOpen}><Plus size={12}/> Add Element</button><span/></div>; }
function InsertPicker({ onPick, onClose }: { onPick: (type: PageBlock['type']) => void; onClose: () => void }) { return <div className="insert-picker"><b className="mr-1 text-[10px] uppercase tracking-widest text-emerald-700">Insert here</b>{INSERT_TYPES.map(({ type, label, icon: Icon }) => <button key={type} onClick={() => onPick(type)}><Icon size={12}/>{label}</button>)}<button onClick={onClose} className="ml-auto">Cancel</button></div>; }
function BrokerPicker({ value, brokers, onChange, multiple = false }: { value?: number | number[]; brokers: Broker[]; onChange: (value: any) => void; multiple?: boolean }) { const selected = multiple ? ((value as number[]) || []).map(Number) : []; if (multiple) return <div><select multiple value={selected.map(String)} onChange={e => onChange(Array.from(e.target.selectedOptions).map(o => Number(o.value)))} className="input min-h-28">{brokers.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select><p className="mt-1 text-[10px] text-slate-500">Ctrl/Cmd-click to select multiple brokers.</p></div>; return <select value={value == null ? '' : String(value)} onChange={e => onChange(e.target.value ? Number(e.target.value) : undefined)} className="input"><option value="">Select broker</option>{brokers.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select>; }
function BrokerBlockEditor({ block, brokers, onChange }: { block: PageBlock; brokers: Broker[]; onChange: (p: Partial<PageBlock>) => void }) {
  if (block.type === 'structured_broker_data') return <div className="space-y-3"><div><label className="label">Broker</label><BrokerPicker value={block.brokerId} brokers={brokers} onChange={brokerId => onChange({ brokerId })}/></div><div><label className="label">Data category</label><select value={block.section || 'overview'} onChange={e => onChange({ section: e.target.value as StructuredBrokerSection })} className="input">{(['overview','pricing','trust','platforms','features','editorial'] as StructuredBrokerSection[]).map(s => <option key={s} value={s}>{sectionLabel(s)}</option>)}</select></div><p className="text-[10px] text-slate-500">Uses the live Broker Workspace record and the same visual data treatment as PipRank's broker cards.</p></div>;
  if (block.type === 'broker_card') return <div className="space-y-3"><div><label className="label">Broker</label><BrokerPicker value={block.brokerId} brokers={brokers} onChange={brokerId => onChange({ brokerId })}/></div><div><label className="label">Card style</label><select value={block.variant || 'default'} onChange={e => onChange({ variant: e.target.value as BrokerCardVariant })} className="input"><option value="default">Default</option><option value="compact">Compact</option><option value="featured">Featured</option></select></div></div>;
  if (block.type === 'broker_grid') return <div className="space-y-3"><div><label className="label">Brokers</label><BrokerPicker value={block.brokerIds} brokers={brokers} multiple onChange={brokerIds => onChange({ brokerIds })}/></div><div><label className="label">Card style</label><select value={block.variant || 'compact'} onChange={e => onChange({ variant: e.target.value as BrokerCardVariant })} className="input"><option value="compact">Compact</option><option value="default">Default</option><option value="featured">Featured</option></select></div></div>;
  if (block.type === 'comparison_table') return <div className="comparison-editor space-y-3"><div><label className="label">Brokers</label><BrokerPicker value={block.brokerIds} brokers={brokers} multiple onChange={brokerIds => onChange({ brokerIds })}/></div><div><label className="label">Table title</label><input value={block.title || ''} onChange={e => onChange({ title: e.target.value })} className="input"/></div><div><label className="label">Comparison fields</label><div className="flex flex-wrap gap-2">{ALL_FIELDS.map(f => <label key={f} className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-white px-2.5 py-1.5 text-[10px] font-bold text-slate-700"><input type="checkbox" checked={(block.fields || []).includes(f)} onChange={() => onChange({ fields: (block.fields || []).includes(f) ? (block.fields || []).filter(x => x !== f) : [...(block.fields || []), f] })}/>{fieldLabel(f)}</label>)}</div></div><label className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs font-bold text-emerald-900"><input type="checkbox" checked={block.showCta === true} onChange={e => onChange({ showCta: e.target.checked })}/><span>Add CTA</span><span className="font-normal text-emerald-800">— each selected broker gets its own existing Open Account destination</span></label><div><label className="label">CTA label</label><input value={block.ctaLabel || 'Open Account'} onChange={e => onChange({ ctaLabel: e.target.value })} className="input" placeholder="Open Account"/><p className="mt-1 text-[10px] text-slate-500">This changes only the button text. The destination always comes from the selected broker's existing /go/ routing.</p></div></div>;
  if (block.type === 'broker_cta') return <div className="space-y-3"><div><label className="label">Broker</label><BrokerPicker value={block.brokerId} brokers={brokers} onChange={brokerId => onChange({ brokerId })}/></div><div><label className="label">Headline</label><input value={block.headline ?? block.title ?? ''} onChange={e => onChange({ headline: e.target.value })} className="input"/></div><div><label className="label">Button label</label><input value={block.buttonLabel ?? block.ctaLabel ?? 'Open Account'} onChange={e => onChange({ buttonLabel: e.target.value })} className="input"/></div><select value={block.variant || 'primary'} onChange={e => onChange({ variant: e.target.value as BrokerCtaVariant })} className="input"><option value="primary">Primary</option><option value="dark">Dark</option><option value="soft">Soft</option></select><p className="text-[10px] text-slate-500">The CTA destination is always the broker's existing affiliate routing. No manual URL is needed.</p></div>;
  if (block.type === 'piprank_verdict') return <div className="space-y-3"><div><label className="label">Broker</label><BrokerPicker value={block.brokerId} brokers={brokers} onChange={brokerId => onChange({ brokerId })}/></div><div><label className="label">Headline</label><input value={block.headline || ''} onChange={e => onChange({ headline: e.target.value })} className="input" placeholder="Is this broker right for you?"/></div><div><label className="label">Verdict text</label><RichTextEditor value={block.html || ''} onChange={html => onChange({ html })}/></div><label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700"><input type="checkbox" checked={block.showCta !== false} onChange={e => onChange({ showCta: e.target.checked })}/> Show broker CTA</label></div>;
  return null;
}
function BrokerVisualPreview({ block, brokers }: { block: PageBlock; brokers: Broker[] }) { if (block.type === 'broker_card') { const broker = brokers.find(b => b.id === Number(block.brokerId)); if (!broker) return <div className="rounded-xl border border-dashed border-line p-5 text-xs text-slate-500">Select a broker to preview the live BrokerCard.</div>; return <div className="max-w-md"><BrokerCard broker={broker} /></div>; } if (block.type === 'broker_grid') { const selected = (block.brokerIds || []).map(id => brokers.find(b => b.id === Number(id))).filter(Boolean) as Broker[]; if (!selected.length) return <div className="rounded-xl border border-dashed border-line p-5 text-xs text-slate-500">Select brokers to preview the live broker cards.</div>; return <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{selected.map((broker, i) => <BrokerCard key={broker.id} broker={broker} rank={i + 1} />)}</div>; } return null; }
function BlockEditor({ block, index, total, brokers, onChange, onMove, onDuplicate, onRemove, onUploadImage }: { block: PageBlock; index: number; total: number; brokers: Broker[]; onChange: (p: Partial<PageBlock>) => void; onMove: (i: number, d: number) => void; onDuplicate: (i: number) => void; onRemove: (i: number) => void; onUploadImage?: (file: File) => Promise<string> }) { return <div className="rounded-2xl border border-line bg-white shadow-sm"><div className="flex items-center gap-2 border-b border-line px-3 py-2"><span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{block.type.replaceAll('_',' ')}</span><span className="text-[10px] text-slate-400">#{index + 1}</span><span className="flex-1"/><button onClick={() => onDuplicate(index)} title="Duplicate" className="iconbtn"><Copy size={14}/></button><button disabled={index === 0} onClick={() => onMove(index, -1)} title="Move up" className="iconbtn"><ArrowUp size={14}/></button><button disabled={index === total - 1} onClick={() => onMove(index, 1)} title="Move down" className="iconbtn"><ArrowDown size={14}/></button><button onClick={() => onRemove(index)} title="Delete" className="iconbtn text-rose-500"><Trash2 size={14}/></button></div><div className="p-3">{block.type === 'heading' && <input value={block.title || ''} onChange={e => onChange({ title: e.target.value })} className="w-full rounded-xl border border-line px-3 py-2.5 font-display text-xl font-bold text-ink-950"/>}{block.type === 'richtext' && <RichTextEditor value={block.html || ''} onChange={html => onChange({ html })} onUploadImage={onUploadImage}/>} {block.type === 'image' && <div className="grid gap-3 sm:grid-cols-2"><div><label className="label">Image URL</label><input value={block.src || ''} onChange={e => onChange({ src: e.target.value })} className="input"/><label className="label mt-3">Alt text</label><input value={block.alt || ''} onChange={e => onChange({ alt: e.target.value })} className="input"/>{onUploadImage && <label className="mt-3 inline-flex cursor-pointer rounded-xl bg-ink-950 px-3 py-2 text-xs font-bold text-white">Upload image<input type="file" accept="image/*" className="hidden" onChange={async e => { const f = e.target.files?.[0]; if (!f) return; onChange({ src: await onUploadImage(f) }); e.currentTarget.value = ''; }}/></label>}</div><div className="flex min-h-40 items-center justify-center rounded-xl bg-slate-100">{block.src ? <img src={block.src} alt={block.alt || ''} className="max-h-64 rounded-xl object-contain"/> : <span className="text-xs text-slate-500">Image preview</span>}</div></div>}{block.type === 'table' && <TableBlock block={block} onChange={onChange}/>} {block.type === 'links' && <LinksBlock block={block} onChange={onChange}/>} {block.type === 'callout' && <div><select value={block.tone || 'neutral'} onChange={e => onChange({ tone: e.target.value as any })} className="mb-2 rounded-lg border border-line px-2 py-1 text-xs text-slate-700"><option>neutral</option><option>success</option><option>warning</option><option>dark</option></select><RichTextEditor value={block.html || ''} onChange={html => onChange({ html })}/></div>}{block.type === 'divider' && <hr/>}{['structured_broker_data','comparison_table','broker_cta','piprank_verdict'].includes(block.type) && <BrokerBlockEditor block={block} brokers={brokers} onChange={onChange}/>} {['broker_card','broker_grid'].includes(block.type) && <div className="space-y-4"><BrokerBlockEditor block={block} brokers={brokers} onChange={onChange}/><div className="rounded-xl border border-emerald-100 bg-emerald-50/30 p-3"><div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-emerald-700">Live production card preview</div><BrokerVisualPreview block={block} brokers={brokers}/></div></div>}{block.type === 'piprank_verdict' && <div className="rounded-xl border border-emerald-100 bg-emerald-50/30 p-3"><div className="text-[10px] font-bold uppercase tracking-widest text-emerald-700">Verdict preview</div><p className="mt-2 text-xs text-slate-600">The public template renders this block with the live PipRank verdict treatment.</p></div>}</div></div>; }
function TableBlock({ block, onChange }: { block: PageBlock; onChange: (p: Partial<PageBlock>) => void }) { const rows = block.rows?.length ? block.rows : [['Feature','Details','Notes'],['','','']]; const width = Math.max(1, rows[0]?.length || 1); const normalized = rows.map(row => Array.from({ length: width }, (_, i) => row[i] ?? '')); const set = (r:number,c:number,v:string) => { const n = normalized.map(x => [...x]); n[r][c] = v; onChange({ rows: n }); }; const addRow = () => onChange({ rows: [...normalized, Array(width).fill('')] }); const addCol = () => onChange({ rows: normalized.map((row, i) => [...row, i === 0 ? 'New column' : '']) }); const removeRow = (r:number) => { if (normalized.length <= 2) return; onChange({ rows: normalized.filter((_, i) => i !== r) }); }; const removeCol = (c:number) => { if (width <= 1) return; onChange({ rows: normalized.map(row => row.filter((_, i) => i !== c)) }); }; return <div className="overflow-x-auto"><table className="w-full min-w-[520px] border-collapse"><tbody>{normalized.map((row,r) => <tr key={r}>{row.map((cell,c) => <td key={c} className="border border-line p-1"><div className="flex items-center gap-1"><input value={cell} onChange={e => set(r,c,e.target.value)} className={`min-w-0 flex-1 bg-transparent px-2 py-2 text-xs text-ink-900 ${r===0?'font-bold':''}`}/><button type="button" onClick={() => removeCol(c)} disabled={width <= 1} className="iconbtn text-slate-300 hover:text-rose-500" title="Remove column">×</button></div></td>)}<td className="border-0 p-1"><button type="button" onClick={() => removeRow(r)} disabled={normalized.length <= 2} className="iconbtn text-slate-300 hover:text-rose-500" title="Remove row">×</button></td></tr>)}</tbody></table><div className="mt-2 flex flex-wrap gap-2"><button onClick={addRow} className="inline-flex items-center gap-1 rounded-lg border border-line bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700"><Plus size={12}/> Add row</button><button onClick={addCol} className="inline-flex items-center gap-1 rounded-lg border border-line bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700"><Plus size={12}/> Add column</button></div></div>; }
function LinksBlock({ block, onChange }: { block: PageBlock; onChange: (p: Partial<PageBlock>) => void }) { const links = block.links || []; return <div><p className="mb-2 text-xs font-bold text-slate-600">Internal links</p>{links.map((x,n) => <div key={n} className="mb-2 grid grid-cols-[1fr_1fr_auto] gap-2"><input value={x.label} onChange={e => onChange({ links: links.map((y,j) => j===n ? {...y,label:e.target.value}:y) })} className="input" placeholder="Link label"/><input value={x.href} onChange={e => onChange({ links: links.map((y,j) => j===n ? {...y,href:e.target.value}:y) })} className="input" placeholder="/best/forex-brokers"/><button onClick={() => onChange({ links: links.filter((_,j) => j!==n) })} className="iconbtn text-rose-500"><Trash2 size={14}/></button></div>)}<button onClick={() => onChange({ links: [...links,{label:'New link',href:'/'}] })} className="mt-1 inline-flex items-center gap-1 rounded-lg border border-line bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700"><Plus size={12}/> Add link</button></div>; }
