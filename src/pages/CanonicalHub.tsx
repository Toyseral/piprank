import { Component, useEffect, useState, type ErrorInfo, type ReactNode } from 'react';
import { useLocation, Navigate } from 'react-router-dom';
import type { CanonicalRoute } from '../lib/canonicalHub/types';
import { resolveCanonicalPath } from '../lib/canonicalHub/resolver';
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
class CanonicalErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError(): { hasError: boolean } { return { hasError: true }; }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Canonical route render failure', error, info);
  }
  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="mx-auto max-w-3xl px-4 py-24 text-center sm:px-6">
        <h1 className="font-display text-3xl font-bold text-ink-950">This page could not be loaded</h1>
        <p className="mt-3 text-sm leading-6 text-slate-500">The page encountered an unexpected rendering error. Refresh the page to try again.</p>
        <button type="button" onClick={() => window.location.reload()} className="mt-7 inline-flex rounded-xl bg-ink-950 px-5 py-3 text-sm font-bold text-white">Refresh page</button>
      </div>
    );
  }
}


export default function CanonicalHub() {
  const { pathname } = useLocation();
  const [state, setState] = useState<'loading' | 'resolved' | 'missing'>('loading');
  const [route, setRoute] = useState<CanonicalRoute | null>(null);

  useEffect(() => {
    let active = true;
    setState('loading');
    setRoute(null);
    resolveCanonicalPath(pathname).then((resolved) => {
      if (!active) return;
      if (!resolved) {
        setState('missing');
        return;
      }
      setRoute(resolved);
      setState('resolved');
    }).catch((error) => {
      console.error('Canonical route resolution failure', { pathname, error });
      if (active) setState('missing');
    });
    return () => { active = false; };
  }, [pathname]);

  useSEO(
    state === 'missing'
      ? { title: 'Page not found | PipRank', description: 'The requested PipRank page does not exist.', path: pathname, type: 'website', noindex: true }
      : null
  );

  if (state === 'loading') return <Loading />;
  if (state === 'missing' || !route) return <NotFound />;
  if (route.type === 'country' && route.path.startsWith('/countries/')) {
    return <Navigate to={`/${route.slug}`} replace />;
  }

  return (
    <CanonicalErrorBoundary>
      {(() => {
        switch (route.type) {
          case 'global-best-for':
            return <CanonicalGlobalBestFor route={route} />;
          case 'guide':
          case 'country-guide':
          case 'country-best-for':
          case 'localized-guide':
          case 'localized-best-for':
            return <ContentRenderer route={route} />;
          case 'broker':
            return route.path === '/brokers' ? <Brokers /> : <BrokerDetailNew />;
          case 'country':
            return route.path === '/countries' ? <Countries /> : <CountryDetail route={route} />;
          case 'compare':
            return route.path === '/compare' ? <Compare /> : <ComparePair />;
          default:
            return <NotFound />;
        }
      })()}
    </CanonicalErrorBoundary>
  );
}
