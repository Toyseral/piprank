import { useEffect, useMemo, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
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

let intentsCache: Promise<Intent[]> | null = null;
const loadIntents = () => {
  intentsCache ??= fetchIntents();
  return intentsCache;
};

let countriesCache: Promise<CountryPage[]> | null = null;
const loadCountries = () => {
  countriesCache ??= fetchCountries();
  return countriesCache;
};

let brokersCache: Promise<Broker[]> | null = null;
const loadBrokers = () => {
  brokersCache ??= fetchBrokers();
  return brokersCache;
};

export function Logo({ light = false }: { light?: boolean }) {
  return (
    <Link to="/" className="flex shrink-0 items-center gap-2.5" aria-label="PipRank home">
      <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden="true">
        <rect width="32" height="32" rx="7" fill={light ? '#ffffff' : '#0b1e16'} stroke={light ? '#e1e6da' : '#1f3c2d'} strokeWidth="1" />
        <line x1="9" y1="6" x2="9" y2="18" stroke="#47e0a5" strokeWidth="1.6" strokeLinecap="round" />
        <rect x="6.8" y="9.5" width="4.4" height="6.5" rx="1" fill="#47e0a5" />
        <line x1="16" y1="12" x2="16" y2="25" stroke="#ff6b6b" strokeWidth="1.6" strokeLinecap="round" />
        <rect x="13.8" y="15" width="4.4" height="6" rx="1" fill="#ff6b6b" />
        <line x1="23" y1="4.5" x2="23" y2="15.5" stroke="#47e0a5" strokeWidth="1.6" strokeLinecap="round" />
        <rect x="20.8" y="7.5" width="4.4" height="6.5" rx="1" fill="#47e0a5" />
      </svg>
      <span className={`font-display text-lg font-bold tracking-tight ${light ? 'text-ink-900' : 'text-white'}`}>
        Pip<span className="text-emerald-400">Rank</span>
        <span className="ml-0.5 inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 align-baseline" />
      </span>
    </Link>
  );
}

type OpenMenu = 'none' | 'reviews' | 'country' | 'tools' | 'guides' | 'about' | 'search' | 'flag';
type MobileSection = 'none' | 'reviews' | 'country' | 'tools' | 'guides' | 'about';

const ABOUT_LINKS = [
  { label: 'About PipRank', to: '/about', note: 'How PipRank works' },
  { label: 'Our methodology', to: '/methodology', note: 'How we score brokers' },
  { label: 'Authors & reviewers', to: '/authors', note: 'Meet the people behind the research' },
];

const TOOL_LINKS = [
  { label: 'Get Matched to a Broker', to: '/quiz', note: 'Personalised broker match', icon: Sparkles },
  { label: 'Broker Signup Bonuses', to: '/promotions', note: 'Current broker promotions', icon: Gift },
  { label: 'Compare Brokers', to: '/compare', note: 'Compare brokers side by side', icon: CircleUserRound },
  { label: 'Position Size Calculator', to: '/tools?tab=position' },
  { label: 'Pip Value Calculator', to: '/tools?tab=pip' },
  { label: 'Margin Calculator', to: '/tools?tab=margin' },
  { label: 'Profit & Loss Calculator', to: '/tools?tab=profit' },
  { label: 'Compounding Calculator', to: '/tools?tab=compound' },
];

export default function Navbar() {
  const [openMenu, setOpenMenu] = useState<OpenMenu>('none');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileSection, setMobileSection] = useState<MobileSection>('none');
  const [intents, setIntents] = useState<Intent[]>([]);
  const [countries, setCountries] = useState<CountryPage[]>([]);
  const [brokers, setBrokers] = useState<Broker[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileSearch, setMobileSearch] = useState('');
  const location = useLocation();
  const navigate = useNavigate();
  const { country: activeGeo, setCountry } = useGeo();

  useEffect(() => {
    loadIntents().then(setIntents).catch(() => {});
    loadCountries().then(setCountries).catch(() => {});
    loadBrokers().then(setBrokers).catch(() => {});
  }, []);

  useEffect(() => {
    setOpenMenu('none');
    setMobileOpen(false);
    setMobileSection('none');
  }, [location.pathname, location.search]);

  const countryList = useMemo(() => {
    const db = countries.map((c) => ({ slug: c.slug, label: c.name, flag: c.flag }));
    const seen = new Set(db.map((c) => c.slug));
    return [
      ...db,
      ...GEO_OPTIONS.filter((g) => !seen.has(g.slug)).map((g) => ({ slug: g.slug, label: g.name, flag: g.flag })),
    ];
  }, [countries]);

  // Keep the country menu useful even when the API contains a long list.
  // Float the visitor's detected/selected country to the front of the list so
  // the menu feels personalized instead of always showing the same static set.
  const majorCountries = useMemo(() => {
    const rest = countryList.filter((c) => c.slug !== activeGeo?.slug);
    const pinned = activeGeo ? countryList.filter((c) => c.slug === activeGeo.slug) : [];
    return [...pinned, ...rest].slice(0, 10);
  }, [countryList, activeGeo]);

  // Geo-personalized "top brokers" list for the Broker Reviews menu: prefer
  // this country's curated recommendations, falling back to overall top-rated
  // brokers when there's no geo match yet (first-time visitor, Global, etc).
  const topBrokers = useMemo(() => {
    const activeCountry = activeGeo ? countries.find((c) => c.slug === activeGeo.slug) : null;
    if (activeCountry?.recommended?.length) {
      const matched = activeCountry.recommended
        .map((r) => brokers.find((b) => b.slug === r.slug))
        .filter((b): b is Broker => Boolean(b));
      if (matched.length) return { list: matched, label: `Top brokers in ${activeCountry.name}` };
    }
    const topRated = [...brokers].sort((a, b) => b.rating - a.rating);
    return { list: topRated, label: 'Top-rated brokers' };
  }, [activeGeo, countries, brokers]);

  const submitSearch = (value: string) => {
    const q = value.trim();
    if (!q) return;
    navigate(`/brokers?q=${encodeURIComponent(q)}`);
    setSearchQuery('');
    setMobileSearch('');
  };

  const selectCountry = (slug: string) => {
    setCountry(slug || null);
    if (slug) navigate(`/${slug}`);
    else navigate('/');
  };

  const linkCls = ({ isActive }: { isActive: boolean }) =>
    `rounded-lg px-2.5 py-2 text-sm font-medium transition ${
      isActive ? 'bg-white/10 text-emerald-300' : 'text-slate-300 hover:bg-white/5 hover:text-white'
    }`;

  const dropBtnCls = (active: boolean) =>
    `flex items-center gap-1 rounded-lg px-2.5 py-2 text-sm font-medium transition ${
      active ? 'bg-white/10 text-white' : 'text-slate-300 hover:bg-white/5 hover:text-white'
    }`;

  const dropItemCls =
    'block rounded-xl px-3.5 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-emerald-50 hover:text-emerald-800';

  const toggleDesktop = (menu: OpenMenu) => setOpenMenu((v) => (v === menu ? 'none' : menu));
  const toggleMobile = (section: MobileSection) => setMobileSection((v) => (v === section ? 'none' : section));

  const closeMobile = () => {
    setMobileOpen(false);
    setMobileSection('none');
  };

  return (
    <header className="sticky top-0 z-50 border-b border-white/5 bg-ink-950/95 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-1.5 px-3 sm:px-6">
        <Logo />

        {/* Desktop navigation */}
        <nav className="ml-3 hidden items-center gap-0.5 xl:flex">
          {/* Broker Reviews */}
          <div className="relative">
            <button
              onClick={() => toggleDesktop('reviews')}
              className={dropBtnCls(openMenu === 'reviews' || location.pathname.startsWith('/brokers'))}
              aria-expanded={openMenu === 'reviews'}
            >
              Broker Reviews <ChevronDown size={14} className={`transition ${openMenu === 'reviews' ? 'rotate-180' : ''}`} />
            </button>
            {openMenu === 'reviews' && (
              <div className="absolute left-0 top-full z-30 mt-2 w-[620px] rounded-2xl border border-line bg-white p-3 shadow-xl">
                <div className="grid grid-cols-[1.3fr_.7fr] gap-2">
                  <div className="rounded-xl bg-emerald-50 p-4">
                    <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-700">
                      <Star size={13} /> {topBrokers.label}
                    </p>
                    <div className="mt-2.5 grid gap-0.5">
                      {topBrokers.list.slice(0, 5).map((b) => (
                        <Link
                          key={b.slug}
                          to={`/brokers/${b.slug}`}
                          className="rounded-lg px-2 py-1.5 text-sm font-semibold text-ink-900 transition hover:bg-emerald-100"
                        >
                          {b.name}
                        </Link>
                      ))}
                      {topBrokers.list.length === 0 && (
                        <p className="px-2 py-1.5 text-xs text-slate-500">Loading recommendations…</p>
                      )}
                    </div>
                  </div>
                  <Link to="/brokers" className="flex flex-col rounded-xl p-4 transition hover:bg-paper">
                    <BookOpen size={18} className="text-emerald-700" />
                    <p className="mt-2 text-sm font-bold text-ink-900">See all brokers</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">Browse every broker profile, score, fees and platforms.</p>
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* Country */}
          <div className="relative">
            <button
              onClick={() => toggleDesktop('country')}
              className={dropBtnCls(openMenu === 'country' || location.pathname.startsWith('/countries') || !!activeGeo)}
              aria-expanded={openMenu === 'country'}
            >
              Country <ChevronDown size={14} className={`transition ${openMenu === 'country' ? 'rotate-180' : ''}`} />
            </button>
            {openMenu === 'country' && (
              <div className="absolute left-0 top-full z-30 mt-2 w-[700px] rounded-2xl border border-line bg-white p-4 shadow-xl">
                <div className="flex items-end justify-between gap-4 border-b border-line pb-3">
                  <div>
                    <p className="text-sm font-bold text-ink-900">Forex brokers by country</p>
                    <p className="mt-0.5 text-xs text-slate-500">See recommendations and localised broker content.</p>
                  </div>
                  <Link to="/countries" className="text-xs font-bold text-emerald-700 hover:text-emerald-900">See all countries →</Link>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-1">
                  {majorCountries.map((c) => (
                    <Link key={c.slug} to={`/${c.slug}`} className={`${dropItemCls} flex items-center gap-2`}>
                      <span className="text-base leading-none">{c.flag}</span>
                      <span className="truncate">{c.label}</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Tools */}
          <div className="relative">
            <button
              onClick={() => toggleDesktop('tools')}
              className={dropBtnCls(openMenu === 'tools' || location.pathname.startsWith('/tools') || location.pathname === '/quiz' || location.pathname === '/compare' || location.pathname === '/promotions')}
              aria-expanded={openMenu === 'tools'}
            >
              Tools <ChevronDown size={14} className={`transition ${openMenu === 'tools' ? 'rotate-180' : ''}`} />
            </button>
            {openMenu === 'tools' && (
              <div className="absolute left-0 top-full z-30 mt-2 w-[760px] rounded-2xl border border-line bg-white p-4 shadow-xl">
                <div className="grid grid-cols-3 gap-2">
                  {TOOL_LINKS.map((tool) => {
                    const Icon = tool.icon;
                    return (
                      <Link key={tool.to} to={tool.to} className={`${dropItemCls} ${tool.note ? 'border border-transparent hover:border-emerald-100' : ''}`}>
                        {Icon && <Icon size={17} className="mb-2 text-emerald-700" />}
                        <span className="block">{tool.label}</span>
                        {tool.note && <span className="mt-1 block text-[11px] font-medium leading-4 text-slate-400">{tool.note}</span>}
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Guides */}
          <div className="relative">
            <button
              onClick={() => toggleDesktop('guides')}
              className={dropBtnCls(openMenu === 'guides' || location.pathname.startsWith('/guides') || location.pathname.startsWith('/best'))}
              aria-expanded={openMenu === 'guides'}
            >
              Guides <ChevronDown size={14} className={`transition ${openMenu === 'guides' ? 'rotate-180' : ''}`} />
            </button>
            {openMenu === 'guides' && (
              <div className="absolute left-0 top-full z-30 mt-2 w-[760px] rounded-2xl border border-line bg-white p-4 shadow-xl">
                <div className="grid grid-cols-[1.15fr_.85fr] gap-4">
                  <div>
                    <p className="px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Best brokers by category</p>
                    <div className="mt-2 grid grid-cols-2 gap-1">
                      {intents.slice(0, 10).map((i) => (
                        <Link key={i.slug} to={`/best/${i.slug}`} className={dropItemCls}>
                          {i.title.replace(/ \(\d{4}\)/, '')}
                        </Link>
                      ))}
                    </div>
                    <Link to="/#categories" className="mt-2 inline-block px-3 text-xs font-bold text-emerald-700">See all categories →</Link>
                  </div>
                  <div className="border-l border-line pl-4">
                    <p className="px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Guides</p>
                    <Link to="/guides" className="mt-2 block rounded-xl bg-paper p-4 hover:bg-emerald-50">
                      <BookOpen size={18} className="text-emerald-700" />
                      <p className="mt-2 text-sm font-bold text-ink-900">Forex Guides</p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">Educational guides and informational articles for traders.</p>
                    </Link>
                    <Link to="/compare" className={`${dropItemCls} mt-1`}>Side-by-side broker comparisons</Link>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* About */}
          <div className="relative">
            <button
              onClick={() => toggleDesktop('about')}
              className={dropBtnCls(openMenu === 'about' || location.pathname === '/about' || location.pathname === '/methodology' || location.pathname === '/authors')}
              aria-expanded={openMenu === 'about'}
            >
              About us <ChevronDown size={14} className={`transition ${openMenu === 'about' ? 'rotate-180' : ''}`} />
            </button>
            {openMenu === 'about' && (
              <div className="absolute left-0 top-full z-30 mt-2 w-72 rounded-2xl border border-line bg-white p-2 shadow-xl">
                {ABOUT_LINKS.map((item) => (
                  <Link key={item.to} to={item.to} className={dropItemCls}>
                    <span className="block">{item.label}</span>
                    <span className="mt-0.5 block text-[11px] font-medium text-slate-400">{item.note}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </nav>

        <div className="ml-auto flex items-center gap-1.5">
          {/* Small broker-name search */}
          <div className="relative hidden md:block">
            {openMenu === 'search' ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  submitSearch(searchQuery);
                }}
                className="flex h-9 w-48 items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-2.5 focus-within:border-emerald-400/50"
              >
                <Search size={15} className="shrink-0 text-slate-400" />
                <input
                  autoFocus
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search brokers…"
                  className="w-full bg-transparent text-xs text-white outline-none placeholder:text-slate-500"
                  aria-label="Search broker name"
                />
                <button type="button" onClick={() => setOpenMenu('none')} className="text-slate-500 hover:text-white" aria-label="Close search">
                  <X size={14} />
                </button>
              </form>
            ) : (
              <button onClick={() => setOpenMenu('search')} className="rounded-lg p-2 text-slate-300 hover:bg-white/10 hover:text-white" aria-label="Search brokers">
                <Search size={18} />
              </button>
            )}
          </div>

          {/* Flag / country switcher */}
          <div className="relative hidden md:block">
            <button
              onClick={() => toggleDesktop('flag')}
              className="rounded-lg p-2 text-slate-300 hover:bg-white/10 hover:text-white"
              aria-label="Change country"
              title="Change country"
            >
              {activeGeo?.flag ? <span className="text-lg leading-none">{activeGeo.flag}</span> : <Globe2 size={18} />}
            </button>
            {openMenu === 'flag' && (
              <div className="absolute right-0 top-full z-30 mt-2 w-72 rounded-2xl border border-line bg-white p-2 shadow-xl">
                <div className="border-b border-line px-3 py-2">
                  <p className="text-sm font-bold text-ink-900">Your country</p>
                  <p className="mt-0.5 text-xs text-slate-500">Switch to local broker recommendations.</p>
                </div>
                <button onClick={() => selectCountry('')} className={`${dropItemCls} w-full text-left`}>🌐 Global</button>
                <div className="grid grid-cols-2 gap-1">
                  {majorCountries.map((c) => (
                    <button key={c.slug} onClick={() => selectCountry(c.slug)} className={`${dropItemCls} flex items-center gap-2 text-left`}>
                      <span>{c.flag}</span><span className="truncate">{c.label}</span>
                    </button>
                  ))}
                </div>
                <Link to="/countries" className="mt-1 block border-t border-line px-3 pt-2 text-xs font-bold text-emerald-700">See all countries →</Link>
              </div>
            )}
          </div>

          <Link to="/quiz" className={btnCls('primary', 'sm', 'hidden md:inline-flex !h-9 whitespace-nowrap')}>
            <Sparkles size={14} />
            Find My Broker
          </Link>

          <button
            onClick={() => setMobileOpen((v) => !v)}
            className="rounded-lg p-2 text-slate-300 transition hover:bg-white/10 hover:text-white xl:hidden"
            aria-label="Toggle menu"
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X size={21} /> : <Menu size={21} />}
          </button>
        </div>
      </div>

      {/* Mobile navigation: accordion sections, large touch targets, no desktop mega-menu overflow */}
      {mobileOpen && (
        <div className="border-t border-white/5 bg-ink-950 px-3 pb-5 pt-2 shadow-soft-lg xl:hidden">
          <div className="mb-2 flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5">
            <Search size={17} className="shrink-0 text-slate-400" />
            <form
              className="flex min-w-0 flex-1"
              onSubmit={(e) => {
                e.preventDefault();
                submitSearch(mobileSearch);
                closeMobile();
              }}
            >
              <input
                value={mobileSearch}
                onChange={(e) => setMobileSearch(e.target.value)}
                placeholder="Search broker name…"
                className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
                aria-label="Search broker name"
              />
            </form>
          </div>

          <div className="grid gap-1 pb-20">
            <MobileMenuButton label="Broker Reviews" open={mobileSection === 'reviews'} onClick={() => toggleMobile('reviews')} />
            {mobileSection === 'reviews' && (
              <div className="grid gap-1 border-l border-white/10 pl-2">
                <p className="px-3 pt-1 text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-400">{topBrokers.label}</p>
                {topBrokers.list.slice(0, 3).map((b) => (
                  <MobileLink key={b.slug} to={`/brokers/${b.slug}`} onClick={closeMobile}>{b.name}</MobileLink>
                ))}
                {topBrokers.list.length === 0 && (
                  <p className="px-3 py-2 text-xs text-slate-500">Loading recommendations…</p>
                )}
                <MobileLink to="/brokers" onClick={closeMobile}>See all brokers →</MobileLink>
              </div>
            )}

            <MobileMenuButton label="Tools" open={mobileSection === 'tools'} onClick={() => toggleMobile('tools')} />
            {mobileSection === 'tools' && (
              <div className="grid gap-1 border-l border-white/10 pl-2">
                {TOOL_LINKS.map((tool) => <MobileLink key={tool.to} to={tool.to} onClick={closeMobile}>{tool.label}</MobileLink>)}
              </div>
            )}

            <MobileMenuButton label="Guides" open={mobileSection === 'guides'} onClick={() => toggleMobile('guides')} />
            {mobileSection === 'guides' && (
              <div className="grid gap-1 border-l border-white/10 pl-2">
                <MobileLink to="/guides" onClick={closeMobile}>Guides</MobileLink>
                <MobileLink to="/compare" onClick={closeMobile}>Side-by-side broker comparisons</MobileLink>
                {intents.slice(0, 6).map((i) => (
                  <MobileLink key={i.slug} to={`/best/${i.slug}`} onClick={closeMobile}>{i.title.replace(/ \(\d{4}\)/, '')}</MobileLink>
                ))}
                <MobileLink to="/#categories" onClick={closeMobile}>See all categories →</MobileLink>
              </div>
            )}

            <MobileMenuButton label="About us" open={mobileSection === 'about'} onClick={() => toggleMobile('about')} />
            {mobileSection === 'about' && (
              <div className="grid gap-1 border-l border-white/10 pl-2">
                {ABOUT_LINKS.map((item) => <MobileLink key={item.to} to={item.to} onClick={closeMobile}>{item.label}</MobileLink>)}
              </div>
            )}

            {/* Single country control — was previously duplicated as both an
                accordion entry above and a separate status bar down here. */}
            <button
              onClick={() => toggleMobile('country')}
              className="mt-1 flex w-full items-center justify-between rounded-xl border border-white/10 px-3 py-2.5"
              aria-expanded={mobileSection === 'country'}
            >
              <span className="text-xs font-semibold text-slate-400">Country</span>
              <span className="flex items-center gap-1.5 text-sm font-semibold text-white">
                {activeGeo ? `${activeGeo.flag} ${activeGeo.name}` : '🌐 Global'}
                <ChevronDown size={14} className={`transition ${mobileSection === 'country' ? 'rotate-180' : ''}`} />
              </span>
            </button>
            {mobileSection === 'country' && (
              <div className="rounded-xl border border-white/10 bg-white/5 p-2">
                <button onClick={() => { selectCountry(''); closeMobile(); }} className="w-full rounded-lg px-3 py-2.5 text-left text-sm text-slate-300 hover:bg-white/5">🌐 Global</button>
                <div className="grid grid-cols-2 gap-1">
                  {majorCountries.map((c) => (
                    <MobileLink key={c.slug} to={`/${c.slug}`} onClick={closeMobile}>{c.flag} {c.label}</MobileLink>
                  ))}
                </div>
                <MobileLink to="/countries" onClick={closeMobile}>See all countries →</MobileLink>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Persistent primary CTA, pinned to the viewport so it's reachable
          without scrolling through the whole mobile menu. */}
      {mobileOpen && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-ink-950 p-3 xl:hidden">
          <Link to="/quiz" onClick={closeMobile} className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-bold text-white shadow-soft">
            <Sparkles size={16} /> Find My Broker
          </Link>
        </div>
      )}
    </header>
  );
}

function MobileMenuButton({ label, open, onClick }: { label: string; open: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex min-h-12 w-full items-center justify-between rounded-xl px-3 py-3 text-left text-[15px] font-semibold text-slate-200 transition hover:bg-white/5"
      aria-expanded={open}
    >
      {label}
      <ChevronDown size={17} className={`text-slate-500 transition ${open ? 'rotate-180' : ''}`} />
    </button>
  );
}

function MobileLink({ to, children, onClick }: { to: string; children: React.ReactNode; onClick?: () => void }) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className="rounded-lg px-3 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-white/5 hover:text-emerald-300"
    >
      {children}
    </Link>
  );
}
