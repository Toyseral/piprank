import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { fetchCountryBestFor } from '../lib/api';
import BestFor from './BestFor';
import CountryPathRouter from './CountryPathRouter';

/**
 * Country Best-For pages are stored in country_best_for, while the generic
 * country topic matrix uses the same two-segment URL shape. Resolve the
 * database-backed page first; only fall back to the generic topic router when
 * no country_best_for record exists.
 */
export default function CountryBestForRoute() {
  const { countrySlug, topicSlug } = useParams<{ countrySlug: string; topicSlug: string }>();
  const [state, setState] = useState<'loading' | 'best-for' | 'topic'>('loading');

  useEffect(() => {
    if (!countrySlug || !topicSlug) {
      setState('topic');
      return;
    }
    let active = true;
    setState('loading');
    fetchCountryBestFor(countrySlug, topicSlug)
      .then(() => { if (active) setState('best-for'); })
      .catch(() => { if (active) setState('topic'); });
    return () => { active = false; };
  }, [countrySlug, topicSlug]);

  if (state === 'loading') {
    return <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6"><div className="h-48 animate-pulse rounded-3xl border border-line bg-white" /></div>;
  }

  return state === 'best-for' ? <BestFor /> : <CountryPathRouter />;
}
