import { useMemo, useState } from 'react';
import PageBuilder, { type PageBlock } from './PageBuilder';

type BestForSection = 'introduction' | 'why_these_brokers' | 'who_its_for' | 'who_its_not_for' | 'detailed_analysis' | 'methodology';

type Props = {
  value?: unknown[];
  onChange: (blocks: PageBlock[]) => void;
  onUploadImage?: (file: File) => Promise<string>;
};

const SECTIONS: { key: BestForSection; label: string; description: string }[] = [
  { key: 'introduction', label: 'Introduction', description: 'The short answer and opening explanation before the rankings.' },
  { key: 'why_these_brokers', label: 'Why These Brokers?', description: 'Explain the evidence and trade-offs behind the shortlist.' },
  { key: 'who_its_for', label: 'Who This Is For', description: 'Explain which traders the criteria and recommendations suit.' },
  { key: 'who_its_not_for', label: 'Who This Is Not For', description: 'Explain important limitations and cases where the page may not fit.' },
  { key: 'detailed_analysis', label: 'Detailed Analysis', description: 'Long-form editorial analysis supporting the commercial decision.' },
  { key: 'methodology', label: 'Methodology', description: 'Explain how PipRank evaluates and filters the brokers on this page.' },
];

type ScopedBlock = PageBlock & { editorialSection?: BestForSection };

const sectionOf = (block: ScopedBlock): BestForSection => SECTIONS.some((section) => section.key === block.editorialSection) ? block.editorialSection! : 'introduction';

export default function BestForEditorialPageBuilder({ value, onChange, onUploadImage }: Props) {
  const allBlocks = useMemo(() => Array.isArray(value) ? value as ScopedBlock[] : [], [value]);
  const [activeSection, setActiveSection] = useState<BestForSection>('introduction');
  const active = SECTIONS.find((section) => section.key === activeSection) || SECTIONS[0];
  const activeBlocks = allBlocks.filter((block) => sectionOf(block) === activeSection);

  const replaceActiveSection = (next: PageBlock[]) => {
    const preserved = allBlocks.filter((block) => sectionOf(block) !== activeSection);
    const scoped = next.map((block) => ({ ...block, editorialSection: activeSection } as ScopedBlock));
    onChange([...preserved, ...scoped] as PageBlock[]);
  };

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-2xl border border-emerald-200 bg-white shadow-sm">
        <div className="border-b border-emerald-100 bg-emerald-50/70 px-4 py-3.5 sm:px-5">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-emerald-700">Best-For editorial sections</p>
          <h3 className="mt-1 font-display text-lg font-bold text-ink-950 sm:text-xl">Contextual PageBuilder</h3>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">Edit only the editorial zones. Rankings, eligibility and system components remain controlled by PipRank data and the page template.</p>
        </div>
        <div className="border-b border-line bg-white p-2 sm:p-3">
          <div className="flex gap-1 overflow-x-auto pb-1">
            {SECTIONS.map((section) => {
              const count = allBlocks.filter((block) => sectionOf(block) === section.key).length;
              const selected = activeSection === section.key;
              return (
                <button key={section.key} type="button" onClick={() => setActiveSection(section.key)} className={`shrink-0 rounded-xl px-3 py-2.5 text-left transition ${selected ? 'bg-ink-950 text-white shadow-soft' : 'text-slate-600 hover:bg-paper'}`}>
                  <span className="block text-xs font-bold">{section.label}</span>
                  <span className={`mt-0.5 block text-[10px] ${selected ? 'text-slate-300' : 'text-slate-400'}`}>{count} block{count === 1 ? '' : 's'}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
      <div className="rounded-2xl border border-line bg-white p-3 sm:p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-bold text-ink-900">{active.label}</p>
            <p className="text-xs text-slate-500">{active.description}</p>
          </div>
          <span className="rounded-full border border-slate-200 bg-paper px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">{activeSection}</span>
        </div>
        <PageBuilder key={activeSection} value={activeBlocks} onChange={replaceActiveSection} onUploadImage={onUploadImage} context="best-for" />
      </div>
    </div>
  );
}
