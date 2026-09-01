import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { Session } from '@supabase/supabase-js';
import {
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  CircleDollarSign,
  Copy,
  ExternalLink,
  Eye,
  FlaskConical,
  FileText,
  Info,
  KeyRound,
  Landmark,
  LayoutDashboard,
  Loader2,
  Lock,
  LogOut,
  Menu,
  MessageSquare,
  MousePointerClick,
  Newspaper,
  Pencil,
  Plus,
  Sparkles,
  BookOpen,
  Search,
  ShieldAlert,
  ShieldCheck,
  Star,
  Tags,
  Trash2,
  Users,
  Link2,
  Globe2,
  X,
} from 'lucide-react';
import AnalyticsPanel from './AnalyticsPanel';
import supabase from '../lib/supabase';
import type { Broker, BrokerContent, CountryBestFor, CountryPage, FAQ, Guide, GuideSection, Intent, Promotion, Regulation, Review, TestResult, ContentDocument, CountryLanguage, LocalizedSeoPage } from '../lib/types';
import { legacySectionsToBlocks, brokerContentToLegacySections, guideSectionsToLegacySections, introCriteriaToLegacySections, faqsToBlocks } from '../lib/contentBlocks';
import Monogram from '../components/Monogram';
import Stars from '../components/Stars';
import { fmtDate, timeAgo } from '../lib/format';
import { INTENT_LABELS } from '../lib/score';
import PageBuilder, { blocksToHtml, type PageBlock } from '../components/PageBuilder';
import { initEditorBlocks } from '../lib/content/loadDocument';

/* =============================== TYPES =============================== */

type Tab = 'overview' | 'brokers' | 'countries' | 'global' | 'authors' | 'commercial' | 'analytics' | 'team';

interface Sub {
  id: number;
  email: string;
  created_at: string;
}

interface ClickRow {
  id: number;
  broker_id: number;
  page: string;
  created_at: string;
}

interface ClicksAgg {
  total: number;
  allTimeTotal?: number;
  byBroker: Record<string, number>;
  byPage: Record<string, number>;
  byDay?: Record<string, number>;
  recent: ClickRow[];
}

type BrokerForm = Record<string, any>;

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin (full ops)',
  brokers_admin: 'Brokers manager',
  content_admin: 'Content editor',
  moderator: 'Moderator',
};

const ROLE_ACCESS: Record<string, string[]> = {
  overview: ['super_admin', 'admin', 'brokers_admin', 'content_admin', 'moderator'],
  brokers: ['super_admin', 'admin', 'brokers_admin'],
  countries: ['super_admin', 'admin', 'content_admin', 'brokers_admin'],
  global: ['super_admin', 'admin', 'content_admin'],
  authors: ['super_admin', 'admin', 'content_admin'],
  commercial: ['super_admin', 'admin'],
  analytics: ['super_admin', 'admin', 'brokers_admin', 'content_admin', 'moderator'],
  team: ['super_admin'],
};

const TABS: { key: Tab; label: string; icon: typeof Landmark; desc: string }[] = [
  { key: 'overview', label: 'Overview', icon: LayoutDashboard, desc: 'Operational tasks, gaps and admin shortcuts.' },
  { key: 'brokers', label: 'Broker Workspace', icon: Landmark, desc: 'Manage broker profile, rich content, trading data, countries, reviews, promotions and affiliate coverage.' },
  { key: 'countries', label: 'Country Hub', icon: Globe2, desc: 'Manage country overview, publishing, SEO, brokers, best-for pages, guides, FAQs and internal links.' },
  { key: 'global', label: 'Global Hub', icon: BookOpen, desc: 'Manage guides and best-for pages that are not country-specific.' },
  { key: 'authors', label: 'Author Hub', icon: Users, desc: 'Manage public author profiles, bios, expertise, credentials, photos, links and attribution.' },
  { key: 'commercial', label: 'Commercial', icon: Link2, desc: 'Affiliate links, promotions and conversion reporting.' },
  { key: 'analytics', label: 'Analytics', icon: BarChart3, desc: 'CTA performance, quiz funnel, layouts and conversions by date range.' },
  { key: 'team', label: 'Team', icon: ShieldCheck, desc: 'Invite staff, assign roles and control access.' },
];

const ADMIN_ACTIVE_TAB_STORAGE_KEY = 'piprank-admin-active-tab';
const DEFAULT_ADMIN_TAB: Tab = 'overview';
const VALID_ADMIN_TAB_KEYS = new Set<Tab>(TABS.map((tab) => tab.key));

function normalizeAdminTab(value: string | null): string | null {
  if (value === 'pages' || value === 'content' || value === 'rankings' || value === 'localization') return 'countries';
  if (value === 'reviews') return 'brokers';
  if (value === 'promos' || value === 'affiliate' || value === 'conversions' || value === 'subs') return 'commercial';
  return value;
}

function isAdminTab(value: string | null): value is Tab {
  return value !== null && VALID_ADMIN_TAB_KEYS.has(value as Tab);
}

