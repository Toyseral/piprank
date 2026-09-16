import { useEffect, useState, type ReactNode } from 'react';
import type { Broker, ContentDocument } from '../lib/types';
import { fetchContentDocument } from '../lib/api';
import PageBlocksRenderer from './PageBlocksRenderer';
import type { PageBlock } from './PageBuilder';

type Section = 'editorial' | 'pricing' | 'platforms' | 'trust' | 'accounts' | 'funding';

type Props = {
  broker: Broker;
  section: Section;
  fallback?: ReactNode;
};

export default function BrokerEditorialSection({ broker, section, fallback }: Props) {
  const [document, setDocument] = useState<ContentDocument | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    setLoaded(false);
    fetchContentDocument(`broker:${broker.slug}:main`)
      .then((doc) => {
        if (!active) return;
        setDocument(doc?.published ? doc : null);
        setLoaded(true);
      })
      .catch(() => {
        if (!active) return;
        setDocument(null);
        setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, [broker.slug]);

  const blocks = Array.isArray(document?.blocks)
    ? (document.blocks as PageBlock[]).filter((block: any) => block?.type !== 'structured_broker_data')
    : [];

  if (!loaded || !blocks.length) return fallback ? <>{fallback}</> : null;

  return <PageBlocksRenderer blocks={blocks} brokers={[broker]} editorialSection={section} />;
}
