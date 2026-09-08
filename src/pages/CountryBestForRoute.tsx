import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { fetchContentDocument } from '../lib/api';
import { getCountrySeoTopic } from '../data/countrySeoTopics';
import CountrySeoTopic from './CountrySeoTopic';
import CountryPathRouter from './CountryPathRouter';

/**
 * Canonical country Best-For URLs are owned by content_documents using the
 * country-topic:{country}:{canonical-topic} key. The legacy country_best_for
 * table is compatibility data only and must never win route ownership.
 */
export default function CountryBestForRoute() {
  const { countrySlug, topicSlug } = useParams<{ countrySlug: string; topicSlug: string }>();
  const [state, setState] = useState<'loading' | 'topic' | 'fallback'>('loading');

  useEffect(() => {
    if (!countrySlug || !topicSlug) {
      setState('fallback');
      return;
    }
    let active = true;
    setState('loading');
    const topic = getCountrySeoTopic(topicSlug);
    if (!topic) {
      setState('fallback');
      return;
    }
    fetchContentDocument(`country-topic:${countrySlug}:${topic.slug}`)
      .then((doc) => {
        if (!active) return;
        setState(doc?.published && doc.content_type === 'country-topic' ? 'topic' : 'fallback');
      })
      .catch(() => { if (active) setState('fallback'); });
    return () => { active = false; };
  }, [countrySlug, topicSlug]);

  if (state === 'loading') {
    return <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6"><div className="h-48 animate-pulse rounded-3xl border border-line bg-white" /></div>;
  }

  return state === 'topic' ? <CountrySeoTopic /> : <CountryPathRouter />;
}
