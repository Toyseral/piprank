import { Fragment, useMemo } from 'react';
import BrokerCard from './BrokerCard';
import PipRankVerdictCard from './PipRankVerdictCard';
import PipRankComparisonTable from './PipRankComparisonTable';
import StructuredBrokerDataCard from './StructuredBrokerDataCard';
import { blocksToHtml, type PageBlock } from './PageBuilder';
import type { Broker } from '../lib/types';
import { fmtMoney } from '../lib/format';

type Props = {
  blocks: PageBlock[];
  brokers: Broker[];
  intent?: string;
  countrySlug?: string;
  className?: string;
  zone?: string;
  excludeZone?: string;
  editorialSection?: string;
};

function BrokerAtAGlance({ broker }: { broker: Broker }) {
  const rows = [
    ['Minimum deposit', fmtMoney(broker.min_deposit)],
    ['EUR/USD spread', `${broker.spread_eurusd} pips`],
    ['Commission', broker.commission || '—'],
    ['Platforms', broker.platforms.join(' · ') || '—'],
    ['Founded', String(broker.founded || '—')],
    ['Headquarters', broker.headquarters || '—'],
  ];
  return (
    <section className="scroll-mt-28 rounded-3xl border border-line bg-white p-6 sm:p-8">
      <p className="text-xs font-bold uppercase tracking-widest text-emerald-700">Overview</p>
      <h2 className="mt-1 font-display text-2xl font-bold text-ink-900">{broker.name} at a glance</h2>
      <div className="mt-5 overflow-hidden rounded-2xl border border-line">
        {rows.map(([label, value], i) => (
          <div key={label} className={`flex flex-col gap-1 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between ${i % 2 === 0 ? 'bg-paper/70' : 'bg-white'}`}>
            <span className="text-sm font-medium text-slate-500">{label}</span>
            <span className="text-sm font-bold text-ink-900">{value}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function normalizeRichTextHtml(html: string) {
  const trimmed = html.trim();
  if (!trimmed) return '';
  const hasBlockMarkup = /<(p|h[1-6]|ul|ol|blockquote|table|figure|hr|div|section|aside)\b/i.test(trimmed);
  if (hasBlockMarkup) return trimmed;
  return `<p>${trimmed}</p>`;
}

export default function PageBlocksRenderer({ blocks, brokers, intent, countrySlug, className = '', zone, excludeZone, editorialSection }: Props) {
  const normalized = useMemo(
    () => (Array.isArray(blocks) ? blocks : []).filter((block: any) => {
      const blockZone = typeof block?.zone === 'string' ? block.zone : undefined;
      if (zone && blockZone !== zone) return false;
      if (excludeZone && blockZone === excludeZone) return false;

      const blockSection = typeof block?.editorialSection === 'string' ? block.editorialSection : undefined;
      if (blockSection) return blockSection === (editorialSection ?? 'editorial');
      if (editorialSection === 'introduction') return true;
      return editorialSection === undefined || editorialSection === 'editorial';
    }),
    [blocks, zone, excludeZone, editorialSection],
  );

  return (
    <div className={`${className} space-y-7`}>
      {normalized.map((block, index) => {
        if (block.type === 'structured_broker_data') {
          const broker = brokers.find((b) => b.id === Number(block.brokerId));
          if (!broker) return null;
          if (block.section === 'overview') return <BrokerAtAGlance key={block.id || index} broker={broker} />;
          return <StructuredBrokerDataCard key={block.id || index} broker={broker} section={block.section} editorialHtml={block.html} />;
        }
        if (block.type === 'broker_card') {
          const broker = brokers.find((b) => b.id === Number(block.brokerId));
          if (!broker) return null;
          return <BrokerCard key={block.id || index} broker={broker} intent={intent} countrySlug={countrySlug} />;
        }
        if (block.type === 'broker_grid') {
          const selected = (block.brokerIds || []).map((id) => brokers.find((b) => b.id === Number(id))).filter(Boolean) as Broker[];
          if (!selected.length) return null;
          return <div key={block.id || index} className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{selected.map((broker, i) => <BrokerCard key={`${block.id || index}-${broker.id}`} broker={broker} rank={i + 1} intent={intent} countrySlug={countrySlug} />)}</div>;
        }
        if (block.type === 'comparison_table') {
          const selected = (block.brokerIds || []).map((id) => brokers.find((b) => b.id === Number(id))).filter(Boolean) as Broker[];
          if (selected.length < 2) return null;
          return <PipRankComparisonTable key={block.id || index} brokers={selected} fields={block.fields} title={block.title} showCta={block.showCta === true || Boolean(block.ctaLabel)} />;
        }
        if (block.type === 'piprank_verdict') {
          const broker = brokers.find((b) => b.id === Number(block.brokerId));
          if (!broker) return null;
          return <PipRankVerdictCard key={block.id || index} broker={broker} headline={block.headline} text={block.html?.replace(/<[^>]+>/g, '').trim() || undefined} showCta={block.showCta !== false} />;
        }
        const html = normalizeRichTextHtml(blocksToHtml([block], brokers));
        if (!html) return null;
        return (
          <Fragment key={block.id || index}>
            <div className="prose prose-slate max-w-none text-[15px] leading-7 [&_p]:my-0 [&_p+p]:mt-6 [&_h2]:mt-10 [&_h2]:mb-3 [&_h3]:mt-7 [&_h3]:mb-2 [&_ul]:my-5 [&_ol]:my-5 [&_li]:my-1.5 [&_blockquote]:my-7 [&_table]:my-7" dangerouslySetInnerHTML={{ __html: html }} />
          </Fragment>
        );
      })}
    </div>
  );
}
