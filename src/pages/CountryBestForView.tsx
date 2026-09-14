import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Broker, ContentDocument, CountryPage } from '../lib/types';
import { fetchBrokers, fetchCountry, fetchCountryIntentRankings } from '../lib/api';
import { fetchPublishedContentDocument } from '../lib/canonicalContent';
import PageBlocksRenderer from '../components/PageBlocksRenderer';
import BrokerCard from '../components/BrokerCard';
import Reveal from '../components/Reveal';
import NewsletterForm from '../components/NewsletterForm';
import { buildBreadcrumbJsonLd, buildFAQPageJsonLd, buildItemListJsonLd, countryBestForSeo } from '../lib/seo';
import { useSEO } from '../hooks/useSEO';
import NotFound from './NotFound';

const CANONICAL_INTENT_SLUGS: Record<string, string> = {
  beginners: 'forex-brokers-for-beginners',
  'low-spread': 'low-spread-forex-brokers',
  mt5: 'mt5-forex-brokers',
  gold: 'gold-forex-brokers',
  scalping: 'forex-brokers-for-scalping',
  islamic: 'islamic-forex-brokers',
  ecn: 'ecn-forex-brokers',
  'copy-trading': 'copy-trading-forex-brokers',
  'swing-trading': 'forex-brokers-for-swing-trading',
  'high-leverage': 'high-leverage-forex-brokers',
};

type EditorialPage = {
  title: string;
  slug: string;
  label: string;
  intro: string[];
  criteria: string[];
  sections: { heading: string; body: string[]; bullets?: string[] }[];
  faqs: { q: string; a: string }[];
  indexable: boolean;
  meta_title?: string | null;
  meta_description?: string | null;
};

function settingsOf(doc: ContentDocument | null): Record<string, any> { return (doc?.settings ?? {}) as Record<string, any>; }

function editorialPage(doc: ContentDocument): EditorialPage {
  const s = settingsOf(doc);
  return {
    title: doc.title,
    slug: doc.slug || '',
    label: String(s.label || doc.title),
    intro: Array.isArray(s.intro) ? s.intro.filter(Boolean) : (doc.excerpt ? [doc.excerpt] : []),
    criteria: Array.isArray(s.criteria) ? s.criteria.filter(Boolean) : [],
    sections: Array.isArray(s.sections) ? s.sections.filter((x: any) => x?.heading) : [],
    faqs: Array.isArray(s.faqs) ? s.faqs.filter((x: any) => x?.q && x?.a) : [],
    indexable: doc.indexable !== false,
    meta_title: doc.seo_title,
    meta_description: doc.seo_description,
  };
}

