import { useMemo, useState } from 'react';
import PageBuilder, { type PageBlock } from './PageBuilder';
import type { Broker } from '../lib/types';

type BestForSection = 'introduction' | 'why_these_brokers' | 'who_its_for' | 'who_its_not_for' | 'detailed_analysis' | 'methodology';
type Props = { value?: unknown[]; onChange: (blocks: PageBlock[]) => void; onUploadImage?: (file: File) => Promise<string>; brokers?: Broker[]; analysisBrokers?: Broker[] };
type ScopedBlock = PageBlock & { editorialSection?: string };

const BASE_SECTIONS: { key: BestForSection; label: string; description: string }[] = [
  { key: 'introduction', label: 'Introduction', description: 'Opening explanation before the rankings.' },
  { key: 'why_these_brokers', label: 'Why These Brokers?', description: 'Explain the evidence and trade-offs behind the shortlist.' },
  { key: 'who_its_for', label: 'Who This Is For', description: 'Explain which traders the recommendations suit.' },
  { key: 'who_its_not_for', label: 'Who This Is Not For', description: 'Explain important limitations and cases where the page may not fit.' },
  { key: 'detailed_analysis', label: 'Additional Analysis', description: 'General long-form editorial analysis for the page.' },
  { key: 'methodology', label: 'Methodology Notes', description: 'Optional supporting notes. The canonical methodology page remains the source of truth.' },
  { key: 'additional', label: 'Additional Content', description: 'Supporting editorial content migrated from the legacy Best-For section store.' },
];

const sectionOf = (block: ScopedBlock) => block.editorialSection || 'introduction';
const isCopyBlock = (block: ScopedBlock) => String(block.id || '').startsWith('bestfor-copy:');
const isBrokerKey = (key: string) => key.startsWith('broker:');
const brokerSlugFromKey = (key: string) => isBrokerKey(key) ? key.slice('broker:'.length) : '';

export default function BestForEditorialPageBuilder({ value, onChange, onUploadImage, analysisBrokers = [] }: Props) {
  const allBlocks = useMemo(() => Array.isArray(value) ? value as ScopedBlock[] : [], [value]);
  const sections = useMemo(() => [
    ...BASE_SECTIONS,
    ...analysisBrokers.slice(0, 9).map((broker, index) => ({ key: `broker:${broker.slug}`, label: `${index + 1}. ${broker.name}`, description: `Editorial analysis displayed inside the ${broker.name} recommendation module.` })),
  ], [analysisBrokers]);
  const [activeSection, setActiveSection] = useState<string>('introduction');
  const active = sections.find((section) => section.key === activeSection) || sections[0];
  const activeBlocks = useMemo(() => {
    if (isBrokerKey(activeSection)) {
      const slug = brokerSlugFromKey(activeSection);
      return allBlocks.filter((block) => block.editorialSection === 'detailed_analysis' && String(block.id || '').startsWith(`bestfor-broker:${slug}:`));
    }
    return allBlocks.filter((block) => sectionOf(block) === activeSection && !String(block.id || '').startsWith('bestfor-broker:') && !isCopyBlock(block));
  }, [activeSection, allBlocks]);

  const replaceActiveSection = (next: PageBlock[]) => {
    if (isBrokerKey(activeSection)) {
      const slug = brokerSlugFromKey(activeSection);
      const prefix = `bestfor-broker:${slug}:`;
      const preserved = allBlocks.filter((block) => !(block.editorialSection === 'detailed_analysis' && String(block.id || '').startsWith(prefix)));
      const scoped = next.map((block) => {
        const rawId = String((block as ScopedBlock).id || `b_${Date.now()}`);
        const id = rawId.startsWith(prefix) ? rawId : `${prefix}${rawId}`;
        return { ...block, id, editorialSection: 'detailed_analysis' } as ScopedBlock;
      });
      onChange([...preserved, ...scoped] as PageBlock[]);
      return;
    }
    const preserved = allBlocks.filter((block) => sectionOf(block) !== activeSection);
    const scoped = next.map((block) => ({ ...block, editorialSection: activeSection } as ScopedBlock));
    onChange([...preserved, ...scoped] as PageBlock[]);
  };

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-2xl border border-emerald-200 bg-white shadow-sm">
        <div className="border-b border-emerald-100 bg-emerald-50/70 px-4 py-3.5 sm:px-5">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-emerald-700">Best-For page editor</p>
          <h3 className="mt-1 font-display text-lg font-bold text-ink-950 sm:text-xl">Structured template + PageBuilder</h3>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">Template sections, rankings and broker data stay controlled by PipRank. PageBuilder supplies the editorial content.</p>
        </div>
        <div className="border-b border-line bg-white p-2 sm:p-3">
          <div className="flex gap-1 overflow-x-auto pb-1">
            {sections.map((section) => {
              const count = isBrokerKey(section.key)
                ? allBlocks.filter((block) => block.editorialSection === 'detailed_analysis' && String(block.id || '').startsWith(`bestfor-broker:${brokerSlugFromKey(section.key)}:`)).length
                : allBlocks.filter((block) => sectionOf(block) === section.key && !String(block.id || '').startsWith('bestfor-broker:') && !isCopyBlock(block)).length;
              const selected = activeSection === section.key;
              const isBroker = isBrokerKey(section.key);
              return <button key={section.key} type="button" onClick={() => setActiveSection(section.key)} className={`shrink-0 rounded-xl px-3 py-2.5 text-left transition ${selected ? 'bg-ink-950 text-white shadow-soft' : isBroker ? 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100' : 'text-slate-600 hover:bg-paper'}`}><span className="block text-xs font-bold">{section.label}</span><span className={`mt-0.5 block text-[10px] ${selected ? 'text-slate-300' : 'text-slate-400'}`}>{count} block{count === 1 ? '' : 's'}</span></button>;
            })}
          </div>
        </div>
      </div>
      <div className="rounded-2xl border border-line bg-white p-3 sm:p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><div><p className="text-sm font-bold text-ink-900">{active.label}</p><p className="text-xs text-slate-500">{active.description}</p></div><span className="rounded-full border border-slate-200 bg-paper px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">{isBrokerKey(activeSection) ? 'broker editorial' : activeSection}</span></div>
        <PageBuilder key={activeSection} value={activeBlocks} onChange={replaceActiveSection} onUploadImage={onUploadImage} context="best-for" />
      </div>
    </div>
  );
}
