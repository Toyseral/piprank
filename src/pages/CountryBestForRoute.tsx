import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getCountrySeoTopic } from '../data/countrySeoTopics';
import { fetchCanonicalCountryTopic } from '../lib/canonicalContent';
import { useSEO } from '../hooks/useSEO';
import CountrySeoTopic from './CountrySeoTopic';
import NotFound from './NotFound';

/**
 * Canonical country Best-For URLs are owned by published content_documents
 * using the country-topic:{country}:{canonical-topic} key. Missing or
 * unpublished documents are not allowed to fall back to a static template.
 */
export default function CountryBestForRoute() {
  const { countrySlug, topicSlug } = useParams<{ countrySlug: string; topicSlug: string }>();
  const [state, setState] = useState<'loading' | 'topic' | 'missing'>('loading');

  useEffect(() => {
    if (!countrySlug || !topicSlug) {
      setState('missing');
      return;
    }
    let active = true;
    setState('loading');
    const topic = getCountrySeoTopic(topicSlug);
    if (!topic) {
      setState('missing');
      return;
    }
    fetchCanonicalCountryTopic(countrySlug, topic.slug)
      .then((doc) => {
        if (!active) return;
        setState(doc ? 'topic' : 'missing');
      })
      .catch(() => { if (active) setState('missing'); });
    return () => { active = false; };
  }, [countrySlug, topicSlug]);

  useSEO(
    state === 'missing'
      ? {
          title: 'Page not found | PipRank',
          description: 'The requested PipRank page does not exist.',
          path: `/${countrySlug ?? ''}/${topicSlug ?? ''}`,
          type: 'website',
          noindex: true,
        }
      : null,
  );

  if (state === 'loading') {
    return <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6"><div className="h-48 animate-pulse rounded-3xl border border-line bg-white" /></div>;
  }

  return state === 'topic' ? <CountrySeoTopic /> : <NotFound />;
}
