import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Copy, Database, Eye, GripVertical, Image as ImageIcon, Link2, Plus, Quote, Save, Table2, Trash2, Type } from 'lucide-react';
import RichTextEditor from './RichTextEditor';
import BrokerCard from './BrokerCard';
import type { Broker } from '../lib/types';
import { fetchBrokers } from '../lib/api';

export type StructuredBrokerSection = 'overview' | 'pricing' | 'trust' | 'platforms' | 'features' | 'editorial';
export type BrokerCardVariant = 'default' | 'compact' | 'featured';
export type BrokerCtaVariant = 'primary' | 'dark' | 'soft';
export type ComparisonField = 'rating' | 'trust_score' | 'min_deposit' | 'spread_eurusd' | 'commission' | 'max_leverage' | 'platforms' | 'payments' | 'regulations';

export type PageBlock = {
  id: string;
  type: 'richtext' | 'heading' | 'image' | 'table' | 'callout' | 'divider' | 'links' | 'structured_broker_data' | 'broker_card' | 'broker_grid' | 'comparison_table' | 'broker_cta';
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
};

type Props = {
  value?: unknown[];
  onChange: (blocks: PageBlock[]) => void;
  onUploadImage?: (file: File) => Promise<string>;
};

const uid = () => `b_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const esc = (v: unknown) => String(v ?? '').replace(/[&<>\"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;', "'": '&#039;' }[c] as string));

const legacyHtmlToBlocks = (html: string): PageBlock[] => {
  if (!html?.trim() || typeof DOMParser === 'undefined') return [];
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return Array.from(doc.body.childNodes)
    .filter(n => n.nodeType === 1 || !!n.textContent?.trim())
    .map((node: any): PageBlock => {
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

const sectionLabel = (s: StructuredBrokerSection) => ({
  overview: 'Overview', pricing: 'Pricing & trading costs', trust: 'Trust & regulation',
  platforms: 'Trading platforms', features: 'Features & payments', editorial: 'Editorial highlights'
}[s]);
const fieldLabel = (f: ComparisonField) => ({
  rating: 'Rating', trust_score: 'Trust score', min_deposit: 'Min. deposit', spread_eurusd: 'EUR/USD spread',
  commission: 'Commission', max_leverage: 'Max leverage', platforms: 'Platforms', payments: 'Payment methods', regulations: 'Regulation'
}[f]);

const brokerField = (b: Broker, f: ComparisonField): string => {
  if (f === 'rating') return `${b.rating ?? ''}/5`;
  if (f === 'trust_score') return String(b.trust_score ?? '');
  if (f === 'min_deposit') return String(b.min_deposit ?? '');
  if (f === 'spread_eurusd') return String(b.spread_eurusd ?? '');
  if (f === 'commission') return String(b.commission ?? '');
  if (f === 'max_leverage') return String(b.max_leverage ?? '');
  if (f === 'platforms') return (b.platforms || []).join(', ') || 'Not listed';
  if (f === 'payments') return (b.payments || []).join(', ') || 'Not listed';
  return (b.regulations || []).map(r => r.body || r.country).filter(Boolean).join(', ') || 'Not listed';
};

function structuredBrokerHtml(block: PageBlock, brokers: Broker[]) {
  const b = brokers.find(x => x.id === Number(block.brokerId));
  if (!b) return '';
  const s = block.section || 'overview';
  const rows: [string, string][] = s === 'overview'
    ? [['Broker', b.name], ['Rating', `${b.rating}/5`], ['Trust score', String(b.trust_score)], ['Founded', String(b.founded || '')], ['Headquarters', b.headquarters || '']]
    : s === 'pricing'
      ? [['Minimum deposit', String(b.min_deposit)], ['EUR/USD spread', String(b.spread_eurusd)], ['Commission', b.commission || ''], ['Maximum leverage', b.max_leverage || '']]
      : s === 'trust'
        ? [['Trust score', String(b.trust_score)], ['Regulation', (b.regulations || []).map(r => r.body || r.country).filter(Boolean).join(', ') || 'Not listed'], ['Segregated funds', b.segregated ? 'Yes' : 'No'], ['Negative balance protection', b.nbp ? 'Yes' : 'No'], ['Risk warning', b.risk_warning || '']]
        : s === 'platforms'
          ? [['Platforms', (b.platforms || []).join(', ') || 'Not listed']]
          : s === 'features'
            ? [['Demo account', b.demo_account ? 'Yes' : 'No'], ['Islamic account', b.islamic_account ? 'Yes' : 'No'], ['Copy trading', b.copy_trading ? 'Yes' : 'No'], ['Scalping', b.scalping ? 'Yes' : 'No'], ['Hedging', b.hedging ? 'Yes' : 'No'], ['Payment methods', (b.payments || []).join(', ') || 'Not listed']]
            : [['Best for', (b.best_for || []).join(', ')], ['Pros', (b.pros || []).join(' • ')], ['Cons', (b.cons || []).join(' • ')]];
  return `<section class="piprank-structured-broker-data" data-broker-id="${Number(b.id)}" data-section="${esc(s)}"><h3>${esc(b.name)} — ${esc(sectionLabel(s))}</h3><div class="overflow-x-auto"><table><tbody>${rows.filter(([, v]) => v !== '').map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join('')}</tbody></table></div></section>`;
}

function brokerCardHtml(b: Broker, variant: BrokerCardVariant = 'default') {
  const href = b.affiliate_url || `/brokers/${b.slug}`;
  return `<article class="piprank-broker-card piprank-broker-card-${esc(variant)}" data-broker-id="${Number(b.id)}"><div><h3>${esc(b.name)}</h3><p>Rating: ${esc(`${b.rating ?? ''}/5`)} · Trust score: ${esc(b.trust_score)}</p><p>Min. deposit: ${esc(b.min_deposit)} · EUR/USD: ${esc(b.spread_eurusd)}</p></div><a href="${esc(href)}">View ${esc(b.name)}</a></article>`;
}

function comparisonHtml(block: PageBlock, brokers: Broker[]) {
  const selected = (block.brokerIds || []).map(id => brokers.find(b => b.id === Number(id))).filter(Boolean) as Broker[];
  if (!selected.length) return '';
  const fields = block.fields?.length ? block.fields : ['rating', 'trust_score', 'min_deposit', 'spread_eurusd'] as ComparisonField[];
  const rows = fields.map(f => `<tr><th>${esc(fieldLabel(f))}</th>${selected.map(b => `<td>${esc(brokerField(b, f))}</td>`).join('')}</tr>`).join('');
  return `<section class="piprank-comparison-table"><h3>${esc(block.title || 'Broker comparison')}</h3><div class="overflow-x-auto"><table><thead><tr><th>Broker</th>${selected.map(b => `<th>${esc(b.name)}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div></section>`;
}

function ctaHtml(block: PageBlock, brokers: Broker[]) {
  const b = brokers.find(x => x.id === Number(block.brokerId));
  if (!b) return '';
  const href = block.ctaHref || b.affiliate_url || `/brokers/${b.slug}`;
  const headline = block.headline ?? block.title ?? `Trade with ${b.name}`;
  const label = block.buttonLabel ?? block.ctaLabel ?? `View ${b.name}`;
  return `<aside class="piprank-broker-cta piprank-broker-cta-${esc(block.variant || 'primary')}"><strong>${esc(headline)}</strong><a href="${esc(href)}">${esc(label)}</a></aside>`;
}

export function blocksToHtml(blocks: PageBlock[], brokers: Broker[] = []) {
  const seen = new Map<string, number>();
  const slug = (s: string) => {
    const base = s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'section';
    const n = (seen.get(base) || 0) + 1; seen.set(base, n);
    return n > 1 ? `${base}-${n}` : base;
  };
  return blocks.map(b => {
    if (b.type === 'structured_broker_data') return structuredBrokerHtml(b, brokers);
    if (b.type === 'broker_card') { const x = brokers.find(v => v.id === Number(b.brokerId)); return x ? brokerCardHtml(x, (b.variant as BrokerCardVariant) || 'default') : ''; }
    if (b.type === 'broker_grid') return (b.brokerIds || []).map(id => brokers.find(x => x.id === Number(id))).filter(Boolean).map(x => brokerCardHtml(x as Broker, (b.variant as BrokerCardVariant) || 'compact')).join('\n');
    if (b.type === 'comparison_table') return comparisonHtml(b, brokers);
    if (b.type === 'broker_cta') return ctaHtml(b, brokers);
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
  { type: 'richtext', label: 'Text', icon: Type },
  { type: 'heading', label: 'Heading', icon: Type },
  { type: 'structured_broker_data', label: 'Broker data', icon: Database },
  { type: 'broker_card', label: 'Broker card', icon: Database },
  { type: 'broker_grid', label: 'Broker grid', icon: Database },
  { type: 'comparison_table', label: 'Compare', icon: Table2 },
  { type: 'broker_cta', label: 'Broker CTA', icon: Link2 },
  { type: 'image', label: 'Image', icon: ImageIcon },
  { type: 'table', label: 'Table', icon: Table2 },
  { type: 'callout', label: 'Callout', icon: Quote },
  { type: 'links', label: 'Links', icon: Link2 },
  { type: 'divider', label: 'Divider', icon: Plus },
];

function makeBlock(type: PageBlock['type'], brokers: Broker[]): PageBlock {
  const first = brokers[0]?.id;
  if (type === 'table') return { id: uid(), type, rows: [['Feature', 'Details'], ['', '']] };
  if (type === 'image') return { id: uid(), type, src: '', alt: '' };
  if (type === 'heading') return { id: uid(), type, title: 'New heading' };
  if (type === 'callout') return { id: uid(), type, html: '<p>Add an important note.</p>', tone: 'neutral' };
  if (type === 'links') return { id: uid(), type, links: [{ label: 'Related PipRank page', href: '/' }] };
  if (type === 'structured_broker_data') return { id: uid(), type, brokerId: first, section: 'overview' };
  if (type === 'broker_card') return { id: uid(), type, brokerId: first, variant: 'default' };
  if (type === 'broker_grid') return { id: uid(), type, brokerIds: brokers.slice(0, 3).map(x => x.id), variant: 'compact' };
  if (type === 'comparison_table') return { id: uid(), type, brokerIds: brokers.slice(0, 3).map(x => x.id), fields: ['rating', 'trust_score', 'min_deposit', 'spread_eurusd'], title: 'Broker comparison' };
  if (type === 'broker_cta') return { id: uid(), type, brokerId: first, variant: 'primary', headline: 'Ready to compare?', buttonLabel: 'View broker' };
  if (type === 'divider') return { id: uid(), type };
  return { id: uid(), type: 'richtext', html: '<p>Start writing…</p>' };
}

export default function PageBuilder({ value, onChange, onUploadImage }: Props) {
  const [blocks, setBlocks] = useState<PageBlock[]>(() => norm(value));
  const [brokers, setBrokers] = useState<Broker[]>([]);
  const [preview, setPreview] = useState(false);
  const [insertAt, setInsertAt] = useState<number | null>(null);

  useEffect(() => { fetchBrokers().then(setBrokers).catch(() => setBrokers([])); }, []);

  const emit = (next: PageBlock[]) => { setBlocks(next); onChange(next); };
  const update = (i: number, patch: Partial<PageBlock>) => emit(blocks.map((b, n) => n === i ? { ...b, ...patch } : b));
  const insert = (index: number, type: PageBlock['type']) => { const next = [...blocks]; next.splice(index, 0, makeBlock(type, brokers)); emit(next); setInsertAt(null); };
  const add = (type: PageBlock['type']) => insert(blocks.length, type);
  const move = (i: number, d: number) => { const j = i + d; if (j < 0 || j >= blocks.length) return; const next = [...blocks]; [next[i], next[j]] = [next[j], next[i]]; emit(next); };
  const duplicate = (i: number) => { const next = [...blocks]; next.splice(i + 1, 0, { ...blocks[i], id: uid() }); emit(next); };
  const remove = (i: number) => emit(blocks.filter((_, n) => n !== i));

  if (preview) return <div className="rounded-2xl border border-line bg-white"><div className="flex items-center justify-between border-b border-line p-3"><b className="text-sm">Page preview</b><button onClick={() => setPreview(false)} className="rounded-xl border border-line px-3 py-2 text-xs font-bold">Back to editor</button></div><div className="piprank-rich-content p-6 sm:p-10" dangerouslySetInnerHTML={{ __html: blocksToHtml(blocks, brokers) }} /></div>;

  return <div className="rounded-2xl border border-line bg-slate-50 p-3 sm:p-4">
    <div className="sticky top-0 z-20 mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-line bg-white p-2 shadow-sm">
      <span className="mr-1 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-slate-400"><GripVertical size={13}/> Page Builder</span>
      {INSERT_TYPES.map(({ type, label, icon: Icon }) => <button key={type} onClick={() => add(type)} className="tool"><Icon size={14}/>{label}</button>)}
      <span className="flex-1"/><button onClick={() => setPreview(true)} className="tool"><Eye size={14}/> Preview</button><span className="text-[10px] text-slate-400">{blocks.length} blocks</span>
    </div>

    <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 px-3 py-2 text-[11px] font-medium text-emerald-900 mb-3">
      Continuous document: existing content stays in place. Use <b>+ Add Element</b> between any two blocks to insert new content exactly there.
    </div>

    <div>
      {blocks.length === 0 && <div className="mb-2"><InsertBar onOpen={() => setInsertAt(insertAt === 0 ? null : 0)} /></div>}
      {blocks.map((b, i) => <div key={b.id}>
        {insertAt === i ? <InsertPicker onPick={type => insert(i, type)} onClose={() => setInsertAt(null)} /> : <InsertBar onOpen={() => setInsertAt(i)} />}
        <BlockEditor block={b} index={i} total={blocks.length} brokers={brokers} onChange={patch => update(i, patch)} onMove={move} onDuplicate={duplicate} onRemove={remove} onUploadImage={onUploadImage}/>
      </div>)}
      {blocks.length > 0 && (insertAt === blocks.length ? <InsertPicker onPick={type => insert(blocks.length, type)} onClose={() => setInsertAt(null)} /> : <InsertBar onOpen={() => setInsertAt(blocks.length)} />)}
    </div>

    <div className="mt-4 flex items-center justify-between rounded-xl bg-ink-950 px-3 py-2 text-white"><span className="text-[11px] text-slate-400">Blocks are saved in document order; broker blocks store broker IDs, not copied broker facts.</span><button onClick={() => onChange(blocks)} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-400 px-3 py-1.5 text-xs font-bold text-ink-950"><Save size={13}/> Save builder state</button></div>
    <style>{`.tool{display:inline-flex;align-items:center;gap:.3rem;border:1px solid #e2e8f0;border-radius:.65rem;padding:.45rem .65rem;font-size:.7rem;font-weight:700;background:white}.iconbtn{padding:.35rem;border-radius:.5rem;color:#94a3b8}.iconbtn:disabled{opacity:.25}.label{display:block;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#94a3b8;margin-bottom:.35rem}.input{width:100%;border:1px solid #e2e8f0;border-radius:.75rem;padding:.6rem .75rem;font-size:.8rem}.insert-row{display:flex;align-items:center;gap:8px;min-height:42px}.insert-row>span{height:1px;flex:1;background:#cbd5e1}.insert-button{display:inline-flex;align-items:center;gap:5px;border:1px solid #cbd5e1;border-radius:999px;background:white;padding:6px 11px;font-size:10px;font-weight:800;color:#64748b;box-shadow:0 2px 8px rgba(15,23,42,.05)}.insert-button:hover{border-color:#10b981;color:#047857;background:#ecfdf5}.insert-picker{display:flex;flex-wrap:wrap;gap:5px;align-items:center;border:1px solid #a7f3d0;border-radius:14px;background:#f0fdf4;padding:8px;margin:3px 0}.insert-picker button{display:inline-flex;align-items:center;gap:4px;border:1px solid #d1fae5;border-radius:9px;background:white;padding:6px 8px;font-size:10px;font-weight:700;color:#475569}.insert-picker button:hover{background:#ecfdf5;color:#047857}`}</style>
  </div>;
}

function InsertBar({ onOpen }: { onOpen: () => void }) { return <div className="insert-row"><span/><button type="button" className="insert-button" onClick={onOpen}><Plus size={12}/> Add Element</button><span/></div>; }
function InsertPicker({ onPick, onClose }: { onPick: (type: PageBlock['type']) => void; onClose: () => void }) { return <div className="insert-picker"><b className="mr-1 text-[10px] uppercase tracking-widest text-emerald-700">Insert here</b>{INSERT_TYPES.map(({ type, label, icon: Icon }) => <button key={type} onClick={() => onPick(type)}><Icon size={12}/>{label}</button>)}<button onClick={onClose} className="ml-auto">Cancel</button></div>; }

function BrokerPicker({ value, brokers, onChange, multiple = false }: { value?: number | number[]; brokers: Broker[]; onChange: (value: any) => void; multiple?: boolean }) {
  const selected = multiple ? ((value as number[]) || []).map(Number) : [];
  if (multiple) return <div><select multiple value={selected.map(String)} onChange={e => onChange(Array.from(e.target.selectedOptions).map(o => Number(o.value)))} className="input min-h-28">{brokers.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select><p className="mt-1 text-[10px] text-slate-400">Ctrl/Cmd-click to select multiple brokers.</p></div>;
  return <select value={value == null ? '' : String(value)} onChange={e => onChange(e.target.value ? Number(e.target.value) : undefined)} className="input"><option value="">Select broker</option>{brokers.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select>;
}

function BrokerBlockEditor({ block, brokers, onChange }: { block: PageBlock; brokers: Broker[]; onChange: (p: Partial<PageBlock>) => void }) {
  if (block.type === 'structured_broker_data') return <div className="space-y-3"><div><label className="label">Broker</label><BrokerPicker value={block.brokerId} brokers={brokers} onChange={brokerId => onChange({ brokerId})}/></div><div><label className="label">Data category</label><select value={block.section || 'overview'} onChange={e => onChange({ section: e.target.value as StructuredBrokerSection })} className="input">{(['overview','pricing','trust','platforms','features','editorial'] as StructuredBrokerSection[]).map(s => <option key={s} value={s}>{sectionLabel(s)}</option>)}</select></div><p className="text-[10px] text-slate-400">This block references the live Broker Workspace record. Updating the broker updates every block using this ID.</p></div>;
  if (block.type === 'broker_card') return <div className="space-y-3"><div><label className="label">Broker</label><BrokerPicker value={block.brokerId} brokers={brokers} onChange={brokerId => onChange({ brokerId})}/></div><div><label className="label">Card style</label><select value={block.variant || 'default'} onChange={e => onChange({ variant: e.target.value as BrokerCardVariant })} className="input"><option value="default">Default</option><option value="compact">Compact</option><option value="featured">Featured</option></select></div></div>;
  if (block.type === 'broker_grid') return <div className="space-y-3"><div><label className="label">Brokers</label><BrokerPicker value={block.brokerIds} brokers={brokers} multiple onChange={brokerIds => onChange({ brokerIds })}/></div><div><label className="label">Card style</label><select value={block.variant || 'compact'} onChange={e => onChange({ variant: e.target.value as BrokerCardVariant })} className="input"><option value="compact">Compact</option><option value="default">Default</option><option value="featured">Featured</option></select></div></div>;
  if (block.type === 'comparison_table') return <div className="space-y-3"><div><label className="label">Brokers</label><BrokerPicker value={block.brokerIds} brokers={brokers} multiple onChange={brokerIds => onChange({ brokerIds })}/></div><div><label className="label">Table title</label><input value={block.title || ''} onChange={e => onChange({ title: e.target.value })} className="input"/></div><div><label className="label">Comparison fields</label><div className="flex flex-wrap gap-2">{ALL_FIELDS.map(f => <label key={f} className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-white px-2.5 py-1.5 text-[10px] font-bold"><input type="checkbox" checked={(block.fields || []).includes(f)} onChange={() => onChange({ fields: (block.fields || []).includes(f) ? (block.fields || []).filter(x => x !== f) : [...(block.fields || []), f] })}/>{fieldLabel(f)}</label>)}</div></div></div>;
  if (block.type === 'broker_cta') return <div className="space-y-3"><div><label className="label">Broker</label><BrokerPicker value={block.brokerId} brokers={brokers} onChange={brokerId => onChange({ brokerId})}/></div><div><label className="label">Headline</label><input value={block.headline ?? block.title ?? ''} onChange={e => onChange({ headline: e.target.value })} className="input"/></div><div><label className="label">Button label</label><input value={block.buttonLabel ?? block.ctaLabel ?? ''} onChange={e => onChange({ buttonLabel: e.target.value })} className="input"/></div><div><label className="label">Optional custom URL</label><input value={block.ctaHref || ''} onChange={e => onChange({ ctaHref: e.target.value })} className="input" placeholder="Leave blank to use broker affiliate URL"/></div><select value={block.variant || 'primary'} onChange={e => onChange({ variant: e.target.value as BrokerCtaVariant })} className="input"><option value="primary">Primary</option><option value="dark">Dark</option><option value="soft">Soft</option></select></div>;
  return null;
}

function BrokerVisualPreview({ block, brokers }: { block: PageBlock; brokers: Broker[] }) {
  if (block.type === 'broker_card') {
    const broker = brokers.find(b => b.id === Number(block.brokerId));
    if (!broker) return <div className="rounded-xl border border-dashed border-line p-5 text-xs text-slate-400">Select a broker to preview the live BrokerCard.</div>;
    return <div className="max-w-md"><BrokerCard broker={broker} /></div>;
  }
  if (block.type === 'broker_grid') {
    const selected = (block.brokerIds || []).map(id => brokers.find(b => b.id === Number(id))).filter(Boolean) as Broker[];
    if (!selected.length) return <div className="rounded-xl border border-dashed border-line p-5 text-xs text-slate-400">Select brokers to preview the live broker cards.</div>;
    return <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{selected.map((broker, i) => <BrokerCard key={broker.id} broker={broker} rank={i + 1} />)}</div>;
  }
  return null;
}

function BlockEditor({ block, index, total, brokers, onChange, onMove, onDuplicate, onRemove, onUploadImage }: { block: PageBlock; index: number; total: number; brokers: Broker[]; onChange: (p: Partial<PageBlock>) => void; onMove: (i: number, d: number) => void; onDuplicate: (i: number) => void; onRemove: (i: number) => void; onUploadImage?: (file: File) => Promise<string> }) {
  return <div className="rounded-2xl border border-line bg-white shadow-sm"><div className="flex items-center gap-2 border-b border-line px-3 py-2"><span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{block.type.replaceAll('_',' ')}</span><span className="text-[10px] text-slate-300">#{index + 1}</span><span className="flex-1"/><button onClick={() => onDuplicate(index)} title="Duplicate" className="iconbtn"><Copy size={14}/></button><button disabled={index === 0} onClick={() => onMove(index, -1)} title="Move up" className="iconbtn"><ArrowUp size={14}/></button><button disabled={index === total - 1} onClick={() => onMove(index, 1)} title="Move down" className="iconbtn"><ArrowDown size={14}/></button><button onClick={() => onRemove(index)} title="Delete" className="iconbtn text-rose-500"><Trash2 size={14}/></button></div><div className="p-3">
    {block.type === 'heading' && <input value={block.title || ''} onChange={e => onChange({ title: e.target.value })} className="w-full rounded-xl border border-line px-3 py-2.5 font-display text-xl font-bold"/>}
    {block.type === 'richtext' && <RichTextEditor value={block.html || ''} onChange={html => onChange({ html })} onUploadImage={onUploadImage}/>} 
    {block.type === 'image' && <div className="grid gap-3 sm:grid-cols-2"><div><label className="label">Image URL</label><input value={block.src || ''} onChange={e => onChange({ src: e.target.value })} className="input"/><label className="label mt-3">Alt text</label><input value={block.alt || ''} onChange={e => onChange({ alt: e.target.value })} className="input"/>{onUploadImage && <label className="mt-3 inline-flex cursor-pointer rounded-xl bg-ink-950 px-3 py-2 text-xs font-bold text-white">Upload image<input type="file" accept="image/*" className="hidden" onChange={async e => { const f = e.target.files?.[0]; if (!f) return; onChange({ src: await onUploadImage(f) }); e.currentTarget.value = ''; }}/></label>}</div><div className="flex min-h-40 items-center justify-center rounded-xl bg-slate-100">{block.src ? <img src={block.src} alt={block.alt || ''} className="max-h-64 rounded-xl object-contain"/> : <span className="text-xs text-slate-400">Image preview</span>}</div></div>}
    {block.type === 'table' && <TableBlock block={block} onChange={onChange}/>} 
    {block.type === 'links' && <LinksBlock block={block} onChange={onChange}/>} 
    {block.type === 'callout' && <div><select value={block.tone || 'neutral'} onChange={e => onChange({ tone: e.target.value as any })} className="mb-2 rounded-lg border border-line px-2 py-1 text-xs"><option>neutral</option><option>success</option><option>warning</option><option>dark</option></select><RichTextEditor value={block.html || ''} onChange={html => onChange({ html })}/></div>}
    {block.type === 'divider' && <hr/>}
    {['structured_broker_data','comparison_table','broker_cta'].includes(block.type) && <BrokerBlockEditor block={block} brokers={brokers} onChange={onChange}/>} 
    {['broker_card','broker_grid'].includes(block.type) && <div className="space-y-4"><BrokerBlockEditor block={block} brokers={brokers} onChange={onChange}/><div className="rounded-xl border border-emerald-100 bg-emerald-50/30 p-3"><div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-emerald-700">Live production card preview</div><BrokerVisualPreview block={block} brokers={brokers}/></div></div>}
  </div></div>;
}

function TableBlock({ block, onChange }: { block: PageBlock; onChange: (p: Partial<PageBlock>) => void }) { const rows = block.rows || [['Feature','Details'],['','']]; const set = (r:number,c:number,v:string) => { const n = rows.map(x => [...x]); n[r][c] = v; onChange({ rows: n }); }; return <div className="overflow-x-auto"><table className="w-full border-collapse"><tbody>{rows.map((row,r) => <tr key={r}>{row.map((cell,c) => <td key={c} className="border border-line p-1"><input value={cell} onChange={e => set(r,c,e.target.value)} className={`w-full bg-transparent px-2 py-2 text-xs ${r===0?'font-bold':''}`}/></td>)}</tr>)}</tbody></table><button onClick={() => onChange({ rows: [...rows, Array(rows[0]?.length || 2).fill('')] })} className="mt-2 inline-flex items-center gap-1 rounded-lg border border-line px-2.5 py-1.5 text-xs font-bold"><Plus size={12}/> Add row</button></div>; }
function LinksBlock({ block, onChange }: { block: PageBlock; onChange: (p: Partial<PageBlock>) => void }) { const links = block.links || []; return <div><p className="mb-2 text-xs font-bold text-slate-500">Internal links</p>{links.map((x,n) => <div key={n} className="mb-2 grid grid-cols-[1fr_1fr_auto] gap-2"><input value={x.label} onChange={e => onChange({ links: links.map((y,j) => j===n ? {...y,label:e.target.value}:y) })} className="input" placeholder="Link label"/><input value={x.href} onChange={e => onChange({ links: links.map((y,j) => j===n ? {...y,href:e.target.value}:y) })} className="input" placeholder="/best/forex-brokers"/><button onClick={() => onChange({ links: links.filter((_,j) => j!==n) })} className="iconbtn text-rose-500"><Trash2 size={14}/></button></div>)}<button onClick={() => onChange({ links: [...links,{label:'New link',href:'/'}] })} className="mt-1 inline-flex items-center gap-1 rounded-lg border border-line px-2.5 py-1.5 text-xs font-bold"><Plus size={12}/> Add link</button></div>; }
