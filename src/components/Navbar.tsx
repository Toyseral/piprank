import { useEffect, useMemo, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { globalIntentPath } from '../lib/topicPaths';
import {
  BookOpen,
  ChevronDown,
  Menu,
  Scale,
  Search,
  Sparkles,
  X,
  type LucideIcon,
} from 'lucide-react';
import { fetchBrokers, fetchCountries, fetchIntents } from '../lib/api';
import { GEO_OPTIONS } from '../lib/geo';
import { useGeo } from '../lib/GeoContext';
import { btnCls } from './Button';
import type { Broker, CountryPage, Intent } from '../lib/types';

const linkCls = ({ isActive }: { isActive: boolean }) =>
  `text-sm font-semibold transition ${isActive ? 'text-emerald-700' : 'text-slate-600 hover:text-ink-900'}`;

const dropItemCls =
  'block rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-emerald-50 hover:text-emerald-800';

export function Logo({ inverse = false }: { inverse?: boolean }) {
  return (
    <Link to="/" className="group flex items-center gap-2.5">
      <span
        className={`grid h-8 w-8 place-items-center rounded-lg text-[13px] font-black tracking-tight ${
          inverse ? 'bg-emerald-400 text-ink-950' : 'bg-ink-950 text-emerald-400'
        }`}
      >
        P
      </span>
      <span className={`font-display text-lg font-bold tracking-tight ${inverse ? 'text-white' : 'text-ink-950'}`}>
        Pip<span className={inverse ? 'text-emerald-400' : 'text-emerald-600'}>Rank</span>
      </span>
    </Link>
  );
}

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [brokers, setBrokers] = useState<Broker[]>([]);
  const [intents, setIntents] = useState<Intent[]>([]);
  const [countries, setCountries] = useState<CountryPage[]>([]);
  const { country, setCountrySlug } = useGeo();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    fetchBrokers().then(setBrokers).catch(() => {});
    fetchIntents().then(setIntents).catch(() => {});
    fetchCountries().then(setCountries).catch(() => {});
  }, []);

  useEffect(() => {
    setOpen(false);
    setQ('');
  }, [location.pathname]);

  const results = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (query.length < 2) return [];
    return brokers
      .filter((b) => b.name.toLowerCase().includes(query) || b.slug.includes(query))
      .slice(0, 6);
  }, [q, brokers]);

  const closeMobile = () => setOpen(false);

  return (
    <header className="sticky top-0 z-40 border-b border-line/80 bg-paper/90 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
        <Logo />

        <nav className="ml-4 hidden items-center gap-1 lg:flex">
          <NavLink to="/brokers" className={linkCls}>
            Brokers
          </NavLink>

          {/* Best for dropdown */}
          <div className="relative group">
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm font-semibold text-slate-600 transition hover:text-ink-900"
            >
              Best for <ChevronDown size={14} className="opacity-60 transition group-hover:rotate-180" />
            </button>
            <div className="invisible absolute left-0 top-full z-50 w-[340px] pt-2 opacity-0 transition group-hover:visible group-hover:opacity-100">
              <div className="rounded-2xl border border-line bg-white p-2 shadow-soft-lg">
                <div className="grid grid-cols-1 gap-0.5">
                  <p className="px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Best brokers by category</p>
                  <div className="mt-2 grid grid-cols-2 gap-1">
                    {intents.slice(0, 10).map((i) => (
                      <Link key={i.slug} to={globalIntentPath(i.slug)} className={dropItemCls}>
                        {i.title.replace(/ \(\d{4}\)/, '')}
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <NavLink to="/countries" className={linkCls}>
            Countries
          </NavLink>

          {/* Guides */}
          <div className="relative group">
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm font-semibold text-slate-600 transition hover:text-ink-900"
            >
              Learn <ChevronDown size={14} className="opacity-60 transition group-hover:rotate-180" />
            </button>
            <div className="invisible absolute left-0 top-full z-50 w-[280px] pt-2 opacity-0 transition group-hover:visible group-hover:opacity-100">
              <div className="rounded-2xl border border-line bg-white p-2 shadow-soft-lg">
                <div className="border-l border-line pl-4">
                  <p className="px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Guides</p>
                  <Link to="/guides" className="mt-2 block rounded-xl bg-paper p-4 hover:bg-emerald-50">
                    <span className="inline-flex items-center gap-2 text-sm font-bold text-ink-900">
                      <BookOpen size={16} className="text-emerald-600" /> Forex trading guides
                    </span>
                    <p className="mt-1 text-xs text-slate-500">Mechanics, costs, risk — not hype.</p>
                  </Link>
                  <Link to="/methodology" className={`${dropItemCls} mt-1`}>
                    How we score brokers
                  </Link>
                  <Link to="/about" className={dropItemCls}>
                    About & editorial policy
                  </Link>
                </div>
              </div>
            </div>
          </div>

          <NavLink to="/compare" className={linkCls}>
            Compare
          </NavLink>
          <NavLink to="/tools" className={linkCls}>
            Tools
          </NavLink>
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {/* Search */}
          <div className="relative hidden sm:block">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search brokers…"
              className="h-9 w-44 rounded-full border border-line bg-white pl-9 pr-3 text-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 lg:w-56"
            />
            {results.length > 0 && (
              <div className="absolute right-0 top-full z-50 mt-2 w-72 overflow-hidden rounded-2xl border border-line bg-white shadow-soft-lg">
                {results.map((b) => (
                  <Link
                    key={b.slug}
                    to={`/brokers/${b.slug}`}
                    onClick={() => setQ('')}
                    className="flex items-center gap-3 border-b border-line px-4 py-3 last:border-0 hover:bg-emerald-50"
                  >
                    <span className="text-sm font-semibold text-ink-900">{b.name}</span>
                    <span className="ml-auto text-xs text-slate-400">{b.rating.toFixed(1)}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Country selector */}
          <select
            value={country?.slug ?? ''}
            onChange={(e) => setCountrySlug(e.target.value || null)}
            className="hidden h-9 rounded-full border border-line bg-white px-3 text-xs font-semibold text-slate-600 outline-none md:block"
            aria-label="Your country"
          >
            <option value="">Global</option>
            {GEO_OPTIONS.map((g) => (
              <option key={g.slug} value={g.slug}>
                {g.flag} {g.name}
              </option>
            ))}
          </select>

          <Link to="/quiz" className={`${btnCls('emerald', 'sm')} hidden sm:inline-flex`}>
            <Sparkles size={14} /> Match me
          </Link>

          <button
            type="button"
            className="grid h-9 w-9 place-items-center rounded-lg border border-line bg-white text-ink-900 lg:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-label="Menu"
          >
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="border-t border-line bg-white lg:hidden">
          <div className="mx-auto max-w-7xl space-y-1 px-4 py-4">
            <MobileLink to="/brokers" onClick={closeMobile}>All brokers</MobileLink>
            <MobileLink to="/countries" onClick={closeMobile}>By country</MobileLink>
            <MobileLink to="/compare" onClick={closeMobile}>Compare</MobileLink>
            <MobileLink to="/tools" onClick={closeMobile}>Tools</MobileLink>
            <MobileLink to="/guides" onClick={closeMobile}>Guides</MobileLink>
            <MobileLink to="/quiz" onClick={closeMobile}>Broker match quiz</MobileLink>
            <MobileLink to="/about" onClick={closeMobile}>About</MobileLink>
            <div className="pt-3">
              <p className="px-1 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Best for</p>
              <div className="mt-2 grid grid-cols-2 gap-1">
                {intents.slice(0, 8).map((i) => (
                  <MobileLink key={i.slug} to={globalIntentPath(i.slug)} onClick={closeMobile}>{i.title.replace(/ \(\d{4}\)/, '')}</MobileLink>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

function MobileLink({
  to,
  onClick,
  children,
}: {
  to: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className="block rounded-xl px-3 py-2.5 text-sm font-semibold text-ink-900 hover:bg-white/5 hover:text-emerald-300"
    >
      {children}
    </Link>
  );
}
