import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, Clock, Compass, ListOrdered, Sparkles } from 'lucide-react';
import type { Broker, ContentDocument, CountryPage, LocalizedSeoPage } from '../lib/types';
import type { CanonicalRoute } from '../lib/canonicalHub/types';
import { fetchBrokers, fetchCountry, fetchLocalizedSeoPagesForCountry } from '../lib/api';
import { fetchPublishedContentDocument, fetchPublishedContentDocuments } from '../lib/canonicalContent';
import PageBlocksRenderer from './PageBlocksRenderer';
import BrokerCard from './BrokerCard';
import Reveal from './Reveal';
import Monogram from './Monogram';
import NewsletterForm from './NewsletterForm';
import { ButtonLink } from './Button';
import { useSEO } from '../hooks/useSEO';
import { staticPageSeo, buildBreadcrumbJsonLd, buildFAQPageJsonLd, buildItemListJsonLd, buildWebPageJsonLd, absoluteUrl, guideSeo } from '../lib/seo';
import { reviewerFor } from '../lib/team';
import { getCountrySeoTopic, rankCountryTopicBrokers, topicFaq, topicNote, topicMeta, topicIntro } from '../data/countrySeoTopics';
import { englishHreflangForCountry } from '../lib/localization';
import { fmtDate } from '../lib/format';
import { isBlockShape } from '../lib/contentBlocks';
import NotFound from '../pages/NotFound';

type Props = { route: CanonicalRoute };
type Faq = { q: string; a: string };

function settingsOf(doc: ContentDocument | null): Record<string, any> {
  return (doc?.settings ?? {}) as Record<string, any>;
}

function faqsOf(doc: ContentDocument | null): Faq[] {
  const faqs = settingsOf(doc).faqs;
  return Array.isArray(faqs) ? faqs.filter((x: any) => x?.q && x?.a) : [];
}

function internalLinksOf(doc: ContentDocument | null): { label: string; href: string }[] {
  const links = settingsOf(doc).internalLinks;
  return Array.isArray(links) ? links.filter((x: any) => x?.label && x?.href) : [];
}

function Loading({ tall = false }: { tall?: boolean }) {
  return <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6"><div className={`${tall ? 'h-64' : 'h-52'} animate-pulse rounded-3xl border border-line bg-white`} /><div className="mt-8 h-64 animate-pulse rounded-3xl border border-line bg-white" /></div>;
}

function Missing({ countryGuide = false }: { countryGuide?: boolean }) {
  return countryGuide ? (
    <div className="mx-auto max-w-2xl px-4 py-28 text-center sm:px-6"><div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-ink-950 text-emerald-400"><Compass size={30} /></div><h1 className="mt-6 font-display text-2xl font-bold text-ink-900">This guide isn't published</h1><p className="mt-3 text-slate-500">It may have moved, been retired, or never existed for this country.</p><ButtonLink variant="dark" size="lg" to="/countries" className="mt-7">Browse countries</ButtonLink></div>
  ) : <NotFound />;
}

