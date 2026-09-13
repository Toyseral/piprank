import { lazy, Suspense } from 'react';
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom';
import { Analytics } from '@vercel/analytics/react';
import Footer from './components/Footer';
import Navbar from './components/Navbar';
import ScrollToTop from './components/ScrollToTop';
import Home from './pages/Home';
import NotFound from './pages/NotFound';
import { GeoProvider } from './lib/GeoContext';

const SmartCTA = lazy(() => import('./components/SmartCTA'));
const About = lazy(() => import('./pages/About'));
const Admin = lazy(() => import('./pages/Admin'));
const AdminLocalization = lazy(() => import('./pages/AdminLocalization'));
const Authors = lazy(() => import('./pages/Authors'));
const CanonicalHub = lazy(() => import('./pages/CanonicalHub'));
const CountryBestFor = lazy(() => import('./pages/CountryBestFor'));
const GlobalBestFor = lazy(() => import('./pages/GlobalBestFor'));
const GuideTopic = lazy(() => import('./pages/GuideTopic'));
const LegacyBestForRedirect = lazy(() => import('./pages/LegacyBestForRedirect'));
const LegacyCountryBestForRedirect = lazy(() => import('./pages/LegacyCountryBestForRedirect'));
const LegacyCountryRedirect = lazy(() => import('./pages/LegacyCountryRedirect'));
const LegacyCountryTopicRedirect = lazy(() => import('./pages/LegacyCountryTopicRedirect'));
const LocalizedGuide = lazy(() => import('./pages/LocalizedGuide'));
const Methodology = lazy(() => import('./pages/Methodology'));
const Promotions = lazy(() => import('./pages/Promotions'));
const Quiz = lazy(() => import('./pages/Quiz'));
const Tools = lazy(() => import('./pages/Tools'));

function RouteLoader() { return <div className="flex min-h-[60vh] items-center justify-center"><div className="h-9 w-9 animate-spin rounded-full border-2 border-line border-t-emerald-500" /></div>; }

const GLOBAL_BEST_FOR_ROUTES = [
  'forex-brokers-for-beginners', 'low-spread-forex-brokers', 'mt4-forex-brokers', 'mt5-forex-brokers',
  'gold-forex-brokers', 'forex-brokers-for-scalping', 'islamic-forex-brokers', 'ecn-forex-brokers',
  'copy-trading-forex-brokers', 'forex-brokers-for-swing-trading', 'high-leverage-forex-brokers',
];

const COUNTRY_BEST_FOR_ROUTES = GLOBAL_BEST_FOR_ROUTES;

export function Shell() {
  const { pathname } = useLocation();
  const bare = pathname.startsWith('/archypage');
  return <div className="flex min-h-screen flex-col bg-paper text-ink-900">
    {!bare && <Navbar />}
    <main className={bare ? '' : 'flex-1'}>
      <Suspense fallback={<RouteLoader />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/quiz" element={<Quiz />} />
          <Route path="/tools" element={<Tools />} />
          <Route path="/methodology" element={<Methodology />} />
          <Route path="/about" element={<About />} />
          <Route path="/authors" element={<Authors />} />
          <Route path="/promotions" element={<Promotions />} />
          <Route path="/archypage/localization" element={<AdminLocalization />} />
          <Route path="/archypage" element={<Admin />} />

          <Route path="/best/:slug" element={<LegacyBestForRedirect />} />
          <Route path="/best-forex-brokers-for-beginners" element={<LegacyBestForRedirect />} />
          <Route path="/best-low-spread-forex-brokers" element={<LegacyBestForRedirect />} />
          <Route path="/best-mt4-forex-brokers" element={<LegacyBestForRedirect />} />
          <Route path="/best-mt5-forex-brokers" element={<LegacyBestForRedirect />} />
          <Route path="/best-gold-forex-brokers" element={<LegacyBestForRedirect />} />
          <Route path="/best-forex-brokers-for-scalping" element={<LegacyBestForRedirect />} />
          <Route path="/best-islamic-forex-brokers" element={<LegacyBestForRedirect />} />
          <Route path="/best-ecn-forex-brokers" element={<LegacyBestForRedirect />} />
          <Route path="/best-copy-trading-forex-brokers" element={<LegacyBestForRedirect />} />
          <Route path="/best-forex-brokers-for-swing-trading" element={<LegacyBestForRedirect />} />
          <Route path="/best-high-leverage-forex-brokers" element={<LegacyBestForRedirect />} />

          <Route path="/countries/:countrySlug/best/:slug" element={<LegacyCountryBestForRedirect />} />
          <Route path="/:countrySlug/best-low-spread-forex-brokers" element={<LegacyCountryBestForRedirect />} />
          <Route path="/:countrySlug/best-forex-brokers-for-beginners" element={<LegacyCountryBestForRedirect />} />
          <Route path="/:countrySlug/best-mt4-forex-brokers" element={<LegacyCountryBestForRedirect />} />
          <Route path="/:countrySlug/best-mt5-forex-brokers" element={<LegacyCountryBestForRedirect />} />
          <Route path="/:countrySlug/best-gold-forex-brokers" element={<LegacyCountryBestForRedirect />} />
          <Route path="/:countrySlug/best-forex-brokers-for-scalping" element={<LegacyCountryBestForRedirect />} />
          <Route path="/:countrySlug/best-islamic-forex-brokers" element={<LegacyCountryBestForRedirect />} />
          <Route path="/:countrySlug/best-ecn-forex-brokers" element={<LegacyCountryBestForRedirect />} />
          <Route path="/:countrySlug/best-copy-trading-forex-brokers" element={<LegacyCountryBestForRedirect />} />
          <Route path="/:countrySlug/best-forex-brokers-for-swing-trading" element={<LegacyCountryBestForRedirect />} />
          <Route path="/:countrySlug/best-high-leverage-forex-brokers" element={<LegacyCountryBestForRedirect />} />

          {GLOBAL_BEST_FOR_ROUTES.map((slug) => <Route key={slug} path={`/${slug}`} element={<GlobalBestFor slug={slug} />} />)}

          <Route path="/:countrySlug/guides/:slug" element={<GuideTopic />} />

          {COUNTRY_BEST_FOR_ROUTES.map((slug) => <Route key={slug} path={`/:countrySlug/${slug}`} element={<CountryBestFor />} />)}

          <Route path="/brokers" element={<CanonicalHub />} />
          <Route path="/brokers/:slug" element={<CanonicalHub />} />
          <Route path="/:countrySlug/brokers/:slug" element={<CanonicalHub />} />
          <Route path="/compare" element={<CanonicalHub />} />
          <Route path="/compare/:pair" element={<CanonicalHub />} />
          <Route path="/guides" element={<CanonicalHub />} />
          <Route path="/guides/:slug" element={<CanonicalHub />} />
          <Route path="/countries" element={<CanonicalHub />} />
          <Route path="/countries/:slug" element={<LegacyCountryRedirect />} />
          <Route path="/:countrySlug/:locale/guides/:slug" element={<LocalizedGuide />} />
          <Route path="/:countrySlug/:locale/:topicSlug" element={<CanonicalHub />} />
          <Route path="/:countrySlug/:topicSlug" element={<LegacyCountryTopicRedirect />} />
          <Route path="/:slug" element={<CanonicalHub />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </main>
    {!bare && <Footer />}
    {!bare && <Suspense fallback={null}><SmartCTA /></Suspense>}
  </div>;
}

export default function App() { return <BrowserRouter><GeoProvider><ScrollToTop /><Shell /></GeoProvider><Analytics /></BrowserRouter>; }