function readSavedAdminTab(): Tab {
  if (typeof window === 'undefined') return DEFAULT_ADMIN_TAB;

  try {
    const hashTab = normalizeAdminTab(new URLSearchParams(window.location.hash.replace(/^#/, '')).get('tab'));
    if (isAdminTab(hashTab)) return hashTab;
    const savedTab = window.localStorage.getItem(ADMIN_ACTIVE_TAB_STORAGE_KEY);
    if (isAdminTab(savedTab)) return savedTab;
    if (savedTab !== null) window.localStorage.removeItem(ADMIN_ACTIVE_TAB_STORAGE_KEY);
  } catch {
    // Ignore storage access failures so private browsing or blocked storage does not break admin.
  }

  return DEFAULT_ADMIN_TAB;
}

function saveAdminTab(tab: Tab) {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(ADMIN_ACTIVE_TAB_STORAGE_KEY, tab);
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    params.set('tab', tab);
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#${params.toString()}`);
  } catch {
    // Ignore storage access failures; the in-memory tab state still updates.
  }
}

const NUMERIC_KEYS = new Set([
  'rating',
  'trust_score',
  'min_deposit',
  'spread_eurusd',
  'commission_value',
  'leverage_value',
  'execution_ms',
  'withdrawal_hours',
  'uptime',
  'withdrawal_fee',
  'founded',
  'support_score',
]);

const PLATFORM_OPTIONS = ['MT4', 'MT5', 'cTrader', 'TradingView', 'ProRealTime', 'FIX API'];
const PAYMENT_OPTIONS = ['Bank transfer', 'Visa', 'Mastercard', 'PayPal', 'Skrill', 'Neteller', 'UnionPay', 'ACH', 'Crypto (USDT)', 'Apple Pay'];
const SUPPORT_OPTIONS = ['Live chat', 'Email', 'Phone', 'WhatsApp', 'Message center'];

const HEALTH_FACTORS: { key: string; label: string }[] = [
  { key: 'regulation', label: 'Regulation quality' },
  { key: 'withdrawals', label: 'Withdrawal reliability' },
  { key: 'execution', label: 'Execution quality' },
  { key: 'longevity', label: 'Years in business' },
  { key: 'support', label: 'Customer support' },
  { key: 'sentiment', label: 'User sentiment' },
];

const NEW_BROKER: BrokerForm = {
  name: '',
  slug: '',
  tagline: '',
  brand_color: '#35a371',
  rating: '4.0',
  trust_score: '75',
  founded: String(new Date().getFullYear()),
  headquarters: '',
  website: 'https://',
  min_deposit: '100',
  spread_eurusd: '0.8',
  commission: 'None (spread-only)',
  commission_value: '0',
  max_leverage: '1:500',
  leverage_value: '500',
  execution_ms: '50',
  withdrawal_hours: '24',
  deposit_time: 'Instant',
  uptime: '99.9',
  withdrawal_fee: '0',
  inactivity_fee: 'None',
  demo_account: true,
  islamic_account: false,
  copy_trading: false,
  scalping: true,
  hedging: true,
  nbp: true,
  segregated: true,
  bonus: '',
  support_channels: ['Live chat', 'Email'],
  support_score: '80',
  regulations: [],
  platforms: ['MT4', 'MT5'],
  payments: ['Bank transfer', 'Visa', 'Mastercard'],
  account_types: ['Standard', 'Demo'],
  assets: { forex: 50, indices: 12, commodities: 10, crypto: 10, stocks: 500 },
  best_for: [],
  pros: [],
  cons: [],
  review: [],
  testing: [],
  faqs: [],
  health: { regulation: 80, longevity: 75, withdrawals: 80, execution: 78, support: 80, sentiment: 78 },
  featured: false,
};

/* ============================ AUTH GATE ============================ */

export default function Admin() {
  const [session, setSession] = useState<Session | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [role, setRole] = useState<'checking' | 'none' | string>('checking');

  useEffect(() => {
    document.title = 'Console | PipRank';
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setCheckingAuth(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setCheckingAuth(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // resolve the admin role for this account
  useEffect(() => {
    if (!session) return;
    setRole('checking');
    fetch('/api/admin-users?self=1', {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then((r) => (r.ok ? r.json() : { role: null }))
      .then((d) => setRole(d.role ?? 'none'))
      .catch(() => setRole('none'));
  }, [session]);

  if (checkingAuth || (session && role === 'checking'))
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper">
        <Loader2 className="animate-spin text-emerald-600" size={32} />
      </div>
    );

  if (!session) return <Login />;
  if (role === 'none') return <AccessDenied email={session.user.email ?? ''} />;
  return <Dashboard session={session} role={role} />;
}

function AccessDenied({ email }: { email: string }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-ink-950 px-4">
      <div className="absolute inset-0 bg-grid-dark" />
      <div className="relative w-full max-w-sm rounded-3xl border border-line bg-white p-8 text-center shadow-soft-lg">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-500">
          <ShieldAlert size={22} />
        </div>
        <h1 className="mt-4 font-display text-xl font-bold text-ink-900">No admin access</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-500">
          <span className="font-semibold text-ink-900">{email}</span> signed in successfully, but it isn't on the
          admin team list. Ask the super admin to grant you a role.
        </p>
        <button
          onClick={() => supabase.auth.signOut()}
          className="mt-5 w-full rounded-xl bg-ink-950 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-ink-800"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}

/* ============================ LOGIN ============================ */

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    if (err) setError(err.message);
    setBusy(false);
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-ink-950 px-4">
      <div className="absolute inset-0 bg-grid-dark" />
      <div className="absolute -top-24 left-1/2 h-64 w-[560px] -translate-x-1/2 rounded-full bg-emerald-500/10 blur-[130px]" />
      <div className="relative w-full max-w-sm">
        <div className="rounded-3xl border border-line bg-white p-8 shadow-soft-lg">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-ink-950 text-emerald-400">
            <Lock size={22} />
          </div>
          <h1 className="mt-5 font-display text-2xl font-bold text-ink-900">PipRank Admin</h1>
          <p className="mt-1 text-sm text-slate-500">Manage brokers, reviews, categories and content.</p>
          <form onSubmit={submit} className="mt-6 space-y-3">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Your email"
              className="h-11 w-full rounded-xl border border-line bg-paper px-4 text-sm outline-none focus:border-emerald-500"
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="h-11 w-full rounded-xl border border-line bg-paper px-4 text-sm outline-none focus:border-emerald-500"
            />
            {error && <p className="text-sm font-medium text-rose-600">{error}</p>}
            <button
              type="submit"
              disabled={busy}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-ink-950 text-sm font-bold text-white transition hover:bg-ink-800 disabled:opacity-60"
            >
              {busy && <Loader2 size={15} className="animate-spin" />}
              Sign in
            </button>
          </form>
          <Link
            to="/"
            className="mt-4 block text-center text-xs font-semibold text-slate-400 transition hover:text-emerald-700"
          >
            ← Back to the site
          </Link>
        </div>
      </div>
    </div>
  );
}


/* ============================ LOCALIZATION MANAGER ============================ */
/* Extracted to src/components/admin/LocalizationManager.tsx */

/* ============================ DASHBOARD SHELL ============================ */

function Dashboard({ session, role }: { session: Session; role: string }) {
  const [tab, setTab] = useState<Tab>(() => readSavedAdminTab());
  const [menuOpen, setMenuOpen] = useState(false);
  const [brokers, setBrokers] = useState<Broker[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [guides, setGuides] = useState<Guide[]>([]);
  const [intents, setIntents] = useState<Intent[]>([]);
  const [countries, setCountries] = useState<CountryPage[]>([]);
  const [countryBestFors, setCountryBestFors] = useState<CountryBestFor[]>([]);
  const [subs, setSubs] = useState<Sub[]>([]);
  const [clicks, setClicks] = useState<ClicksAgg>({ total: 0, byBroker: {}, byPage: {}, recent: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [editingBroker, setEditingBroker] = useState<Broker | null | 'new'>(null);
  const [editingGuide, setEditingGuide] = useState<Guide | null | 'new'>(null);
  const [editingCountry, setEditingCountry] = useState<CountryPage | null | 'new'>(null);
  const [editingIntent, setEditingIntent] = useState<Intent | null | 'new'>(null);
  const [editingCountryBestFor, setEditingCountryBestFor] = useState<CountryBestFor | 'new' | null>(null);
  const [editingBrokerContent, setEditingBrokerContent] = useState<Broker | null>(null);
  const [contentDocs, setContentDocs] = useState<ContentDocument[]>([]);
  const [editingContentDoc, setEditingContentDoc] = useState<ContentDocument | 'new' | null>(null);
  const [newDocDefaultCountry, setNewDocDefaultCountry] = useState<string | undefined>(undefined);
  const [countryLanguages, setCountryLanguages] = useState<CountryLanguage[]>([]);
  const [localizedPages, setLocalizedPages] = useState<LocalizedSeoPage[]>([]);

  const headers = useCallback(
    () => ({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    }),
    [session.access_token]
  );

  const notify = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }, []);

  const load = useCallback(async () => {
    try {
      const [b, r, g, i, co, cb, s, c, cd, cl, lp] = await Promise.all([
        fetch('/api/brokers').then((x) => x.json()),
        fetch('/api/reviews', { headers: headers() }).then((x) => x.json()),
        fetch('/api/guides').then((x) => x.json()),
        fetch('/api/intents').then((x) => x.json()),
        fetch('/api/countries').then((x) => x.json()),
        fetch('/api/country-best-for').then((x) => x.json()),
        fetch('/api/newsletter', { headers: headers() }).then((x) => x.json()),
        fetch('/api/track?resource=clicks', { headers: headers() }).then((x) => x.json()),
        fetch('/api/content-documents').then((x) => x.json()),
        fetch('/api/country-languages?admin=true', { headers: headers() }).then((x) => x.json()),
        fetch('/api/localized-seo-pages?admin=true', { headers: headers() }).then((x) => x.json()),
      ]);
      if (Array.isArray(b)) setBrokers(b);
      if (Array.isArray(r)) setReviews(r);
      if (Array.isArray(g)) setGuides(g);
      if (Array.isArray(i)) setIntents(i);
      if (Array.isArray(co)) setCountries(co);
      if (Array.isArray(cb)) setCountryBestFors(cb);
      if (Array.isArray(s)) setSubs(s);
      if (c && typeof c === 'object' && Array.isArray(c.recent)) setClicks(c);
      if (Array.isArray(cd)) setContentDocs(cd);
      if (Array.isArray(cl)) setCountryLanguages(cl);
      if (Array.isArray(lp)) setLocalizedPages(lp);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load admin data');
    } finally {
      setLoading(false);
    }
  }, [headers]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const onHashChange = () => {
      const nextTab = normalizeAdminTab(new URLSearchParams(window.location.hash.replace(/^#/, '')).get('tab'));
      if (isAdminTab(nextTab)) setTab(nextTab);
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const mutate = async (path: string, method: string, body: unknown, msg: string) => {
    const res = await fetch(path, { method, headers: headers(), body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert((data as { error?: string }).error || `Action failed (${res.status})`);
      return;
    }
    notify(msg);
    await load();
  };

  const brokerName = useMemo(() => {
    const map = new Map<number, Broker>();
    brokers.forEach((b) => map.set(b.id, b));
    return map;
  }, [brokers]);

  const counts: Record<string, number | null> = {
    overview: null,
    brokers: brokers.length,
    countries: countries.length,
    authors: contentDocs.filter((d) => d.content_type === 'author').length,
    commercial: null,
    analytics: null,
    team: null,
  };
  const visibleTabs = TABS.filter((t) => (ROLE_ACCESS[t.key] ?? []).includes(role));

  const setActiveAdminTab = useCallback((nextTab: Tab) => {
    setTab(nextTab);
    saveAdminTab(nextTab);
  }, []);

  const activeTab = visibleTabs.find((t) => t.key === tab)?.key ?? visibleTabs[0]?.key ?? DEFAULT_ADMIN_TAB;
  const active = visibleTabs.find((t) => t.key === activeTab) ?? visibleTabs[0];

  const nav = (onPick?: () => void) =>
    visibleTabs.map((t) => (
      <button
        key={t.key}
        onClick={() => {
          setActiveAdminTab(t.key);
          onPick?.();
        }}
        className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition ${
          activeTab === t.key
            ? 'bg-ink-950 text-white shadow-sm'
            : 'text-slate-500 hover:bg-paper hover:text-ink-900'
        }`}
      >
        <t.icon size={16} className={activeTab === t.key ? 'text-emerald-400' : 'text-slate-400'} />
        {t.label}
        {counts[t.key] !== null && (
          <span
            className={`tnum ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold ${
              activeTab === t.key ? 'bg-white/15 text-emerald-300' : 'bg-paper text-slate-500'
            }`}
          >
            {counts[t.key]}
          </span>
        )}
      </button>
    ));

  return (
    <div className="flex min-h-screen bg-paper">
      {/* ======================= SIDEBAR (desktop) ======================= */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-line bg-white lg:flex">
        <div className="flex items-center gap-2.5 border-b border-line px-5 py-5">
          <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden="true">
            <rect width="32" height="32" rx="7" fill="#0d1b12" />
            <line x1="9" y1="6" x2="9" y2="18" stroke="#57b98b" strokeWidth="1.6" strokeLinecap="round" />
            <rect x="6.8" y="9.5" width="4.4" height="6.5" rx="1" fill="#57b98b" />
            <line x1="16" y1="12" x2="16" y2="25" stroke="#ff6b6b" strokeWidth="1.6" strokeLinecap="round" />
            <rect x="13.8" y="15" width="4.4" height="6" rx="1" fill="#ff6b6b" />
            <line x1="23" y1="4.5" x2="23" y2="15.5" stroke="#57b98b" strokeWidth="1.6" strokeLinecap="round" />
            <rect x="20.8" y="7.5" width="4.4" height="6.5" rx="1" fill="#57b98b" />
          </svg>
          <div>
            <p className="font-display text-[15px] font-bold leading-none text-ink-900">
              PipRank <span className="text-emerald-600">Admin</span>
            </p>
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-widest text-slate-400">Console</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-3">{nav()}</nav>

        <div className="border-t border-line p-3">
          <Link
            to="/"
            className="flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-slate-500 transition hover:bg-paper hover:text-ink-900"
          >
            <ExternalLink size={16} className="text-slate-400" />
            View site
          </Link>
          <div className="mt-2 flex items-center gap-2.5 rounded-xl bg-paper px-3.5 py-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink-950 text-xs font-bold text-emerald-400">
              {(session.user.email ?? 'A')[0].toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-bold text-ink-900">{session.user.email}</p>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700">{ROLE_LABELS[role] ?? role}</p>
            </div>
            <button
              onClick={() => supabase.auth.signOut()}
              className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white hover:text-rose-600"
              title="Sign out"
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </aside>

      {/* ======================= MAIN ======================= */}
      <div className="min-w-0 flex-1">
        {/* mobile top bar */}
        <div className="sticky top-0 z-40 border-b border-line bg-white/90 backdrop-blur lg:hidden">
          <div className="flex items-center gap-3 px-4 py-3">
            <p className="font-display text-base font-bold text-ink-900">
              PipRank <span className="text-emerald-600">Admin</span>
            </p>
            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={() => supabase.auth.signOut()}
                className="rounded-lg p-2 text-slate-400 transition hover:bg-paper hover:text-rose-600"
                title="Sign out"
              >
                <LogOut size={16} />
              </button>
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="rounded-lg p-2 text-slate-600 transition hover:bg-paper"
                aria-label="Menu"
              >
                {menuOpen ? <X size={18} /> : <Menu size={18} />}
              </button>
            </div>
          </div>
          {menuOpen && <nav className="space-y-1 border-t border-line bg-white p-3">{nav(() => setMenuOpen(false))}</nav>}
        </div>

        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-8">
          {/* page head */}
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="font-display text-2xl font-bold tracking-tight text-ink-900 sm:text-3xl">
                {active.label}
              </h1>
              <p className="mt-1 text-sm text-slate-500">{active.desc}</p>
            </div>
            {(activeTab === 'brokers' || activeTab === 'countries' || activeTab === 'authors') && (
              <button
                onClick={() => activeTab === 'brokers' ? setEditingBroker('new') : activeTab === 'countries' ? setEditingCountry('new') : setEditingContentDoc({ id: 0, content_key: 'author:new-author', content_type: 'author', country_slug: null, topic_slug: null, slug: 'new-author', title: '', excerpt: '', html: '', blocks: [], seo_title: null, seo_description: null, indexable: false, published: false, updated_by: null, created_at: '', updated_at: '', settings: { role: '', short_bio: '', expertise: [], credentials: [], links: [], display_order: 0, photo_url: '' } } as ContentDocument)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-ink-950 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-ink-800"
              >
                <Plus size={14} className="text-emerald-400" /> {activeTab === 'brokers' ? 'New broker' : activeTab === 'countries' ? 'New country' : 'New author'}
              </button>
            )}
          </div>

          {error && (
            <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>
          )}

          <div className="mt-6">
            {loading ? (
              <div className="h-96 animate-pulse rounded-2xl border border-line bg-white" />
            ) : (
              <>
                {activeTab === 'overview' && (
                  <Overview
                    brokers={brokers}
                    reviews={reviews}
                    subs={subs}
                    clicks={clicks}
                    brokerName={brokerName}
                    onGoBrokers={() => setActiveAdminTab('brokers')}
                  />
                )}
                {activeTab === 'analytics' && <AnalyticsPanel token={session.access_token} brokers={brokers} />}
                {activeTab === 'brokers' && (
                  <BrokersTab
                    brokers={brokers}
                    onNew={() => setEditingBroker('new')}
                    onEdit={(b) => setEditingBroker(b)}
                    onEditContent={(b) => setEditingBrokerContent(b)}
                    onDuplicate={(b) => {
                      const copy: BrokerForm = { ...b, name: `${b.name} (copy)`, slug: `${b.slug}-copy`, featured: false };
                      delete copy.id;
                      mutate('/api/brokers', 'POST', copy, `${b.name} duplicated`);
                    }}
                    onToggleFeatured={(b) =>
                      mutate('/api/brokers', 'PUT', { id: b.id, featured: !b.featured }, `${b.name} ${b.featured ? 'removed from featured' : 'marked as featured'}`)
                    }
                    onDelete={(b) => {
                      if (window.confirm(`Delete ${b.name} and all its reviews? This cannot be undone.`))
                        mutate('/api/brokers', 'DELETE', { id: b.id }, `${b.name} deleted`);
                    }}
                  />
                )}
                {activeTab === 'countries' && (
                  <CountryHub
                    countries={countries}
                    brokers={brokers}
                    countryBestFors={countryBestFors}
                    contentDocs={contentDocs}
                    countryLanguages={countryLanguages}
                    localizedPages={localizedPages}
                    token={session.access_token}
                    notify={notify}
                    reloadLocalization={() => {
                      fetch('/api/country-languages?admin=true', { headers: headers() }).then((x) => x.json()).then((cl) => { if (Array.isArray(cl)) setCountryLanguages(cl); }).catch(() => {});
                      fetch('/api/localized-seo-pages?admin=true', { headers: headers() }).then((x) => x.json()).then((lp) => { if (Array.isArray(lp)) setLocalizedPages(lp); }).catch(() => {});
                    }}
                    onNewCountry={() => setEditingCountry('new')}
                    onEditCountry={(c) => setEditingCountry(c)}
                    onEditCountryBestFor={(p) => setEditingCountryBestFor(p)}
                    onEditContentDoc={(d) => setEditingContentDoc(d)}
                    onNewCountryContentDoc={(slug) => { setNewDocDefaultCountry(slug); setEditingContentDoc('new'); }}
                    onSeedCountryBestFor={async (key, page, blocks) => {
                      try {
                        const res = await fetch('/api/content-documents', {
                          method: 'POST',
                          headers: headers(),
                          body: JSON.stringify({ content_key: key, content_type: 'country-best-for', country_slug: page.country_slug ?? null, topic_slug: page.slug, slug: page.slug, title: page.title || page.label, excerpt: '', html: '', blocks, seo_title: page.meta_title || '', seo_description: page.meta_description || '', indexable: true, published: true }),
                        });
                        const doc = await res.json().catch(() => null);
                        if (!res.ok) throw new Error((doc as { error?: string })?.error || 'Could not create rich content');
                        notify('Existing content loaded into the visual builder');
                        setEditingContentDoc(doc as ContentDocument);
                      } catch (e) {
                        notify(e instanceof Error ? e.message : 'Could not open visual builder');
                      }
                    }}
                  />
                )}
                {activeTab === 'global' && (
                  <GlobalHub
                    guides={guides}
                    intents={intents}
                    contentDocs={contentDocs}
                    token={session.access_token}
                    notify={notify}
                    onNewGuide={() => setEditingGuide('new')}
                    onEditGuide={(g) => setEditingGuide(g)}
                    onNewIntent={() => setEditingIntent('new')}
                    onEditIntent={(i) => setEditingIntent(i)}
                    onEditContentDoc={(d) => setEditingContentDoc(d)}
                  />
                )}
                {activeTab === 'authors' && (
                  <AuthorHub
                    authors={contentDocs.filter((d) => d.content_type === 'author')}
                    allContent={contentDocs}
                    onNewAuthor={() => setEditingContentDoc({ id: 0, content_key: 'author:new-author', content_type: 'author', country_slug: null, topic_slug: null, slug: 'new-author', title: '', excerpt: '', html: '', blocks: [], seo_title: null, seo_description: null, indexable: false, published: false, updated_by: null, created_at: '', updated_at: '', settings: { role: '', short_bio: '', expertise: [], credentials: [], links: [], display_order: 0, photo_url: '' } } as ContentDocument)}
                    onEditAuthor={(d) => setEditingContentDoc(d)}
                  />
                )}
                {activeTab === 'commercial' && (
                  <CommercialHub token={session.access_token} brokers={brokers} notify={notify} />
                )}
                {activeTab === 'team' && (
                  <TeamTab token={session.access_token} myEmail={(session.user.email ?? '').toLowerCase()} />
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* toast */}
      {toast && (
        <div className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-full bg-ink-950 px-5 py-3 text-sm font-semibold text-emerald-300 shadow-soft-lg">
          ✓ {toast}
        </div>
      )}

      {/* drawers */}
      {editingBroker && (
        <BrokerEditor
          broker={editingBroker === 'new' ? null : editingBroker}
          intents={intents}
          token={session.access_token}
          onClose={() => setEditingBroker(null)}
          onSave={async (fields) => {
            if (editingBroker === 'new') {
              await mutate('/api/brokers', 'POST', fields, 'Broker created');
              setEditingBroker(null);
            } else {
              await mutate('/api/brokers', 'PUT', { id: editingBroker.id, ...fields }, 'Saved — live on site');
            }
          }}
        />
      )}
      {editingGuide && (
        <GuideEditor
          guide={editingGuide === 'new' ? null : editingGuide}
          onClose={() => setEditingGuide(null)}
          onSave={async (fields, isNew) => {
            await mutate('/api/guides', isNew ? 'POST' : 'PUT', fields, isNew ? 'Guide published' : 'Guide saved');
            if (isNew) setEditingGuide(null);
          }}
        />
      )}
      {editingIntent && (
        <IntentEditor
          intent={editingIntent === 'new' ? null : editingIntent}
          onClose={() => setEditingIntent(null)}
          onSave={async (fields, isNew) => {
            await mutate('/api/intents', isNew ? 'POST' : 'PUT', fields, isNew ? 'Intent published' : 'Intent saved');
            setEditingIntent(null);
          }}
        />
      )}
      {editingBrokerContent && (
        <BrokerContentEditor
          broker={editingBrokerContent}
          token={session.access_token}
          onClose={() => setEditingBrokerContent(null)}
          onSave={async (content) => {
            const res = await fetch('/api/broker-assets?resource=content', {
              method: 'PUT',
              headers: headers(),
              body: JSON.stringify({ ...content, broker_id: editingBrokerContent.id }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || 'Could not save broker content');
            notify('Broker detailed content saved');
            setEditingBrokerContent(null);
          }}
        />
      )}
      {editingCountryBestFor && (
        <CountryBestForEditor
          page={editingCountryBestFor === 'new' ? null : editingCountryBestFor}
          countries={countries}
          intents={intents}
          onClose={() => setEditingCountryBestFor(null)}
          onSave={async (fields, isNew) => {
            await mutate('/api/country-best-for', isNew ? 'POST' : 'PUT', fields, isNew ? 'Best-for page published' : 'Best-for page saved');
            setEditingCountryBestFor(null);
          }}
        />
      )}
      {editingCountry && (
        <CountryEditor
          country={editingCountry === 'new' ? null : editingCountry}
          brokers={brokers}
          onClose={() => setEditingCountry(null)}
          onSave={async (fields, isNew) => {
            await mutate('/api/countries', isNew ? 'POST' : 'PUT', fields, isNew ? 'Country published' : 'Country saved');
            if (isNew) setEditingCountry(null);
          }}
        />
      )}
      {editingContentDoc && (
        <ContentDocumentEditor
          key={editingContentDoc === 'new' ? 'new' : String((editingContentDoc as ContentDocument).id)}
          document={editingContentDoc === 'new' ? null : editingContentDoc}
          countries={countries}
          token={session.access_token}
          defaultCountrySlug={editingContentDoc === 'new' ? newDocDefaultCountry : undefined}
          onClose={() => { setEditingContentDoc(null); setNewDocDefaultCountry(undefined); }}
          onSave={async (fields, isNew) => {
            await mutate('/api/content-documents', isNew ? 'POST' : 'PUT', fields, isNew ? 'Rich content published' : 'Rich content saved');
            setEditingContentDoc(null);
            setNewDocDefaultCountry(undefined);
          }}
        />
      )}
    </div>
  );
}

/* ======================= BROKER CONTENT EDITOR ======================= */

function BrokerContentEditor({ broker, token, onClose, onSave }: { broker: Broker; token: string; onClose: () => void; onSave: (content: BrokerContent) => Promise<void> }) {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [countries, setCountries] = useState<any[]>([]);
  const [availabilityRows, setAvailabilityRows] = useState<{ country_id: number; status: 'available' | 'restricted' | 'unavailable' | 'unknown'; note: string; priority: number }[]>([]);
  const [countrySearch, setCountrySearch] = useState('');
  const [advanced, setAdvanced] = useState<Record<string,string>>({
    overview:'[]', verdict:'[]', why_recommend:'[]', best_for_detail:'[]', avoid_if:'[]', regulation_detail:'[]', fees_detail:'[]', platform_intro:'[]', accounts_intro:'[]', funding_intro:'[]', faqs:'[]', platforms:'[]', accounts:'[]', payments:'[]'
  });
  const [richDocs, setRichDocs] = useState<ContentDocument[]>([]);
  const [editingDoc, setEditingDoc] = useState<ContentDocument | null>(null);
  const [newDoc, setNewDoc] = useState(false);
  const [seedNewDoc, setSeedNewDoc] = useState(false);

  const hasMainDoc = richDocs.some((d) => (d.slug || 'main') === 'main');
  const legacySeedBlocks = useMemo(() => {
    const parse = (k: string) => { try { const v = JSON.parse(advanced[k] ?? '[]'); return Array.isArray(v) ? v : []; } catch { return []; } };
    const content: BrokerContent = {
      broker_id: broker.id, overview: parse('overview'), verdict: parse('verdict'), why_recommend: parse('why_recommend'),
      best_for_detail: parse('best_for_detail'), avoid_if: parse('avoid_if'), regulation_detail: parse('regulation_detail'),
      fees_detail: parse('fees_detail'), platform_intro: parse('platform_intro'), accounts_intro: parse('accounts_intro'),
      funding_intro: parse('funding_intro'), platforms: [], accounts: [], payments: [],
    };
    return [...legacySectionsToBlocks(brokerContentToLegacySections(content)), ...faqsToBlocks(parse('faqs'))];
  }, [advanced, broker.id]);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [data,av,c,docs] = await Promise.all([
        fetch(`/api/broker-assets?resource=content&broker_id=${broker.id}`).then(r=>r.json()),
        fetch(`/api/broker-assets?resource=availability&broker_id=${broker.id}`).then(r=>r.json()).catch(()=>[]),
        fetch('/api/countries').then(r=>r.json()).catch(()=>[]),
        fetch(`/api/content-documents?type=broker&slug=${encodeURIComponent(broker.slug)}`).then(r=>r.json()).catch(()=>[]),
      ]);
      const d=data??{};
      setAdvanced(Object.fromEntries(['overview','verdict','why_recommend','best_for_detail','avoid_if','regulation_detail','fees_detail','platform_intro','accounts_intro','funding_intro','faqs','platforms','accounts','payments'].map((k)=>[k,JSON.stringify(d[k]??[],null,2)])));
      setAvailabilityRows((Array.isArray(av)?av:[]).map((r:any)=>({country_id:Number(r.country_id),status:r.status || 'unknown',note:r.note??'',priority:Number(r.priority??0)})));
      setCountries(Array.isArray(c)?c:[]);
      setRichDocs(Array.isArray(docs)?docs:[]);
    } catch(e) { setError(e instanceof Error?e.message:'Failed to load broker content'); }
    finally { setLoading(false); }
  }, [broker.id, broker.slug]);

  useEffect(()=>{ load(); },[load]);

  const saveAdvanced = async () => {
    try {
      const parse=(k:string)=>{ const v=JSON.parse(advanced[k]??'[]'); if(!Array.isArray(v)) throw new Error(`${k} must be a JSON array.`); return v; };
      const content: BrokerContent = { broker_id: broker.id, overview:parse('overview'), verdict:parse('verdict'), why_recommend:parse('why_recommend'), best_for_detail:parse('best_for_detail'), avoid_if:parse('avoid_if'), regulation_detail:parse('regulation_detail'), fees_detail:parse('fees_detail'), platform_intro:parse('platform_intro'), accounts_intro:parse('accounts_intro'), funding_intro:parse('funding_intro'), faqs:parse('faqs'), platforms:parse('platforms'), accounts:parse('accounts'), payments:parse('payments') };
      await onSave(content);
      const rows=availabilityRows.filter((row)=>row.country_id).map((row)=>({ ...row, priority:Number(row.priority)||0 }));
      const r=await fetch('/api/broker-assets?resource=availability',{method:'PUT',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({broker_id:broker.id,rows})});
      const d=await r.json().catch(()=>({})); if(!r.ok) throw new Error(d.error||'Could not save country availability');
      setError('');
    } catch(e) { setError(e instanceof Error?e.message:'Could not save broker data'); }
  };

  const availabilityByCountry = useMemo(() => new Map(availabilityRows.map((row) => [row.country_id, row])), [availabilityRows]);
  const visibleCountries = useMemo(() => countries.filter((c) => `${c.name} ${c.slug}`.toLowerCase().includes(countrySearch.toLowerCase().trim())), [countries, countrySearch]);
  const updateAvailability = (countryId: number, patch: Partial<{ status: 'available' | 'restricted' | 'unavailable' | 'unknown'; note: string; priority: number }>) => {
    setAvailabilityRows((rows) => {
      const existing = rows.find((row) => row.country_id === countryId);
      if (existing) return rows.map((row) => row.country_id === countryId ? { ...row, ...patch } : row);
      return [...rows, { country_id: countryId, status: 'unknown', note: '', priority: 0, ...patch }];
    });
  };

  const saveDoc = async (doc: any, isNew=false) => {
    const payload = { ...doc, content_type:'broker', slug: broker.slug, content_key: doc.content_key || `broker:${broker.slug}:${doc.slug || 'main'}` };
    const res = await fetch('/api/content-documents',{method:isNew?'POST':'PUT',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify(isNew?payload:{...payload,id:doc.id})});
    const out=await res.json().catch(()=>({})); if(!res.ok) throw new Error(out.error||'Could not save broker rich content');
    await load(); setEditingDoc(null); setNewDoc(false);
  };

  const deleteDoc = async (doc: ContentDocument) => {
    if(!window.confirm(`Delete “${doc.title || doc.content_key}”?`)) return;
    const res=await fetch('/api/content-documents',{method:'DELETE',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({id:doc.id})});
    if(!res.ok){const d=await res.json().catch(()=>({})); setError(d.error||'Could not delete content'); return;}
    await load();
  };

  return <div className="fixed inset-0 z-[90]">
    <div className="absolute inset-0 bg-ink-950/50 backdrop-blur-sm" onClick={onClose}/>
    <div className="absolute inset-y-0 right-0 flex w-full flex-col bg-white shadow-soft-lg sm:max-w-5xl">
      <div className="flex items-center gap-3 bg-ink-950 px-5 py-4 text-white">
        <Monogram name={broker.name} logoUrl={broker.logo_url} color={broker.brand_color} size={38} className="rounded-xl"/>
        <div className="min-w-0 flex-1"><p className="font-display text-lg font-bold">{broker.name} content CMS</p><p className="text-xs text-slate-400">Rich broker profile content, additional sections, trading data and country availability</p></div>
        <button onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white"><X size={18}/></button>
      </div>
      <div className="flex-1 overflow-y-auto p-5 sm:p-6">
        {error&&<p className="mb-5 rounded-xl bg-rose-50 px-4 py-2.5 text-sm text-rose-600">{error}</p>}
        {loading?<p className="text-sm text-slate-500">Loading…</p>:<div className="space-y-7">
          <section className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-display text-xl font-bold text-ink-900">Broker profile content</h2><p className="mt-1 text-xs leading-relaxed text-slate-500">Use the same rich editor as country SEO pages. Add headings, links, images and comparison tables. These documents render inside the public broker profile.</p></div><div className="flex shrink-0 flex-wrap gap-2">{!hasMainDoc && legacySeedBlocks.length > 0 && <button onClick={()=>{setSeedNewDoc(true);setNewDoc(true);}} className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 px-3.5 py-2 text-xs font-bold text-white" title="Converts the existing overview, verdict, fees and other written content into editable builder sections"><Sparkles size={13}/> Load existing content into builder</button>}<button onClick={()=>{setSeedNewDoc(false);setNewDoc(true);}} className="inline-flex items-center gap-1.5 rounded-xl bg-ink-950 px-3.5 py-2 text-xs font-bold text-white"><Plus size={13}/> Add section</button></div></div>
            <div className="mt-4 divide-y divide-line overflow-hidden rounded-xl border border-line bg-white">
              {richDocs.map(d=><div key={d.id} className="flex items-center gap-3 px-4 py-3"><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-ink-900">{d.title || d.content_key}</p><p className="truncate text-[11px] text-slate-400">{d.slug} · {d.published?'Published':'Draft'} · {d.indexable?'Indexable':'Noindex'}</p></div><Link to={`/brokers/${broker.slug}`} target="_blank" className="rounded-lg p-2 text-slate-400 hover:bg-paper hover:text-ink-900" title="View live"><Eye size={15}/></Link><button onClick={()=>setEditingDoc(d)} className="rounded-lg p-2 text-slate-400 hover:bg-emerald-50 hover:text-emerald-700" title="Edit"><Pencil size={15}/></button><button onClick={()=>deleteDoc(d)} className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600" title="Delete"><Trash2 size={15}/></button></div>)}
              {!richDocs.length&&<p className="p-5 text-sm text-slate-400">No rich broker sections yet. Add the main review first, then add sections such as Fees, Platforms, Safety, Best For or FAQs.</p>}
            </div>
          </section>

          <section><div className="flex items-center justify-between"><div><h2 className="font-display text-xl font-bold text-ink-900">Structured broker data</h2><p className="mt-1 text-xs text-slate-400">Keep factual platform, account and payment data separate from editorial prose.</p></div><button onClick={saveAdvanced} className="rounded-xl bg-emerald-500 px-4 py-2 text-xs font-bold text-white">Save data</button></div>
            {(['platforms','accounts','payments'] as const).map(k=><label key={k} className="mt-4 block"><FieldLabel>{k==='platforms'?'Platforms':k==='accounts'?'Account types':'Payment methods'}</FieldLabel><textarea value={advanced[k]} onChange={e=>setAdvanced(a=>({...a,[k]:e.target.value}))} rows={8} spellCheck={false} className="mt-1.5 w-full rounded-xl border border-line bg-paper px-3 py-3 font-mono text-xs leading-relaxed outline-none focus:border-emerald-500"/></label>)}
          </section>

          <section><div className="flex items-center justify-between gap-3"><div><h2 className="font-display text-xl font-bold text-ink-900">Country eligibility</h2><p className="mt-1 text-xs text-slate-400">Search countries and set whether this broker is available, restricted or unavailable. No raw JSON required.</p></div><button onClick={saveAdvanced} className="rounded-xl bg-emerald-500 px-4 py-2 text-xs font-bold text-white">Save eligibility</button></div><div className="mt-3 flex items-center gap-2 rounded-xl border border-line bg-paper px-3"><Search size={14} className="text-slate-400"/><input value={countrySearch} onChange={e=>setCountrySearch(e.target.value)} placeholder="Search countries…" className="h-10 flex-1 bg-transparent text-sm outline-none"/></div><div className="mt-3 max-h-96 overflow-auto rounded-xl border border-line bg-white"><table className="w-full text-left text-xs"><thead className="sticky top-0 bg-paper text-slate-500"><tr><th className="px-3 py-2">Country</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Priority</th><th className="px-3 py-2">Note</th></tr></thead><tbody className="divide-y divide-line">{visibleCountries.map((c)=>{const row=availabilityByCountry.get(c.id) ?? { country_id:c.id, status:'unknown' as const, note:'', priority:0 }; return <tr key={c.id}><td className="px-3 py-2 font-bold text-ink-900">{c.flag} {c.name}<span className="ml-1 font-normal text-slate-400">/{c.slug}</span></td><td className="px-3 py-2"><select value={row.status} onChange={(e)=>updateAvailability(c.id,{status:e.target.value as any})} className="h-9 rounded-lg border border-line bg-paper px-2 text-xs font-bold outline-none"><option value="unknown">Unknown</option><option value="available">Available</option><option value="restricted">Restricted</option><option value="unavailable">Unavailable</option></select></td><td className="px-3 py-2"><input type="number" value={row.priority} onChange={(e)=>updateAvailability(c.id,{priority:Number(e.target.value)||0})} className="h-9 w-20 rounded-lg border border-line bg-paper px-2 text-xs outline-none"/></td><td className="px-3 py-2"><input value={row.note} onChange={(e)=>updateAvailability(c.id,{note:e.target.value})} placeholder="Eligibility, entity or affiliate note…" className="h-9 w-full min-w-56 rounded-lg border border-line bg-paper px-2 text-xs outline-none"/></td></tr>})}</tbody></table></div></section>
        </div>}
      </div>
      <div className="flex justify-end border-t border-line bg-white px-5 py-4"><button onClick={onClose} className="rounded-xl border border-line px-4 py-2 text-xs font-bold text-slate-600">Close</button></div>
    </div>
    {(editingDoc || newDoc) && <BrokerRichDocEditor key={editingDoc?.id ? String(editingDoc.id) : (newDoc ? 'new' : 'none')} broker={broker} token={token} document={editingDoc} seedBlocks={!editingDoc && seedNewDoc ? legacySeedBlocks : undefined} seedTitle={!editingDoc && seedNewDoc ? `${broker.name} — Full Profile` : undefined} onClose={()=>{setEditingDoc(null);setNewDoc(false);setSeedNewDoc(false)}} onSave={saveDoc}/>}
  </div>;
}

function BrokerRichDocEditor({ broker, token, document, seedBlocks, seedTitle, onClose, onSave }: { broker: Broker; token: string; document: ContentDocument | null; seedBlocks?: PageBlock[]; seedTitle?: string; onClose:()=>void; onSave:(doc:any,isNew:boolean)=>Promise<void> }) {
  const [form,setForm]=useState<any>(()=>document ? {...document} : {content_key:`broker:${broker.slug}:main`,content_type:'broker',slug:'main',title:seedTitle||`${broker.name} Review`,excerpt:'',html:'',blocks:seedBlocks&&seedBlocks.length?seedBlocks:[],seo_title:`${broker.name} Review 2026 | PipRank`,seo_description:`Read the PipRank ${broker.name} review, including costs, platforms, regulation and who it may suit.`,indexable:true,published:true});
  const [busy,setBusy]=useState(false); const [err,setErr]=useState('');
  const [builderBlocks,setBuilderBlocks]=useState<any[]>(()=>initEditorBlocks(document ? {blocks: document.blocks, html: document.html} : null, seedBlocks && seedBlocks.length ? seedBlocks : undefined));
  const uploadImage=async(file:File)=>{const reader=new FileReader(); const data=await new Promise<string>((resolve,reject)=>{reader.onload=()=>resolve(String(reader.result));reader.onerror=reject;reader.readAsDataURL(file)}); const res=await fetch('/api/content-assets',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({filename:file.name,contentType:file.type,dataBase64:data})}); const out=await res.json().catch(()=>({})); if(!res.ok) throw new Error(out.error||'Image upload failed'); return out.url;};
  const submit=async()=>{try{setBusy(true);setErr('');await onSave({...form,content_key:form.content_key||`broker:${broker.slug}:${form.slug||'main'}`},!document)}catch(e){setErr(e instanceof Error?e.message:'Could not save')}finally{setBusy(false)}};
  return <div className="fixed inset-0 z-[110] flex items-center justify-center bg-ink-950/60 p-3 backdrop-blur-sm"><div className="flex max-h-[96vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl bg-white shadow-soft-lg"><div className="flex items-center gap-3 bg-ink-950 px-5 py-4 text-white"><Monogram name={broker.name} logoUrl={broker.logo_url} color={broker.brand_color} size={34} className="rounded-lg"/><div className="flex-1"><p className="font-display font-bold">{document?'Edit':'Create'} broker rich content</p><p className="text-xs text-slate-400">{broker.name} · content CMS</p></div><button onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-white/10"><X size={18}/></button></div><div className="flex-1 overflow-y-auto p-5 sm:p-7">{err&&<p className="mb-4 rounded-xl bg-rose-50 px-4 py-2.5 text-sm text-rose-600">{err}</p>}<div className="grid gap-4 sm:grid-cols-2"><label><FieldLabel>Section title</FieldLabel><input value={form.title||''} onChange={e=>setForm({...form,title:e.target.value})} className="mt-1.5 w-full rounded-xl border border-line px-3 py-2.5 text-sm outline-none focus:border-emerald-500"/></label><label><FieldLabel>Slug</FieldLabel><input value={form.slug||''} onChange={e=>setForm({...form,slug:e.target.value})} className="mt-1.5 w-full rounded-xl border border-line px-3 py-2.5 text-sm outline-none focus:border-emerald-500"/></label></div><label className="mt-4 block"><FieldLabel>Excerpt</FieldLabel><textarea value={form.excerpt||''} onChange={e=>setForm({...form,excerpt:e.target.value})} rows={2} className="mt-1.5 w-full rounded-xl border border-line px-3 py-2.5 text-sm outline-none focus:border-emerald-500"/></label><div className="mt-5"><FieldLabel hint="Build the complete broker editorial page with reorderable sections">Visual page builder</FieldLabel><div className="mt-1.5"><PageBuilder key={document?.id || document?.content_key || 'new'} value={builderBlocks} onChange={blocks=>{setBuilderBlocks(blocks);setForm((f:any)=>({...f,blocks,html:blocksToHtml(blocks)}))}} onUploadImage={uploadImage}/></div></div><div className="mt-5 grid gap-4 sm:grid-cols-2"><label><FieldLabel>SEO title</FieldLabel><input value={form.seo_title||''} onChange={e=>setForm({...form,seo_title:e.target.value})} className="mt-1.5 w-full rounded-xl border border-line px-3 py-2.5 text-sm outline-none focus:border-emerald-500"/></label><label><FieldLabel>SEO description</FieldLabel><textarea value={form.seo_description||''} onChange={e=>setForm({...form,seo_description:e.target.value})} rows={2} className="mt-1.5 w-full rounded-xl border border-line px-3 py-2.5 text-sm outline-none focus:border-emerald-500"/></label></div><div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="flex items-center justify-between rounded-xl border border-line bg-paper p-4"><span><span className="block text-sm font-bold">Publish</span><span className="text-xs text-slate-400">Show this section publicly.</span></span><Toggle on={!!form.published} onToggle={()=>setForm({...form,published:!form.published})}/></label><label className="flex items-center justify-between rounded-xl border border-line bg-paper p-4"><span><span className="block text-sm font-bold">Index</span><span className="text-xs text-slate-400">Allow this document to contribute to search.</span></span><Toggle on={!!form.indexable} onToggle={()=>setForm({...form,indexable:!form.indexable})}/></label></div></div><div className="flex justify-end gap-2 border-t border-line bg-white px-5 py-4"><button onClick={onClose} className="rounded-xl border border-line px-4 py-2 text-xs font-bold text-slate-600">Cancel</button><button onClick={submit} disabled={busy} className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-bold text-white disabled:opacity-60">{busy&&<Loader2 size={14} className="animate-spin"/>}{document?'Save changes':'Publish section'}</button></div></div></div>;
}

/* ============================ SHARED BITS ============================ */

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`relative h-6 w-11 shrink-0 rounded-full transition ${on ? 'bg-emerald-500' : 'bg-slate-300'}`}
      aria-pressed={on}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
          on ? 'left-[22px]' : 'left-0.5'
        }`}
      />
    </button>
  );
}

function Th({ children }: { children: ReactNode }) {
  return (
    <th className="whitespace-nowrap px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-400">
      {children}
    </th>
  );
}

function Td({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <td className={`px-4 py-3 align-middle ${className}`}>{children}</td>;
}

function FieldLabel({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-400">
      {children}
      {hint && <span className="ml-1.5 font-medium normal-case tracking-normal text-slate-400/70">{hint}</span>}
    </span>
  );
}

function TextInput({
  value,
  onChange,
  mono = false,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  mono?: boolean;
  placeholder?: string;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`h-10 w-full rounded-xl border border-line bg-paper px-3 text-sm font-medium outline-none transition focus:border-emerald-500 ${mono ? 'tnum font-mono text-[13px]' : ''}`}
    />
  );
}

/* ============================ OVERVIEW ============================ */

const RANGES = [
  { key: '1', label: 'Today' },
  { key: '7', label: '7 days' },
  { key: '30', label: '30 days' },
  { key: 'all', label: 'All time' },
] as const;



function CommercialHub({ token, brokers, notify }: { token: string; brokers: Broker[]; notify: (msg: string) => void }) {
  const [section, setSection] = useState<'affiliate' | 'promos' | 'conversions'>('affiliate');
  return <div className="space-y-5"><div className="rounded-2xl border border-line bg-white p-4"><div className="flex flex-wrap gap-2">{(['affiliate','promos','conversions'] as const).map((key)=><button key={key} onClick={()=>setSection(key)} className={`rounded-xl px-4 py-2 text-xs font-bold transition ${section===key?'bg-ink-950 text-white':'bg-paper text-slate-500 hover:bg-white'}`}>{key==='affiliate'?'Affiliate links':key==='promos'?'Promotions':'Conversions'}</button>)}</div></div>{section==='affiliate'&&<AffiliateLinksTab token={token} brokers={brokers} notify={notify}/>} {section==='promos'&&<PromosTab token={token} brokers={brokers} notify={notify}/>} {section==='conversions'&&<ConversionsTab token={token} brokers={brokers}/>}</div>;
}

function CountryHub({ countries, brokers, countryBestFors, contentDocs, countryLanguages, localizedPages, token, notify, reloadLocalization, onNewCountry, onEditCountry, onEditCountryBestFor, onEditContentDoc, onNewCountryContentDoc, onSeedCountryBestFor }: { countries: CountryPage[]; brokers: Broker[]; countryBestFors: CountryBestFor[]; contentDocs: ContentDocument[]; countryLanguages: CountryLanguage[]; localizedPages: LocalizedSeoPage[]; token: string; notify: (msg: string) => void; reloadLocalization: () => void; onNewCountry: () => void; onEditCountry: (country: CountryPage) => void; onEditCountryBestFor: (page: CountryBestFor) => void; onEditContentDoc: (doc: ContentDocument) => void; onNewCountryContentDoc: (countrySlug: string) => void; onSeedCountryBestFor: (key: string, page: CountryBestFor, blocks: PageBlock[]) => void }) {
  const [query, setQuery] = useState('');
  const [selectedSlug, setSelectedSlug] = useState(() => countries[0]?.slug ?? '');
  useEffect(() => { if (!selectedSlug && countries[0]) setSelectedSlug(countries[0].slug); }, [countries, selectedSlug]);
  const filtered = countries.filter((country) => `${country.name} ${country.slug}`.toLowerCase().includes(query.toLowerCase()));
  const selected = countries.find((country) => country.slug === selectedSlug) ?? filtered[0] ?? countries[0];
  const bestFor = selected ? countryBestFors.filter((page) => page.country_id === selected.id || page.country_slug === selected.slug) : [];
  const docs = selected ? contentDocs.filter((doc) => doc.country_slug === selected.slug || doc.content_key.includes(`:${selected.slug}:`) || doc.slug === selected.slug) : [];
  const publishedState = String((selected as any)?.publishing_state ?? ((selected as any)?.status ?? 'published'));
  return <div className="grid gap-5 lg:grid-cols-[300px_1fr]"><section className="rounded-2xl border border-line bg-white p-4"><div className="flex items-center justify-between"><h2 className="font-display text-lg font-bold text-ink-900">Countries</h2><button onClick={onNewCountry} className="rounded-lg bg-ink-950 px-3 py-1.5 text-xs font-bold text-white"><Plus size={13} className="inline"/> New</button></div><div className="mt-3 flex items-center gap-2 rounded-xl border border-line bg-paper px-3"><Search size={14} className="text-slate-400"/><input value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="Search countries…" className="h-10 flex-1 bg-transparent text-sm outline-none"/></div><div className="mt-3 max-h-[560px] space-y-1 overflow-auto">{filtered.map((country)=><button key={country.id} onClick={()=>setSelectedSlug(country.slug)} className={`w-full rounded-xl px-3 py-2 text-left text-sm transition ${selected?.id===country.id?'bg-emerald-50 text-emerald-800':'hover:bg-paper'}`}><span className="font-bold">{country.flag} {country.name}</span><span className="block text-xs text-slate-400">/{country.slug}</span></button>)}</div></section>{selected&&<section className="space-y-5"><div className="rounded-2xl border border-line bg-white p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-widest text-emerald-700">Country Workspace</p><h2 className="font-display text-2xl font-bold text-ink-900">{selected.flag} {selected.name}</h2><p className="mt-1 text-sm text-slate-500">Overview, publishing, SEO, brokers, best-for pages, guides, FAQs and internal links in one place.</p></div><button onClick={()=>onEditCountry(selected)} className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-bold text-white"><Pencil size={14}/> Edit country hub</button></div><div className="mt-4 grid gap-3 sm:grid-cols-3"><HubMetric label="Publishing" value={publishedState} sub="draft · published · closed"/><HubMetric label="Best-For" value={String(bestFor.length)} sub="country category pages"/><HubMetric label="Country content" value={String(docs.length)} sub="guides and SEO docs"/></div></div><div className="grid gap-5 xl:grid-cols-2"><EntityPanel title="SEO QA" items={[selected.seo_title?'SEO title present':'Missing SEO title',selected.seo_description?'Meta description present':'Missing meta description',(selected.seo_intro?.length||0)>0?'Intro present':'Missing SEO intro',(selected.seo_sections?.length||0)>0?'Structured sections present':'Missing sections',(selected.seo_faqs?.length||0)>0?'FAQs present':'Missing FAQs']}/><EntityPanel title="Broker coverage" items={[`${selected.recommended.length} recommended brokers`,`${selected.unavailable.length} unavailable broker flags`,`${brokers.length} brokers in database`,'Use Broker Workspace for searchable eligibility states']}/></div><div className="rounded-2xl border border-line bg-white p-5"><h3 className="font-display text-lg font-bold text-ink-900">Best-For pages</h3><div className="mt-3 divide-y divide-line rounded-xl border border-line">{bestFor.map((page)=>{const key=`best-for:${selected.slug}:${page.slug}`;const existingDoc=contentDocs.find((d)=>d.content_key===key);const seedBlocks=legacySectionsToBlocks(introCriteriaToLegacySections(page.intro,page.criteria,page.sections));return <div key={page.id} className="flex items-center justify-between px-4 py-3"><button onClick={()=>onEditCountryBestFor(page)} className="min-w-0 flex-1 text-left"><span className="block text-sm font-bold text-ink-900">{page.label}</span><span className="text-xs text-slate-400">/{selected.slug}/{page.slug} · {page.indexable?'Indexable':'Noindex'}</span></button><div className="flex shrink-0 items-center gap-1">{existingDoc?<button onClick={()=>onEditContentDoc(existingDoc)} className="rounded-lg p-2 text-slate-400 hover:bg-emerald-50 hover:text-emerald-700" title="Edit in visual builder"><Sparkles size={14}/></button>:seedBlocks.length>0?<button onClick={()=>onSeedCountryBestFor(key,page,seedBlocks)} className="rounded-lg p-2 text-slate-400 hover:bg-emerald-50 hover:text-emerald-700" title="Load existing content into builder"><Sparkles size={14}/></button>:null}<button onClick={()=>onEditCountryBestFor(page)} className="rounded-lg p-2 text-slate-400 hover:bg-paper"><Pencil size={14}/></button></div></div>;})}{!bestFor.length&&<p className="p-4 text-sm text-slate-400">No country best-for pages yet.</p>}</div></div><div className="rounded-2xl border border-line bg-white p-5"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-display text-lg font-bold text-ink-900">Country guides and SEO content</h3><button onClick={()=>onNewCountryContentDoc(selected.slug)} className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 px-3.5 py-1.5 text-xs font-bold text-white"><Plus size={13}/> Add new page</button></div><div className="mt-3 divide-y divide-line rounded-xl border border-line">{docs.map((doc)=><button key={doc.id} onClick={()=>onEditContentDoc(doc)} className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-paper"><span><span className="block text-sm font-bold text-ink-900">{doc.title || doc.content_key}</span><span className="text-xs text-slate-400">{doc.content_type} · {doc.published?'Published':'Draft'} · {doc.indexable?'Indexable':'Noindex'}</span></span><Pencil size={14} className="text-slate-400"/></button>)}{!docs.length&&<p className="p-4 text-sm text-slate-400">No country-specific rich content found.</p>}</div></div><CountryLanguagesPanel country={selected} countryLanguages={countryLanguages} localizedPages={localizedPages} token={token} notify={notify} reload={reloadLocalization} onEditContentDoc={onEditContentDoc}/></section>}</div>;
}

function CountryLanguagesPanel({ country, countryLanguages, localizedPages, token, notify, reload, onEditContentDoc }: { country: CountryPage; countryLanguages: CountryLanguage[]; localizedPages: LocalizedSeoPage[]; token: string; notify: (msg: string) => void; reload: () => void; onEditContentDoc: (doc: ContentDocument) => void }) {
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editingLang, setEditingLang] = useState<CountryLanguage | null>(null);
  const [newLang, setNewLang] = useState({ name: '', native_name: '', code: '', locale: '', url_prefix: '', is_default: false });
  const [editingPage, setEditingPage] = useState<LocalizedSeoPage | null>(null);

  const languages = countryLanguages.filter((l) => l.country_slug === country.slug);
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  const input = 'h-9 w-full rounded-lg border border-line bg-paper px-2.5 text-xs font-medium outline-none focus:border-emerald-500';

  const addLanguage = async () => {
    if (!newLang.name.trim() || !newLang.native_name.trim() || !newLang.code.trim() || !newLang.locale.trim()) {
      notify('Name, native name, code and locale are required');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/country-languages', { method: 'POST', headers, body: JSON.stringify({ ...newLang, country_id: country.id }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not add language');
      notify(`${newLang.name} added — draft localized pages created`);
      setAdding(false);
      setNewLang({ name: '', native_name: '', code: '', locale: '', url_prefix: '', is_default: false });
      reload();
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Could not add language');
    } finally {
      setBusy(false);
    }
  };

  const saveLanguage = async () => {
    if (!editingLang) return;
    setBusy(true);
    try {
      const res = await fetch('/api/country-languages', { method: 'PUT', headers, body: JSON.stringify(editingLang) });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || 'Could not save language'); }
      notify('Language saved');
      setEditingLang(null);
      reload();
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Could not save language');
    } finally {
      setBusy(false);
    }
  };

  const deleteLanguage = async (lang: CountryLanguage) => {
    if (!window.confirm(`Delete ${lang.name} and all its localized pages? This cannot be undone.`)) return;
    setBusy(true);
    try {
      const res = await fetch('/api/country-languages', { method: 'DELETE', headers, body: JSON.stringify({ id: lang.id }) });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || 'Could not delete language'); }
      notify(`${lang.name} deleted`);
      reload();
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Could not delete language');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-line bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-display text-lg font-bold text-ink-900">Languages</h3>
          <p className="mt-0.5 text-xs text-slate-500">Localized SEO pages for {country.name}. Adding a language auto-creates draft pages for every commercial topic.</p>
        </div>
        <button onClick={() => setAdding((v) => !v)} className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 px-3.5 py-1.5 text-xs font-bold text-white">
          <Plus size={13} /> Add language
        </button>
      </div>

      {adding && (
        <div className="mt-4 grid gap-2 rounded-xl border border-line bg-paper p-4 sm:grid-cols-3">
          <label><FieldLabel>Name</FieldLabel><input value={newLang.name} onChange={(e) => setNewLang({ ...newLang, name: e.target.value })} placeholder="Vietnamese" className={input} /></label>
          <label><FieldLabel>Native name</FieldLabel><input value={newLang.native_name} onChange={(e) => setNewLang({ ...newLang, native_name: e.target.value })} placeholder="Tiếng Việt" className={input} /></label>
          <label><FieldLabel>Code</FieldLabel><input value={newLang.code} onChange={(e) => setNewLang({ ...newLang, code: e.target.value })} placeholder="vi" className={input} /></label>
          <label><FieldLabel>Locale</FieldLabel><input value={newLang.locale} onChange={(e) => setNewLang({ ...newLang, locale: e.target.value })} placeholder="vi-VN" className={input} /></label>
          <label><FieldLabel hint="Used in the URL, e.g. /vn/vi/...">URL prefix</FieldLabel><input value={newLang.url_prefix} onChange={(e) => setNewLang({ ...newLang, url_prefix: e.target.value })} placeholder="vi" className={input} /></label>
          <label className="flex items-center gap-2 pt-5"><input type="checkbox" checked={newLang.is_default} onChange={(e) => setNewLang({ ...newLang, is_default: e.target.checked })} /><span className="text-xs font-semibold text-slate-600">Default language</span></label>
          <div className="sm:col-span-3 flex justify-end gap-2">
            <button onClick={() => setAdding(false)} className="rounded-lg px-3 py-1.5 text-xs font-bold text-slate-500 hover:bg-white">Cancel</button>
            <button onClick={addLanguage} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg bg-ink-950 px-3.5 py-1.5 text-xs font-bold text-white disabled:opacity-50">{busy && <Loader2 size={12} className="animate-spin" />} Add language</button>
          </div>
        </div>
      )}

      <div className="mt-4 space-y-3">
        {languages.map((lang) => {
          const pages = localizedPages.filter((p) => p.language_code === lang.code && p.country_slug === country.slug);
          const isEditing = editingLang?.id === lang.id;
          return (
            <div key={lang.id} className="rounded-xl border border-line">
              <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                {isEditing ? (
                  <div className="grid flex-1 gap-2 sm:grid-cols-3">
                    <input value={editingLang.name} onChange={(e) => setEditingLang({ ...editingLang, name: e.target.value })} className={input} />
                    <input value={editingLang.native_name} onChange={(e) => setEditingLang({ ...editingLang, native_name: e.target.value })} className={input} />
                    <input value={editingLang.url_prefix} onChange={(e) => setEditingLang({ ...editingLang, url_prefix: e.target.value })} className={input} />
                  </div>
                ) : (
                  <span>
                    <span className="text-sm font-bold text-ink-900">{lang.name} <span className="font-normal text-slate-400">({lang.native_name})</span></span>
                    {lang.is_default && <span className="ml-2 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">Default</span>}
                    <span className="ml-2 rounded-full bg-paper px-2 py-0.5 text-[10px] font-bold text-slate-500">/{lang.url_prefix}</span>
                    {!lang.active && <span className="ml-2 rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-600">Inactive</span>}
                  </span>
                )}
                <div className="flex shrink-0 items-center gap-1">
                  {isEditing ? (
                    <>
                      <button onClick={saveLanguage} disabled={busy} className="rounded-lg bg-ink-950 px-2.5 py-1.5 text-[11px] font-bold text-white disabled:opacity-50">Save</button>
                      <button onClick={() => setEditingLang(null)} className="rounded-lg px-2.5 py-1.5 text-[11px] font-bold text-slate-500 hover:bg-paper">Cancel</button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => setEditingLang({ ...lang, active: !lang.active })} className="rounded-lg px-2.5 py-1.5 text-[11px] font-bold text-slate-500 hover:bg-paper">{lang.active ? 'Deactivate' : 'Activate'}</button>
                      <button onClick={() => setEditingLang(lang)} className="rounded-lg p-1.5 text-slate-400 hover:bg-paper" title="Manage language"><Pencil size={13} /></button>
                      <button onClick={() => deleteLanguage(lang)} className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600" title="Delete language"><Trash2 size={13} /></button>
                    </>
                  )}
                </div>
              </div>
              <div className="divide-y divide-line border-t border-line">
                {pages.map((page) => (
                  <button key={page.id} onClick={() => setEditingPage(page)} className="flex w-full items-center justify-between px-4 py-2.5 text-left hover:bg-paper">
                    <span><span className="block text-xs font-bold text-ink-900">{page.title || page.slug}</span><span className="text-[11px] text-slate-400">{page.topic_key} · {page.published ? 'Published' : 'Draft'} · {page.indexable ? 'Indexable' : 'Noindex'}</span></span>
                    <Pencil size={12} className="text-slate-400" />
                  </button>
                ))}
                {!pages.length && <p className="px-4 py-3 text-xs text-slate-400">No localized pages for this language yet.</p>}
              </div>
            </div>
          );
        })}
        {!languages.length && <p className="rounded-xl border border-dashed border-line p-4 text-center text-xs text-slate-400">No languages added for {country.name} yet.</p>}
      </div>

      {editingPage && (
        <LocalizedPageEditor
          page={editingPage}
          token={token}
          notify={notify}
          onClose={() => setEditingPage(null)}
          onSaved={() => { setEditingPage(null); reload(); }}
          onEditContentDoc={onEditContentDoc}
        />
      )}
    </div>
  );
}

function LocalizedPageEditor({ page, token, notify, onClose, onSaved, onEditContentDoc }: { page: LocalizedSeoPage; token: string; notify: (msg: string) => void; onClose: () => void; onSaved: () => void; onEditContentDoc: (doc: ContentDocument) => void }) {
  const [form, setForm] = useState<any>({ ...page });
  const [busy, setBusy] = useState(false);
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  const input = 'h-10 w-full rounded-xl border border-line bg-paper px-3 text-sm outline-none focus:border-emerald-500';

  const save = async () => {
    setBusy(true);
    try {
      const res = await fetch('/api/localized-seo-pages', { method: 'PUT', headers, body: JSON.stringify(form) });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || 'Could not save page'); }
      notify('Localized page saved');
      onSaved();
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Could not save page');
    } finally {
      setBusy(false);
    }
  };

  // First time the admin wants the visual builder for this page's body,
  // seed a real content_documents record from the existing plain-text
  // content, then link it back via content_document_id — matching the same
  // "load existing content into blocks" pattern used for brokers and
  // country SEO pages.
  const openInBuilder = async () => {
    if (form.content_document_id) {
      notify("Open this page's linked rich content from Country guides and SEO content to edit it.");
      return;
    }
    setBusy(true);
    try {
      const seedBlocks = form.content && form.content.trim()
        ? legacySectionsToBlocks([{ paragraphs: form.content.split(/\n{2,}/) }])
        : [];
      const seedFaqBlocks = faqsToBlocks(form.faqs ?? []);
      const res = await fetch('/api/content-documents', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          content_key: `localized:${form.country_slug}:${form.language_code}:${form.topic_key}`,
          content_type: 'localized-seo',
          country_slug: form.country_slug,
          topic_slug: form.topic_key,
          slug: form.slug,
          title: form.title,
          excerpt: '',
          html: '',
          blocks: [...seedBlocks, ...seedFaqBlocks],
          seo_title: form.meta_title || '',
          seo_description: form.meta_description || '',
          indexable: form.indexable,
          published: form.published,
        }),
      });
      const doc = await res.json().catch(() => null);
      if (!res.ok) throw new Error((doc as { error?: string })?.error || 'Could not create rich content');
      const linkRes = await fetch('/api/localized-seo-pages', { method: 'PUT', headers, body: JSON.stringify({ id: form.id, content_document_id: doc.id }) });
      if (!linkRes.ok) throw new Error('Content created but could not be linked to this page');
      notify('Existing content loaded into the visual builder');
      onEditContentDoc(doc as ContentDocument);
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Could not open visual builder');
    } finally {
      setBusy(false);
    }
  };

  return (
    <DrawerShell title={`${form.title || form.slug} — ${form.language_name ?? ''}`} onClose={onClose}>
      <div className="space-y-4">
        <label><FieldLabel>Title</FieldLabel><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={input} /></label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label><FieldLabel>SEO title</FieldLabel><input value={form.meta_title ?? ''} onChange={(e) => setForm({ ...form, meta_title: e.target.value })} className={input} /></label>
          <label><FieldLabel>H1</FieldLabel><input value={form.h1 ?? ''} onChange={(e) => setForm({ ...form, h1: e.target.value })} className={input} /></label>
        </div>
        <label><FieldLabel>Meta description</FieldLabel><textarea value={form.meta_description ?? ''} onChange={(e) => setForm({ ...form, meta_description: e.target.value })} rows={2} className="w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-sm outline-none focus:border-emerald-500" /></label>
        <div className="rounded-xl border border-line bg-paper p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-ink-900">Page body</p>
              <p className="text-xs text-slate-500">{form.content_document_id ? 'This page already uses the visual builder.' : 'Currently plain text. Load it into the same visual builder used everywhere else.'}</p>
            </div>
            {!form.content_document_id && (
              <button onClick={openInBuilder} disabled={busy} className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 px-3.5 py-2 text-xs font-bold text-white disabled:opacity-50">
                {busy && <Loader2 size={12} className="animate-spin" />} <Sparkles size={13} /> Load into builder
              </button>
            )}
          </div>
          {!form.content_document_id && (
            <textarea value={form.content ?? ''} onChange={(e) => setForm({ ...form, content: e.target.value })} rows={6} className="mt-3 w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-500" placeholder="Plain-text content (legacy)" />
          )}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex items-center justify-between rounded-xl border border-line bg-paper p-4"><span className="text-sm font-bold">Publish</span><Toggle on={!!form.published} onToggle={() => setForm({ ...form, published: !form.published })} /></label>
          <label className="flex items-center justify-between rounded-xl border border-line bg-paper p-4"><span className="text-sm font-bold">Index page</span><Toggle on={!!form.indexable} onToggle={() => setForm({ ...form, indexable: !form.indexable })} /></label>
        </div>
        <button onClick={save} disabled={busy} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-ink-950 text-sm font-bold text-white disabled:opacity-60">{busy && <Loader2 size={15} className="animate-spin" />}Save localized page</button>
      </div>
    </DrawerShell>
  );
}

