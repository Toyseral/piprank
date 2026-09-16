import { Fragment, useMemo } from 'react';
import BrokerCard from './BrokerCard';
import PipRankVerdictCard from './PipRankVerdictCard';
import PipRankComparisonTable from './PipRankComparisonTable';
import StructuredBrokerDataCard from './StructuredBrokerDataCard';
import { blocksToHtml, type PageBlock } from './PageBuilder';
import type { Broker } from '../lib/types';

type Props = {
  blocks: PageBlock[];
  brokers: Broker[];
  intent?: string;
  countrySlug?: string;
  className?: string;
  zone?: string;
  excludeZone?: string;
};

export default function PageBlocksRenderer({ blocks, brokers, intent, countrySlug, className = '', zone, excludeZone }: Props) {
  const normalized = useMemo(
    () => (Array.isArray(blocks) ? blocks : []).filter((block: any) => {
      const blockZone = typeof block?.zone === 'string' ? block.zone : undefined;
      if (zone && blockZone !== zone) return false;
      if (excludeZone && blockZone === excludeZone) return false;
      return true;
    }),
    [blocks, zone, excludeZone],
  );

  return (
    <div className={className}>
      {normalized.map((block, index) => {
        if (block.type === 'structured_broker_data') {
          const broker = brokers.find((b) => b.id === Number(block.brokerId));
          if (!broker) return null;
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
        const html = blocksToHtml([block], brokers);
        if (!html) return null;
        return (
          <Fragment key={block.id || index}>
            <div className="prose prose-slate max-w-none text-[15px] leading-7 text-slate-700 [&_h2]:font-display [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:text-ink-950 [&_h2]:tracking-tight [&_h3]:font-display [&_h3]:text-xl [&_h3]:font-bold [&_h3]:text-ink-950 [&_h3]:tracking-tight [&_a]:font-semibold [&_a]:text-emerald-700 [&_table]:w-full [&_img]:rounded-2xl">
              <div dangerouslySetInnerHTML={{ __html: html }} />
            </div>
          </Fragment>
        );
      })}
    </div>
  );
}
