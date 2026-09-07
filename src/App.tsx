import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom';
import Footer from './components/Footer';
import Navbar from './components/Navbar';
import ScrollToTop from './components/ScrollToTop';
import Home from './pages/Home';
import NotFound from './pages/NotFound';
import { GeoProvider } from './lib/GeoContext';

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

const GLOBAL_INTENT_SLUGS = [
  'forex-brokers-for-beginners',
  'low-spread-forex-brokers',
  'mt5-forex-brokers',
  'mt4-forex-brokers',
  'gold-forex-brokers',
  'ecn-forex-brokers',
  'copy-trading-forex-brokers',
  'forex-brokers-for-scalping',
  'forex-brokers-for-swing-trading',
  'high-leverage-forex-brokers',
] as const;

const LEGACY_GLOBAL_INTENT_TO_NEW: Record<string, string> = {
  beginners: 'forex-brokers-for-beginners',
  'low-spread': 'low-spread-forex-brokers',
  mt5: 'mt5-forex-brokers',
  mt4: 'mt4-forex-brokers',
  gold: 'gold-forex-brokers',
  ecn: 'ecn-forex-brokers',
  'copy-trading': 'copy-trading-forex-brokers',
  scalping: 'forex-brokers-for-scalping',
  'swing-trading': 'forex-brokers-for-swing-trading',
  'high-leverage': 'high-leverage-forex-brokers',
};

const LEGACY_COUNTRY_INTENT_TO_NEW: Record<string, string> = {
  ...LEGACY_GLOBAL_INTENT_TO_NEW,
  'forex-brokers-for-beginners': 'forex-brokers-for-beginners',
  'low-spread-forex-brokers': 'low-spread-forex-brokers',
  'mt5-forex-brokers': 'mt5-forex-brokers',
  'mt4-forex-brokers': 'mt4-forex-brokers',
  'gold-forex-brokers': 'gold-forex-brokers',
  'ecn-forex-brokers': 'ecn-forex-brokers',
  'copy-trading-forex-brokers': 'copy-trading-forex-brokers',
  'forex-brokers-for-scalping': 'forex-brokers-for-scalping',
  'forex-brokers-for-swing-trading': 'forex-brokers-for-swing-trading',
  'high-leverage-forex-brokers': 'high-leverage-forex-brokers',
};

function LegacyGlobalIntentRedirect() {
  const { slug } = useParams<{ slug: string }>();
  const destination = slug ? LEGACY_GLOBAL_INTENT_TO_NEW[slug] : undefined;
  return destination ? <Navigate to={`/${destination}`} replace /> : <NotFound />;
}

function LegacyCountryIntentRedirect() {
  const { countrySlug, slug } = useParams<{ countrySlug: string; slug: string }>();
  const topic = slug ? LEGACY_COUNTRY_INTENT_TO_NEW[slug] : undefined;
  return countrySlug && topic ? <Navigate to={`/${countrySlug}/${topic}`} replace /> : <NotFound />;
}

function RouteLoader() {
  return <div className="flex min-h-[60vh] items-center justify-center"><div className="h-9 w-9 animate-spin rounded-full border-2 border-line border-t-emerald-500" /></div>;
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
            <Route path="/compare" element={<Compare />} />
            <Route path="/compare/:pair" element={<ComparePair />} />
            <Route path="/quiz" element={<Quiz />} />
            <Route path="/tools" element={<Tools />} />
            <Route path="/guides" element={<Guides />} />
            <Route path="/guides/:slug" element={<GuideDetail />} />
            <Route path="/methodology" element={<Methodology />} />
            <Route path="/about" element={<About />} />
            <Route path="/authors" element={<Authors />} />
            {GLOBAL_INTENT_SLUGS.map((slug) => <Route key={slug} path={`/${slug}`} element={<BestFor />} />)}
            <Route path="/best/:slug" element={<LegacyGlobalIntentRedirect />} />
            <Route path="/countries/:countrySlug/best/:slug" element={<LegacyCountryIntentRedirect />} />
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
      {!bare && <Suspense fallback={null}><SmartCTA /></Suspense>}
    </div>
  );
}

export default function App() {
  return <BrowserRouter><GeoProvider><ScrollToTop /><Shell /></GeoProvider></BrowserRouter>;
}