function GuideIndex() {
  const [guides, setGuides] = useState<ContentDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cat, setCat] = useState('All');

  useEffect(() => {
    fetchPublishedContentDocuments({ type: 'guide' })
      .then((rows) => setGuides(rows.filter((g) => !g.country_slug)))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load guides'))
      .finally(() => setLoading(false));
  }, []);

  const cats = useMemo(() => ['All', ...new Set(guides.map((g) => String(settingsOf(g).category ?? 'Basics')))], [guides]);
  const list = useMemo(() => cat === 'All' ? guides : guides.filter((g) => String(settingsOf(g).category ?? 'Basics') === cat), [guides, cat]);

  useSEO(staticPageSeo.guides, [buildWebPageJsonLd(staticPageSeo.guides), buildBreadcrumbJsonLd([{ name: 'Home', path: '/' }, { name: 'Guides', path: '/guides' }]), buildItemListJsonLd('Forex trading guides', guides.map((g) => ({ name: g.title, path: `/guides/${g.slug}` })))]);

  return <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6"><div className="max-w-2xl"><p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-600">PipRank Guides</p><h1 className="mt-2 font-display text-4xl font-bold tracking-tight text-ink-900">Forex <em className="serif-accent text-emerald-700">trading guides</em> that teach mechanics, not hype</h1><p className="mt-3 text-slate-500">Research-desk guides covering the foundations, costs, risk and the psychology that decides who survives their first year.</p></div><div className="mt-7 flex flex-wrap gap-2">{cats.map((c) => <button key={c} onClick={() => setCat(c)} className={`rounded-full border px-4 py-2 text-xs font-bold transition ${cat === c ? 'border-ink-900 bg-ink-900 text-white' : 'border-line bg-white text-slate-500 hover:border-ink-900 hover:text-ink-900'}`}>{c}</button>)}</div>{error && <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">{error}</div>}{loading ? <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{[0,1,2,3,4,5].map((i) => <div key={i} className="h-80 animate-pulse rounded-2xl border border-line bg-white" />)}</div> : <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{list.map((g, i) => <Reveal key={g.slug} delay={Math.min(i, 4) * 0.06}><Link to={`/guides/${g.slug}`} className="group flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-white transition hover:-translate-y-1 hover:shadow-soft-lg"><div className="relative overflow-hidden"><img src={String(settingsOf(g).image ?? '')} alt={g.title} className="aspect-[16/9] w-full object-cover transition duration-500 group-hover:scale-105" loading="lazy"/><span className="absolute left-3 top-3 rounded-full bg-ink-950/90 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white backdrop-blur">{String(settingsOf(g).category ?? 'Basics')}</span></div><div className="flex flex-1 flex-col p-5"><h2 className="font-display text-lg font-bold leading-snug text-ink-900 transition group-hover:text-emerald-700">{g.title}</h2><p className="mt-2 line-clamp-2 text-sm leading-relaxed text-slate-500">{g.excerpt}</p><div className="mt-auto flex items-center justify-between pt-4"><span className="text-xs font-medium text-slate-400">{Number(settingsOf(g).minutes ?? 0)} min · {String(settingsOf(g).level ?? 'Beginner')}</span><span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600">Read <ArrowRight size={12} /></span></div></div></Link></Reveal>)}</div>}</div>;
}

