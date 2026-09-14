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
const LegacyBestForRedirect = lazy(() => import('./pages/LegacyBestForRedirect'));
const LegacyCountryBestForRedirect = lazy(() => import('./pages/LegacyCountryBestForRedirect'));
const LegacyCountryGuideRedirect = lazy(() => import('./pages/LegacyCountryGuideRedirect'));
const LocalizedGuide = lazy(() => import('./pages/LocalizedGuide'));
const Methodology = lazy(() => import('./pages/Methodology'));
const Promotions = lazy(() => import('./pages/Promotions'));
const Quiz = lazy(() => import('./pages/Quiz'));
const Tools = lazy(() => import('./pages/Tools'));

function RouteLoader() { return <div className="flex min-h-[60vh] items-center justify-center"><div className="h-9 w-9 animate-spin rounded-full border-2 border-line border-t-emerald-500" /></div>; }

export function Shell() {
  const { pathname } = useLocation();
  const bare = pathname.startsWith('/archypage');
  return <div className="flex min-h-screen flex-col bg-paper text-ink-900">
    {!bare && <Navbar />}
    <main className={bare ? '' : 'flex-1'}>
      <Suspense fallback={<RouteLoader />}>
        <Routes>
          <Route path="/" element={<Home />} />

          {/* Non-canonical application/tools/admin surfaces remain explicit. */}
          <Route path="/quiz" element={<Quiz />} />
          <Route path="/tools" element={<Tools />} />
          <Route path="/methodology" element={<Methodology />} />
          <Route path="/about" element={<About />} />
          <Route path="/authors" element={<Authors />} />
          <Route path="/promotions" element={<Promotions />} />
          <Route path="/archypage/localization" element={<AdminLocalization />} />
          <Route path="/archypage" element={<Admin />} />

          {/* Legacy URLs remain redirects and never own canonical content. */}
          <Route path="/best/:slug" element={<LegacyBestForRedirect />} />
          <Route path="/best-:slug" element={<LegacyBestForRedirect />} />
          <Route path="/countries/:countrySlug/best/:slug" element={<LegacyCountryBestForRedirect />} />
          <Route path="/countries/:countrySlug/guides/:slug" element={<LegacyCountryGuideRedirect />} />
          <Route path="/:countrySlug/best-:slug" element={<LegacyCountryBestForRedirect />} />
          <Route path="/:countrySlug/best-low-spread-forex-brokers" element={<LegacyCountryBestForRedirect />} />
          <Route path="/:countrySlug/best-forex-brokers-for-beginners" element={<LegacyCountryBestForRedirect />} />
          <Route path="/:countrySlug/best-mt4-brokers" element={<LegacyCountryBestForRedirect />} />
          <Route path="/:countrySlug/best-mt4-forex-brokers" element={<LegacyCountryBestForRedirect />} />
          <Route path="/:countrySlug/best-mt5-brokers" element={<LegacyCountryBestForRedirect />} />
          <Route path="/:countrySlug/best-mt5-forex-brokers" element={<LegacyCountryBestForRedirect />} />
          <Route path="/:countrySlug/best-gold-brokers" element={<LegacyCountryBestForRedirect />} />
          <Route path="/:countrySlug/best-gold-forex-brokers" element={<LegacyCountryBestForRedirect />} />
          <Route path="/:countrySlug/best-forex-brokers-for-scalping" element={<LegacyCountryBestForRedirect />} />
          <Route path="/:countrySlug/best-islamic-forex-brokers" element={<LegacyCountryBestForRedirect />} />
          <Route path="/:countrySlug/best-ecn-forex-brokers" element={<LegacyCountryBestForRedirect />} />
          <Route path="/:countrySlug/best-copy-trading-forex-brokers" element={<LegacyCountryBestForRedirect />} />
          <Route path="/:countrySlug/best-forex-brokers-for-swing-trading" element={<LegacyCountryBestForRedirect />} />
          <Route path="/:countrySlug/best-high-leverage-forex-brokers" element={<LegacyCountryBestForRedirect />} />

          {/* Canonical route ownership is resolved centrally by CanonicalHub. */}
          <Route path="/brokers" element={<CanonicalHub />} />
          <Route path="/brokers/:slug" element={<CanonicalHub />} />
          <Route path="/:countrySlug/brokers/:slug" element={<CanonicalHub />} />
          <Route path="/compare" element={<CanonicalHub />} />
          <Route path="/compare/:pair" element={<CanonicalHub />} />
          <Route path="/guides" element={<CanonicalHub />} />
          <Route path="/guides/:slug" element={<CanonicalHub />} />

          {/* Country informational hub remains an explicit surface; canonical child pages are Hub-driven. */}
          <Route path="/countries" element={<CanonicalHub />} />
          <Route path="/countries/:slug" element={<CanonicalHub />} />

          {/* Country guides and Best-For pages are canonical-content owned. */}
          <Route path="/:countrySlug/guides/:slug" element={<CanonicalHub />} />
          <Route path="/:countrySlug/:locale/guides/:slug" element={<LocalizedGuide />} />
          <Route path="/:countrySlug/:locale/:topicSlug" element={<CanonicalHub />} />
          <Route path="/:countrySlug/:topicSlug" element={<CanonicalHub />} />

          {/* Root-level global Best-For URLs are all resolved through CanonicalHub. */}
          <Route path="/forex-brokers-for-beginners" element={<CanonicalHub />} />
          <Route path="/low-spread-forex-brokers" element={<CanonicalHub />} />
          <Route path="/mt4-forex-brokers" element={<CanonicalHub />} />
          <Route path="/mt5-forex-brokers" element={<CanonicalHub />} />
          <Route path="/gold-forex-brokers" element={<CanonicalHub />} />
          <Route path="/forex-brokers-for-scalping" element={<CanonicalHub />} />
          <Route path="/islamic-forex-brokers" element={<CanonicalHub />} />
          <Route path="/ecn-forex-brokers" element={<CanonicalHub />} />
          <Route path="/copy-trading-forex-brokers" element={<CanonicalHub />} />
          <Route path="/forex-brokers-for-swing-trading" element={<CanonicalHub />} />
          <Route path="/high-leverage-forex-brokers" element={<CanonicalHub />} />

          {/* Any remaining root-level slug is resolved as a canonical country route. */}
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
