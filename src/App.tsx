import { lazy, Suspense } from 'react';
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom';
import { Analytics } from '@vercel/analytics/react';
import Footer from './components/Footer';
import Navbar from './components/Navbar';
import ScrollToTop from './components/ScrollToTop';
import Home from './pages/Home';
import NotFound from './pages/NotFound';
import { GeoProvider } from './lib/GeoContext';
import { GLOBAL_TOPIC_PATHS } from './lib/topicPaths';

// Lazy-loaded so the framer-motion chunk it depends on isn't forced onto
// every page's initial load — SmartCTA only appears after scroll/exit-intent
// triggers anyway, so a brief async load has no visible cost.
const SmartCTA = lazy(() => import('./components/SmartCTA'));

const About = lazy(() => import('./pages/About'));
const Admin = lazy(() => import('./pages/Admin'));
const Authors = lazy(() => import('./pages/Authors'));
const BestFor = lazy(() => import('./pages/BestFor'));
const BrokerDetail = lazy(() => import('./pages/BrokerDetail'));
const Brokers = lazy(() => import('./pages/Brokers'));
const Compare = lazy(() => import('./pages/Compare'));
const ComparePair = lazy(() => import('./pages/ComparePair'));
const Countries = lazy(() => import('./pages/Countries'));
const CountryDetail = lazy(() => import('./pages/CountryDetail'));
const CountrySeoTopic = lazy(() => import('./pages/CountrySeoTopic'));
const LocalizedCountrySeoTopic = lazy(() => import('./pages/LocalizedCountrySeoTopic'));
const GuideDetail = lazy(() => import('./pages/GuideDetail'));
const Guides = lazy(() => import('./pages/Guides'));
const Methodology = lazy(() => import('./pages/Methodology'));
const GuideTopic = lazy(() => import('./pages/GuideTopic'));
const Promotions = lazy(() => import('./pages/Promotions'));
const Quiz = lazy(() => import('./pages/Quiz'));
const Tools = lazy(() => import('./pages/Tools'));

function RouteLoader() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="h-9 w-9 animate-spin rounded-full border-2 border-line border-t-emerald-500" />
    </div>
  );
}

export function Shell() {
  const { pathname } = useLocation();
  const bare = pathname.startsWith('/archypage');

  return (
    <div className="flex min-h-screen flex-col bg-paper text-ink-900">
      {!bare && <Navbar />}
      <main className={bare ? '' : 'flex-1'}>
        <Suspense fallback={<RouteLoader />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/brokers" element={<Brokers />} />
            <Route path="/brokers/:slug" element={<BrokerDetail />} />
            <Route path="/:countrySlug/brokers/:slug" element={<BrokerDetail />} />
            <Route path="/compare" element={<Compare />} />
            <Route path="/compare/:pair" element={<ComparePair />} />
            <Route path="/quiz" element={<Quiz />} />
            <Route path="/tools" element={<Tools />} />
            <Route path="/guides" element={<Guides />} />
            <Route path="/guides/:slug" element={<GuideDetail />} />
            <Route path="/methodology" element={<Methodology />} />
            <Route path="/about" element={<About />} />
            <Route path="/authors" element={<Authors />} />
            {/* Flat global ranking URLs e.g. /forex-brokers-for-beginners */}
            {GLOBAL_TOPIC_PATHS.map((topicPath) => (
              <Route key={topicPath} path={`/${topicPath}`} element={<BestFor />} />
            ))}
            {/* Legacy /best/:slug kept for SPA fallback; vercel 301s preferred paths */}
            <Route path="/best/:slug" element={<BestFor />} />
            <Route path="/countries/:countrySlug/best/:slug" element={<BestFor />} />
            <Route path="/:countrySlug/guides/:slug" element={<GuideTopic />} />
            <Route path="/countries" element={<Countries />} />
            <Route path="/countries/:slug" element={<CountryDetail />} />
            <Route path="/promotions" element={<Promotions />} />
            <Route path="/archypage" element={<Admin />} />
            <Route path="/:countrySlug/:locale/:topicSlug" element={<LocalizedCountrySeoTopic />} />
            <Route path="/:countrySlug/:topicSlug" element={<CountrySeoTopic />} />
            <Route path="/:slug" element={<CountryDetail />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </main>
      {!bare && <Footer />}
      {!bare && (
        <Suspense fallback={null}>
          <SmartCTA />
        </Suspense>
      )}
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <GeoProvider>
        <ScrollToTop />
        <Shell />
      </GeoProvider>
      <Analytics />
    </BrowserRouter>
  );
}