function GuideDetailView({ route }: Props) {
  const [guide, setGuide] = useState<ContentDocument | null>(route.document ?? null);
  const [all, setAll] = useState<ContentDocument[]>([]);
  const [brokers, setBrokers] = useState<Broker[]>([]);
  const [loading, setLoading] = useState(!route.document);
  const [error, setError] = useState('');
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [blockToc, setBlockToc] = useState<{ id: string; text: string }[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const [g, b, rows] = await Promise.all([
          guide ? Promise.resolve(guide) : fetchPublishedContentDocument(`guide:${route.slug}`),
          fetchBrokers(),
          fetchPublishedContentDocuments({ type: 'guide' }),
        ]);
        setGuide(g?.country_slug ? null : g);
        setBrokers(b);
        setAll(rows.filter((x) => !x.country_slug));
      } catch (e) { setError(e instanceof Error ? e.message : 'Guide not found'); }
      finally { setLoading(false); }
    };
    load();
  }, [route.slug]);

  useEffect(() => {
    if (!guide || !isBlockShape(guide.blocks) || !contentRef.current) { setBlockToc([]); return; }
    const headings = Array.from(contentRef.current.querySelectorAll('h2[id]'));
    setBlockToc(headings.map((h) => ({ id: h.id, text: h.textContent || '' })));
  }, [guide, brokers]);

  const seoInput = guide ? guideSeo({ ...guide, slug: guide.slug ?? '' }) : null;
  useSEO(seoInput, guide ? [buildWebPageJsonLd(seoInput!), buildBreadcrumbJsonLd([{ name: 'Home', path: '/' }, { name: 'Guides', path: '/guides' }, { name: guide.title, path: `/guides/${guide.slug}` }])] : undefined);

  const related = useMemo(() => {
    if (!guide) return [];
    const same = all.filter((g) => g.slug !== guide.slug && settingsOf(g).category === settingsOf(guide).category);
    const rest = all.filter((g) => g.slug !== guide.slug && settingsOf(g).category !== settingsOf(guide).category);
    return [...same, ...rest].slice(0, 3);
  }, [all, guide]);

  if (loading) return <Loading tall />;
  if (error || !guide) return <Missing />;
  const settings = settingsOf(guide);
  const legacySections = (Array.isArray(guide.blocks) ? guide.blocks : []) as Array<{ heading: string; body: string[]; bullets?: string[] }>;
  const blocks = isBlockShape(guide.blocks) ? guide.blocks : null;

  return <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6"><nav className="flex items-center gap-1.5 text-xs font-medium text-slate-400"><Link to="/">Home</Link><span>/</span><Link to="/guides">Guides</Link><span>/</span><span className="text-ink-900">{String(settings.category ?? 'Basics')}</span></nav><div className="mt-6 overflow-hidden rounded-3xl"><img src={String(settings.image ?? '')} alt={guide.title} className="aspect-[21/9] w-full object-cover" /></div><div className="mt-8 grid gap-10 lg:grid-cols-[1fr_280px]"><article className="min-w-0"><div className="flex flex-wrap items-center gap-2 text-xs"><span className="rounded-full bg-ink-900 px-3 py-1 font-bold text-white">{String(settings.category ?? 'Basics')}</span><span className="rounded-full border border-line bg-white px-3 py-1 font-semibold text-slate-500">{String(settings.level ?? 'Beginner')}</span><span className="inline-flex items-center gap-1 font-medium text-slate-400"><Clock size={12} /> {Number(settings.minutes ?? 0)} min read</span><span className="text-slate-400">Updated {fmtDate(guide.updated_at)}</span></div><h1 className="mt-4 font-display text-3xl font-bold leading-tight tracking-tight text-ink-900 sm:text-4xl">{guide.title}</h1><p className="mt-3 text-lg leading-relaxed text-slate-500">{guide.excerpt}</p><div className="mt-8 space-y-10" ref={contentRef}>{blocks ? <PageBlocksRenderer blocks={blocks as any} brokers={brokers} className="piprank-rich-content [&_h2]:scroll-mt-28 space-y-8" /> : legacySections.map((sec, i) => <section key={i} id={`sec-${i}`} className="scroll-mt-28"><h2 className="flex items-baseline gap-3 font-display text-2xl font-bold text-ink-900"><span className="tnum text-sm font-bold text-emerald-600">{String(i + 1).padStart(2, '0')}</span>{sec.heading}</h2><div className="mt-3 space-y-4 text-[15.5px] leading-relaxed text-slate-600">{sec.body.map((p, j) => <p key={j}>{p}</p>)}</div>{sec.bullets && <ul className="mt-4 space-y-2.5 rounded-2xl border border-line bg-white p-5">{sec.bullets.map((b) => <li key={b} className="flex gap-2.5 text-sm font-medium text-slate-700"><Check size={16} className="mt-0.5 shrink-0 text-emerald-600" strokeWidth={3}/>{b}</li>)}</ul>}</section>)}</div><div className="mt-12 rounded-2xl border border-line bg-white p-6"><p className="font-display text-lg font-bold text-ink-900">Keep learning, weekly</p><p className="mt-1 text-sm text-slate-500">One research note every Friday — no noise.</p><div className="mt-4"><NewsletterForm /></div></div></article><aside className="space-y-5 lg:sticky lg:top-24 lg:self-start"><div className="rounded-2xl border border-line bg-white p-5"><p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-400"><ListOrdered size={14}/> In this guide</p><ol className="mt-3 space-y-2">{(blocks ? blockToc : legacySections.map((sec, i) => ({ id: `sec-${i}`, text: sec.heading }))).map((item, i) => <li key={item.id}><button onClick={() => document.getElementById(item.id)?.scrollIntoView({ behavior: 'smooth' })} className="flex items-baseline gap-2 text-left text-sm font-medium text-slate-600 hover:text-emerald-700"><span className="tnum text-xs font-bold text-slate-400">{i + 1}.</span>{item.text}</button></li>)}</ol></div><div className="rounded-2xl border border-line bg-ink-950 p-5"><p className="font-display text-sm font-bold text-white">Put it into practice</p><p className="mt-1.5 text-xs leading-relaxed text-slate-400">Ready to trade what you learned? Compare brokers graded on real testing data.</p><ButtonLink variant="primary" size="sm" icon={ArrowRight} iconRight to="/brokers" className="mt-4">Browse brokers</ButtonLink></div></aside></div>{related.length > 0 && <div className="mt-16"><h2 className="font-display text-2xl font-bold text-ink-900">Read next</h2><div className="mt-6 grid gap-5 sm:grid-cols-3">{related.map((g) => <Link key={g.slug} to={`/guides/${g.slug}`} className="group overflow-hidden rounded-2xl border border-line bg-white"><img src={String(settingsOf(g).image ?? '')} alt={g.title} className="aspect-[16/8] w-full object-cover" loading="lazy"/><div className="p-4"><span className="text-[10px] font-bold uppercase tracking-wide text-emerald-600">{String(settingsOf(g).category ?? 'Basics')}</span><p className="mt-1 line-clamp-2 font-display text-sm font-bold leading-snug text-ink-900">{g.title}</p></div></Link>)}</div></div>}</div>;
}

