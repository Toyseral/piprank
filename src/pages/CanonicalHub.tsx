import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import type { CanonicalRoute } from '../lib/canonicalHub/types';
import { resolveCanonicalPath } from '../lib/canonicalHub/resolver';
import { useSEO } from '../hooks/useSEO';
import BestFor from './BestFor';
import BrokerDetail from './BrokerDetail';
import Brokers from './Brokers';
import Compare from './Compare';
import ComparePair from './ComparePair';
import Countries from './Countries';
import CountryDetail from './CountryDetail';
import GuideDetail from './GuideDetail';
import GuideTopic from './GuideTopic';
import Guides from './Guides';
import NotFound from './NotFound';

function Loading() {
  return <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6"><div className="h-48 animate-pulse rounded-3xl border border-line bg-white" /></div>;
}

function routeMatchesNamespace(pathname: string, route: CanonicalRoute): boolean {
  const segments = pathname.slice(1).split('/').filter(Boolean);
  if (segments.length === 3 && segments[1] === 'guides') {
    return route.type === 'country-guide';
  }
  if (segments.length === 2 && segments[0] !== 'guides' && segments[0] !== 'brokers' && segments[0] !== 'compare') {
    return route.type === 'country-best-for';
  }
  return true;
}

export default function CanonicalHub() {
  const { pathname } = useLocation();
  const [state, setState] = useState<'loading' | 'resolved' | 'missing'>('loading');
  const [route, setRoute] = useState<CanonicalRoute | null>(null);

  useEffect(() => {
    let active = true;
    setState('loading');
    setRoute(null);
    resolveCanonicalPath(pathname)
      .then((resolved) => {
        if (!active) return;
        if (!resolved) {
          setState('missing');
          return;
        }
        if (!routeMatchesNamespace(pathname, resolved)) {
          setState('missing');
          return;
        }
        setRoute(resolved);
        setState('resolved');
      })
      .catch(() => {
        if (active) setState('missing');
      });
    return () => { active = false; };
  }, [pathname]);

  useSEO(
    state === 'missing'
      ? {
          title: 'Page not found | PipRank',
          description: 'The requested PipRank page does not exist.',
          path: pathname,
          type: 'website',
          noindex: true,
        }
      : null,
  );

  if (state === 'loading') return <Loading />;
  if (state === 'missing' || !route) return <NotFound />;
  if (route.canonicalPath !== route.path) return <Navigate replace to={route.canonicalPath} />;

  switch (route.type) {
    case 'global-best-for':
    case 'country-best-for':
      return <BestFor />;
    case 'guide':
      return route.path === '/guides' ? <Guides /> : <GuideDetail />;
    case 'country-guide':
      return <GuideTopic />;
    case 'broker':
      return route.path === '/brokers' ? <Brokers /> : <BrokerDetail />;
    case 'country':
      return route.path === '/countries' ? <Countries /> : <CountryDetail />;
    case 'compare':
      return route.path === '/compare' ? <Compare /> : <ComparePair />;
    default:
      return <NotFound />;
  }
}
