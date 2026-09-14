import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import type { CanonicalRoute } from '../lib/canonicalHub/types';
import { resolveCanonicalPath } from '../lib/canonicalHub/resolver';
import { useSEO } from '../hooks/useSEO';
import ContentRenderer from '../components/ContentRenderer';
import BrokerDetail from './BrokerDetail';
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
  useEffect(() => { let active = true; setState('loading'); setRoute(null); resolveCanonicalPath(pathname).then(resolved => { if (!active) return; if (!resolved) { setState('missing'); return; } setRoute(resolved); setState('resolved'); }).catch(() => { if (active) setState('missing'); }); return () => { active = false; }; }, [pathname]);
  useSEO(state === 'missing' ? { title: 'Page not found | PipRank', description: 'The requested PipRank page does not exist.', path: pathname, type: 'website', noindex: true } : null);
  if (state === 'loading') return <Loading />;
  if (state === 'missing' || !route) return <NotFound />;
  switch (route.type) {
    case 'global-best-for':
    case 'guide':
    case 'localized-guide':
    case 'country-guide':
    case 'country-topic':
    case 'localized-seo':
      return <ContentRenderer route={route} />;
    case 'broker':
      return route.path === '/brokers' ? <Brokers /> : <BrokerDetail />;
    case 'country':
      return route.path === '/countries' || route.path.startsWith('/countries/') ? <CountryDetail /> : <Countries />;
    case 'compare':
      return route.path === '/compare' ? <Compare /> : <ComparePair />;
    default:
      return <NotFound />;
  }
}