function CountryGuideView({ route }: Props) {
  const [country, setCountry] = useState<CountryPage | null>(null);
  const [brokers, setBrokers] = useState<Broker[]>([]);
  const [doc, setDoc] = useState<ContentDocument | null>(route.document ?? null);
  const [loading, setLoading] = useState(!route.document);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const [c, b, content] = await Promise.all([fetchCountry(route.countrySlug!), fetchBrokers(), doc ? Promise.resolve(doc) : fetchPublishedContentDocument(`country-guide:${route.countrySlug}:${route.slug}`)]);
        if (!content || content.content_type !== 'country-guide' || !content.published) { setMissing(true); return; }
        setCountry(c); setBrokers(b); setDoc(content);
      } catch { setMissing(true); }
      finally { setLoading(false); }
    };
    load();
  }, [route.countrySlug, route.slug]);

  const reviewer = reviewerFor(`${route.countrySlug ?? ''}-guide-${route.slug ?? ''}`);
  const faqs = faqsOf(doc);
  const internalLinks = internalLinksOf(doc);
  const seo = country && doc ? { title: doc.seo_title || doc.title, description: doc.seo_description || doc.excerpt, path: `/${country.slug}/guides/${doc.slug}`, type: 'article' as const } : null;
  useSEO(missing ? { title: 'Guide not found | PipRank', description: 'This guide could not be found.', path: window.location.pathname, type: 'website', noindex: true } : seo, seo && country && doc ? [{ ...buildWebPageJsonLd(seo), author: { '@type': 'Person', name: reviewer.penName, jobTitle: reviewer.role, url: absoluteUrl(`/authors#${reviewer.slug}`) } }, buildBreadcrumbJsonLd([{ name: 'Home', path: '/' }, { name: country.name, path: `/${country.slug}` }, { name: doc.title, path: seo.path }]), ...(faqs.length ? [buildFAQPageJsonLd(faqs.map((f) => ({ question: f.q, answer: f.a })))] : [])] : undefined);

  if (loading || !country || !doc) return missing ? <Missing countryGuide /> : <Loading />;
  return <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6"><nav aria-label="Breadcrumb" className="mb-5 flex flex-wrap items-center gap-1.5 text-xs font-medium text-slate-400"><Link to="/">Home</Link><span>/</span><Link to={`/${country.slug}`}>{country.name}</Link><span>/</span><span className="text-ink-900">{doc.title}</span></nav><p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-emerald-700"><span className="text-lg leading-none">{country.flag}</span> {country.name} guide</p><h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-ink-900 sm:text-4xl">{doc.title}</h1><div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500"><Monogram name={reviewer.penName} color={reviewer.color} size={20}/><span>Reviewed by <Link to={`/authors#${reviewer.slug}`} className="font-semibold text-ink-900">{reviewer.penName}</Link>, {reviewer.role}</span><span>·</span><span>Updated {new Date(doc.updated_at).toISOString().slice(0, 10)}</span></div>{doc.excerpt && <p className="mt-4 max-w-2xl text-base leading-relaxed text-slate-500">{doc.excerpt}</p>}<div className="piprank-rich-content mt-8 rounded-3xl border border-line bg-white p-6 sm:p-8">{Array.isArray(doc.blocks) && doc.blocks.length ? <PageBlocksRenderer blocks={doc.blocks as any} brokers={brokers} countrySlug={country.slug} className="space-y-8"/> : doc.html ? <div dangerouslySetInnerHTML={{ __html: doc.html }}/> : null}</div>{faqs.length > 0 && <section className="mt-8 space-y-4"><h2 className="font-display text-xl font-bold text-ink-900">Frequently asked questions</h2>{faqs.map((f) => <details key={f.q} className="rounded-2xl border border-line bg-white p-5"><summary className="cursor-pointer font-bold text-ink-900">{f.q}</summary><p className="mt-3 text-sm leading-7 text-slate-600">{f.a}</p></details>)}</section>}{internalLinks.length > 0 && <section className="mt-8 rounded-2xl border border-line bg-white p-6"><p className="text-xs font-bold uppercase tracking-widest text-emerald-700">Related pages</p><div className="mt-3 grid gap-2 sm:grid-cols-2">{internalLinks.map((link, i) => <Link key={i} to={link.href} className="rounded-xl border border-line px-4 py-3 text-sm font-semibold text-ink-900 hover:border-emerald-300 hover:bg-emerald-50">{link.label}</Link>)}</div></section>}<div className="mt-10 rounded-3xl bg-ink-950 p-7 text-white sm:p-9"><p className="text-xs font-bold uppercase tracking-widest text-emerald-300">Continue your research</p><h2 className="mt-2 font-display text-2xl font-bold">Compare forex brokers in {country.name}</h2><div className="mt-5 flex flex-wrap gap-3"><Link to={`/${country.slug}`} className="rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-ink-950">View all {country.name} brokers</Link><Link to="/quiz" className="rounded-xl border border-white/15 px-4 py-2.5 text-sm font-bold">Find my broker</Link></div></div></div>;
}