function GlobalHub({ guides, intents, contentDocs, token, notify, onNewGuide, onEditGuide, onNewIntent, onEditIntent, onEditContentDoc }: { guides: Guide[]; intents: Intent[]; contentDocs: ContentDocument[]; token: string; notify: (msg: string) => void; onNewGuide: () => void; onEditGuide: (g: Guide) => void; onNewIntent: () => void; onEditIntent: (i: Intent) => void; onEditContentDoc: (d: ContentDocument) => void }) {
  const [seeding, setSeeding] = useState<string | null>(null);
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  const docFor = (key: string) => contentDocs.find((d) => d.content_key === key);

  const seed = async (key: string, contentType: string, title: string, seedBlocks: PageBlock[], topicSlug: string) => {
    if (!seedBlocks.length) { notify('Nothing to convert yet — this page has no written content.'); return; }
    setSeeding(key);
    try {
      const res = await fetch('/api/content-documents', {
        method: 'POST',
        headers,
        body: JSON.stringify({ content_key: key, content_type: contentType, country_slug: null, topic_slug: topicSlug, slug: topicSlug, title, excerpt: '', html: '', blocks: seedBlocks, seo_title: '', seo_description: '', indexable: true, published: true }),
      });
      const doc = await res.json().catch(() => null);
      if (!res.ok) throw new Error((doc as { error?: string })?.error || 'Could not create rich content');
      notify('Existing content loaded into the visual builder');
      onEditContentDoc(doc as ContentDocument);
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Could not open visual builder');
    } finally {
      setSeeding(null);
    }
  };

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <div className="rounded-2xl border border-line bg-white shadow-soft">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <p className="font-display text-base font-bold text-ink-900">Guides ({guides.length})</p>
          <button onClick={onNewGuide} className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 px-3.5 py-1.5 text-xs font-bold text-white transition hover:bg-emerald-600"><Plus size={13} /> New guide</button>
        </div>
        <div className="divide-y divide-line">
          {guides.map((g) => {
            const key = `guide:${g.slug}`;
            const existing = docFor(key);
            const seedBlocks = legacySectionsToBlocks(guideSectionsToLegacySections(g.sections));
            return (
              <div key={g.id} className="flex items-center gap-3 px-5 py-3.5">
                <img src={g.image} alt="" className="h-10 w-16 shrink-0 rounded-lg object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-ink-900">{g.title}</p>
                  <p className="text-xs text-slate-400">{g.category} · {g.level} · {g.minutes} min</p>
                </div>
                {existing ? (
                  <button onClick={() => onEditContentDoc(existing)} className="rounded-lg p-2 text-slate-400 hover:bg-emerald-50 hover:text-emerald-700" title="Edit in visual builder"><Sparkles size={14} /></button>
                ) : seedBlocks.length > 0 ? (
                  <button onClick={() => seed(key, 'guide', g.title, seedBlocks, g.slug)} disabled={seeding === key} className="rounded-lg p-2 text-slate-400 hover:bg-emerald-50 hover:text-emerald-700 disabled:opacity-50" title="Load existing content into builder">
                    {seeding === key ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                  </button>
                ) : null}
                <button onClick={() => onEditGuide(g)} className="rounded-lg p-2 text-slate-400 hover:bg-paper hover:text-ink-900" title="Edit guide details"><Pencil size={14} /></button>
              </div>
            );
          })}
          {!guides.length && <p className="p-5 text-sm text-slate-400">No guides yet.</p>}
        </div>
      </div>

      <div className="rounded-2xl border border-line bg-white shadow-soft">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <p className="font-display text-base font-bold text-ink-900">Best-For pages ({intents.length})</p>
          <button onClick={onNewIntent} className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 px-3.5 py-1.5 text-xs font-bold text-white transition hover:bg-emerald-600"><Plus size={13} /> New page</button>
        </div>
        <div className="divide-y divide-line">
          {intents.map((i) => {
            const key = `best-for:${i.slug}`;
            const existing = docFor(key);
            const seedBlocks = legacySectionsToBlocks(introCriteriaToLegacySections(i.intro, i.criteria, i.sections));
            return (
              <div key={i.id} className="flex items-center gap-3 px-5 py-3.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-ink-900">{i.label}</p>
                  <p className="text-xs text-slate-400">/best/{i.slug}</p>
                </div>
                {existing ? (
                  <button onClick={() => onEditContentDoc(existing)} className="rounded-lg p-2 text-slate-400 hover:bg-emerald-50 hover:text-emerald-700" title="Edit in visual builder"><Sparkles size={14} /></button>
                ) : seedBlocks.length > 0 ? (
                  <button onClick={() => seed(key, 'best-for', i.label, seedBlocks, i.slug)} disabled={seeding === key} className="rounded-lg p-2 text-slate-400 hover:bg-emerald-50 hover:text-emerald-700 disabled:opacity-50" title="Load existing content into builder">
                    {seeding === key ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                  </button>
                ) : null}
                <button onClick={() => onEditIntent(i)} className="rounded-lg p-2 text-slate-400 hover:bg-paper hover:text-ink-900" title="Edit page details"><Pencil size={14} /></button>
              </div>
            );
          })}
          {!intents.length && <p className="p-5 text-sm text-slate-400">No best-for pages yet.</p>}
        </div>
      </div>
    </div>
  );
}

function AuthorHub({ authors, allContent, onNewAuthor, onEditAuthor }: { authors: ContentDocument[]; allContent: ContentDocument[]; onNewAuthor: () => void; onEditAuthor: (doc: ContentDocument) => void }) {
  const sorted = [...authors].sort((a,b)=>Number(a.settings?.display_order ?? 0)-Number(b.settings?.display_order ?? 0));
  return <div className="space-y-5"><div className="rounded-2xl border border-line bg-white p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-widest text-emerald-700">Author Hub</p><h2 className="font-display text-2xl font-bold text-ink-900">Editorial authors and reviewers</h2><p className="mt-1 text-sm text-slate-500">Manage public bios, roles, expertise, credentials, professional links, photos and attribution.</p></div><button onClick={onNewAuthor} className="inline-flex items-center gap-1.5 rounded-xl bg-ink-950 px-4 py-2 text-xs font-bold text-white"><Plus size={14}/> New author</button></div></div><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{sorted.map((author)=><button key={author.id || author.content_key} onClick={()=>onEditAuthor(author)} className="rounded-2xl border border-line bg-white p-5 text-left transition hover:-translate-y-0.5 hover:shadow-soft"><div className="flex items-center gap-3"><div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-emerald-50 text-sm font-bold text-emerald-700">{author.settings?.photo_url?<img src={String(author.settings.photo_url)} alt="" className="h-full w-full object-cover"/>:author.title.slice(0,2).toUpperCase()}</div><div><p className="font-display text-lg font-bold text-ink-900">{author.title || 'Untitled author'}</p><p className="text-xs text-slate-400">{String(author.settings?.role ?? 'Author')} · {author.published?'Published':'Draft'}</p></div></div><p className="mt-3 line-clamp-3 text-sm text-slate-600">{String(author.settings?.short_bio ?? author.excerpt ?? '')}</p><div className="mt-3 flex flex-wrap gap-1.5">{((author.settings?.expertise as string[] | undefined) ?? []).slice(0,4).map((x)=><span key={x} className="rounded-full bg-paper px-2 py-1 text-[11px] font-bold text-slate-500">{x}</span>)}</div></button>)}{!sorted.length&&<div className="rounded-2xl border border-dashed border-line bg-white p-8 text-center text-sm text-slate-500">No author profiles yet. Create the first author to enable written-by, reviewed-by and fact-checked-by attribution.</div>}</div><EntityPanel title="Attribution readiness" items={[`${authors.length} author records`,`${allContent.filter((d)=>d.settings?.written_by || d.settings?.reviewed_by || d.settings?.fact_checked_by).length} content documents with attribution metadata`,'Use author records for Written by, Reviewed by and Fact checked by roles']}/></div>;
}

function HubMetric({ label, value, sub }: { label: string; value: string; sub: string }) { return <div className="rounded-xl border border-line bg-paper p-3"><p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">{label}</p><p className="mt-1 font-display text-xl font-bold text-ink-900">{value}</p><p className="mt-0.5 text-xs text-slate-500">{sub}</p></div>; }

function EntityPanel({ title, items }: { title: string; items: string[] }) { return <div className="rounded-2xl border border-line bg-white p-5"><h3 className="font-display text-lg font-bold text-ink-900">{title}</h3><ul className="mt-3 space-y-2">{items.map((item)=><li key={item} className="flex items-start gap-2 text-sm text-slate-600"><ShieldCheck size={14} className="mt-0.5 text-emerald-500"/><span>{item}</span></li>)}</ul></div>; }

function Overview({
  brokers,
  reviews,
  subs,
  clicks,
  brokerName,
  onGoBrokers,
}: {
  brokers: Broker[];
  reviews: Review[];
  subs: Sub[];
  clicks: ClicksAgg;
  brokerName: Map<number, Broker>;
  onGoBrokers: () => void;
}) {
  const [range, setRange] = useState<'1' | '7' | '30' | 'all'>('30');
  const [rangeData, setRangeData] = useState<ClicksAgg | null>(null);
  const [rangeLoading, setRangeLoading] = useState(false);

  useEffect(() => {
    setRangeLoading(true);
    fetch(range === 'all' ? '/api/track?resource=clicks' : `/api/track?resource=clicks&days=${range}`)
      .then((x) => x.json())
      .then((d) => setRangeData(d))
      .catch(() => setRangeData(null))
      .finally(() => setRangeLoading(false));
  }, [range]);

  const data = rangeData ?? clicks;
  const verifiedPct = reviews.length
    ? Math.round((reviews.filter((r) => r.verified).length / reviews.length) * 100)
    : 0;

  // ---- daily series for the chart ----
  const daySeries = useMemo(() => {
    const byDay = data.byDay ?? {};
    const days: { day: string; n: number; label: string }[] = [];
    const now = new Date();
    const len = range === '1' ? 1 : range === '7' ? 7 : 30;
    const keys = Object.keys(byDay).sort();
    const start = range === 'all' && keys.length ? new Date(keys[0]) : new Date(now.getTime() - (len - 1) * 86400000);
    const capped = range === 'all' ? Math.min(60, Math.max(7, Math.round((now.getTime() - start.getTime()) / 86400000) + 1)) : len;
    for (let i = capped - 1; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 86400000);
      const key = d.toISOString().slice(0, 10);
      days.push({
        day: key,
        n: byDay[key] ?? 0,
        label: d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
      });
    }
    return days;
  }, [data, range]);

  const maxDay = Math.max(1, ...daySeries.map((d) => d.n));
  const perDay = daySeries.length ? (data.total / daySeries.length).toFixed(1) : '0';

  const clickBars = [...brokers]
    .map((b) => ({ b, n: data.byBroker?.[String(b.id)] ?? 0 }))
    .sort((x, y) => y.n - x.n)
    .slice(0, 6);
  const maxBroker = Math.max(1, ...clickBars.map((c) => c.n));

  const pageRows = Object.entries(data.byPage ?? {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);
  const maxPage = Math.max(1, ...pageRows.map(([, n]) => n));

  const gaps = [
    { label: 'missing editorial review', items: brokers.filter((b) => !b.review?.length) },
    { label: 'missing pros & cons', items: brokers.filter((b) => !b.pros?.length || !b.cons?.length) },
    { label: 'missing lab test data', items: brokers.filter((b) => !b.testing?.length) },
    { label: 'missing FAQs', items: brokers.filter((b) => !b.faqs?.length) },
    { label: 'uncategorised', items: brokers.filter((b) => !b.best_for?.length) },
  ].filter((g) => g.items.length > 0);

  return (
    <div className="space-y-6">
      {/* stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { icon: Landmark, label: 'Brokers tracked', value: String(brokers.length), sub: `${brokers.filter((b) => b.featured).length} featured` },
          { icon: MessageSquare, label: 'Community reviews', value: String(reviews.length), sub: `${verifiedPct}% verified` },
          { icon: Users, label: 'Newsletter subscribers', value: String(subs.length), sub: 'Friday Spread list' },
          { icon: MousePointerClick, label: 'Affiliate clicks', value: String(data.allTimeTotal ?? clicks.total ?? 0), sub: 'All-time outbound' },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-line bg-white p-5 shadow-soft">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <s.icon size={17} />
            </div>
            <p className="tnum mt-3 font-display text-3xl font-bold text-ink-900">{s.value}</p>
            <p className="text-xs font-semibold text-slate-500">{s.label}</p>
            <p className="mt-0.5 text-[11px] text-slate-400">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* data gaps */}
      {gaps.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-5">
          <p className="flex items-center gap-2 font-display text-base font-bold text-amber-900">
            <AlertTriangle size={17} className="text-amber-600" /> Data gaps to fix
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {gaps.map((g) => (
              <button
                key={g.label}
                onClick={onGoBrokers}
                className="rounded-xl border border-amber-200 bg-white px-4 py-3 text-left transition hover:border-amber-400 hover:shadow-sm"
              >
                <p className="text-sm font-bold text-amber-900">
                  {g.items.length} <span className="font-medium text-amber-700">{g.label}</span>
                </p>
                <p className="mt-0.5 truncate text-xs text-slate-500">
                  {g.items.map((b) => b.name).join(', ')}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ================= ANALYTICS ================= */}
      <div className="rounded-2xl border border-line bg-white p-5 shadow-soft sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-display text-lg font-bold text-ink-900">Traffic & conversions</p>
            <p className="text-xs text-slate-500">
              <span className="tnum font-bold text-ink-900">{data.total}</span> outbound clicks ·{' '}
              <span className="tnum">{perDay}</span>/day avg in range
            </p>
          </div>
          <div className="flex gap-1 rounded-xl bg-paper p-1">
            {RANGES.map((r) => (
              <button
                key={r.key}
                onClick={() => setRange(r.key)}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                  range === r.key ? 'bg-ink-950 text-white shadow-sm' : 'text-slate-500 hover:text-ink-900'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {/* daily clicks chart */}
        <div className={`mt-5 transition ${rangeLoading ? 'opacity-40' : ''}`}>
          <div className="flex h-28 items-end gap-[3px] sm:h-32">
            {daySeries.map((d) => (
              <div
                key={d.day}
                className="group relative flex-1 rounded-t-md bg-gradient-to-t from-emerald-600/50 to-emerald-400 transition hover:from-emerald-500"
                style={{ height: `${Math.max(d.n > 0 ? 6 : 2, (d.n / maxDay) * 100)}%` }}
              >
                <div className="pointer-events-none absolute -top-9 left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-ink-950 px-2 py-1 text-[10px] font-bold text-white group-hover:block">
                  {d.label}: {d.n}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-1.5 flex justify-between text-[10px] font-semibold text-slate-400">
            <span>{daySeries[0]?.label}</span>
            <span>{daySeries[daySeries.length - 1]?.label}</span>
          </div>
        </div>

        <div className="mt-6 grid gap-6 border-t border-line pt-6 lg:grid-cols-2">
          {/* top converting pages */}
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
              Top converting pages
            </p>
            <div className="mt-3 space-y-2.5">
              {pageRows.length === 0 && (
                <p className="rounded-xl border border-dashed border-line p-5 text-center text-xs text-slate-400">
                  No clicks in this range yet.
                </p>
              )}
              {pageRows.map(([page, n], i) => (
                <div key={page} className="flex items-center gap-3">
                  <span className="tnum w-4 shrink-0 text-xs font-bold text-slate-400">{i + 1}</span>
                  <span className="w-44 shrink-0 truncate font-mono text-xs font-semibold text-ink-900">{page}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-paper">
                    <div
                      className="h-full rounded-full bg-emerald-500"
                      style={{ width: `${Math.max(4, (n / maxPage) * 100)}%` }}
                    />
                  </div>
                  <span className="tnum w-8 text-right text-xs font-bold text-ink-900">{n}</span>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
              Pages producing the most outbound clicks are where review intent is strongest — double down there.
            </p>
          </div>

          {/* top brokers in range */}
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
              Top brokers in range
            </p>
            <div className="mt-3 space-y-2.5">
              {clickBars.every((c) => c.n === 0) && (
                <p className="rounded-xl border border-dashed border-line p-5 text-center text-xs text-slate-400">
                  No broker clicks in this range yet.
                </p>
              )}
              {clickBars.map(({ b, n }) => (
                <div key={b.id} className="flex items-center gap-3">
                  <Monogram name={b.name} logoUrl={b.logo_url} color={b.brand_color} size={24} className="rounded-md" />
                  <span className="w-32 truncate text-xs font-semibold text-ink-900">{b.name}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-paper">
                    <div
                      className="h-full rounded-full bg-ink-900"
                      style={{ width: `${Math.max(n > 0 ? 4 : 0, (n / maxBroker) * 100)}%` }}
                    />
                  </div>
                  <span className="tnum w-8 text-right text-xs font-bold text-ink-900">{n}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* recent clicks */}
      <div className="rounded-2xl border border-line bg-white p-5 shadow-soft">
        <p className="font-display text-base font-bold text-ink-900">Recent outbound clicks</p>
        <div className="mt-3 max-h-72 overflow-y-auto">
          {(clicks.recent ?? []).length === 0 ? (
            <p className="rounded-xl border border-dashed border-line p-5 text-center text-xs text-slate-400">
              Nothing recorded yet.
            </p>
          ) : (
            <table className="w-full text-xs">
              <tbody>
                {(clicks.recent ?? []).map((c) => (
                  <tr key={c.id} className="border-b border-line last:border-0">
                    <td className="py-2.5 pr-2 font-semibold text-ink-900">
                      {brokerName.get(c.broker_id)?.name ?? `#${c.broker_id}`}
                    </td>
                    <td className="py-2.5 pr-2 font-mono text-[11px] text-slate-500">{c.page}</td>
                    <td className="py-2.5 text-right text-slate-400">{timeAgo(c.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

/* ============================ BROKERS TAB ============================ */

function BrokersTab({
  brokers,
  onNew,
  onEdit,
  onDuplicate,
  onEditContent,
  onToggleFeatured,
  onDelete,
}: {
  brokers: Broker[];
  onNew: () => void;
  onEdit: (b: Broker) => void;
  onDuplicate: (b: Broker) => void;
  onEditContent: (b: Broker) => void;
  onToggleFeatured: (b: Broker) => void;
  onDelete: (b: Broker) => void;
}) {
  const [query, setQuery] = useState('');
  const list = brokers.filter(
    (b) =>
      !query ||
      b.name.toLowerCase().includes(query.toLowerCase()) ||
      b.tagline.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="rounded-2xl border border-line bg-white shadow-soft">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
        <p className="text-sm text-slate-500">
          <span className="tnum font-display text-lg font-bold text-ink-900">{list.length}</span> of {brokers.length} brokers
        </p>
        <div className="flex items-center gap-2">
          <div className="flex h-9 items-center gap-2 rounded-xl border border-line bg-paper px-3 transition focus-within:border-emerald-500">
            <Search size={14} className="text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search brokers…"
              className="w-40 bg-transparent text-xs outline-none"
            />
          </div>
          <button
            onClick={onNew}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-1.5 text-xs font-bold text-white transition hover:bg-emerald-600"
          >
            <Plus size={14} /> New broker
          </button>
        </div>
      </div>
      <p className="border-b border-line bg-paper/50 px-5 py-2.5 text-[11px] font-medium text-slate-400">
        Tip: use the document icon to open the broker CMS — detailed content, rich profile sections, trading data and country eligibility are now managed from the broker row.
      </p>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="border-b border-line bg-paper/60">
            <tr>
              <Th>Broker</Th>
              <Th>Rating</Th>
              <Th>Trust</Th>
              <Th>Categories</Th>
              <Th>Featured</Th>
              <Th>Actions</Th>
            </tr>
          </thead>
          <tbody>
            {list.map((b) => (
              <tr
                key={b.id}
                onClick={() => onEdit(b)}
                className="cursor-pointer border-b border-line last:border-0 transition hover:bg-emerald-50/40"
              >
                <Td>
                  <div className="flex items-center gap-3">
                    <Monogram name={b.name} logoUrl={b.logo_url} color={b.brand_color} size={30} className="rounded-lg" />
                    <div>
                      <p className="font-bold text-ink-900">{b.name}</p>
                      <p className="text-xs text-slate-400">/brokers/{b.slug}</p>
                    </div>
                  </div>
                </Td>
                <Td>
                  <span className="tnum flex items-center gap-1.5 font-bold text-ink-900">
                    <Star size={13} className="fill-amber-400 text-amber-400" />
                    {b.rating.toFixed(1)}
                  </span>
                </Td>
                <Td>
                  <span className="tnum font-bold text-ink-900">{b.trust_score}</span>
                </Td>
                <Td>
                  <div className="flex max-w-[220px] flex-wrap gap-1">
                    {b.best_for.length === 0 && <span className="text-xs text-slate-400">—</span>}
                    {b.best_for.slice(0, 3).map((s) => (
                      <span key={s} className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                        {INTENT_LABELS[s] ?? s}
                      </span>
                    ))}
                    {b.best_for.length > 3 && (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">
                        +{b.best_for.length - 3}
                      </span>
                    )}
                  </div>
                </Td>
                <Td>
                  <span onClick={(e) => e.stopPropagation()}>
                    <Toggle on={b.featured} onToggle={() => onToggleFeatured(b)} />
                  </span>
                </Td>
                <Td>
                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <Link
                      to={`/brokers/${b.slug}`}
                      target="_blank"
                      className="rounded-lg p-2 text-slate-400 transition hover:bg-paper hover:text-ink-900"
                      title="View public page"
                    >
                      <ArrowUpRight size={15} />
                    </Link>
                    <button
                      onClick={() => onEditContent(b)}
                      className="rounded-lg p-2 text-slate-400 transition hover:bg-emerald-50 hover:text-emerald-700"
                      title="Open broker CMS"
                    >
                      <FileText size={15} />
                    </button>
                    <button
                      onClick={() => onDuplicate(b)}
                      className="rounded-lg p-2 text-slate-400 transition hover:bg-sky-50 hover:text-sky-700"
                      title="Duplicate"
                    >
                      <Copy size={15} />
                    </button>
                    <button
                      onClick={() => onEdit(b)}
                      className="rounded-lg p-2 text-slate-400 transition hover:bg-emerald-50 hover:text-emerald-700"
                      title="Edit"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      onClick={() => onDelete(b)}
                      className="rounded-lg p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                      title="Delete"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
        {list.length === 0 && (
          <p className="p-8 text-center text-sm text-slate-400">No brokers match that search.</p>
        )}
      </div>
    </div>
  );
}

/* ============================ BROKER EDITOR ============================ */

const EDITOR_TABS = [
  { key: 'basics', label: 'Basics', icon: Info, done: (f: BrokerForm) => !!String(f.name ?? '').trim() && !!String(f.tagline ?? '').trim() },
  { key: 'pricing', label: 'Pricing & data', icon: CircleDollarSign, done: (f: BrokerForm) => parseFloat(String(f.rating)) > 0 && parseFloat(String(f.trust_score)) > 0 },
  { key: 'trust', label: 'Trust & regulation', icon: ShieldCheck, done: (f: BrokerForm) => (f.regulations?.length ?? 0) > 0 },
  { key: 'categories', label: 'Categories & features', icon: Tags, done: (f: BrokerForm) => (f.best_for?.length ?? 0) > 0 },
  { key: 'editorial', label: 'Editorial', icon: Newspaper, done: (f: BrokerForm) => (f.review?.length ?? 0) > 0 && (f.pros?.length ?? 0) > 0 && (f.cons?.length ?? 0) > 0 },
  { key: 'faq', label: 'FAQ & lab tests', icon: FlaskConical, done: (f: BrokerForm) => (f.faqs?.length ?? 0) > 0 && (f.testing?.length ?? 0) > 0 },
] as const;

type EditorTabKey = (typeof EDITOR_TABS)[number]['key'];

function BrokerEditor({
  broker,
  intents,
  token,
  onClose,
  onSave,
}: {
  broker: Broker | null;
  intents: Intent[];
  token: string;
  onClose: () => void;
  onSave: (fields: BrokerForm) => Promise<void>;
}) {
  const [form, setForm] = useState<BrokerForm>(() =>
    broker ? JSON.parse(JSON.stringify(broker)) : JSON.parse(JSON.stringify(NEW_BROKER))
  );
  const [etab, setEtab] = useState<EditorTabKey>('basics');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [logoBusy, setLogoBusy] = useState(false);

  const uploadLogo = (file: File) => {
    if (!broker) return;
    setLogoBusy(true);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64 = String(reader.result ?? '').split(',')[1] ?? '';
        const res = await fetch('/api/logo-upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ brokerId: broker.id, fileName: file.name, fileBase64: base64, contentType: file.type }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error((data as { error?: string }).error || 'Upload failed');
        setForm((f: BrokerForm) => ({ ...f, logo_url: data.url }));
      } catch (e) {
        alert(e instanceof Error ? e.message : 'Logo upload failed');
      } finally {
        setLogoBusy(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const removeLogo = async () => {
    if (!broker) return;
    setLogoBusy(true);
    try {
      await fetch('/api/broker-assets?resource=media', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ broker_id: broker.id }),
      });
      setForm((f: BrokerForm) => ({ ...f, logo_url: null }));
    } finally {
      setLogoBusy(false);
    }
  };
  const savedSnapshot = useRef(JSON.stringify(
    broker ? JSON.parse(JSON.stringify(broker)) : JSON.parse(JSON.stringify(NEW_BROKER))
  ));

  const dirty = JSON.stringify(form) !== savedSnapshot.current;

  const set = (key: string, value: unknown) => setForm((f: BrokerForm) => ({ ...f, [key]: value }));
  const setHealth = (key: string, value: number) =>
    setForm((f: BrokerForm) => ({ ...f, health: { ...f.health, [key]: value } }));
  const setAsset = (key: string, value: string) =>
    setForm((f: BrokerForm) => ({ ...f, assets: { ...f.assets, [key]: value } }));

  const attemptClose = useCallback(() => {
    if (dirty && !window.confirm('You have unsaved changes. Discard them?')) return;
    onClose();
  }, [dirty, onClose]);

  const submit = async () => {
    if (String(form.name).trim().length < 2) {
      setEtab('basics');
      return setErr('A broker name is required (see Basics tab).');
    }
    const out: BrokerForm = { ...form };
    for (const k of Object.keys(out)) {
      if (NUMERIC_KEYS.has(k)) out[k] = parseFloat(String(out[k])) || 0;
    }
    out.rating = Math.max(1, Math.min(5, Math.round(out.rating * 10) / 10));
    out.trust_score = Math.max(0, Math.min(100, Math.round(out.trust_score)));
    out.founded = Math.round(out.founded);
    out.bonus = String(out.bonus ?? '').trim() === '' ? null : String(out.bonus).trim();
    for (const k of Object.keys(out.assets)) out.assets[k] = Math.round(parseFloat(String(out.assets[k])) || 0);
    delete out.id;
    delete out.slug; // server derives slug from name
    delete out.logo_url; // logos live in broker_media, not the brokers table
    setBusy(true);
    try {
      await onSave(out);
      savedSnapshot.current = JSON.stringify(form);
      setErr('');
    } finally {
      setBusy(false);
    }
  };

  const categoryOptions = intents.map((i) => ({ value: i.slug, label: i.label }));
  const ratingPreview = parseFloat(String(form.rating)) || 0;
  const completed = EDITOR_TABS.filter((t) => t.done(form)).length;

  return (
    <div className="fixed inset-0 z-[80]">
      <div className="absolute inset-0 bg-ink-950/50 backdrop-blur-sm" onClick={attemptClose} />
      <div className="absolute inset-y-0 right-0 flex w-full flex-col bg-white shadow-soft-lg sm:max-w-3xl lg:max-w-4xl">
        {/* header with identity + live status */}
        <div className="relative overflow-hidden bg-ink-950 px-5 py-4">
          <div className="absolute inset-0 bg-grid-dark" />
          <div className="relative flex items-center gap-3">
            <Monogram name={form.name || 'New Broker'} logoUrl={form.logo_url} color={form.brand_color} size={40} className="rounded-xl" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate font-display text-lg font-bold text-white">
                  {form.name || 'New broker'}
                </p>
                {dirty && (
                  <span className="shrink-0 rounded-full bg-amber-400/15 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                    Unsaved
                  </span>
                )}
              </div>
              <p className="truncate text-xs text-slate-400">
                {form.tagline || (broker ? `/brokers/${broker.slug}` : 'New broker record')}
                {' · '}{completed}/{EDITOR_TABS.length} sections complete
              </p>
            </div>
            {broker && (
              <Link
                to={`/brokers/${broker.slug}`}
                target="_blank"
                className="hidden items-center gap-1.5 rounded-lg border border-white/15 px-3 py-1.5 text-xs font-semibold text-slate-300 transition hover:bg-white/10 hover:text-white sm:inline-flex"
              >
                <Eye size={13} /> View live
              </Link>
            )}
            <button
              onClick={attemptClose}
              className="rounded-lg p-2 text-slate-400 transition hover:bg-white/10 hover:text-white"
              aria-label="Close editor"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* left rail: preview + section nav */}
          <nav className="w-12 shrink-0 overflow-y-auto border-r border-line bg-paper/70 p-2 sm:w-56 sm:p-3">
            {/* live mini preview */}
            <div className="mb-3 hidden rounded-xl border border-line bg-white p-3 sm:block">
              <div className="flex items-center gap-2.5">
                <Monogram name={form.name || 'NB'} logoUrl={form.logo_url} color={form.brand_color} size={32} className="rounded-lg" />
                <div className="min-w-0">
                  <p className="truncate text-xs font-bold text-ink-900">{form.name || 'Broker name'}</p>
                  <Stars value={ratingPreview} size={10} />
                </div>
              </div>
              <div className="mt-2.5 grid grid-cols-3 gap-1">
                {[
                  ['Trust', String(form.trust_score ?? '—')],
                  ['Spread', `${form.spread_eurusd ?? '—'}p`],
                  ['Min dep', `$${form.min_deposit ?? '—'}`],
                ].map(([l, v]) => (
                  <div key={l} className="rounded-lg bg-paper px-1 py-1.5 text-center">
                    <p className="tnum text-[11px] font-bold text-ink-900">{v}</p>
                    <p className="text-[8px] font-bold uppercase tracking-wide text-slate-400">{l}</p>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-center text-[9px] font-bold uppercase tracking-[0.18em] text-slate-400">
                Live preview
              </p>
            </div>

            {EDITOR_TABS.map((t) => {
              const active = etab === t.key;
              const done = t.done(form);
              return (
                <button
                  key={t.key}
                  onClick={() => setEtab(t.key)}
                  title={t.label}
                  className={`group flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-xs font-bold transition sm:px-3 ${
                    active
                      ? 'bg-ink-950 text-white shadow-soft'
                      : 'text-slate-500 hover:bg-white hover:text-ink-900'
                  }`}
                >
                  <t.icon size={15} className={`shrink-0 ${active ? 'text-emerald-400' : 'text-slate-400'}`} />
                  <span className="hidden flex-1 sm:inline">{t.label}</span>
                  <span
                    className={`hidden h-1.5 w-1.5 shrink-0 rounded-full sm:inline-block ${
                      done ? 'bg-emerald-500' : active ? 'bg-white/30' : 'bg-slate-300'
                    }`}
                  />
                </button>
              );
            })}
          </nav>

          {/* scrollable form body */}
          <div className="flex-1 overflow-y-auto p-5 sm:p-6">
            {err && (
              <p className="mb-4 rounded-xl bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-600">{err}</p>
            )}

            {etab === 'basics' && (
              <div className="space-y-4">
                <SectionIntro
                  title="Identity"
                  text="Name, positioning line and brand colour — these drive the monogram and every card on the site."
                />
                <div className="grid grid-cols-2 gap-3">
                  <label className="col-span-2 block">
                    <FieldLabel>Name</FieldLabel>
                    <TextInput value={form.name} onChange={(v) => set('name', v)} placeholder="e.g. Pepperstone" />
                  </label>
                  <label className="col-span-2 block">
                    <FieldLabel hint="one-line pitch shown on cards">Tagline</FieldLabel>
                    <TextInput value={form.tagline} onChange={(v) => set('tagline', v)} />
                  </label>
                  <label className="col-span-2 block">
                    <FieldLabel hint="affiliate redirect target">Website URL</FieldLabel>
                    <TextInput value={form.website} onChange={(v) => set('website', v)} mono />
                  </label>
                  <label className="col-span-2 block">
                    <FieldLabel hint="preferred outbound affiliate / account-opening URL; falls back to Website URL when blank">Affiliate / account-opening URL</FieldLabel>
                    <TextInput value={form.affiliate_url ?? ''} onChange={(v) => set('affiliate_url', v)} placeholder="https://affiliate.example.com/..." mono />
                  </label>
                  <label className="block">
                    <FieldLabel>Brand color</FieldLabel>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={form.brand_color}
                        onChange={(e) => set('brand_color', e.target.value)}
                        className="h-10 w-12 cursor-pointer rounded-xl border border-line bg-paper p-1"
                      />
                      <TextInput value={form.brand_color} onChange={(v) => set('brand_color', v)} mono />
                    </div>
                  </label>
                  <label className="block">
                    <FieldLabel>Founded</FieldLabel>
                    <TextInput value={String(form.founded)} onChange={(v) => set('founded', v)} mono />
                  </label>
                  <label className="col-span-2 block">
                    <FieldLabel>Headquarters</FieldLabel>
                    <TextInput value={form.headquarters} onChange={(v) => set('headquarters', v)} placeholder="City, Country" />
                  </label>
                  <label className="col-span-2 block">
                    <FieldLabel hint="blank = no promotion">Active promotion / bonus</FieldLabel>
                    <TextInput value={form.bonus ?? ''} onChange={(v) => set('bonus', v)} placeholder="e.g. Active Trader rebates" />
                  </label>
                  <label className="col-span-2 block">
                    <FieldLabel hint="Verbatim from the broker's own regulated entity's disclosure — e.g. '76% of retail investor accounts lose money when trading CFDs with this provider'. Leave blank until verified; never estimate this figure.">
                      Risk warning (regulator-mandated, per broker)
                    </FieldLabel>
                    <TextInput value={form.risk_warning ?? ''} onChange={(v) => set('risk_warning', v)} placeholder="e.g. 76% of retail investor accounts lose money when trading CFDs with this provider" />
                  </label>
                  <div className="col-span-2 rounded-xl border border-line bg-paper p-4">
                    <FieldLabel hint="PNG / SVG / WebP up to 500KB — replaces the two-letter tile everywhere">
                      Broker logo
                    </FieldLabel>
                    <div className="mt-2 flex items-center gap-3">
                      <Monogram name={form.name || 'NB'} color={form.brand_color} size={44} logoUrl={form.logo_url} />
                      {broker ? (
                        <>
                          <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-ink-950 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-ink-800">
                            {logoBusy ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                            {form.logo_url ? 'Replace logo' : 'Upload logo'}
                            <input
                              type="file"
                              accept="image/png,image/jpeg,image/svg+xml,image/webp"
                              className="hidden"
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) uploadLogo(f);
                                e.target.value = '';
                              }}
                            />
                          </label>
                          {form.logo_url && (
                            <button
                              type="button"
                              onClick={removeLogo}
                              className="rounded-xl px-3 py-2 text-xs font-bold text-rose-600 transition hover:bg-rose-50"
                            >
                              Remove
                            </button>
                          )}
                        </>
                      ) : (
                        <p className="text-xs text-slate-400">Save the broker first, then upload a logo.</p>
                      )}
                    </div>
                  </div>
                </div>
                <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-line bg-paper px-4 py-3">
                  <Toggle on={!!form.featured} onToggle={() => set('featured', !form.featured)} />
                  <div>
                    <p className="text-sm font-semibold text-ink-900">Featured broker</p>
                    <p className="text-xs text-slate-400">Pinned emphasis across the site</p>
                  </div>
                </label>
              </div>
            )}

            {etab === 'pricing' && (
              <div className="space-y-4">
                <SectionIntro
                  title="Scores & trading data"
                  text="Every number here renders publicly — stats on cards, the fee table and the comparison engine."
                />
                <div className="grid grid-cols-2 gap-4">
                  <NumField label="Editorial rating (1–5)" value={String(form.rating)} onChange={(v) => set('rating', v)} />
                  <NumField label="Trust score (0–100)" value={String(form.trust_score)} onChange={(v) => set('trust_score', v)} />
                  <NumField label="Min deposit ($)" value={String(form.min_deposit)} onChange={(v) => set('min_deposit', v)} />
                  <NumField label="EUR/USD spread (pips)" value={String(form.spread_eurusd)} onChange={(v) => set('spread_eurusd', v)} />
                  <label className="block">
                    <FieldLabel>Commission label</FieldLabel>
                    <TextInput value={form.commission} onChange={(v) => set('commission', v)} placeholder="$3.50 / lot" />
                  </label>
                  <NumField label="Commission value ($/lot)" value={String(form.commission_value)} onChange={(v) => set('commission_value', v)} />
                  <label className="block">
                    <FieldLabel>Max leverage label</FieldLabel>
                    <TextInput value={form.max_leverage} onChange={(v) => set('max_leverage', v)} placeholder="1:500" />
                  </label>
                  <NumField label="Leverage numeric (500)" value={String(form.leverage_value)} onChange={(v) => set('leverage_value', v)} />
                  <NumField label="Execution (ms)" value={String(form.execution_ms)} onChange={(v) => set('execution_ms', v)} />
                  <NumField label="Avg withdrawal (hours)" value={String(form.withdrawal_hours)} onChange={(v) => set('withdrawal_hours', v)} />
                  <label className="block">
                    <FieldLabel>Deposit speed label</FieldLabel>
                    <TextInput value={form.deposit_time} onChange={(v) => set('deposit_time', v)} placeholder="Instant" />
                  </label>
                  <NumField label="Uptime % (90d)" value={String(form.uptime)} onChange={(v) => set('uptime', v)} />
                  <NumField label="Withdrawal fee ($)" value={String(form.withdrawal_fee)} onChange={(v) => set('withdrawal_fee', v)} />
                  <label className="block">
                    <FieldLabel>Inactivity fee</FieldLabel>
                    <TextInput value={form.inactivity_fee} onChange={(v) => set('inactivity_fee', v)} placeholder="None" />
                  </label>
                  <label className="col-span-2 block">
                    <FieldLabel hint="comma separated">Account types</FieldLabel>
                    <TextInput
                      value={(form.account_types ?? []).join(', ')}
                      onChange={(v) => set('account_types', v.split(',').map((s) => s.trim()).filter(Boolean))}
                      placeholder="Standard, Raw, Islamic, Demo"
                    />
                  </label>
                </div>
                <div className="rounded-xl border border-line bg-paper p-4">
                  <FieldLabel hint="symbol counts per asset class">Markets shelf</FieldLabel>
                  <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-5">
                    {(['forex', 'indices', 'commodities', 'crypto', 'stocks'] as const).map((k) => (
                      <label key={k} className="block">
                        <span className="mb-1 block text-[10px] font-semibold capitalize text-slate-500">{k}</span>
                        <TextInput value={String(form.assets?.[k] ?? 0)} onChange={(v) => setAsset(k, v)} mono />
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {etab === 'trust' && (
              <div className="space-y-5">
                <SectionIntro
                  title="Safety stack"
                  text="Licences, protection mechanisms and the six factors that compute the public Health Score ring."
                />
                <div className="rounded-xl border border-line bg-paper p-4">
                  <FieldLabel>Regulators & licences</FieldLabel>
                  <div className="mt-2 space-y-2">
                    {(form.regulations as Regulation[]).map((r, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <input
                          value={r.body}
                          onChange={(e) =>
                            set('regulations', form.regulations.map((x: Regulation, xi: number) => (xi === i ? { ...x, body: e.target.value } : x)))
                          }
                          placeholder="FCA"
                          className="h-10 w-28 rounded-xl border border-line bg-white px-3 text-sm font-medium outline-none focus:border-emerald-500"
                        />
                        <input
                          value={r.country}
                          onChange={(e) =>
                            set('regulations', form.regulations.map((x: Regulation, xi: number) => (xi === i ? { ...x, country: e.target.value } : x)))
                          }
                          placeholder="United Kingdom"
                          className="h-10 flex-1 rounded-xl border border-line bg-white px-3 text-sm font-medium outline-none focus:border-emerald-500"
                        />
                        <select
                          value={r.tier}
                          onChange={(e) =>
                            set('regulations', form.regulations.map((x: Regulation, xi: number) => (xi === i ? { ...x, tier: Number(e.target.value) } : x)))
                          }
                          className="h-10 rounded-xl border border-line bg-white px-2 text-sm font-semibold outline-none"
                        >
                          <option value={1}>Tier-1</option>
                          <option value={2}>Tier-2</option>
                          <option value={3}>Tier-3</option>
                        </select>
                        <IconRemove onClick={() => set('regulations', form.regulations.filter((_: Regulation, xi: number) => xi !== i))} />
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => set('regulations', [...form.regulations, { body: '', country: '', tier: 1 }])}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-line px-3 py-2 text-xs font-bold text-slate-500 transition hover:border-emerald-500 hover:text-emerald-700"
                    >
                      <Plus size={13} /> Add regulator
                    </button>
                  </div>
                </div>

                <div className="rounded-xl border border-line bg-paper p-4">
                  <FieldLabel hint="feeds the Broker Health Score ring">Health factors (0–100)</FieldLabel>
                  <div className="mt-3 space-y-3">
                    {HEALTH_FACTORS.map((h) => (
                      <div key={h.key} className="flex items-center gap-3">
                        <span className="w-36 shrink-0 text-xs font-semibold text-slate-600">{h.label}</span>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          value={form.health?.[h.key] ?? 50}
                          onChange={(e) => setHealth(h.key, Number(e.target.value))}
                          className="h-2 flex-1 cursor-pointer accent-emerald-500"
                        />
                        <span className="tnum w-9 text-right text-xs font-bold text-ink-900">
                          {form.health?.[h.key] ?? 50}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <ToggleGrid
                  items={[
                    { key: 'nbp', label: 'Negative balance protection' },
                    { key: 'segregated', label: 'Segregated client funds' },
                    { key: 'hedging', label: 'Hedging allowed' },
                    { key: 'scalping', label: 'Scalping allowed' },
                  ]}
                  form={form}
                  set={set}
                />
              </div>
            )}

            {etab === 'categories' && (
              <div className="space-y-5">
                <SectionIntro
                  title="Where this broker ranks"
                  text="Categories decide which /best/* pages feature this broker — and the quiz matcher reads the same flags."
                />
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
                  <FieldLabel hint="controls where this broker appears in /best/* rankings">Categories</FieldLabel>
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    {categoryOptions.map((opt) => {
                      const on = (form.best_for as string[]).includes(opt.value);
                      return (
                        <button
                          type="button"
                          key={opt.value}
                          onClick={() =>
                            set(
                              'best_for',
                              on
                                ? form.best_for.filter((s: string) => s !== opt.value)
                                : [...form.best_for, opt.value]
                            )
                          }
                          className={`rounded-full border px-3.5 py-2 text-xs font-bold transition ${
                            on
                              ? 'border-emerald-600 bg-emerald-600 text-white shadow-sm'
                              : 'border-line bg-white text-slate-500 hover:border-emerald-400'
                          }`}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                  {form.best_for.length === 0 && (
                    <p className="mt-2.5 text-xs text-amber-700">
                      ⚠ No categories selected — this broker won't appear in any "Best for" ranking.
                    </p>
                  )}
                </div>

                <ChipSelect label="Trading platforms" options={PLATFORM_OPTIONS} form={form} setKey="platforms" set={set} allowCustom />
                <ChipSelect label="Payment methods" options={PAYMENT_OPTIONS} form={form} setKey="payments" set={set} allowCustom />
                <ChipSelect label="Support channels" options={SUPPORT_OPTIONS} form={form} setKey="support_channels" set={set} allowCustom />

                <div className="grid grid-cols-2 gap-4">
                  <NumField label="Support score (0–100)" value={String(form.support_score)} onChange={(v) => set('support_score', v)} />
                </div>

                <ToggleGrid
                  items={[
                    { key: 'demo_account', label: 'Free demo account' },
                    { key: 'islamic_account', label: 'Islamic / swap-free' },
                    { key: 'copy_trading', label: 'Copy trading built in' },
                  ]}
                  form={form}
                  set={set}
                />
              </div>
            )}

            {etab === 'editorial' && (
              <div className="space-y-5">
                <SectionIntro
                  title="The review itself"
                  text="Long-form paragraphs plus pros & cons — this is the persuasive core of the public page."
                />
                <StringList
                  label="Review body paragraphs"
                  hint="long-form review, one block per paragraph"
                  items={form.review}
                  onChange={(v) => set('review', v)}
                  textarea
                  placeholder="Write a review paragraph…"
                />
                <StringList
                  label="Pros — 'What we like'"
                  items={form.pros}
                  onChange={(v) => set('pros', v)}
                  placeholder="e.g. Raw spreads from 0.0 pips"
                />
                <StringList
                  label="Cons — 'Watch out for'"
                  items={form.cons}
                  onChange={(v) => set('cons', v)}
                  placeholder="e.g. No weekend support"
                />
              </div>
            )}

            {etab === 'faq' && (
              <div className="space-y-5">
                <SectionIntro
                  title="Answers & evidence"
                  text="Lab results are your measurement receipts; FAQs win long-tail search snippets."
                />
                <div className="rounded-xl border border-line bg-paper p-4">
                  <FieldLabel hint="shown as lab-tested on the public review">Measured lab results</FieldLabel>
                  <div className="mt-2 space-y-2.5">
                    {(form.testing as TestResult[]).map((t, i) => (
                      <div key={i} className="flex flex-col gap-2 sm:grid sm:grid-cols-[140px_120px_1fr_26px]">
                        <input
                          value={t.label}
                          onChange={(e) => set('testing', form.testing.map((x: TestResult, xi: number) => (xi === i ? { ...x, label: e.target.value } : x)))}
                          placeholder="Deposit time"
                          className="h-10 rounded-xl border border-line bg-white px-3 text-sm font-medium outline-none focus:border-emerald-500"
                        />
                        <input
                          value={t.result}
                          onChange={(e) => set('testing', form.testing.map((x: TestResult, xi: number) => (xi === i ? { ...x, result: e.target.value } : x)))}
                          placeholder="6h 12m"
                          className="tnum h-10 rounded-xl border border-line bg-white px-3 text-sm font-bold outline-none focus:border-emerald-500"
                        />
                        <input
                          value={t.detail}
                          onChange={(e) => set('testing', form.testing.map((x: TestResult, xi: number) => (xi === i ? { ...x, detail: e.target.value } : x)))}
                          placeholder="Skrill request Monday 10:04…"
                          className="h-10 rounded-xl border border-line bg-white px-3 text-sm outline-none focus:border-emerald-500"
                        />
                        <IconRemove onClick={() => set('testing', form.testing.filter((_: TestResult, xi: number) => xi !== i))} />
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => set('testing', [...form.testing, { label: '', result: '', detail: '' }])}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-line px-3 py-2 text-xs font-bold text-slate-500 transition hover:border-emerald-500 hover:text-emerald-700"
                    >
                      <FlaskConical size={13} /> Add lab result
                    </button>
                  </div>
                </div>

                <div className="rounded-xl border border-line bg-paper p-4">
                  <FieldLabel>FAQs</FieldLabel>
                  <div className="mt-2 space-y-2.5">
                    {(form.faqs as FAQ[]).map((f, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <div className="flex-1 space-y-1.5">
                          <input
                            value={f.q}
                            onChange={(e) => set('faqs', form.faqs.map((x: FAQ, xi: number) => (xi === i ? { ...x, q: e.target.value } : x)))}
                            placeholder="Question"
                            className="h-10 w-full rounded-xl border border-line bg-white px-3 text-sm font-medium outline-none focus:border-emerald-500"
                          />
                          <textarea
                            value={f.a}
                            onChange={(e) => set('faqs', form.faqs.map((x: FAQ, xi: number) => (xi === i ? { ...x, a: e.target.value } : x)))}
                            placeholder="Answer"
                            rows={2}
                            className="w-full rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500"
                          />
                        </div>
                        <IconRemove onClick={() => set('faqs', form.faqs.filter((_: FAQ, xi: number) => xi !== i))} />
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => set('faqs', [...form.faqs, { q: '', a: '' }])}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-line px-3 py-2 text-xs font-bold text-slate-500 transition hover:border-emerald-500 hover:text-emerald-700"
                    >
                      <Plus size={13} /> Add FAQ
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* sticky footer */}
        <div className="flex items-center gap-3 border-t border-line bg-white px-5 py-3.5 shadow-[0_-8px_24px_-16px_rgba(13,18,12,0.15)]">
          <p className={`flex items-center gap-1.5 text-xs font-semibold ${dirty ? 'text-amber-600' : 'text-slate-400'}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${dirty ? 'bg-amber-500' : 'bg-slate-300'}`} />
            {dirty ? 'Unsaved changes' : broker ? 'All changes saved' : 'Slug generated from name'}
          </p>
          <button
            onClick={attemptClose}
            className="ml-auto rounded-xl border border-line px-5 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-paper"
          >
            Close
          </button>
          <button
            onClick={submit}
            disabled={busy || !dirty}
            className="inline-flex items-center gap-2 rounded-xl bg-ink-950 px-6 py-2.5 text-sm font-bold text-white transition hover:bg-ink-800 disabled:opacity-50"
          >
            {busy && <Loader2 size={15} className="animate-spin" />}
            {broker ? 'Save changes' : 'Create broker'}
          </button>
        </div>
      </div>
    </div>
  );
}

function SectionIntro({ title, text }: { title: string; text: string }) {
  return (
    <div className="border-b border-line pb-3">
      <p className="font-display text-base font-bold text-ink-900">{title}</p>
      <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{text}</p>
    </div>
  );
}

/* -------- editor helper components -------- */

function NumField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <FieldLabel>{label}</FieldLabel>
      <TextInput value={value} onChange={onChange} mono />
    </label>
  );
}

function IconRemove({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
      aria-label="Remove"
    >
      <Trash2 size={14} />
    </button>
  );
}

function StringList({
  label,
  hint,
  items,
  onChange,
  textarea = false,
  placeholder,
}: {
  label: string;
  hint?: string;
  items: string[];
  onChange: (v: string[]) => void;
  textarea?: boolean;
  placeholder?: string;
}) {
  return (
    <div className="rounded-xl border border-line bg-paper p-4">
      <FieldLabel hint={hint}>{label}</FieldLabel>
      <div className="mt-2 space-y-2">
        {items.map((item, i) => (
          <div key={i} className="flex items-start gap-2">
            {textarea ? (
              <textarea
                value={item}
                rows={3}
                onChange={(e) => onChange(items.map((x, xi) => (xi === i ? e.target.value : x)))}
                placeholder={placeholder}
                className="w-full rounded-xl border border-line bg-white px-3 py-2 text-sm leading-relaxed outline-none focus:border-emerald-500"
              />
            ) : (
              <input
                value={item}
                onChange={(e) => onChange(items.map((x, xi) => (xi === i ? e.target.value : x)))}
                placeholder={placeholder}
                className="h-10 w-full rounded-xl border border-line bg-white px-3 text-sm outline-none focus:border-emerald-500"
              />
            )}
            <IconRemove onClick={() => onChange(items.filter((_, xi) => xi !== i))} />
          </div>
        ))}
        <button
          type="button"
          onClick={() => onChange([...items, ''])}
          className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-line px-3 py-2 text-xs font-bold text-slate-500 transition hover:border-emerald-500 hover:text-emerald-700"
        >
          <Plus size={13} /> Add entry
        </button>
      </div>
    </div>
  );
}

function ChipSelect({
  label,
  options,
  form,
  setKey,
  set,
  allowCustom = false,
}: {
  label: string;
  options: string[];
  form: BrokerForm;
  setKey: string;
  set: (k: string, v: unknown) => void;
  allowCustom?: boolean;
}) {
  const selected: string[] = form[setKey] ?? [];
  const [custom, setCustom] = useState('');
  const all = [...new Set([...options, ...selected])];

  return (
    <div className="rounded-xl border border-line bg-paper p-4">
      <FieldLabel>{label}</FieldLabel>
      <div className="mt-2 flex flex-wrap gap-2">
        {all.map((opt) => {
          const on = selected.includes(opt);
          return (
            <button
              type="button"
              key={opt}
              onClick={() => set(setKey, on ? selected.filter((s) => s !== opt) : [...selected, opt])}
              className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                on
                  ? 'border-ink-950 bg-ink-950 text-white'
                  : 'border-line bg-white text-slate-500 hover:border-ink-900'
              }`}
            >
              {opt}
            </button>
          );
        })}
      </div>
      {allowCustom && (
        <div className="mt-2.5 flex gap-2">
          <input
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            placeholder="Add custom option…"
            className="h-9 flex-1 rounded-lg border border-line bg-white px-3 text-xs outline-none focus:border-emerald-500"
          />
          <button
            type="button"
            onClick={() => {
              const v = custom.trim();
              if (v && !selected.includes(v)) set(setKey, [...selected, v]);
              setCustom('');
            }}
            className="rounded-lg bg-ink-950 px-3.5 text-xs font-bold text-white transition hover:bg-ink-800"
          >
            Add
          </button>
        </div>
      )}
    </div>
  );
}

function ToggleGrid({
  items,
  form,
  set,
}: {
  items: { key: string; label: string }[];
  form: BrokerForm;
  set: (k: string, v: unknown) => void;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {items.map((it) => (
        <label
          key={it.key}
          className="flex cursor-pointer items-center gap-3 rounded-xl border border-line bg-paper px-4 py-3 transition hover:border-emerald-300"
        >
          <Toggle on={!!form[it.key]} onToggle={() => set(it.key, !form[it.key])} />
          <span className="text-sm font-semibold text-ink-900">{it.label}</span>
        </label>
      ))}
    </div>
  );
}

/* ============================ REVIEWS TAB ============================ */

function ReviewsTab({
  reviews,
  brokerName,
  onToggleVerified,
  onDelete,
}: {
  reviews: Review[];
  brokerName: Map<number, Broker>;
  onToggleVerified: (r: Review) => void;
  onDelete: (r: Review) => void;
}) {
  const [filter, setFilter] = useState('');
  const [expanded, setExpanded] = useState<number | null>(null);
  const list = filter
    ? reviews.filter((r) => {
        const b = brokerName.get(r.broker_id)?.name ?? '';
        return (
          b.toLowerCase().includes(filter.toLowerCase()) ||
          r.author.toLowerCase().includes(filter.toLowerCase()) ||
          r.title.toLowerCase().includes(filter.toLowerCase())
        );
      })
    : reviews;

  return (
    <div className="rounded-2xl border border-line bg-white shadow-soft">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
        <p className="font-display text-base font-bold text-ink-900">
          {reviews.length} reviews <span className="text-slate-400">· {reviews.filter((r) => r.verified).length} verified</span>
        </p>
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter by broker, author, title…"
          className="h-9 w-64 rounded-xl border border-line bg-paper px-3.5 text-xs outline-none focus:border-emerald-500"
        />
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="border-b border-line bg-paper/60">
            <tr>
              <Th>Review</Th>
              <Th>Broker</Th>
              <Th>Rating</Th>
              <Th>Helpful</Th>
              <Th>Verified</Th>
              <Th>Posted</Th>
              <Th>Actions</Th>
            </tr>
          </thead>
          <tbody>
            {list.map((r) => {
              const b = brokerName.get(r.broker_id);
              const open = expanded === r.id;
              return (
                <Fragment key={r.id}>
                  <tr
                    onClick={() => setExpanded(open ? null : r.id)}
                    className="cursor-pointer border-b border-line transition hover:bg-emerald-50/40"
                  >
                    <Td className="max-w-xs">
                      <p className="truncate font-bold text-ink-900">{r.title}</p>
                      <p className="text-xs text-slate-400">
                        {r.author} · {r.country}
                      </p>
                    </Td>
                    <Td>
                      {b && (
                        <span className="flex items-center gap-2 text-xs font-semibold text-ink-900">
                          <Monogram name={b.name} logoUrl={b.logo_url} color={b.brand_color} size={20} className="rounded-md" />
                          {b.name}
                        </span>
                      )}
                    </Td>
                    <Td>
                      <Stars value={r.rating} size={11} />
                    </Td>
                    <Td>
                      <span className="tnum text-xs font-semibold">{r.helpful}</span>
                    </Td>
                    <Td>
                      <span onClick={(e) => e.stopPropagation()}>
                        <Toggle on={r.verified} onToggle={() => onToggleVerified(r)} />
                      </span>
                    </Td>
                    <Td>
                      <span className="text-xs text-slate-400">{timeAgo(r.created_at)}</span>
                    </Td>
                    <Td>
                      <span onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => onDelete(r)}
                          className="rounded-lg p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                          title="Delete"
                        >
                          <Trash2 size={15} />
                        </button>
                      </span>
                    </Td>
                  </tr>
                  {open && (
                    <tr className="border-b border-line bg-paper/50">
                      <td colSpan={7} className="px-4 py-3 text-sm leading-relaxed text-slate-600">
                        {r.body}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
        {list.length === 0 && (
          <p className="p-8 text-center text-sm text-slate-400">No reviews match that filter.</p>
        )}
      </div>
    </div>
  );
}

/* ============================ CONTENT TAB ============================ */

function ContentTab({
  guides,
  intents,
  countries,
  countryBestFors,
  brokers,
  onNewGuide,
  onEditGuide,
  onDeleteGuide,
  onNewIntent,
  onEditIntent,
  onDeleteIntent,
  onNewCountryBestFor,
  onEditCountryBestFor,
  onDeleteCountryBestFor,
  onEditBrokerContent,
  onNewCountry,
  onEditCountry,
  onDeleteCountry,
  contentDocs,
  onNewContentDoc,
  onEditContentDoc,
  onDeleteContentDoc,
}: {
  guides: Guide[];
  intents: Intent[];
  countries: CountryPage[];
  countryBestFors: CountryBestFor[];
  brokers: Broker[];
  onNewGuide: () => void;
  onEditGuide: (g: Guide) => void;
  onDeleteGuide: (g: Guide) => void;
  onNewIntent: () => void;
  onEditIntent: (i: Intent) => void;
  onDeleteIntent: (i: Intent) => void;
  onNewCountryBestFor: () => void;
  onEditCountryBestFor: (p: CountryBestFor) => void;
  onDeleteCountryBestFor: (p: CountryBestFor) => void;
  onEditBrokerContent: (b: Broker) => void;
  onNewCountry: () => void;
  onEditCountry: (c: CountryPage) => void;
  onDeleteCountry: (c: CountryPage) => void;
  contentDocs: ContentDocument[];
  onNewContentDoc: () => void;
  onEditContentDoc: (d: ContentDocument) => void;
  onDeleteContentDoc: (d: ContentDocument) => void;
}) {
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <div className="rounded-2xl border border-line bg-white shadow-soft">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <p className="font-display text-base font-bold text-ink-900">Guides ({guides.length})</p>
          <button
            onClick={onNewGuide}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 px-3.5 py-1.5 text-xs font-bold text-white transition hover:bg-emerald-600"
          >
            <Plus size={13} /> New guide
          </button>
        </div>
        <div className="divide-y divide-line">
          {guides.map((g) => (
            <div key={g.id} className="flex items-center gap-3 px-5 py-3.5">
              <img src={g.image} alt="" className="h-10 w-16 rounded-lg object-cover" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-ink-900">{g.title}</p>
                <p className="text-xs text-slate-400">
                  {g.category} · {g.level} · {g.minutes} min · {fmtDate(g.published)}
                </p>
              </div>
              <Link
                to={`/guides/${g.slug}`}
                target="_blank"
                className="rounded-lg p-2 text-slate-400 transition hover:bg-paper hover:text-ink-900"
              >
                <ArrowUpRight size={15} />
              </Link>
              <button
                onClick={() => onEditGuide(g)}
                className="rounded-lg p-2 text-slate-400 transition hover:bg-emerald-50 hover:text-emerald-700"
                title="Edit guide"
              >
                <Pencil size={15} />
              </button>
              <button
                onClick={() => onDeleteGuide(g)}
                className="rounded-lg p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                title="Delete guide"
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-line bg-white shadow-soft">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <p className="font-display text-base font-bold text-ink-900">SEO intent pages ({intents.length})</p>
          <button
            onClick={onNewIntent}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 px-3.5 py-1.5 text-xs font-bold text-white transition hover:bg-emerald-600"
          >
            <Plus size={13} /> New page
          </button>
        </div>
        <div className="divide-y divide-line">
          {intents.map((i) => (
            <div key={i.id} className="flex items-center gap-3 px-5 py-3.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-ink-900">{i.title}</p>
                <p className="text-xs text-slate-400">/best/{i.slug}</p>
              </div>
              <Link
                to={`/best/${i.slug}`}
                target="_blank"
                className="rounded-lg p-2 text-slate-400 transition hover:bg-paper hover:text-ink-900"
                title="View public page"
              >
                <ArrowUpRight size={15} />
              </Link>
              <button
                onClick={() => onEditIntent(i)}
                className="rounded-lg p-2 text-slate-400 transition hover:bg-emerald-50 hover:text-emerald-700"
                title="Edit intent"
              >
                <Pencil size={15} />
              </button>
              <button
                onClick={() => onDeleteIntent(i)}
                className="rounded-lg p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                title="Delete intent"
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
        <p className="px-5 py-4 text-xs leading-relaxed text-slate-400">
          Broker categories are assigned per broker in the broker editor — the Categories &amp; features tab.
        </p>
      </div>

      {/* ------------------------- BROKER DETAILED CONTENT ------------------------- */}
      <div className="rounded-2xl border border-line bg-white shadow-soft lg:col-span-2">
        <div className="border-b border-line px-5 py-4">
          <p className="font-display text-base font-bold text-ink-900">Broker detailed content</p>
          <p className="mt-0.5 text-xs text-slate-400">Edit platform, account-type and deposit/withdrawal content used on broker pages. Do not invent broker facts.</p>
        </div>
        <div className="grid gap-0 sm:grid-cols-2">
          {brokers.map((b) => (
            <div key={b.id} className="flex items-center gap-3 border-b border-line px-5 py-3.5 sm:border-r">
              <Monogram name={b.name} logoUrl={b.logo_url} color={b.brand_color} size={32} className="rounded-lg" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-ink-900">{b.name}</p>
                <p className="text-xs text-slate-400">Platforms · accounts · payment methods</p>
              </div>
              <button onClick={() => onEditBrokerContent(b)} className="rounded-lg p-2 text-slate-400 transition hover:bg-emerald-50 hover:text-emerald-700" title="Edit broker detailed content"><Pencil size={15} /></button>
            </div>
          ))}
        </div>
      </div>

      {/* ------------------------- COUNTRY BEST-FOR SEO ------------------------- */}
      <div className="rounded-2xl border border-line bg-white shadow-soft lg:col-span-2">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div>
            <p className="font-display text-base font-bold text-ink-900">Country Best-For SEO pages ({countryBestFors.length})</p>
            <p className="mt-0.5 text-xs text-slate-400">Editable country-specific commercial landing pages.</p>
          </div>
          <button onClick={onNewCountryBestFor} className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 px-3.5 py-1.5 text-xs font-bold text-white transition hover:bg-emerald-600">
            <Plus size={13} /> New page
          </button>
        </div>
        <div className="grid gap-0 sm:grid-cols-2">
          {countryBestFors.map((p) => (
            <div key={p.id} className="flex items-center gap-3 border-b border-line px-5 py-3.5 sm:border-r">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-ink-900">{p.title}</p>
                <p className="text-xs text-slate-400">
                  {SUPERSEDED_INTENT_TO_TOPIC[p.slug]
                    ? <>/countries/{p.country_slug}/best/{p.slug} → redirects to /{p.country_slug}/{SUPERSEDED_INTENT_TO_TOPIC[p.slug]}</>
                    : <>/countries/{p.country_slug}/best/{p.slug} · {p.indexable ? 'Indexable' : 'Noindex'}</>}
                </p>
              </div>
              <Link
                to={SUPERSEDED_INTENT_TO_TOPIC[p.slug] ? `/${p.country_slug}/${SUPERSEDED_INTENT_TO_TOPIC[p.slug]}` : `/countries/${p.country_slug}/best/${p.slug}`}
                target="_blank"
                className="rounded-lg p-2 text-slate-400 transition hover:bg-paper hover:text-ink-900"
                title={SUPERSEDED_INTENT_TO_TOPIC[p.slug] ? 'View the live canonical page (this row now redirects there)' : 'View public page'}
              >
                <ArrowUpRight size={15} />
              </Link>
              <button onClick={() => onEditCountryBestFor(p)} className="rounded-lg p-2 text-slate-400 transition hover:bg-emerald-50 hover:text-emerald-700" title="Edit"><Pencil size={15} /></button>
              <button onClick={() => onDeleteCountryBestFor(p)} className="rounded-lg p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600" title="Delete"><Trash2 size={15} /></button>
            </div>
          ))}
        </div>
      </div>

      {/* ------------------------- BROKER PROFILE CMS ------------------------- */}
      <div className="rounded-2xl border border-line bg-white shadow-soft lg:col-span-2">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
          <div><p className="font-display text-base font-bold text-ink-900">Broker Profile CMS ({brokers.length})</p><p className="mt-0.5 text-xs text-slate-400">Edit broker editorial pages with the same rich-text, image and table tools used for country SEO content.</p></div>
        </div>
        <div className="grid gap-0 sm:grid-cols-2">
          {brokers.map(b=><div key={b.id} className="flex items-center gap-3 border-b border-line px-5 py-3.5 sm:border-r"><Monogram name={b.name} logoUrl={b.logo_url} color={b.brand_color} size={32} className="rounded-lg"/><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-ink-900">{b.name}</p><p className="truncate text-xs text-slate-400">/brokers/{b.slug}</p></div><Link to={`/brokers/${b.slug}`} target="_blank" className="rounded-lg p-2 text-slate-400 hover:bg-paper hover:text-ink-900" title="View live"><Eye size={15}/></Link><button onClick={()=>onEditBrokerContent(b)} className="rounded-lg p-2 text-slate-400 hover:bg-emerald-50 hover:text-emerald-700" title="Open broker CMS"><Pencil size={15}/></button></div>)}
        </div>
      </div>

      {/* ------------------------- RICH CONTENT STUDIO ------------------------- */}
      <div className="rounded-2xl border border-line bg-white shadow-soft lg:col-span-2">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
          <div><p className="font-display text-base font-bold text-ink-900">Rich Content Studio ({contentDocs.length})</p><p className="mt-0.5 text-xs text-slate-400">Edit existing localized pages or add new editorial sections with formatting, images, links and tables.</p></div>
          <button onClick={onNewContentDoc} className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 px-3.5 py-1.5 text-xs font-bold text-white"><Plus size={13}/> New rich content</button>
        </div>
        <div className="divide-y divide-line">
          {contentDocs.map((d) => <div key={d.id} className="flex items-center gap-3 px-5 py-3.5"><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-ink-900">{d.title || d.content_key}</p><p className="truncate text-xs text-slate-400">{d.content_key} · {d.published ? 'Published' : 'Draft'} · updated {fmtDate(d.updated_at)}</p></div><button onClick={()=>onEditContentDoc(d)} className="rounded-lg p-2 text-slate-400 hover:bg-emerald-50 hover:text-emerald-700" title="Edit"><Pencil size={15}/></button><button onClick={()=>onDeleteContentDoc(d)} className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600" title="Delete"><Trash2 size={15}/></button></div>)}
          {!contentDocs.length && <p className="p-6 text-sm text-slate-400">No rich content documents yet. Create one for a country topic or another page section.</p>}
        </div>
      </div>

      {/* ------------------------------ COUNTRIES ------------------------------ */}
      <div className="rounded-2xl border border-line bg-white shadow-soft lg:col-span-2">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <p className="font-display text-base font-bold text-ink-900">
            Country guides ({countries.length})
          </p>
          <button
            onClick={onNewCountry}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 px-3.5 py-1.5 text-xs font-bold text-white transition hover:bg-emerald-600"
          >
            <Plus size={13} /> New country
          </button>
        </div>
        <div className="grid gap-0 sm:grid-cols-2">
          {countries.map((c) => (
            <div
              key={c.id}
              className="flex items-center gap-3 border-b border-line px-5 py-3.5 last:border-0 sm:border-r sm:odd:border-r"
            >
              <span className="text-2xl">{c.flag}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-ink-900">{c.name}</p>
                <p className="text-xs text-slate-400">
                  /countries/{c.slug} · {c.recommended.length} picks
                  {c.unavailable.length > 0 && ` · ${c.unavailable.length} excluded`}
                </p>
              </div>
              <Link
                to={`/countries/${c.slug}`}
                target="_blank"
                className="rounded-lg p-2 text-slate-400 transition hover:bg-paper hover:text-ink-900"
                title="View public page"
              >
                <ArrowUpRight size={15} />
              </Link>
              <button
                onClick={() => onEditCountry(c)}
                className="rounded-lg p-2 text-slate-400 transition hover:bg-emerald-50 hover:text-emerald-700"
                title="Edit"
              >
                <Pencil size={15} />
              </button>
              <button
                onClick={() => onDeleteCountry(c)}
                className="rounded-lg p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                title="Delete"
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
        <p className="px-5 py-4 text-xs leading-relaxed text-slate-400">
          Recommendations per country flow straight into the quiz matcher and geo banner.
        </p>
      </div>
    </div>
  );
}

/* ======================= RICH CONTENT EDITOR ======================= */

function ContentDocumentEditor({ document, countries, token, defaultCountrySlug, onClose, onSave }: {
  document: ContentDocument | null;
  countries: CountryPage[];
  token: string;
  defaultCountrySlug?: string;
  onClose: () => void;
  onSave: (fields: Record<string, unknown>, isNew: boolean) => Promise<void>;
}) {
  const [form, setForm] = useState(() => document ? { ...document } : {
    content_key: '', content_type: 'country-topic', country_slug: defaultCountrySlug || '', topic_slug: '', slug: '', title: '', excerpt: '', html: '', blocks: [] as PageBlock[], seo_title: '', seo_description: '', indexable: true, published: true,
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const input = 'h-10 w-full rounded-xl border border-line bg-paper px-3 text-sm outline-none focus:border-emerald-500';
  const submit = async () => {
    if (form.content_type !== 'author' && !form.content_key.trim()) return setErr('Content key is required. Example: country-topic:ghana:gold-forex-brokers');
    setBusy(true); setErr('');
    try { const isNewDoc = !document || Number((document as any).id) === 0; const nextForm = form.content_type === 'author' && !form.content_key.trim() ? { ...form, content_key: `author:${String(form.slug || form.title || 'author').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}` } : form; await onSave({ ...nextForm, ...(isNewDoc ? {} : { id: document.id }) }, isNewDoc); } catch (e) { setErr(e instanceof Error ? e.message : 'Could not save content'); } finally { setBusy(false); }
  };
  return <DrawerShell title={document ? 'Edit rich content' : 'New rich content'} onClose={onClose} wide>
    <div className="space-y-5">
      {err && <p className="rounded-xl bg-rose-50 px-4 py-2.5 text-sm text-rose-600">{err}</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        <label><FieldLabel hint="Stable identifier used by the page renderer">Content key</FieldLabel><input value={form.content_key} onChange={e=>setForm({...form,content_key:e.target.value})} className={input} placeholder="country-topic:ghana:gold-forex-brokers" /></label>
        <label><FieldLabel>Content type</FieldLabel><select value={form.content_type} onChange={e=>setForm({...form,content_type:e.target.value})} className={input}><option value="country-topic">Country topic</option><option value="country">Country</option><option value="guide">Guide</option><option value="broker">Broker</option><option value="page">Page</option><option value="section">Additional section</option><option value="author">Author profile</option></select></label>
        <label><FieldLabel>Country</FieldLabel><select value={form.country_slug || ''} onChange={e=>setForm({...form,country_slug:e.target.value})} className={input}><option value="">Global</option>{countries.map(c=><option key={c.id} value={c.slug}>{c.name}</option>)}</select></label>
        <label><FieldLabel hint="Topic slug from the SEO matrix">Topic slug</FieldLabel><input value={form.topic_slug || ''} onChange={e=>setForm({...form,topic_slug:e.target.value})} className={input} placeholder="gold-forex-brokers" /></label>
      </div>
      <label><FieldLabel>Section title</FieldLabel><input value={form.title} onChange={e=>setForm({...form,title:e.target.value})} className={input} placeholder="Why gold brokers differ for traders in Ghana" /></label>
      <label><FieldLabel>Short intro</FieldLabel><textarea value={form.excerpt} onChange={e=>setForm({...form,excerpt:e.target.value})} rows={3} className="w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-sm outline-none focus:border-emerald-500" /></label>
      {form.content_type === 'author' && <AuthorProfileFields form={form as ContentDocument} setForm={(next) => setForm(next as any)} input={input} />}
      <div><FieldLabel hint="Build the complete country SEO editorial page visually">Visual page builder</FieldLabel><div className="mt-1.5"><PageBuilder key={document?.id || document?.content_key || 'new'} value={initEditorBlocks(form)} onChange={blocks=>setForm({...form,blocks,html:blocksToHtml(blocks)})} onUploadImage={async (file) => { const reader = new FileReader(); const data = await new Promise<string>((resolve, reject) => { reader.onload=()=>resolve(String(reader.result)); reader.onerror=reject; reader.readAsDataURL(file); }); const res = await fetch('/api/content-assets', { method:'POST', headers:{'Content-Type':'application/json', Authorization:`Bearer ${token}`}, body:JSON.stringify({ filename:file.name, contentType:file.type, dataBase64:data }) }); const out=await res.json().catch(()=>({})); if(!res.ok) throw new Error(out.error || 'Image upload failed'); return out.url; }} /></div></div>
      <div className="grid gap-3 sm:grid-cols-2"><label><FieldLabel>SEO title (optional)</FieldLabel><input value={form.seo_title || ''} onChange={e=>setForm({...form,seo_title:e.target.value})} className={input}/></label><label><FieldLabel>SEO description (optional)</FieldLabel><textarea value={form.seo_description || ''} onChange={e=>setForm({...form,seo_description:e.target.value})} rows={2} className="w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-sm outline-none focus:border-emerald-500"/></label></div>
      <div className="grid gap-3 sm:grid-cols-2"><label className="flex items-center justify-between rounded-xl border border-line bg-paper p-4"><span><span className="block text-sm font-bold">Publish</span><span className="text-xs text-slate-400">Show this content on the site.</span></span><Toggle on={!!form.published} onToggle={()=>setForm({...form,published:!form.published})}/></label><label className="flex items-center justify-between rounded-xl border border-line bg-paper p-4"><span><span className="block text-sm font-bold">Index page</span><span className="text-xs text-slate-400">Keep the page eligible for search indexing.</span></span><Toggle on={!!form.indexable} onToggle={()=>setForm({...form,indexable:!form.indexable})}/></label></div>
      <button onClick={submit} disabled={busy} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-ink-950 text-sm font-bold text-white disabled:opacity-60">{busy&&<Loader2 size={15} className="animate-spin"/>}{document?'Save rich content':'Publish rich content'}</button>
    </div>
  </DrawerShell>;
}


function AuthorProfileFields({ form, setForm, input }: { form: ContentDocument; setForm: (form: ContentDocument) => void; input: string }) {
  const settings = (form.settings ?? {}) as Record<string, any>;
  const setSetting = (key: string, value: unknown) => setForm({ ...form, settings: { ...settings, [key]: value } });
  const expertise = Array.isArray(settings.expertise) ? settings.expertise as string[] : [];
  const credentials = Array.isArray(settings.credentials) ? settings.credentials as string[] : [];
  const links = Array.isArray(settings.links) ? settings.links as { label: string; url: string }[] : [];
  return <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4"><p className="text-sm font-bold text-ink-900">Author profile details</p><p className="mt-1 text-xs text-slate-500">Public author data and attribution metadata — no raw JSON required.</p><div className="mt-4 grid gap-3 sm:grid-cols-2"><label><FieldLabel>Role</FieldLabel><input value={String(settings.role ?? '')} onChange={(e)=>setSetting('role', e.target.value)} className={input} placeholder="Senior broker analyst"/></label><label><FieldLabel>Photo URL</FieldLabel><input value={String(settings.photo_url ?? '')} onChange={(e)=>setSetting('photo_url', e.target.value)} className={input} placeholder="https://…"/></label><label><FieldLabel>Display order</FieldLabel><input type="number" value={Number(settings.display_order ?? 0)} onChange={(e)=>setSetting('display_order', Number(e.target.value)||0)} className={input}/></label><label><FieldLabel>Short bio</FieldLabel><input value={String(settings.short_bio ?? '')} onChange={(e)=>setSetting('short_bio', e.target.value)} className={input} placeholder="One-line author summary"/></label></div><StringList label="Expertise" items={expertise} onChange={(v)=>setSetting('expertise', v)} placeholder="Broker regulation"/><StringList label="Credentials" items={credentials} onChange={(v)=>setSetting('credentials', v)} placeholder="CFA Level I"/><div className="mt-4 rounded-xl border border-line bg-white p-3"><FieldLabel>Professional links</FieldLabel><div className="mt-2 space-y-2">{links.map((link,i)=><div key={i} className="flex gap-2"><input value={link.label} onChange={(e)=>setSetting('links', links.map((x,xi)=>xi===i?{...x,label:e.target.value}:x))} placeholder="LinkedIn" className="h-10 w-32 rounded-xl border border-line bg-paper px-3 text-sm outline-none"/><input value={link.url} onChange={(e)=>setSetting('links', links.map((x,xi)=>xi===i?{...x,url:e.target.value}:x))} placeholder="https://…" className="h-10 flex-1 rounded-xl border border-line bg-paper px-3 text-sm outline-none"/><IconRemove onClick={()=>setSetting('links', links.filter((_,xi)=>xi!==i))}/></div>)}<button type="button" onClick={()=>setSetting('links',[...links,{label:'',url:''}])} className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-line px-3 py-2 text-xs font-bold text-slate-500"><Plus size={13}/> Add link</button></div></div><div className="mt-4 grid gap-3 sm:grid-cols-3"><label><FieldLabel>Written by</FieldLabel><input value={String(settings.written_by ?? '')} onChange={(e)=>setSetting('written_by', e.target.value)} className={input} placeholder="author slug"/></label><label><FieldLabel>Reviewed by</FieldLabel><input value={String(settings.reviewed_by ?? '')} onChange={(e)=>setSetting('reviewed_by', e.target.value)} className={input} placeholder="reviewer slug"/></label><label><FieldLabel>Fact checked by</FieldLabel><input value={String(settings.fact_checked_by ?? '')} onChange={(e)=>setSetting('fact_checked_by', e.target.value)} className={input} placeholder="fact-checker slug"/></label></div></div>;
}

/* ======================= COUNTRY BEST-FOR EDITOR ======================= */

interface CountryBestForForm {
  country_id: number | '';
  intent_id?: number | null;
  slug: string;
  label: string;
  title: string;
  meta_title: string;
  meta_description: string;
  icon: string;
  intro: string[];
  criteria: string[];
  sections: { heading: string; body: string[]; bullets?: string[] }[];
  faqs: FAQ[];
  indexable: boolean;
  sort_order: number;
}

// Kept in sync with INTENT_TO_TOPIC in scripts/prerender.mjs and
// SUPERSEDED_INTENTS in scripts/generate-sitemap.mjs, and the matching
// redirects in vercel.json. These 10 intents are now generated automatically
// per country by the SEO Page Generator — a new country_best_for row using
// one of these slugs would just 301 away the moment the site rebuilds.
const SUPERSEDED_INTENT_SLUGS = new Set([
  'beginners', 'low-spread', 'mt5', 'gold', 'scalping',
  'ecn', 'copy-trading', 'swing-trading', 'high-leverage', 'islamic',
]);

// Kept in sync with INTENT_TO_TOPIC in scripts/prerender.mjs,
// SUPERSEDED_INTENTS in scripts/generate-sitemap.mjs, and the matching
// redirects in vercel.json.
const SUPERSEDED_INTENT_TO_TOPIC: Record<string, string> = {
  beginners: 'forex-brokers-for-beginners',
  'low-spread': 'low-spread-forex-brokers',
  mt5: 'mt5-forex-brokers',
  gold: 'gold-forex-brokers',
  scalping: 'forex-brokers-for-scalping',
  ecn: 'ecn-forex-brokers',
  'copy-trading': 'copy-trading-forex-brokers',
  'swing-trading': 'forex-brokers-for-swing-trading',
  'high-leverage': 'high-leverage-forex-brokers',
  islamic: 'islamic-forex-brokers',
};

const EMPTY_COUNTRY_BEST_FOR: CountryBestForForm = {
  country_id: '', intent_id: null, slug: '', label: '', title: '', meta_title: '', meta_description: '', icon: 'beginners',
  intro: [], criteria: [], sections: [], faqs: [], indexable: true, sort_order: 0,
};

function CountryBestForEditor({ page, countries, intents = [], onClose, onSave }: {
  page: CountryBestFor | null;
  countries: CountryPage[];
  intents?: Intent[];
  onClose: () => void;
  onSave: (fields: Record<string, unknown>, isNew: boolean) => Promise<void>;
}) {
  const [form, setForm] = useState<CountryBestForForm>(() => page ? JSON.parse(JSON.stringify({ ...EMPTY_COUNTRY_BEST_FOR, ...page })) : JSON.parse(JSON.stringify(EMPTY_COUNTRY_BEST_FOR)));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const inputCls = 'h-10 w-full rounded-xl border border-line bg-paper px-3 text-sm font-medium outline-none transition focus:border-emerald-500';
  const jsonSections = JSON.stringify(form.sections, null, 2);
  const jsonFaqs = JSON.stringify(form.faqs, null, 2);
  const isSuperseded = !page && SUPERSEDED_INTENT_SLUGS.has(form.slug);

  const submit = async () => {
    if (!form.country_id) return setErr('Choose a country.');
    if (form.label.trim().length < 2) return setErr('A label is required.');
    if (form.title.trim().length < 8) return setErr('Write a useful page H1/title.');
    if (!page && SUPERSEDED_INTENT_SLUGS.has(form.slug)) {
      return setErr('This category is now generated automatically by the SEO Page Generator (Content tab → SEO Page Generator) and would immediately redirect. Choose a different category, or use the generator instead.');
    }
    setBusy(true);
    try {
      const out: Record<string, unknown> = { ...form, country_id: Number(form.country_id) };
      if (page) out.id = page.id;
      await onSave(out, !page);
    } finally { setBusy(false); }
  };

  return (
    <DrawerShell title={page ? `Edit ${page.title}` : 'New country Best-For page'} onClose={onClose} wide>
      <div className="space-y-4">
        {err && <p className="rounded-xl bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-600">{err}</p>}
        {!page && (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-800">
            Beginners, low-spread, MT5, gold, scalping, ECN, copy-trading, swing-trading, high-leverage and Islamic
            categories are now generated automatically per country via the SEO Page Generator and will redirect if
            created here. Use this editor only for categories the generator doesn't cover.
          </p>
        )}
        <div className="grid grid-cols-2 gap-3">
          <label><FieldLabel>Country</FieldLabel><select value={form.country_id} onChange={(e) => setForm({ ...form, country_id: e.target.value ? Number(e.target.value) : '' })} className={inputCls}><option value="">Select country…</option>{countries.map((c) => <option key={c.id} value={c.id}>{c.flag} {c.name}</option>)}</select></label>
          <label><FieldLabel hint="URL slug within the country">Slug</FieldLabel><input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} className={inputCls} placeholder="low-spread-brokers" /></label>
        </div>
        {isSuperseded && (
          <p className="rounded-xl bg-rose-50 px-4 py-2.5 text-xs font-medium text-rose-600">
            "{form.slug}" is one of the categories generated automatically — this page would redirect immediately. Pick a different slug, or use the SEO Page Generator instead.
          </p>
        )}
        <label>
          <FieldLabel hint="Links this country page to the master Best-For category">Master Best-For category</FieldLabel>
          <select value={form.intent_id ?? ''} onChange={(e) => { const id = e.target.value ? Number(e.target.value) : null; const i = intents.find((x) => x.id === id); setForm({ ...form, intent_id: id, slug: i ? i.slug : form.slug, label: i ? i.label : form.label, title: i ? `${i.title.replace(/\s*\(\d{4}\)$/, '')} in ${countries.find((c) => c.id === Number(form.country_id))?.name ?? ''} (2026)` : form.title }); }} className={inputCls}>
            <option value="">Select master category…</option>
            {intents.map((i) => (
              <option key={i.id} value={i.id} disabled={!page && SUPERSEDED_INTENT_SLUGS.has(i.slug)}>
                {i.label}{!page && SUPERSEDED_INTENT_SLUGS.has(i.slug) ? ' — auto-generated, use SEO Page Generator' : ''}
              </option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label><FieldLabel>Label</FieldLabel><input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} className={inputCls} placeholder="Best Low-Spread Brokers" /></label>
          <label><FieldLabel>Icon</FieldLabel><input value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} className={inputCls} placeholder="low-spread" /></label>
        </div>
        <label><FieldLabel hint="The visible H1">Title (H1)</FieldLabel><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={inputCls} /></label>
        <label><FieldLabel hint="Optional; defaults to title + PipRank">SEO title</FieldLabel><input value={form.meta_title} onChange={(e) => setForm({ ...form, meta_title: e.target.value })} className={inputCls} placeholder="Best Low-Spread Forex Brokers in Malaysia 2026 | PipRank" /></label>
        <label><FieldLabel hint="Unique 140–160 character search description">Meta description</FieldLabel><textarea value={form.meta_description} onChange={(e) => setForm({ ...form, meta_description: e.target.value })} rows={3} className="w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-sm outline-none focus:border-emerald-500" /></label>
        <StringList label="Intro paragraphs" hint="Country-specific opening copy" items={form.intro} onChange={(v) => setForm({ ...form, intro: v })} textarea />
        <StringList label="Ranking criteria" items={form.criteria} onChange={(v) => setForm({ ...form, criteria: v })} placeholder="Explain what qualifies a broker for this category" />
        <SeoSectionsEditor label="SEO sections" hint="Structured sections shown on the country best-for page." sections={form.sections} onChange={(sections) => setForm({ ...form, sections })} />
        <FaqListEditor label="FAQs" hint="Structured FAQ editor for normal admins." faqs={form.faqs} onChange={(faqs) => setForm({ ...form, faqs })} />
        <div className="flex items-center justify-between rounded-xl border border-line bg-paper p-4">
          <div><p className="text-sm font-bold text-ink-900">Index this page</p><p className="text-xs text-slate-500">Only enable when the page has enough unique content and commercial value.</p></div>
          <Toggle on={form.indexable} onToggle={() => setForm({ ...form, indexable: !form.indexable })} />
        </div>
        <label><FieldLabel hint="Controls ordering in admin and related sections">Sort order</FieldLabel><input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) || 0 })} className={inputCls} /></label>
        <button onClick={submit} disabled={busy} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-ink-950 text-sm font-bold text-white transition hover:bg-ink-800 disabled:opacity-60">{busy && <Loader2 size={15} className="animate-spin" />}{page ? 'Save Best-For page' : 'Publish Best-For page'}</button>
      </div>
    </DrawerShell>
  );
}


function SeoSectionsEditor({ label, hint, sections, onChange }: { label: string; hint?: string; sections: { heading: string; body: string[]; bullets?: string[] }[]; onChange: (sections: { heading: string; body: string[]; bullets?: string[] }[]) => void }) {
  const safeSections = Array.isArray(sections) ? sections : [];
  const update = (index: number, patch: Partial<{ heading: string; bodyText: string; bulletsText: string }>) => {
    onChange(safeSections.map((section, i) => {
      if (i !== index) return section;
      return {
        heading: patch.heading ?? section.heading,
        body: patch.bodyText !== undefined ? patch.bodyText.split('\n').map((x) => x.trim()).filter(Boolean) : section.body,
        bullets: patch.bulletsText !== undefined ? patch.bulletsText.split('\n').map((x) => x.trim()).filter(Boolean) : (section.bullets ?? []),
      };
    }));
  };
  return <div className="rounded-xl border border-line bg-paper p-4"><FieldLabel hint={hint}>{label}</FieldLabel><div className="mt-3 space-y-3">{safeSections.map((section, i) => <div key={i} className="rounded-xl border border-line bg-white p-3"><div className="flex items-center gap-2"><input value={section.heading} onChange={(e)=>update(i,{heading:e.target.value})} placeholder="Section heading" className="h-10 flex-1 rounded-xl border border-line bg-paper px-3 text-sm font-bold outline-none focus:border-emerald-500"/><IconRemove onClick={()=>onChange(safeSections.filter((_,x)=>x!==i))}/></div><textarea value={(section.body || []).join('\n')} onChange={(e)=>update(i,{bodyText:e.target.value})} rows={4} placeholder="One paragraph per line" className="mt-2 w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-sm outline-none focus:border-emerald-500"/><textarea value={(section.bullets || []).join('\n')} onChange={(e)=>update(i,{bulletsText:e.target.value})} rows={3} placeholder="Optional bullets — one per line" className="mt-2 w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-sm outline-none focus:border-emerald-500"/></div>)}<button type="button" onClick={()=>onChange([...safeSections,{heading:'',body:[],bullets:[]}])} className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-line px-3 py-2 text-xs font-bold text-slate-500 transition hover:border-emerald-500 hover:text-emerald-700"><Plus size={13}/> Add section</button></div></div>;
}

function FaqListEditor({ label, hint, faqs, onChange }: { label: string; hint?: string; faqs: FAQ[]; onChange: (faqs: FAQ[]) => void }) {
  const safeFaqs = Array.isArray(faqs) ? faqs : [];
  return <div className="rounded-xl border border-line bg-paper p-4"><FieldLabel hint={hint}>{label}</FieldLabel><div className="mt-3 space-y-3">{safeFaqs.map((faq, i) => <div key={i} className="rounded-xl border border-line bg-white p-3"><div className="flex items-center gap-2"><input value={faq.q} onChange={(e)=>onChange(safeFaqs.map((f,x)=>x===i?{...f,q:e.target.value}:f))} placeholder="Question" className="h-10 flex-1 rounded-xl border border-line bg-paper px-3 text-sm font-bold outline-none focus:border-emerald-500"/><IconRemove onClick={()=>onChange(safeFaqs.filter((_,x)=>x!==i))}/></div><textarea value={faq.a} onChange={(e)=>onChange(safeFaqs.map((f,x)=>x===i?{...f,a:e.target.value}:f))} rows={3} placeholder="Answer" className="mt-2 w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-sm outline-none focus:border-emerald-500"/></div>)}<button type="button" onClick={()=>onChange([...safeFaqs,{q:'',a:''}])} className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-line px-3 py-2 text-xs font-bold text-slate-500 transition hover:border-emerald-500 hover:text-emerald-700"><Plus size={13}/> Add FAQ</button></div></div>;
}

/* ============================ COUNTRY EDITOR ============================ */

const FLAG_PRESETS = ['🌍', '🇬🇧', '🇺🇸', '🇦🇺', '🇮🇳', '🇸🇬', '🇦🇪', '🇩🇪', '🇿🇦', '🇳🇬', '🇰🇪', '🇬🇭', '🇨🇦', '🇧🇷', '🇫🇷', '🇪🇸', '🇳🇱', '🇵🇱', '🇿🇲', '🇹🇿', '🇷🇼', '🇺🇬'];

interface CountryForm {
  name: string;
  flag: string;
  subtitle: string;
  intro: string[];
  facts: { label: string; value: string }[];
  recommended: { slug: string; note: string }[];
  unavailable: string[];
  seo_title: string;
  seo_description: string;
  seo_intro: string[];
  seo_sections: { heading: string; body: string[]; bullets?: string[] }[];
  seo_faqs: { q: string; a: string }[];
  publishing_state: 'draft' | 'published' | 'closed';
}

const EMPTY_COUNTRY: CountryForm = {
  name: '',
  flag: '🌍',
  subtitle: '',
  intro: [],
  facts: [],
  recommended: [],
  unavailable: [],
  seo_title: '',
  seo_description: '',
  seo_intro: [],
  seo_sections: [],
  seo_faqs: [],
  publishing_state: 'published',
};

function CountryEditor({
  country,
  brokers,
  onClose,
  onSave,
}: {
  country: CountryPage | null;
  brokers: Broker[];
  onClose: () => void;
  onSave: (fields: Record<string, unknown>, isNew: boolean) => Promise<void>;
}) {
  const [form, setForm] = useState<CountryForm>(() =>
    country
      ? JSON.parse(JSON.stringify({ ...EMPTY_COUNTRY, ...country }))
      : JSON.parse(JSON.stringify(EMPTY_COUNTRY))
  );
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const setRec = (i: number, patch: Partial<{ slug: string; note: string }>) =>
    setForm((f) => ({
      ...f,
      recommended: f.recommended.map((r, xi) => (xi === i ? { ...r, ...patch } : r)),
    }));

  const submit = async () => {
    if (form.name.trim().length < 2) return setErr('Country name is required.');
    setBusy(true);
    try {
      const out: Record<string, unknown> = { ...form };
      if (country) out.id = country.id;
      await onSave(out, !country);
    } finally {
      setBusy(false);
    }
  };

  return (
    <DrawerShell title={country ? `Edit ${country.name}` : 'New country guide'} onClose={onClose} wide>
      <div className="space-y-4">
        {err && <p className="rounded-xl bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-600">{err}</p>}

        <div className="grid grid-cols-[72px_1fr] gap-3">
          <label className="block">
            <FieldLabel>Flag</FieldLabel>
            <input
              value={form.flag}
              onChange={(e) => setForm({ ...form, flag: e.target.value })}
              className="h-11 w-full rounded-xl border border-line bg-paper text-center text-2xl outline-none focus:border-emerald-500"
            />
          </label>
          <label className="block">
            <FieldLabel>Country name</FieldLabel>
            <TextInput value={form.name} onChange={(v) => setForm({ ...form, name: v })} placeholder="e.g. Nigeria" />
          </label>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {FLAG_PRESETS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setForm({ ...form, flag: f })}
              className={`rounded-lg px-2 py-1 text-lg transition ${form.flag === f ? 'bg-emerald-100 ring-2 ring-emerald-500/40' : 'bg-paper hover:bg-white'}`}
            >
              {f}
            </button>
          ))}
        </div>

        <label className="block"><FieldLabel hint="Country-level publishing state">Publishing state</FieldLabel><select value={form.publishing_state} onChange={(e) => setForm({ ...form, publishing_state: e.target.value as 'draft' | 'published' | 'closed' })} className="h-11 w-full rounded-xl border border-line bg-paper px-3 text-sm font-bold outline-none focus:border-emerald-500"><option value="draft">Draft</option><option value="published">Published</option><option value="closed">Closed</option></select></label>

        <label className="block">
          <FieldLabel hint="bold line under the page title">Subtitle</FieldLabel>
          <TextInput
            value={form.subtitle}
            onChange={(v) => setForm({ ...form, subtitle: v })}
            placeholder="e.g. Africa's forex capital — proven NGN funding and fast payouts"
          />
        </label>

        <StringList
          label="Intro paragraphs"
          hint="local context: regulation, funding, tax — 1-2 paragraphs"
          items={form.intro}
          onChange={(v) => setForm({ ...form, intro: v })}
          textarea
          placeholder="Write a paragraph about trading from this country…"
        />

        {/* facts */}
        <div className="rounded-xl border border-line bg-paper p-4">
          <FieldLabel hint="the 4 fact cards under the hero">Country facts</FieldLabel>
          <div className="mt-2 space-y-2">
            {form.facts.map((f, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  value={f.label}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      facts: form.facts.map((x, xi) => (xi === i ? { ...x, label: e.target.value } : x)),
                    })
                  }
                  placeholder="Regulator"
                  className="h-10 w-32 rounded-xl border border-line bg-white px-3 text-sm font-medium outline-none focus:border-emerald-500"
                />
                <input
                  value={f.value}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      facts: form.facts.map((x, xi) => (xi === i ? { ...x, value: e.target.value } : x)),
                    })
                  }
                  placeholder="SEC Nigeria — no local CFD licence"
                  className="h-10 flex-1 rounded-xl border border-line bg-white px-3 text-sm outline-none focus:border-emerald-500"
                />
                <IconRemove onClick={() => setForm({ ...form, facts: form.facts.filter((_, xi) => xi !== i) })} />
              </div>
            ))}
            <button
              type="button"
              onClick={() => setForm({ ...form, facts: [...form.facts, { label: '', value: '' }] })}
              className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-line px-3 py-2 text-xs font-bold text-slate-500 transition hover:border-emerald-500 hover:text-emerald-700"
            >
              <Plus size={13} /> Add fact
            </button>
          </div>
        </div>

        {/* recommended brokers */}
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
          <FieldLabel hint="ranked list — top entry shows the crown">Recommended brokers for this country</FieldLabel>
          <div className="mt-2 space-y-2.5">
            {form.recommended.map((r, i) => (
              <div key={i} className="space-y-1.5 rounded-xl border border-line bg-white p-3">
                <div className="flex items-center gap-2">
                  <span className="tnum w-5 text-center text-xs font-bold text-slate-400">{i + 1}</span>
                  <select
                    value={r.slug}
                    onChange={(e) => setRec(i, { slug: e.target.value })}
                    className="h-9 flex-1 rounded-xl border border-line bg-paper px-2.5 text-sm font-semibold outline-none focus:border-emerald-500"
                  >
                    <option value="">Pick a broker…</option>
                    {brokers.map((b) => (
                      <option key={b.slug} value={b.slug}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                  <IconRemove
                    onClick={() =>
                      setForm({ ...form, recommended: form.recommended.filter((_, xi) => xi !== i) })
                    }
                  />
                </div>
                <input
                  value={r.note}
                  onChange={(e) => setRec(i, { note: e.target.value })}
                  placeholder="Why it ranks here — e.g. 'FSCA entity with instant NGN withdrawals'"
                  className="h-9 w-full rounded-xl border border-line bg-paper px-3 text-xs outline-none focus:border-emerald-500"
                />
              </div>
            ))}
            <button
              type="button"
              onClick={() => setForm({ ...form, recommended: [...form.recommended, { slug: '', note: '' }] })}
              className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-emerald-300 px-3 py-2 text-xs font-bold text-emerald-700 transition hover:border-emerald-500"
            >
              <Plus size={13} /> Add recommended broker
            </button>
          </div>
        </div>

        {/* unavailable brokers */}
        <div className="rounded-xl border border-line bg-paper p-4">
          <FieldLabel hint="shown stricken — they can't onboard residents">Does NOT onboard this country</FieldLabel>
          <div className="mt-2 flex flex-wrap gap-2">
            {brokers.map((b) => {
              const on = form.unavailable.includes(b.slug);
              return (
                <button
                  type="button"
                  key={b.slug}
                  onClick={() =>
                    setForm({
                      ...form,
                      unavailable: on
                        ? form.unavailable.filter((s) => s !== b.slug)
                        : [...form.unavailable, b.slug],
                    })
                  }
                  className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                    on
                      ? 'border-rose-300 bg-rose-50 text-rose-600'
                      : 'border-line bg-white text-slate-500 hover:border-rose-300'
                  }`}
                >
                  {b.name}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-6 border-t border-line pt-5">
          <p className="text-sm font-bold text-ink-900">Country-specific SEO content</p>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">Write genuinely local copy here. Do not simply replace the country name in a global template. This content is used in the country page title/meta and prerendered HTML.</p>
        </div>
        <label><FieldLabel hint="Optional unique title, e.g. Best Forex Brokers in Malaysia 2026 | PipRank">SEO title</FieldLabel><input value={form.seo_title} onChange={(e) => setForm({ ...form, seo_title: e.target.value })} className="w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-sm outline-none focus:border-emerald-500" /></label>
        <label><FieldLabel hint="Unique 140–160 character description written specifically for this country">SEO meta description</FieldLabel><textarea value={form.seo_description} onChange={(e) => setForm({ ...form, seo_description: e.target.value })} rows={3} className="w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-sm outline-none focus:border-emerald-500" /></label>
        <StringList label="Unique SEO introduction" hint="Country-specific search-intent context, market considerations and broker-selection guidance." items={form.seo_intro} onChange={(v) => setForm({ ...form, seo_intro: v })} textarea />
        <SeoSectionsEditor label="Unique SEO sections" hint="Add, edit and reorder structured country sections without JSON." sections={form.seo_sections} onChange={(seo_sections) => setForm({ ...form, seo_sections })} />
        <FaqListEditor label="Unique country FAQs" hint="Answers must be specific to this country." faqs={form.seo_faqs} onChange={(seo_faqs) => setForm({ ...form, seo_faqs })} />

        <button
          onClick={submit}
          disabled={busy}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-ink-950 text-sm font-bold text-white transition hover:bg-ink-800 disabled:opacity-60"
        >
          {busy && <Loader2 size={15} className="animate-spin" />}
          {country ? 'Save country' : 'Publish country guide'}
        </button>
      </div>
    </DrawerShell>
  );
}

/* ============================ TEAM TAB ============================ */

function generatePassword(): string {
  const upper = 'ABCDEFGHJKMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnpqrstuvwxyz';
  const nums = '23456789';
  const all = upper + lower + nums + '!@#%';
  let out = upper[Math.floor(Math.random() * upper.length)] + nums[Math.floor(Math.random() * nums.length)];
  while (out.length < 12) out += all[Math.floor(Math.random() * all.length)];
  return out;
}

const MANAGEABLE = [
  { value: 'brokers_admin', label: 'Brokers manager', hint: 'Brokers data, categories, featured' },
  { value: 'content_admin', label: 'Content editor', hint: 'Guides, intent pages, country guides' },
  { value: 'moderator', label: 'Moderator', hint: 'Reviews verification, newsletter list' },
  { value: 'admin', label: 'Admin (full ops)', hint: 'All tabs except team management' },
  { value: 'super_admin', label: 'Super Admin', hint: 'Everything incl. team management' },
];

interface TeamRow {
  id: number;
  email: string;
  role: string;
  active: boolean;
}

function TeamTab({ token, myEmail }: { token: string; myEmail: string }) {
  const [rows, setRows] = useState<TeamRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [newRole, setNewRole] = useState('brokers_admin');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const headers = useMemo(
    () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }),
    [token]
  );

  const load = useCallback(async () => {
    const res = await fetch('/api/admin-users', { headers });
    const data = await res.json().catch(() => []);
    if (Array.isArray(data)) setRows(data);
    setLoading(false);
  }, [headers]);

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, [load]);

  const api = async (method: string, body: Record<string, unknown>) => {
    const res = await fetch('/api/admin-users', { method, headers, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((data as { error?: string }).error || 'Action failed');
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setErr('Enter a valid email address.');
    if (password.length < 8) return setErr('Set an initial password of at least 8 characters.');
    setBusy(true);
    setErr('');
    try {
      await api('POST', { email, role: newRole, password });
      setEmail('');
      setPassword('');
      await load();
    } catch (e1) {
      setErr(e1 instanceof Error ? e1.message : 'Failed');
    } finally {
      setBusy(false);
    }
  };

  const updateRole = async (row: TeamRow, role: string) => {
    await api('PUT', { id: row.id, role });
    await load();
  };

  const toggleActive = async (row: TeamRow) => {
    if (row.email === myEmail && row.active) return window.alert("You can't suspend your own account.");
    await api('PUT', { id: row.id, active: !row.active });
    await load();
  };

  const remove = async (row: TeamRow) => {
    if (row.email === myEmail) return window.alert("You can't remove your own access.");
    if (!window.confirm(`Remove ${row.email} from the admin team? Their login is deleted and all access ends instantly.`)) return;
    await api('DELETE', { id: row.id });
    await load();
  };

  const resetPassword = async (row: TeamRow) => {
    const pwd = window.prompt(`New password for ${row.email} (min 8 chars):`, generatePassword());
    if (!pwd) return;
    try {
      await api('PUT', { id: row.id, password: pwd });
      window.alert(`Password updated for ${row.email}`);
    } catch (e1) {
      window.alert(e1 instanceof Error ? e1.message : 'Failed');
    }
  };

  return (
    <div className="space-y-5">
      {/* invite form */}
      <form onSubmit={submit} className="rounded-2xl border border-line bg-white p-5 shadow-soft">
        <p className="font-display text-base font-bold text-ink-900">Invite an admin</p>
        <p className="mt-0.5 text-xs text-slate-500">
          One step: creates their login (email + initial password) and grants the role — they can sign in immediately.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_190px]">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="colleague@company.com"
            className="h-11 rounded-xl border border-line bg-paper px-4 text-sm outline-none focus:border-emerald-500"
          />
          <select
            value={newRole}
            onChange={(e) => setNewRole(e.target.value)}
            className="h-11 rounded-xl border border-line bg-paper px-3 text-sm font-semibold outline-none"
          >
            {MANAGEABLE.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
        <div className="mt-4">
          <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-400">
            Initial password <span className="font-medium normal-case tracking-normal text-slate-400/70">they sign in with this — share it with them</span>
          </span>
          <div className="mt-1 flex gap-2">
          <div className="relative flex-1">
            <input
              type={showPw ? 'text' : 'password'}
              value={password}
              onChange={(e) => { setPassword(e.target.value); setErr(''); }}
              placeholder="e.g. Welcome@2026 — min 8 characters"
              className={`h-11 w-full rounded-xl border bg-paper px-4 pr-10 text-sm outline-none transition focus:border-emerald-500 ${
                err && password.length < 8 ? 'border-rose-400 ring-2 ring-rose-500/20' : 'border-line'
              }`}
            />
            <button
              type="button"
              onClick={() => setShowPw((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-ink-900"
              aria-label={showPw ? 'Hide password' : 'Show password'}
            >
              <Eye size={16} />
            </button>
          </div>
          <button
            type="button"
            onClick={() => {
              setPassword(generatePassword());
              setShowPw(true);
            }}
            className="h-11 shrink-0 rounded-xl border border-line px-3.5 text-xs font-bold text-ink-900 transition hover:border-ink-900"
          >
            Generate
          </button>
          <button
            type="submit"
            disabled={busy}
            className="flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-ink-950 px-5 text-sm font-bold text-white transition hover:bg-ink-800 disabled:opacity-60"
          >
            {busy ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
            Add member
          </button>
          </div>
        </div>
        {err && <p className="mt-2 text-sm font-medium text-rose-600">{err}</p>}
        <div className="mt-3 grid gap-1.5 sm:grid-cols-2 lg:grid-cols-4">
          {MANAGEABLE.map((r) => (
            <div key={r.value} className="rounded-xl bg-paper px-3 py-2">
              <p className="text-xs font-bold text-ink-900">{r.label}</p>
              <p className="text-[11px] text-slate-400">{r.hint}</p>
            </div>
          ))}
        </div>
      </form>

      {/* members table */}
      <div className="rounded-2xl border border-line bg-white shadow-soft">
        <p className="border-b border-line px-5 py-4 font-display text-base font-bold text-ink-900">
          Admin team ({rows.length})
        </p>
        {loading ? (
          <div className="h-40 animate-pulse" />
        ) : (
          <div className="divide-y divide-line">
            {rows.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    r.role === 'super_admin' ? 'bg-emerald-600 text-white' : 'bg-ink-950 text-emerald-400'
                  }`}
                >
                  {r.email[0].toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 text-sm font-bold text-ink-900">
                    {r.email}
                    {r.email === myEmail && (
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 ring-1 ring-emerald-200">
                        you
                      </span>
                    )}
                    {!r.active && (
                      <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-600 ring-1 ring-rose-200">
                        suspended
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-slate-400">{ROLE_LABELS[r.role] ?? r.role}</p>
                </div>
                <select
                  value={r.role}
                  disabled={r.email === myEmail}
                  onChange={(e) => updateRole(r, e.target.value)}
                  className="h-9 rounded-xl border border-line bg-paper px-2.5 text-xs font-bold outline-none disabled:opacity-50"
                >
                  {MANAGEABLE.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
                <Toggle on={r.active} onToggle={() => toggleActive(r)} />
                <button
                  onClick={() => resetPassword(r)}
                  className="rounded-lg p-2 text-slate-400 transition hover:bg-sky-50 hover:text-sky-700"
                  title="Reset their password"
                >
                  <KeyRound size={15} />
                </button>
                <button
                  onClick={() => remove(r)}
                  disabled={r.email === myEmail}
                  className="rounded-lg p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-30"
                  title={r.email === myEmail ? 'Cannot remove yourself' : 'Remove admin access'}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        )}
        <p className="px-5 py-4 text-xs leading-relaxed text-slate-400">
          Role changes and suspensions apply on the next API call. Removing a member deletes both the role and
          their login account. Admins provisioned here can sign in at /archypage immediately.
        </p>
      </div>
    </div>
  );
}

/* ============================ PROMOS TAB ============================ */

const PROMO_BADGES = ['Welcome offer', 'Deposit bonus', 'Rebates', 'Cashback', 'Zero-swap', 'Prop funding', 'Giveaway'];

interface PromoForm {
  broker_id: string;
  title: string;
  description: string;
  badge: string;
  terms: string;
  ends_on: string;
  active: boolean;
}

function PromosTab({
  token,
  brokers,
  notify,
}: {
  token: string;
  brokers: Broker[];
  notify: (msg: string) => void;
}) {
  const [rows, setRows] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Promotion | null | 'new'>(null);

  const headers = useMemo(
    () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }),
    [token]
  );

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/promotions?all=1', { headers });
      const data = await res.json().catch(() => []);
      if (Array.isArray(data)) setRows(data);
    } finally {
      setLoading(false);
    }
  }, [headers]);

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, [load]);

  const api = async (method: string, body: unknown) => {
    const res = await fetch('/api/promotions', { method, headers, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((data as { error?: string }).error || 'Action failed');
  };

  const brokerById = useMemo(() => new Map(brokers.map((b) => [b.id, b])), [brokers]);

  const daysLeft = (ends_on: string | null) =>
    ends_on == null ? null : Math.ceil((new Date(ends_on + 'T23:59:59Z').getTime() - Date.now()) / 86400000);

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-line bg-white shadow-soft">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <p className="font-display text-base font-bold text-ink-900">
            Live promotions ({rows.filter((r) => r.active).length} active / {rows.length} total)
          </p>
          <button
            onClick={() => setEditing('new')}
            className="inline-flex items-center gap-1.5 rounded-xl bg-amber-400 px-4 py-1.5 text-xs font-bold text-ink-950 transition hover:bg-amber-300"
          >
            <Plus size={14} /> New promotion
          </button>
        </div>
        {loading ? (
          <div className="h-40 animate-pulse" />
        ) : rows.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-400">
            No promotions yet — create the first one.
          </p>
        ) : (
          <div className="divide-y divide-line">
            {rows.map((p) => {
              const b = brokerById.get(p.broker_id);
              const days = daysLeft(p.ends_on);
              const expired = days !== null && days < 0;
              return (
                <div key={p.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                  {b && <Monogram name={b.name} logoUrl={b.logo_url} color={b.brand_color} size={34} className="rounded-lg" />}
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-bold text-ink-900">
                      {p.title}
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700 ring-1 ring-amber-200">
                        {p.badge}
                      </span>
                      {expired && (
                        <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-600 ring-1 ring-rose-200">
                          expired
                        </span>
                      )}
                      {!expired && days !== null && days <= 14 && (
                        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 ring-1 ring-amber-200">
                          {days}d left
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-slate-400">
                      {b?.name ?? `broker #${p.broker_id}`} · {p.description.slice(0, 90)}
                      {p.description.length > 90 ? '…' : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={p.ends_on ?? ''}
                      onChange={async (e) => {
                        await api('PUT', { id: p.id, ends_on: e.target.value || null });
                        await load();
                        notify('Expiry updated');
                      }}
                      className="h-9 rounded-lg border border-line bg-paper px-2 text-xs font-semibold outline-none"
                    />
                    <Toggle
                      on={p.active}
                      onToggle={async () => {
                        await api('PUT', { id: p.id, active: !p.active });
                        await load();
                      }}
                    />
                    <button
                      onClick={() => setEditing(p)}
                      className="rounded-lg p-2 text-slate-400 transition hover:bg-emerald-50 hover:text-emerald-700"
                      title="Edit"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      onClick={async () => {
                        if (!window.confirm(`Delete the promotion "${p.title}"?`)) return;
                        await api('DELETE', { id: p.id });
                        await load();
                        notify('Promotion deleted');
                      }}
                      className="rounded-lg p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                      title="Delete"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <p className="px-5 py-4 text-xs leading-relaxed text-slate-400">
          Live on the public Promotions page instantly when toggled on. Expired promos are hidden automatically.
        </p>
      </div>

      {editing && (
        <PromoEditor
          promo={editing === 'new' ? null : editing}
          brokers={brokers}
          onClose={() => setEditing(null)}
          onSave={async (fields) => {
            if (editing === 'new') {
              await api('POST', fields);
              notify('Promotion published');
              setEditing(null);
            } else {
              await api('PUT', { id: editing.id, ...fields });
              notify('Promotion saved');
            }
            await load();
          }}
        />
      )}
    </div>
  );
}

function PromoEditor({
  promo,
  brokers,
  onClose,
  onSave,
}: {
  promo: Promotion | null;
  brokers: Broker[];
  onClose: () => void;
  onSave: (fields: PromoForm) => Promise<void>;
}) {
  const [form, setForm] = useState<PromoForm>(() =>
    promo
      ? {
          broker_id: String(promo.broker_id),
          title: promo.title,
          description: promo.description,
          badge: promo.badge,
          terms: promo.terms,
          ends_on: promo.ends_on ?? '',
          active: promo.active,
        }
      : { broker_id: String(brokers[0]?.id ?? ''), title: '', description: '', badge: 'Welcome offer', terms: '', ends_on: '', active: true }
  );
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const submit = async () => {
    if (!form.broker_id) return setErr('Pick a broker.');
    if (form.title.trim().length < 4) return setErr('Promotion title is required.');
    setBusy(true);
    try {
      await onSave({ ...form, broker_id: String(form.broker_id) });
    } finally {
      setBusy(false);
    }
  };

  const inputCls =
    'h-10 w-full rounded-xl border border-line bg-paper px-3 text-sm font-medium outline-none transition focus:border-emerald-500';

  return (
    <DrawerShell title={promo ? 'Edit promotion' : 'New promotion'} onClose={onClose} wide>
      <div className="space-y-4">
        {err && <p className="rounded-xl bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-600">{err}</p>}
        <div className="grid grid-cols-2 gap-3">
          <label className="col-span-2 block">
            <FieldLabel>Broker</FieldLabel>
            <select
              value={form.broker_id}
              onChange={(e) => setForm({ ...form, broker_id: e.target.value })}
              className={inputCls}
            >
              {brokers.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <FieldLabel>Badge</FieldLabel>
            <select value={form.badge} onChange={(e) => setForm({ ...form, badge: e.target.value })} className={inputCls}>
              {PROMO_BADGES.map((b) => (
                <option key={b}>{b}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <FieldLabel hint="blank = open-ended">Ends on</FieldLabel>
            <input
              type="date"
              value={form.ends_on}
              onChange={(e) => setForm({ ...form, ends_on: e.target.value })}
              className={`tnum ${inputCls}`}
            />
          </label>
          <label className="col-span-2 block">
            <FieldLabel>Title</FieldLabel>
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className={inputCls}
              placeholder="e.g. $30 no-deposit welcome account"
            />
          </label>
          <label className="col-span-2 block">
            <FieldLabel>Description</FieldLabel>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
              className="w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-sm outline-none focus:border-emerald-500"
              placeholder="What the visitor receives — concrete numbers, no fluff."
            />
          </label>
          <label className="col-span-2 block">
            <FieldLabel hint="shown verbatim as fine print">Terms</FieldLabel>
            <textarea
              value={form.terms}
              onChange={(e) => setForm({ ...form, terms: e.target.value })}
              rows={2}
              className="w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-sm outline-none focus:border-emerald-500"
              placeholder="Eligibility, volume conditions, entity restrictions…"
            />
          </label>
          <label className="col-span-2 flex cursor-pointer items-center gap-3 rounded-xl border border-line bg-paper px-4 py-3">
            <Toggle on={form.active} onToggle={() => setForm({ ...form, active: !form.active })} />
            <div>
              <p className="text-sm font-semibold text-ink-900">Promotion is live</p>
              <p className="text-xs text-slate-400">Visible on the public site when on (and not expired)</p>
            </div>
          </label>
        </div>
        <button
          onClick={submit}
          disabled={busy}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-ink-950 text-sm font-bold text-white transition hover:bg-ink-800 disabled:opacity-60"
        >
          {busy && <Loader2 size={15} className="animate-spin" />}
          {promo ? 'Save promotion' : 'Publish promotion'}
        </button>
      </div>
    </DrawerShell>
  );
}

/* ============================ SUBSCRIBERS TAB ============================ */

function SubsTab({
  subs,
  onDelete,
  onCopied,
}: {
  subs: Sub[];
  onDelete: (s: Sub) => void;
  onCopied: () => void;
}) {
  return (
    <div className="rounded-2xl border border-line bg-white shadow-soft">
      <div className="flex items-center justify-between border-b border-line px-5 py-4">
        <p className="font-display text-base font-bold text-ink-900">{subs.length} subscribers</p>
        <button
          onClick={() => {
            navigator.clipboard.writeText(subs.map((s) => s.email).join(', '));
            onCopied();
          }}
          className="inline-flex items-center gap-1.5 rounded-xl border border-line px-3.5 py-2 text-xs font-bold text-ink-900 transition hover:border-ink-900"
        >
          <Copy size={13} /> Copy all emails
        </button>
      </div>
      <div className="divide-y divide-line">
        {subs.length === 0 && (
          <p className="p-8 text-center text-sm text-slate-400">No subscribers yet.</p>
        )}
        {subs.map((s) => (
          <div key={s.id} className="flex items-center gap-3 px-5 py-3.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-ink-950 text-xs font-bold text-emerald-400">
              {s.email[0].toUpperCase()}
            </span>
            <div className="flex-1">
              <p className="text-sm font-semibold text-ink-900">{s.email}</p>
              <p className="text-xs text-slate-400">{timeAgo(s.created_at)}</p>
            </div>
            <button
              onClick={() => onDelete(s)}
              className="rounded-lg p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
            >
              <Trash2 size={15} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ============================ GUIDE EDITOR ============================ */

const GUIDE_CATEGORIES = ['Basics', 'Risk', 'Psychology', 'Platforms', 'Costs', 'Strategy'];
const GUIDE_LEVELS = ['Beginner', 'Intermediate', 'Advanced', 'All levels'];
const GUIDE_IMAGES = [
  '/images/guides/basics.jpg',
  '/images/guides/risk.jpg',
  '/images/guides/psychology.jpg',
  '/images/guides/platforms.jpg',
  '/images/guides/costs.jpg',
  '/images/guides/strategy.jpg',
];

interface GuideForm {
  title: string;
  excerpt: string;
  category: string;
  level: string;
  minutes: string;
  published: string;
  image: string;
  sections: GuideSection[];
}

function GuideEditor({
  guide,
  onClose,
  onSave,
}: {
  guide: Guide | null;
  onClose: () => void;
  onSave: (fields: Record<string, unknown>, isNew: boolean) => Promise<void>;
}) {
  const [form, setForm] = useState<GuideForm>(() =>
    guide
      ? JSON.parse(JSON.stringify({ ...guide, minutes: String(guide.minutes) }))
      : {
          title: '',
          excerpt: '',
          category: 'Basics',
          level: 'Beginner',
          minutes: '10',
          published: new Date().toISOString().slice(0, 10),
          image: GUIDE_IMAGES[0],
          sections: [],
        }
  );
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const setSection = (i: number, patch: Partial<GuideSection>) =>
    setForm((f) => ({ ...f, sections: f.sections.map((s, xi) => (xi === i ? { ...s, ...patch } : s)) }));

  const submit = async () => {
    if (form.title.trim().length < 4) return setErr('A guide title is required.');
    setBusy(true);
    try {
      const out: Record<string, unknown> = {
        ...form,
        minutes: parseInt(form.minutes, 10) || 8,
        sections: form.sections.filter((s) => s.heading.trim()),
      };
      if (guide) out.id = guide.id;
      await onSave(out, !guide);
    } finally {
      setBusy(false);
    }
  };

  const inputCls =
    'h-10 w-full rounded-xl border border-line bg-paper px-3 text-sm font-medium outline-none transition focus:border-emerald-500';

  return (
    <DrawerShell title={guide ? 'Edit guide' : 'New guide'} onClose={onClose} wide>
      <div className="space-y-5">
        {err && <p className="rounded-xl bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-600">{err}</p>}

        {/* meta */}
        <div className="space-y-3">
          <label className="block">
            <FieldLabel>Title</FieldLabel>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={inputCls} placeholder="e.g. Forex Trading for Beginners" />
          </label>
          <label className="block">
            <FieldLabel>Excerpt</FieldLabel>
            <textarea
              value={form.excerpt}
              onChange={(e) => setForm({ ...form, excerpt: e.target.value })}
              rows={2}
              className="w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-sm outline-none focus:border-emerald-500"
            />
          </label>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <label className="block">
              <FieldLabel>Category</FieldLabel>
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className={inputCls}>
                {GUIDE_CATEGORIES.map((c) => (<option key={c}>{c}</option>))}
              </select>
            </label>
            <label className="block">
              <FieldLabel>Level</FieldLabel>
              <select value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })} className={inputCls}>
                {GUIDE_LEVELS.map((l) => (<option key={l}>{l}</option>))}
              </select>
            </label>
            <label className="block">
              <FieldLabel>Minutes</FieldLabel>
              <input type="number" value={form.minutes} onChange={(e) => setForm({ ...form, minutes: e.target.value })} className={`tnum ${inputCls}`} />
            </label>
            <label className="block">
              <FieldLabel>Published</FieldLabel>
              <input value={form.published} onChange={(e) => setForm({ ...form, published: e.target.value })} className={inputCls} />
            </label>
          </div>
          {/* image picker */}
          <div>
            <FieldLabel>Cover image</FieldLabel>
            <div className="mt-1.5 grid grid-cols-3 gap-2">
              {GUIDE_IMAGES.map((img) => (
                <button
                  key={img}
                  type="button"
                  onClick={() => setForm({ ...form, image: img })}
                  className={`overflow-hidden rounded-xl border-2 transition ${form.image === img ? 'border-emerald-500 ring-2 ring-emerald-500/30' : 'border-transparent opacity-70 hover:opacity-100'}`}
                >
                  <img src={img} alt="" className="aspect-[16/9] w-full object-cover" />
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* sections */}
        <div className="rounded-xl border border-line bg-paper p-4">
          <FieldLabel hint="numbered article sections">Article sections</FieldLabel>
          <div className="mt-2 space-y-3">
            {form.sections.map((sec, i) => (
              <div key={i} className="space-y-2 rounded-xl border border-line bg-white p-4">
                <div className="flex items-center gap-2">
                  <span className="tnum w-6 shrink-0 text-center font-display text-sm font-bold text-slate-400">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <input
                    value={sec.heading}
                    onChange={(e) => setSection(i, { heading: e.target.value })}
                    placeholder="Section heading"
                    className="h-10 flex-1 rounded-xl border border-line bg-paper px-3 text-sm font-bold outline-none focus:border-emerald-500"
                  />
                  <IconRemove onClick={() => setForm((f) => ({ ...f, sections: f.sections.filter((_, xi) => xi !== i) }))} />
                </div>
                <div className="space-y-1.5 pl-8">
                  {sec.body.map((p, pi) => (
                    <div key={pi} className="flex items-start gap-2">
                      <textarea
                        value={p}
                        rows={2}
                        onChange={(e) => setSection(i, { body: sec.body.map((x, xi) => (xi === pi ? e.target.value : x)) })}
                        placeholder="Paragraph…"
                        className="w-full rounded-xl border border-line bg-paper px-3 py-2 text-sm leading-relaxed outline-none focus:border-emerald-500"
                      />
                      <IconRemove onClick={() => setSection(i, { body: sec.body.filter((_, xi) => xi !== pi) })} />
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => setSection(i, { body: [...sec.body, ''] })}
                    className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 transition hover:text-emerald-700"
                  >
                    <Plus size={12} /> Paragraph
                  </button>
                  {/* bullets */}
                  <div className="pt-1.5">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Bullets (optional)</p>
                    <div className="mt-1.5 space-y-1.5">
                      {(sec.bullets ?? []).map((b, bi) => (
                        <div key={bi} className="flex items-center gap-2">
                          <input
                            value={b}
                            onChange={(e) => setSection(i, { bullets: (sec.bullets ?? []).map((x, xi) => (xi === bi ? e.target.value : x)) })}
                            placeholder="Bullet point…"
                            className="h-9 flex-1 rounded-xl border border-line bg-paper px-3 text-xs outline-none focus:border-emerald-500"
                          />
                          <IconRemove onClick={() => setSection(i, { bullets: (sec.bullets ?? []).filter((_, xi) => xi !== bi) })} />
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => setSection(i, { bullets: [...(sec.bullets ?? []), ''] })}
                        className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 transition hover:text-emerald-700"
                      >
                        <Plus size={12} /> Bullet
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, sections: [...f.sections, { heading: '', body: [''], bullets: [] }] }))}
              className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-line px-3 py-2 text-xs font-bold text-slate-500 transition hover:border-emerald-500 hover:text-emerald-700"
            >
              <Plus size={13} /> Add section
            </button>
          </div>
        </div>

        <button
          onClick={submit}
          disabled={busy}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-ink-950 text-sm font-bold text-white transition hover:bg-ink-800 disabled:opacity-60"
        >
          {busy && <Loader2 size={15} className="animate-spin" />}
          {guide ? 'Save guide' : 'Publish guide'}
        </button>
      </div>
    </DrawerShell>
  );
}

/* ============================ INTENT EDITOR ============================ */

const ICON_OPTIONS = [
  { value: 'beginners', label: 'Beginners (graduation cap)' },
  { value: 'low-spread', label: 'Low spreads (percent)' },
  { value: 'mt5', label: 'MT5 (monitor)' },
  { value: 'ecn', label: 'ECN (zap)' },
  { value: 'copy-trading', label: 'Copy trading (copy)' },
  { value: 'scalping', label: 'Scalping (timer)' },
  { value: 'swing-trading', label: 'Swing trading (waves)' },
  { value: 'high-leverage', label: 'High leverage (gauge)' },
];

interface IntentForm {
  label: string;
  title: string;
  meta_title: string;
  meta_description: string;
  icon: string;
  intro: string[];
  criteria: string[];
  sections: { heading: string; body: string[]; bullets?: string[] }[];
  faqs: FAQ[];
  indexable: boolean;
  sort_order: number;
}

const EMPTY_INTENT: IntentForm = { label: '', title: '', meta_title: '', meta_description: '', icon: 'beginners', intro: [], criteria: [], sections: [], faqs: [], indexable: true, sort_order: 0 };

function IntentEditor({
  intent,
  onClose,
  onSave,
}: {
  intent: Intent | null;
  onClose: () => void;
  onSave: (fields: Record<string, unknown>, isNew: boolean) => Promise<void>;
}) {
  const [form, setForm] = useState<IntentForm>(() =>
    intent ? JSON.parse(JSON.stringify({ ...EMPTY_INTENT, ...intent })) : JSON.parse(JSON.stringify(EMPTY_INTENT))
  );
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const submit = async () => {
    if (form.label.trim().length < 2) return setErr('A label is required.');
    if (form.title.trim().length < 8) return setErr('Write the full page title (H1).');
    setBusy(true);
    try {
      const out: Record<string, unknown> = { ...form };
      if (intent) out.id = intent.id;
      await onSave(out, !intent);
    } finally {
      setBusy(false);
    }
  };

  const inputCls =
    'h-10 w-full rounded-xl border border-line bg-paper px-3 text-sm font-medium outline-none transition focus:border-emerald-500';

  return (
    <DrawerShell title={intent ? `Edit "${intent.label}"` : 'New intent page'} onClose={onClose} wide>
      <div className="space-y-4">
        {err && <p className="rounded-xl bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-600">{err}</p>}
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <FieldLabel hint="short chip label">Label</FieldLabel>
            <input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} className={inputCls} placeholder="e.g. Low spreads" />
          </label>
          <label className="block">
            <FieldLabel>Icon</FieldLabel>
            <select value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} className={inputCls}>
              {ICON_OPTIONS.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
            </select>
          </label>
        </div>
        <label className="block">
          <FieldLabel hint="the page H1 — include keyword + year">Title (H1)</FieldLabel>
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={inputCls} placeholder="Best Forex Brokers for Beginners (2026)" />
        </label>
        <label className="block"><FieldLabel>SEO title</FieldLabel><input value={form.meta_title} onChange={(e) => setForm({ ...form, meta_title: e.target.value })} className={inputCls} placeholder="Best Forex Brokers for Beginners 2026 | PipRank" /></label>
        <label className="block"><FieldLabel>Meta description</FieldLabel><textarea value={form.meta_description} onChange={(e) => setForm({ ...form, meta_description: e.target.value })} rows={3} className="w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-sm outline-none focus:border-emerald-500" /></label>
        <StringList
          label="Intro paragraphs"
          hint="SEO copy under the hero — 1–2 paragraphs"
          items={form.intro}
          onChange={(v) => setForm({ ...form, intro: v })}
          textarea
        />
        <StringList
          label="'How we ranked this list' criteria"
          items={form.criteria}
          onChange={(v) => setForm({ ...form, criteria: v })}
          placeholder="e.g. Observed spreads below 0.3 pips"
        />
        <SeoSectionsEditor label="SEO sections" hint="Structured sections for this SEO page." sections={form.sections} onChange={(sections) => setForm({ ...form, sections })} />
        <FaqListEditor label="FAQs" hint="Structured FAQ editor." faqs={form.faqs} onChange={(faqs) => setForm({ ...form, faqs })} />
        <div className="flex items-center justify-between rounded-xl border border-line bg-paper p-4"><div><p className="text-sm font-bold text-ink-900">Index this page</p><p className="text-xs text-slate-500">Disable for drafts or pages without sufficient unique content.</p></div><Toggle on={form.indexable} onToggle={() => setForm({ ...form, indexable: !form.indexable })} /></div>
        <p className="rounded-xl bg-paper px-3.5 py-2.5 text-xs leading-relaxed text-slate-500">
          Brokers join this page when an admin assigns them the matching category in the broker editor
          (Categories &amp; features).
        </p>
        <button
          onClick={submit}
          disabled={busy}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-ink-950 text-sm font-bold text-white transition hover:bg-ink-800 disabled:opacity-60"
        >
          {busy && <Loader2 size={15} className="animate-spin" />}
          {intent ? 'Save intent page' : 'Publish intent page'}
        </button>
      </div>
    </DrawerShell>
  );
}

/* =============================== AFFILIATE LINKS TAB =============================== */

interface AffiliateLink {
  id: number;
  broker_id: number;
  country_code: string | null;
  affiliate_url: string;
  direct_url: string | null;
  tracking_params: Record<string, string>;
  network: string | null;
  active: boolean;
  cpa_notes: string | null;
}

function AffiliateLinksTab({ token, brokers, notify }: { token: string; brokers: Broker[]; notify: (msg: string) => void }) {
  const [brokerId, setBrokerId] = useState<number | null>(brokers[0]?.id ?? null);
  const [links, setLinks] = useState<AffiliateLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<AffiliateLink | 'new' | null>(null);

  const headers = useMemo(() => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }), [token]);

  const load = useCallback(async () => {
    if (!brokerId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/affiliate-links?resource=links&broker_id=${brokerId}`, { headers });
      const data = await res.json().catch(() => []);
      if (Array.isArray(data)) setLinks(data);
    } finally {
      setLoading(false);
    }
  }, [brokerId, headers]);

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, [load]);

  const api = async (method: string, body: unknown) => {
    const res = await fetch('/api/affiliate-links?resource=links', { method, headers, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((data as { error?: string }).error || 'Action failed');
  };

  const globalRow = links.find((l) => l.country_code === null);
  const countryRows = links.filter((l) => l.country_code !== null);
  const selectedBroker = brokers.find((b) => b.id === brokerId);

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-line bg-white p-5 shadow-soft">
        <p className="font-display text-base font-bold text-ink-900">Affiliate link management</p>
        <p className="mt-1 text-xs text-slate-500">
          Every outbound CTA on the site routes through <code className="rounded bg-paper px-1 py-0.5">/go/&#123;slug&#125;</code>,
          which resolves to the country-specific URL below if one exists for the visitor, otherwise the global URL.
          CPA notes are private — never exposed on any public page or API response.
        </p>
        <select
          value={brokerId ?? ''}
          onChange={(e) => setBrokerId(Number(e.target.value) || null)}
          className="mt-4 h-10 w-full max-w-sm rounded-xl border border-line bg-white px-3 text-sm font-semibold text-ink-900 outline-none focus:border-emerald-500 sm:w-auto"
        >
          {brokers.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="h-40 animate-pulse rounded-2xl border border-line bg-white" />
      ) : (
        <div className="rounded-2xl border border-line bg-white shadow-soft">
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <p className="font-display text-sm font-bold text-ink-900">{selectedBroker?.name} — routing</p>
            <button
              onClick={() => setEditing('new')}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white transition hover:bg-emerald-700"
            >
              <Plus size={14} /> Add country override
            </button>
          </div>
          <div className="divide-y divide-line">
            <div className="flex flex-wrap items-center gap-3 px-5 py-3.5">
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">Global</span>
              <div className="min-w-0 flex-1">
                {globalRow ? (
                  <>
                    <p className="truncate text-xs font-mono text-slate-600">{globalRow.affiliate_url}</p>
                    <p className="text-[11px] text-slate-400">{globalRow.network || 'No network set'} · {globalRow.active ? 'Active' : 'Inactive'}</p>
                  </>
                ) : (
                  <p className="text-xs text-rose-500">No global URL configured — /go/ falls back to the legacy broker.affiliate_url or website field.</p>
                )}
              </div>
              <button
                onClick={() => setEditing(globalRow ?? { id: 0, broker_id: brokerId!, country_code: null, affiliate_url: '', direct_url: null, tracking_params: {}, network: null, active: true, cpa_notes: null })}
                className="rounded-lg p-2 text-slate-400 transition hover:bg-paper hover:text-ink-900"
              >
                <Pencil size={14} />
              </button>
            </div>
            {countryRows.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-slate-400">No country-specific overrides yet.</p>
            ) : (
              countryRows.map((l) => (
                <div key={l.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-700">
                    {l.country_code}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-mono text-slate-600">{l.affiliate_url}</p>
                    <p className="text-[11px] text-slate-400">{l.network || 'No network set'} · {l.active ? 'Active' : 'Inactive'}</p>
                  </div>
                  <button onClick={() => setEditing(l)} className="rounded-lg p-2 text-slate-400 transition hover:bg-paper hover:text-ink-900">
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={async () => {
                      if (!window.confirm(`Remove the ${l.country_code} override for ${selectedBroker?.name}?`)) return;
                      await api('DELETE', { id: l.id });
                      notify('Country override removed');
                      await load();
                    }}
                    className="rounded-lg p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {editing && brokerId && (
        <AffiliateLinkEditor
          link={editing}
          brokerId={brokerId}
          onClose={() => setEditing(null)}
          onSave={async (payload) => {
            try {
              if (editing === 'new' || !('id' in editing) || !editing.id) {
                await api('POST', payload);
                notify('Affiliate link created');
              } else {
                await api('PUT', { id: editing.id, ...payload });
                notify('Affiliate link updated');
              }
              setEditing(null);
              await load();
            } catch (e) {
              alert(e instanceof Error ? e.message : 'Save failed');
            }
          }}
        />
      )}
    </div>
  );
}

function AffiliateLinkEditor({
  link,
  brokerId,
  onClose,
  onSave,
}: {
  link: AffiliateLink | 'new';
  brokerId: number;
  onClose: () => void;
  onSave: (payload: Record<string, unknown>) => void;
}) {
  const initial = link === 'new' ? null : link;
  const [countryCode, setCountryCode] = useState(initial?.country_code ?? '');
  const [affiliateUrl, setAffiliateUrl] = useState(initial?.affiliate_url ?? '');
  const [directUrl, setDirectUrl] = useState(initial?.direct_url ?? '');
  const [network, setNetwork] = useState(initial?.network ?? '');
  const [active, setActive] = useState(initial?.active ?? true);
  const [trackingParamsRaw, setTrackingParamsRaw] = useState(
    initial?.tracking_params ? JSON.stringify(initial.tracking_params, null, 2) : '{}'
  );
  const [cpaNotes, setCpaNotes] = useState(initial?.cpa_notes ?? '');
  const [paramsError, setParamsError] = useState('');

  const submit = () => {
    let trackingParams: Record<string, string> = {};
    try {
      trackingParams = trackingParamsRaw.trim() ? JSON.parse(trackingParamsRaw) : {};
      setParamsError('');
    } catch {
      setParamsError('Tracking params must be valid JSON, e.g. {"subid": "piprank"}');
      return;
    }
    if (!affiliateUrl.trim() || !/^https?:\/\//i.test(affiliateUrl.trim())) {
      alert('A valid affiliate URL (starting with http:// or https://) is required.');
      return;
    }
    onSave({
      broker_id: brokerId,
      country_code: countryCode.trim() ? countryCode.trim().toUpperCase() : null,
      affiliate_url: affiliateUrl.trim(),
      direct_url: directUrl.trim() || null,
      network: network.trim() || null,
      active,
      tracking_params: trackingParams,
      cpa_notes: cpaNotes.trim() || null,
    });
  };

  return (
    <DrawerShell
      title={initial?.country_code ? `Edit ${initial.country_code} override` : initial ? 'Edit global URL' : 'New country override'}
      onClose={onClose}
    >
      <div className="space-y-4">
        <div>
          <label className="text-xs font-bold text-slate-600">
            Country code (ISO 3166-1 alpha-2, e.g. ZA) — leave blank for the global/default URL
          </label>
          <input
            value={countryCode}
            onChange={(e) => setCountryCode(e.target.value)}
            placeholder="e.g. NG, GB, ZA — blank = global"
            maxLength={2}
            className="mt-1 h-10 w-full rounded-xl border border-line bg-white px-3 text-sm font-mono uppercase outline-none focus:border-emerald-500"
          />
        </div>
        <div>
          <label className="text-xs font-bold text-slate-600">Affiliate URL (tracked link, used by /go/)</label>
          <input
            value={affiliateUrl}
            onChange={(e) => setAffiliateUrl(e.target.value)}
            placeholder="https://affiliate.example.com/click?id=..."
            className="mt-1 h-10 w-full rounded-xl border border-line bg-white px-3 text-sm font-mono outline-none focus:border-emerald-500"
          />
        </div>
        <div>
          <label className="text-xs font-bold text-slate-600">Direct account-opening URL (optional, not currently used by /go/ — for reference)</label>
          <input
            value={directUrl}
            onChange={(e) => setDirectUrl(e.target.value)}
            placeholder="https://broker.example.com/open-account"
            className="mt-1 h-10 w-full rounded-xl border border-line bg-white px-3 text-sm font-mono outline-none focus:border-emerald-500"
          />
        </div>
        <div>
          <label className="text-xs font-bold text-slate-600">Affiliate network / program</label>
          <input
            value={network}
            onChange={(e) => setNetwork(e.target.value)}
            placeholder="e.g. In-house CPA, CellXpert, Everflow"
            className="mt-1 h-10 w-full rounded-xl border border-line bg-white px-3 text-sm outline-none focus:border-emerald-500"
          />
        </div>
        <div>
          <label className="text-xs font-bold text-slate-600">
            Tracking params (JSON — values may include the literal token <code>&#123;click_id&#125;</code>)
          </label>
          <textarea
            value={trackingParamsRaw}
            onChange={(e) => setTrackingParamsRaw(e.target.value)}
            rows={3}
            placeholder={'{ "subid": "piprank", "clickref": "{click_id}" }'}
            className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-2 text-xs font-mono outline-none focus:border-emerald-500"
          />
          {paramsError && <p className="mt-1 text-xs text-rose-500">{paramsError}</p>}
        </div>
        <div>
          <label className="flex items-center gap-2 text-xs font-bold text-slate-600">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="h-4 w-4 rounded" />
            Active — inactive rows are skipped by the /go/ resolver
          </label>
        </div>
        <div>
          <label className="text-xs font-bold text-slate-600">CPA notes — private, never shown publicly</label>
          <textarea
            value={cpaNotes}
            onChange={(e) => setCpaNotes(e.target.value)}
            rows={3}
            placeholder="Commission structure, payout terms, contact at the network, etc."
            className="mt-1 w-full rounded-xl border border-amber-200 bg-amber-50/40 px-3 py-2 text-xs outline-none focus:border-amber-400"
          />
        </div>
        <button
          onClick={submit}
          className="w-full rounded-xl bg-emerald-600 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-700"
        >
          Save
        </button>
      </div>
    </DrawerShell>
  );
}

/* =============================== CONVERSIONS (CLICK FUNNEL) TAB =============================== */

interface DashboardData {
  total: number;
  windowDays: number;
  byBroker: Record<string, number>;
  byCountry: Record<string, number>;
  byPageType: Record<string, number>;
  bySourcePage: Record<string, number>;
  byBestFor: Record<string, number>;
  byComparisonPair: Record<string, number>;
  byReferrer: Record<string, number>;
  byUtmSource: Record<string, number>;
  byDevice: Record<string, number>;
  byDay: Record<string, number>;
}

function BreakdownList({ title, data }: { title: string; data: Record<string, number> }) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]).slice(0, 10);
  const max = Math.max(1, ...entries.map(([, n]) => n));
  return (
    <div className="rounded-2xl border border-line bg-white p-5 shadow-soft">
      <p className="font-display text-sm font-bold text-ink-900">{title}</p>
      {entries.length === 0 ? (
        <p className="mt-3 text-xs text-slate-400">No data in this window yet.</p>
      ) : (
        <div className="mt-3 space-y-2">
          {entries.map(([label, n]) => (
            <div key={label} className="flex items-center gap-2">
              <span className="w-28 shrink-0 truncate text-xs text-slate-600" title={label}>{label}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-paper">
                <div className="h-full rounded-full bg-emerald-500" style={{ width: `${(n / max) * 100}%` }} />
              </div>
              <span className="tnum w-8 shrink-0 text-right text-xs font-bold text-ink-900">{n}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ConversionsTab({ token }: { token: string; brokers: Broker[] }) {
  const [days, setDays] = useState<7 | 30 | 90>(30);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/affiliate-links?resource=dashboard&days=${days}`, { headers })
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [days, headers]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-white p-5 shadow-soft">
        <div>
          <p className="font-display text-base font-bold text-ink-900">Click-through funnel</p>
          <p className="mt-1 max-w-xl text-xs text-slate-500">
            Every hit on <code className="rounded bg-paper px-1 py-0.5">/go/&#123;broker&#125;</code>, before the visitor lands
            on the broker's site. This is <strong>not</strong> confirmed conversion data — there's no signup or FTD
            postback from any affiliate network wired up yet, so treat this as routing/interest volume, not revenue.
          </p>
        </div>
        <div className="flex gap-1 rounded-xl bg-paper p-1">
          {([7, 30, 90] as const).map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                days === d ? 'bg-ink-950 text-white shadow-sm' : 'text-slate-500 hover:text-ink-900'
              }`}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="h-96 animate-pulse rounded-2xl border border-line bg-white" />
      ) : !data ? (
        <p className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">Failed to load click data.</p>
      ) : (
        <>
          <div className="rounded-2xl border border-line bg-white p-5 shadow-soft">
            <p className="tnum font-display text-3xl font-bold text-ink-900">{data.total.toLocaleString()}</p>
            <p className="text-xs font-bold text-slate-500">Total /go/ redirects in the last {data.windowDays} days</p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <BreakdownList title="By broker" data={data.byBroker} />
            <BreakdownList title="By country" data={data.byCountry} />
            <BreakdownList title="By page type" data={data.byPageType} />
            <BreakdownList title="By best-for category" data={data.byBestFor} />
            <BreakdownList title="By comparison pair" data={data.byComparisonPair} />
            <BreakdownList title="By source page" data={data.bySourcePage} />
            <BreakdownList title="By referrer" data={data.byReferrer} />
            <BreakdownList title="By UTM source" data={data.byUtmSource} />
            <BreakdownList title="By device" data={data.byDevice} />
          </div>
        </>
      )}
    </div>
  );
}


function DrawerShell({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-[80]">
      <div className="absolute inset-0 bg-ink-950/50 backdrop-blur-sm" onClick={onClose} />
      <div
        className={`absolute inset-y-0 right-0 w-full overflow-y-auto bg-white shadow-soft-lg ${
          wide ? 'max-w-2xl' : 'max-w-md'
        }`}
      >
        <div className="flex items-center justify-between border-b border-line px-6 py-4">
          <p className="font-display text-lg font-bold text-ink-900">{title}</p>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 transition hover:bg-paper hover:text-ink-900"
          >
            <X size={18} />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}
