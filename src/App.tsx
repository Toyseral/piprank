import { lazy, Suspense } from 'react';
import { Navigate, BrowserRouter, Route, Routes, useLocation } from 'react-router-dom';
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
const AdminContentPreview = lazy(() => import('./pages/AdminContentPreview'));
const Authors = lazy(() => import('./pages/Authors'));
const CanonicalHub = lazy(() => import('./pages/CanonicalHub'));
const Methodology = lazy(() => import('./pages/Methodology'));
const Promotions = lazy(() => import('./pages/Promotions'));
const Quiz = lazy(() => import('./pages/Quiz'));
const Tools = lazy(() => import('./pages/Tools'));

function RouteLoader() { return <div className="flex min-h-[60vh] items-center justify-center"><div className="h-9 w-9 animate-spin rounded-full border-2 border-line border-t-emerald-500" /></div>; }

function isBrokerPath(pathname: string) {
  return /^\/brokers\/[^/]+\/?$/.test(pathname) || /^\/[^/]+\/brokers\/[^/]+\/?$/.test(pathname);
}

export function Shell() {
  const { pathname } = useLocation();
  const bare = pathname.startsWith('/archypage');
  const brokerRoute = isBrokerPath(pathname);
  return <div className="flex min-h-screen flex-col bg-paper text-ink-900">
    {!bare && <Navbar />}
    <main className={bare ? '' : brokerRoute ? 'flex-1 pb-20 sm:pb-24' : 'flex-1'}>
      <Suspense fallback={<RouteLoader />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/quiz" element={<Quiz />} />
          <Route path="/tools" element={<Tools />} />
          <Route path="/methodology" element={<Methodology />} />
          <Route path="/about" element={<About />} />
          <Route path="/authors" element={<Authors />} />
          <Route path="/promotions" element={<Promotions />} />
          <Route path="/archypage/preview/:id" element={<AdminContentPreview />} />
          <Route path="/archypage" element={<Admin />} />
          <Route path="/archypage/rankings" element={<Navigate to="/archypage#tab=countries" replace />} />
          <Route path="/brokers" element={<CanonicalHub />} />
          <Route path="/brokers/:slug" element={<CanonicalHub />} />
          <Route path="/:countrySlug/brokers/:slug" element={<CanonicalHub />} />
          <Route path="/compare" element={<CanonicalHub />} />
          <Route path="/compare/:pair" element={<CanonicalHub />} />
          <Route path="/guides" element={<CanonicalHub />} />
          <Route path="/guides/:slug" element={<CanonicalHub />} />
          <Route path="/countries" element={<CanonicalHub />} />
          <Route path="/countries/:slug" element={<CanonicalHub />} />
          <Route path="/:countrySlug/guides/:slug" element={<CanonicalHub />} />
          <Route path="/:countrySlug/:locale/guides/:slug" element={<CanonicalHub />} />
          <Route path="/:countrySlug/:locale/:topicSlug" element={<CanonicalHub />} />
          <Route path="/:countrySlug/:topicSlug" element={<CanonicalHub />} />
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