function CountryTopicView({ route }: Props) {
  const topic = route.topicSlug ? getCountrySeoTopic(route.topicSlug) : null;
  const [country, setCountry] = useState<CountryPage | null>(null);
  const [brokers, setBrokers] = useState<Broker[]>([]);
  const [doc, setDoc] = useState<ContentDocument | null>(route.document ?? null);
  const [localizedAlts, setLocalizedAlts] = useState<LocalizedSeoPage[]>([]);
  const [loading, setLoading] = useState(!route.document);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        if (!route.countrySlug || !topic) { setMissing(true); return; }
        const [c, b, content] = await Promise.all([fetchCountry(route.countrySlug), fetchBrokers(), doc ? Promise.resolve(doc) : fetchPublishedContentDocument(`country-topic:${route.countrySlug}:${topic.slug}`)]);
        if (!content || content.content_type !== 'country-topic' || !content.published) { setMissing(true); return; }
        setCountry(c); setBrokers(b); setDoc(content);
      } catch { setMissing(true); }
      finally { setLoading(false); }
    };
    load();
  }, [route.countrySlug, route.topicSlug]);

  useEffect(() => {
    if (!route.countrySlug || !topic) return;
    fetchLocalizedSeoPagesForCountry(route.countrySlug).then((rows) => setLocalizedAlts((rows ?? []).filter((r) => r.published && r.indexable && r.topic_key === topic.key))).catch(() => setLocalizedAlts([]));
  }, [route.countrySlug, topic?.key]);

  const pageSettings = settingsOf(doc);
  const ranked = useMemo(() => {
    if (!country || !topic) return [];
    const base = rankCountryTopicBrokers(brokers, country, topic);
    const excluded = new Set(Array.isArray(pageSettings.excludedBrokerSlugs) ? pageSettings.excludedBrokerSlugs : []);
    const filtered = base.filter((b) => !excluded.has(b.slug));
    if (pageSettings.rankingMode === 'manual' && Array.isArray(pageSettings.pinnedBrokerSlugs)) {
      const eligible = new Map(filtered.map((b) => [b.slug, b]));
      return pageSettings.pinnedBrokerSlugs.filter((s: string, i: number, a: string[]) => Boolean(s) && a.indexOf(s) === i).map((s: string) => eligible.get(s)).filter(Boolean) as Broker[];
    }
    return filtered;
  }, [country, brokers, topic, doc]);

  const reviewer = useMemo(() => reviewerFor(`${route.countrySlug ?? ''}-${topic?.slug ?? ''}`), [route.countrySlug, topic?.slug]);
  const seo = country && topic ? { title: doc?.seo_title || topicMeta(topic, country.name).metaTitle, description: doc?.seo_description || topicMeta(topic, country.name).description, path: `/${country.slug}/${topic.slug}`, type: 'website' as const, alternates: [{ hreflang: englishHreflangForCountry(country.slug), path: `/${country.slug}/${topic.slug}` }, { hreflang: 'x-default', path: `/${country.slug}/${topic.slug}` }, ...localizedAlts.filter((r) => r.url_prefix && r.slug).map((r) => ({ hreflang: r.locale || r.language_code || 'und', path: `/${country.slug}/${r.url_prefix}/${r.slug}` }))] } : null;
  const faqs = country && topic ? (Array.isArray(pageSettings.faqs) && pageSettings.faqs.length ? pageSettings.faqs : topicFaq(topic, country.name)) : [];
  useSEO(seo, seo && country && topic ? [{ ...buildWebPageJsonLd(seo), author: { '@type': 'Person', name: reviewer.penName, jobTitle: reviewer.role, url: absoluteUrl(`/authors#${reviewer.slug}`) } }, buildBreadcrumbJsonLd([{ name: 'Home', path: '/' }, { name: country.name, path: `/${country.slug}` }, { name: topic.title, path: seo.path }]), buildItemListJsonLd(`${topic.title} in ${country.name}`, ranked.slice(0, 10).map((b) => ({ name: b.name, path: `/brokers/${b.slug}` }))), buildFAQPageJsonLd(faqs.map((f: any) => ({ question: f.q, answer: f.a })))] : undefined);

  if (loading || !country || !topic || !doc) return missing ? <Missing /> : <Loading />;
  const eligibleCount = ranked.length;
  const year = new Date().getFullYear();
  return <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6"><nav aria-label="Breadcrumb" className="mb-5 flex flex-wrap items-center gap-1.5 text-xs font-medium text-slate-400"><Link to="/">Home</Link><span>/</span><Link to={`/${country.slug}`}>{country.name}</Link><span>/</span><span className="text-ink-900">{topic.title}</span></nav><header className="relative overflow-hidden rounded-3xl bg-ink-950 p-7 sm:p-10"><div className="absolute inset-0 bg-grid-dark"/><div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-emerald-500/20 blur-[110px]"/><div className="relative"><div className="flex items-center gap-3 text-sm font-semibold text-emerald-300"><span className="text-3xl">{country.flag}</span>{country.name}</div><h1 className="mt-5 max-w-4xl font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">{topic.title} in {country.name} <span className="text-slate-500">({year})</span></h1><div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-400"><Monogram name={reviewer.penName} color={reviewer.color} size={20}/><span>Reviewed by <Link to={`/authors#${reviewer.slug}`} className="font-semibold text-slate-200">{reviewer.penName}</Link>, {reviewer.role}</span>{doc.updated_at && <><span>·</span><span>Updated {new Date(doc.updated_at).toISOString().slice(0,10)}</span></>}</div>{topicIntro(topic, country.name).map((p, i) => <p key={i} className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-400 sm:text-[15px]">{p}</p>)}<div className="mt-6 flex flex-wrap gap-3"><Link to="/quiz" className="inline-flex items-center gap-2 rounded-xl bg-emerald-400 px-4 py-2.5 text-sm font-bold text-ink-950 hover:bg-emerald-300"><Sparkles size={16}/> Find my best broker</Link><a href="#comparison" className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2.5 text-sm font-bold text-white">Compare brokers <ArrowRight size={15}/></a></div></div></header><section className="mt-8 grid gap-3 sm:grid-cols-3"><div className="rounded-2xl border border-line bg-white p-4"><p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Country</p><p className="mt-1 font-bold text-ink-900">{country.name}</p></div><div className="rounded-2xl border border-line bg-white p-4"><p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Qualified brokers</p><p className="mt-1 font-bold text-ink-900">{eligibleCount}</p></div><div className="rounded-2xl border border-line bg-white p-4"><p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">PipRank approach</p><p className="mt-1 font-bold text-ink-900">Country-specific recommendations</p></div></section><section id="comparison" aria-labelledby="comparison-title" className="mt-10"><div><p className="text-xs font-bold uppercase tracking-widest text-emerald-700">PipRank recommendations</p><h2 id="comparison-title" className="mt-1 font-display text-2xl font-bold text-ink-950">Best {topic.shortTitle} brokers in {country.name}</h2><p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-500">These recommendations are restricted to brokers in PipRank's current {country.name} recommendation set and then filtered for this trading need. Confirm current availability and terms before opening an account.</p></div>{ranked.length ? <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">{ranked.slice(0,8).map((broker,i) => <Reveal key={broker.slug} delay={Math.min(i,5)*0.05}><BrokerCard broker={broker} rank={i+1} countrySlug={country.slug} note={topicNote(topic,broker)}/></Reveal>)}</div> : <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">PipRank does not currently have enough country-specific broker data to make a reliable recommendation for this category. We will not substitute a global broker list.</div>}</section>{Array.isArray(doc.blocks) && doc.blocks.length ? <section className="mt-10" aria-label="Additional editorial content"><PageBlocksRenderer blocks={doc.blocks as any} brokers={brokers} intent={topic.slug} countrySlug={country.slug} className="piprank-rich-content space-y-8"/></section> : doc.html ? <section className="mt-10 rounded-2xl border border-line bg-white p-6 sm:p-8"><div className="piprank-rich-content" dangerouslySetInnerHTML={{ __html: doc.html }}/></section> : null}<section className="mt-10 rounded-2xl border border-line bg-white p-6"><h2 className="font-display text-xl font-bold text-ink-950">How PipRank evaluates this category</h2><ul className="mt-4 space-y-3 text-sm leading-6 text-slate-600"><li className="flex gap-2"><Check size={17} className="mt-0.5 shrink-0 text-emerald-600"/>Country-specific broker recommendations are used instead of a generic global list.</li><li className="flex gap-2"><Check size={17} className="mt-0.5 shrink-0 text-emerald-600"/>The page filters brokers for the specific trading need represented by this URL.</li><li className="flex gap-2"><Check size={17} className="mt-0.5 shrink-0 text-emerald-600"/>Costs, platform support, account features and broker quality are considered where the data supports them.</li><li className="flex gap-2"><Check size={17} className="mt-0.5 shrink-0 text-emerald-600"/>Country availability and broker terms should always be confirmed before depositing funds.</li></ul></section><section className="mt-10 space-y-4">{faqs.map((f:any) => <details key={f.q} className="rounded-2xl border border-line bg-white p-5"><summary className="cursor-pointer font-bold text-ink-900">{f.q}</summary><p className="mt-3 text-sm leading-7 text-slate-600">{f.a}</p></details>)}</section>{Array.isArray(pageSettings.internalLinks) && pageSettings.internalLinks.length > 0 && <section className="mt-10 rounded-2xl border border-line bg-white p-6"><p className="text-xs font-bold uppercase tracking-widest text-emerald-700">Related pages</p><div className="mt-3 grid gap-2 sm:grid-cols-2">{pageSettings.internalLinks.map((link:any,i:number) => <Link key={i} to={link.href} className="rounded-xl border border-line px-4 py-3 text-sm font-semibold text-ink-900 hover:border-emerald-300 hover:bg-emerald-50">{link.label}</Link>)}</div></section>}<section className="mt-10 rounded-3xl bg-ink-950 p-7 text-white sm:p-9"><p className="text-xs font-bold uppercase tracking-widest text-emerald-300">Continue your research</p><h2 className="mt-2 font-display text-2xl font-bold">Compare more forex brokers in {country.name}</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">Explore the main {country.name} broker page or tell PipRank what you need and get a personalized match.</p><div className="mt-5 flex flex-wrap gap-3"><Link to={`/${country.slug}`} className="rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-ink-950">View all {country.name} brokers</Link><Link to="/quiz" className="rounded-xl border border-white/15 px-4 py-2.5 text-sm font-bold">Find my broker <ArrowRight size={15}/></Link></div></section></div>;
}

export default function ContentRenderer({ route }: Props) {
  switch (route.type) {
    case 'guide': return route.path === '/guides' ? <GuideIndex /> : <GuideDetailView route={route} />;
    case 'country-guide': return <CountryGuideView route={route} />;
    case 'country-topic': return <CountryTopicView route={route} />;
    default: return <NotFound />;
  }
}
