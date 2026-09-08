import { Fragment, useMemo } from 'react';
import BrokerCard from './BrokerCard';
import { blocksToHtml, type PageBlock } from './PageBuilder';
import type { Broker } from '../lib/types';

type Props = {
  blocks: PageBlock[];
  brokers: Broker[];
  intent?: string;
  countrySlug?: string;
  className?: string;
};

/**
 * Public renderer for PageBuilder documents.
 *
 * Broker blocks are rendered as the real production BrokerCard component,
 * while the remaining blocks continue through the existing HTML renderer.
 * Broker IDs remain the source of truth; this component only resolves those
 * IDs against the current broker catalogue at render time.
 */
export default function PageBlocksRenderer({ blocks, brokers, intent, countrySlug, className = '' }: Props) {
  const normalized = useMemo(() => Array.isArray(blocks) ? blocks : [], [blocks]);

  return (
    <div className={className}>
      {normalized.map((block, index) => {
        if (block.type === 'broker_card') {
          const broker = brokers.find((b) => b.id === Number(block.brokerId));
          if (!broker) return null;
          return (
            <BrokerCard
              key={block.id || index}
              broker={broker}
              intent={intent}
              countrySlug={countrySlug}
            />
          );
        }

        if (block.type === 'broker_grid') {
          const selected = (block.brokerIds || [])
            .map((id) => brokers.find((b) => b.id === Number(id)))
            .filter(Boolean) as Broker[];
          if (!selected.length) return null;
          return (
            <div key={block.id || index} className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {selected.map((broker, i) => (
                <BrokerCard
                  key={`${block.id || index}-${broker.id}`}
                  broker={broker}
                  rank={i + 1}
                  intent={intent}
                  countrySlug={countrySlug}
                />
              ))}
            </div>
          );
        }

        const html = blocksToHtml([block], brokers);
        if (!html) return null;
        return <Fragment key={block.id || index}><div dangerouslySetInnerHTML={{ __html: html }} /></Fragment>;
      })}
    </div>
  );
}
