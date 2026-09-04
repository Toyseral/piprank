import { useEffect, useMemo, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { globalIntentPath } from '../lib/topicPaths';
import {
  BookOpen,
  ChevronDown,
  CircleUserRound,
  Gift,
  Globe2,
  Menu,
  Search,
  Sparkles,
  Star,
  X,
} from 'lucide-react';
import { fetchBrokers, fetchCountries, fetchIntents } from '../lib/api';
import { GEO_OPTIONS } from '../lib/geo';
import { useGeo } from '../lib/GeoContext';
import { btnCls } from './Button';
import type { Broker, CountryPage, Intent } from '../lib/types';

const linkCls = ({ isActive }: { isActive: boolean }) =>
  `rounded-lg px-2.5 py-1.5 text-sm font-semibold transition ${
    isActive ? 'bg-white/10 text-emerald-300' : 'text-slate-300 hover:bg-white/5 hover:text-white'
  }`;

const dropItemCls =
  'block rounded-xl px-3.5 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-emerald-50 hover:text-emerald-800';

export function Logo({ inverse = false }: { inverse?: boolean } = {}) {
  return (
    <Link to="/" className="group flex items-center gap-2">
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
      className="block rounded-xl px-3 py-2.5 text-sm font-semibold text-white hover:bg-white/10"
    >
      {children}
    </Link>
  );
}

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [brokers, setBrokers] = useState<Broker[]>([]);
  const [intents, setIntents] = useState<Intent[]>([]);
  const [countries, setCountries] = useState<CountryPage[]>([]);
  const { country: activeGeo, setCountry } = useGeo();
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

  const onSelectCountry = (slug: string) => {
    setCountry(slug || null);
  };

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-ink-950/95 text-white backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6">
        <Logo inverse />

        <nav className="ml-2 hidden items-center gap-0.5 lg:flex">
          <NavLink to="/brokers" className={linkCls}>
            Brokers
          </NavLink>

          <div className="relative group">
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm font-semibold text-slate-300 transition hover:bg-white/5 hover:text-white"
            >
              Best for <ChevronDown size={14} className="opacity-60 transition group-hover:rotate-180" />
            </button>
            <div className="invisible absolute left-0 top-full z-50 w-[360px] pt-2 opacity-0 transition group-hover:visible group-hover:opacity-100">
              <div className="rounded-2xl border border-line bg-white p-3 text-ink-900 shadow-soft-lg">
                <p className="px-2 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Best brokers by category</p>
                <div className="mt-2 grid grid-cols-2 gap-1">
                  {intents.slice(0, 10).map((i) => (
                    <Link key={i.slug} to={globalIntentPath(i.slug)} className={dropItemCls}>
                      {i.title.replace(/ \(\d{4}\)/, '')}
                    </Link>
                  ))}
                </div>
                <Link to="/#categories" className="mt-2 inline-block px-2 text-xs font-bold text-emerald-700">
                  See all categories →
                </Link>
              </div>
            </div>
          </div>

          <NavLink to="/countries" className={linkCls}>
            Countries
          </NavLink>
          <NavLink to="/compare" className={linkCls}>
            Compare
          </NavLink>
          <NavLink to="/guides" className={linkCls}>
            Guides
          </NavLink>
          <NavLink to="/tools" className={linkCls}>
            Tools
          </NavLink>
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <div className="relative hidden sm:block">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search brokers…"
              className="h-9 w-44 rounded-full border border-white/10 bg-white/5 pl-9 pr-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-emerald-400/50 lg:w-56"
            />
            {results.length > 0 && (
              <div className="absolute right-0 top-full z-50 mt-2 w-72 overflow-hidden rounded-2xl border border-line bg-white text-ink-900 shadow-soft-lg">
                {results.map((b) => (
                  <Link
                    key={b.slug}
                    to={`/brokers/${b.slug}`}
                    onClick={() => setQ('')}
                    className="flex items-center gap-3 border-b border-line px-4 py-3 last:border-0 hover:bg-emerald-50"
                  >
                    <span className="text-sm font-semibold">{b.name}</span>
                    <span className="ml-auto text-xs text-slate-400">{b.rating.toFixed(1)}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <select
            value={activeGeo?.slug ?? ''}
            onChange={(e) => onSelectCountry(e.target.value)}
            className="hidden h-9 max-w-[9.5rem] rounded-full border border-white/10 bg-white/5 px-3 text-xs font-semibold text-slate-200 outline-none md:block"
            aria-label="Your country"
          >
            <option value="">Global</option>
            {GEO_OPTIONS.map((g) => (
              <option key={g.slug} value={g.slug} className="text-ink-900">
                {g.flag} {g.name}
              </option>
            ))}
          </select>

          <Link to="/quiz" className={btnCls('primary', 'sm', 'hidden md:inline-flex !h-9 whitespace-nowrap')}>
            <Sparkles size={14} /> Match me
          </Link>

          <button
            type="button"
            className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 bg-white/5 text-white lg:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-label="Menu"
          >
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-white/10 bg-ink-950 lg:hidden">
          <div className="mx-auto max-w-7xl space-y-1 px-4 py-4">
            <MobileLink to="/brokers" onClick={closeMobile}>All brokers</MobileLink>
            <MobileLink to="/countries" onClick={closeMobile}>By country</MobileLink>
            <MobileLink to="/compare" onClick={closeMobile}>Compare</MobileLink>
            <MobileLink to="/tools" onClick={closeMobile}>Tools</MobileLink>
            <MobileLink to="/guides" onClick={closeMobile}>Guides</MobileLink>
            <MobileLink to="/quiz" onClick={closeMobile}>Broker match quiz</MobileLink>
            <MobileLink to="/about" onClick={closeMobile}>About</MobileLink>
            <div className="pt-3">
              <p className="px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Best for</p>
              <div className="mt-2 grid grid-cols-2 gap-1">
                {intents.slice(0, 8).map((i) => (
                  <MobileLink key={i.slug} to={globalIntentPath(i.slug)} onClick={closeMobile}>
                    {i.title.replace(/ \(\d{4}\)/, '')}
                  </MobileLink>
                ))}
              </div>
            </div>
            <div className="pt-3">
              <label className="px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Country</label>
              <select
                value={activeGeo?.slug ?? ''}
                onChange={(e) => onSelectCountry(e.target.value)}
                className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white"
              >
                <option value="" className="text-ink-900">Global</option>
                {GEO_OPTIONS.map((g) => (
                  <option key={g.slug} value={g.slug} className="text-ink-900">
                    {g.flag} {g.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