export default function CountryBestForView({ countrySlug, slug, contentKey, document: initialDocument }: { countrySlug: string; slug: string; contentKey?: string; document?: ContentDocument | null }) {
  const [country, setCountry] = useState<CountryPage | null>(null);
  const [doc, setDoc] = useState<ContentDocument | null>(initialDocument ?? null);
  const [brokers, setBrokers] = useState<Broker[]>([]);
  const [rankingIds, setRankingIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    Promise.all([
      fetchCountry(countrySlug),
      initialDocument ? Promise.resolve(initialDocument) : fetchPublishedContentDocument(contentKey || `country-best-for:${countrySlug}:${slug}`),
      fetchBrokers(),
      fetchCountryIntentRankings(countrySlug, slug).catch(() => []),
    ]).then(([c, d, b, rankings]) => {
      if (!active) return;
      setCountry(c);
      setDoc(d);
      setBrokers(b);
      setRankingIds((rankings ?? []).map((r) => Number(r.broker_id)).filter(Number.isFinite));
    }).catch(() => {
      if (active) { setCountry(null); setDoc(null); }
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [countrySlug, slug, contentKey, initialDocument]);

  const page = doc ? editorialPage(doc) : null;
  const ranked = useMemo(() => {
    if (!country) return [];
    const available = new Set((country.recommended ?? []).map((r) => r.slug));
    const pool = brokers.filter((b) => available.size ? available.has(b.slug) : true);
    return [...pool].sort((a, b) => {
      const ar = rankingIds.indexOf(a.id); const br = rankingIds.indexOf(b.id);
      if (ar >= 0 && br >= 0) return ar - br;
      if (ar >= 0) return -1;
      if (br >= 0) return 1;
      return b.rating - a.rating || b.trust_score - a.trust_score;
    });
  }, [country, brokers, rankingIds]);

  const seo = page ? countryBestForSeo(countrySlug, page) : null;
  useSEO(seo, seo && page && country ? [
    buildBreadcrumbJsonLd([
      { name: 'Home', path: '/' },
      { name: country.name, path: `/${country.slug}` },
      { name: page.title, path: seo.path },
    ]),
    buildItemListJsonLd(page.title, ranked.slice(0, 10).map((b) => ({ name: b.name, path: `/brokers/${b.slug}` }))),
    ...(page.faqs.length ? [buildFAQPageJsonLd(page.faqs.map((f) => ({ question: f.q, answer: f.a })))] : []),
  ] : undefined);

  if (loading) return <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6"><div className="h-80 animate-pulse rounded-3xl border border-line bg-white"/><div className="mt-8 h-96 animate-pulse rounded-3xl border border-line bg-white"/></div>;
  if (!country || !doc || !page || !doc.published || !page.indexable) return <NotFound />;

  const canonicalIntent = CANONICAL_INTENT_SLUGS[slug] ?? slug;
  const blocks = Array.isArray(doc.blocks) ? doc.blocks : [];
  const settings = settingsOf(doc);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <nav aria-label="Breadcrumb" className="flex gap-1.5 text-xs text-slate-400">
        <Link to="/">Home</Link><span>/</span><Link to={`/${country.slug}`}>{country.name}</Link><span>/</span><span className="text-ink-900">{page.title}</span>
      </nav>

      <header className="mt-6 rounded-3xl bg-ink-950 p-7 text-white sm:p-10">
        {settings.image && <img src={String(settings.image)} alt="" className="mb-7 aspect-[21/8] w-full rounded-2xl object-cover" />}
        <p className="text-xs font-bold uppercase tracking-widest text-emerald-300">{country.flag} {country.name}</p>
        <h1 className="mt-2 font-display text-3xl font-bold sm:text-4xl">{page.title}</h1>
        {page.intro.map((p, i) => <p key={i} className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">{p}</p>)}
      </header>

      {page.criteria.length > 0 && <section className="mt-6 rounded-2xl border border-line bg-white p-6"><p className="text-xs font-bold uppercase tracking-widest text-slate-400">How we ranked this list</p><ul className="mt-3 grid gap-2.5 sm:grid-cols-2">{page.criteria.map((c) => <li key={c} className="text-sm leading-6 text-slate-600">✓ {c}</li>)}</ul></section>}

      {ranked.length > 0 && <section className="mt-8"><p className="text-xs font-bold uppercase tracking-widest text-emerald-700">PipRank recommendations</p><h2 className="mt-1 font-display text-2xl font-bold">Best {page.label} in {country.name}</h2><div className="mt-5 grid gap-5 lg:grid-cols-2">{ranked.map((b, i) => <Reveal key={b.slug} delay={Math.min(i, 5) * 0.05}><BrokerCard broker={b} rank={i + 1} intent={canonicalIntent} countrySlug={country.slug} /></Reveal>)}</div></section>}

      {(blocks.length > 0 || doc.html) && <article className="mt-10 rounded-3xl border border-line bg-white p-6 sm:p-9">{blocks.length > 0 ? <PageBlocksRenderer blocks={blocks as any} brokers={brokers} intent={canonicalIntent} countrySlug={country.slug} className="piprank-rich-content space-y-8" /> : <div className="piprank-rich-content" dangerouslySetInnerHTML={{ __html: doc.html }} />}</article>}

      {page.sections.length > 0 && <section className="mt-10 space-y-5">{page.sections.map((s) => <article key={s.heading} className="rounded-2xl border border-line bg-white p-6"><h2 className="font-display text-xl font-bold">{s.heading}</h2>{s.body?.map((p) => <p key={p} className="mt-3 text-sm leading-7 text-slate-600">{p}</p>)}{s.bullets?.length ? <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-600">{s.bullets.map((b) => <li key={b}>{b}</li>)}</ul> : null}</article>)}</section>}
      {page.faqs.length > 0 && <section className="mt-10 space-y-3">{page.faqs.map((f) => <details key={f.q} className="rounded-2xl border border-line bg-white p-5"><summary className="cursor-pointer font-bold">{f.q}</summary><p className="mt-3 text-sm leading-7 text-slate-600">{f.a}</p></details>)}</section>}
      <div className="mt-10"><NewsletterForm /></div>
    </div>
  );
}
