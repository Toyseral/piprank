import { Fragment, useMemo } from 'react';
import BrokerCard from './BrokerCard';
import PipRankVerdictCard from './PipRankVerdictCard';
import PipRankComparisonTable from './PipRankComparisonTable';
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
          return <PipRankComparisonTable key={block.id || index} brokers={selected} fields={block.fields} title={block.title} ctaLabel={block.ctaLabel} showCta={block.showCta === true || Boolean(block.ctaLabel)} />;
        }
        if (block.type === 'piprank_verdict') {
          const broker = brokers.find((b) => b.id === Number(block.brokerId));
          if (!broker) return null;
          return <PipRankVerdictCard key={block.id || index} broker={broker} headline={block.headline} text={block.html?.replace(/<[^>]+>/g, '').trim() || undefined} showCta={block.showCta !== false} />;
        }
        const html = blocksToHtml([block], brokers);
        if (!html) return null;
        return <Fragment key={block.id || index}><div dangerouslySetInnerHTML={{ __html: html }} /></Fragment>;
      })}
    </div>
  );
}
