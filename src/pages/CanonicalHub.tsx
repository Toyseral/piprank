import { useEffect, useState } from 'react';
import { useLocation, Navigate } from 'react-router-dom';
import type { CanonicalRoute } from '../lib/canonicalHub/types';
import { resolveCanonicalPath } from '../lib/canonicalHub/resolver';
import { fetchCountry } from '../lib/api';
import { useSEO } from '../hooks/useSEO';
import ContentRenderer from '../components/ContentRenderer';
import CanonicalGlobalBestFor from '../components/CanonicalGlobalBestFor';
import BrokerDetailNew from './BrokerDetailNew';
import Brokers from './Brokers';
import Compare from './Compare';
import ComparePair from './ComparePair';
import Countries from './Countries';
import CountryDetail from './CountryDetail';
import NotFound from './NotFound';

function Loading() { return <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6"><div className="h-48 animate-pulse rounded-3xl border border-line bg-white" /></div>; }

export default function CanonicalHub() {
  const { pathname } = useLocation();
  const [state, setState] = useState<'loading' | 'resolved' | 'missing'>('loading');
  const [route, setRoute] = useState<CanonicalRoute | null>(null);
  useEffect(() => {
    let active = true;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    setState('loading'); setRoute(null);
    const resolve = async () => {
      const first = await resolveCanonicalPath(pathname).catch(() => null);
      if (first) return first;
      await new Promise<void>((resolveDelay) => { retryTimer = setTimeout(resolveDelay, 350); });
      const second = await resolveCanonicalPath(pathname).catch(() => null);
      if (second) return second;
      const match = pathname.match(/^\/([^/]+)\/?$/);
      if (!match) return null;
      const slug = decodeURIComponent(match[1]).trim().toLowerCase();
      if (!slug || ['guides', 'brokers', 'compare', 'countries'].includes(slug)) return null;
      const country = await fetchCountry(slug).catch(() => null);
      if (!country || country.publishing_state !== 'published') return null;
      return {
        type: 'country',
        path: pathname,
        canonicalPath: `/${encodeURIComponent(country.slug)}`,
        slug: country.slug,
        indexable: true,
        published: true,
      } as CanonicalRoute;
    };
    resolve().then((resolved) => {
      if (!active) return;
      if (!resolved) { setState('missing'); return; }
      setRoute(resolved); setState('resolved');
    });
    return () => { active = false; if (retryTimer) clearTimeout(retryTimer); };
  }, [pathname]);
  useSEO(state === 'missing' ? { title: 'Page not found | PipRank', description: 'The requested PipRank page does not exist.', path: pathname, type: 'website', noindex: true } : null);
  if (state === 'loading') return <Loading />;
  if (state === 'missing' || !route) return <NotFound />;
  if (route.type === 'country' && route.path.startsWith('/countries/')) return <Navigate to={`/${route.slug}`} replace />;
  switch (route.type) {
    case 'global-best-for': return <CanonicalGlobalBestFor route={route} />;
    case 'guide':
    case 'country-guide':
    case 'country-best-for':
    case 'localized-guide':
    case 'localized-best-for':
      return <ContentRenderer route={route} />;
    case 'broker': return route.path === '/brokers' ? <Brokers /> : <BrokerDetailNew />;
    case 'country': return route.path === '/countries' ? <Countries /> : <CountryDetail />;
    case 'compare': return route.path === '/compare' ? <Compare /> : <ComparePair />;
    default: return <NotFound />;
  }
}
