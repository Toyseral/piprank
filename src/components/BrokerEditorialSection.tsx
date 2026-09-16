import { useEffect, useState } from 'react';
import type { Broker, ContentDocument } from '../lib/types';
import { fetchContentDocument } from '../lib/api';
import PageBlocksRenderer from './PageBlocksRenderer';
import type { PageBlock } from './PageBuilder';

type Section = 'editorial' | 'pricing' | 'platforms' | 'trust' | 'accounts' | 'funding';

type Props = {
  broker: Broker;
  section: Section;
};

export default function BrokerEditorialSection({ broker, section }: Props) {
  const [document, setDocument] = useState<ContentDocument | null>(null);

  useEffect(() => {
    let active = true;
    fetchContentDocument(`broker:${broker.slug}:main`)
      .then((doc) => {
        if (active) setDocument(doc?.published ? doc : null);
      })
      .catch(() => {
        if (active) setDocument(null);
      });
    return () => {
      active = false;
    };
  }, [broker.slug]);

  const blocks = Array.isArray(document?.blocks)
    ? (document.blocks as PageBlock[]).filter((block: any) => block?.type !== 'structured_broker_data')
    : [];

  if (!blocks.length) return null;

  return <PageBlocksRenderer blocks={blocks} brokers={[broker]} editorialSection={section} />;
}
