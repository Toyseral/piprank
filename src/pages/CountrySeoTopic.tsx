import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowRight, Check, Sparkles } from 'lucide-react';
import type { Broker, CountryPage, ContentDocument, LocalizedSeoPage } from '../lib/types';
import { fetchBrokers, fetchCountry, fetchContentDocument, fetchLocalizedSeoPagesForCountry } from '../lib/api';
import { useSEO } from '../hooks/useSEO';
import { buildBreadcrumbJsonLd, buildFAQPageJsonLd, buildItemListJsonLd, buildWebPageJsonLd, absoluteUrl } from '../lib/seo';
import { getCountrySeoTopic, rankCountryTopicBrokers, topicFaq, topicNote, topicMeta, topicIntro } from '../data/countrySeoTopics';
import BrokerCard from '../components/BrokerCard';
import Monogram from '../components/Monogram';
import { blocksToHtml, hasVisualContent } from '../components/PageBuilder';
import Reveal from '../components/Reveal';
import NotFound from './NotFound';
import { track } from '../lib/track';
import { reviewerFor } from '../lib/team';
import { englishHreflangForCountry } from '../lib/localization';

function rankBrokers(topic: Parameters<typeof rankCountryTopicBrokers>[2], brokers: Broker[], country: CountryPage): Broker[] {
  return rankCountryTopicBrokers(brokers, country, topic);
}


export default function CountrySeoTopic() {
  const { countrySlug, topicSlug } = useParams<{ countrySlug: string; topicSlug: string }>();
  const topic = topicSlug ? getCountrySeoTopic(topicSlug) : null;
  const [country, setCountry] = useState<CountryPage | null>(null);
  const [brokers, setBrokers] = useState<Broker[]>([]);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [richContent, setRichContent] = useState<ContentDocument | null>(null);
  const [localizedAlts, setLocalizedAlts] = useState<LocalizedSeoPage[]>([]);

  useEffect(() => {
    if (!countrySlug || !topic) {
      setMissing(true);
      setLoading(false);
      return;
    }
    setLoading(true);
    Promise.all([fetchCountry(countrySlug), fetchBrokers(), fetchContentDocument(`country-topic:${countrySlug}:${topic.slug}`)])
      .then(([c, b, content]) => {
        setCountry(c);
        setBrokers(b);
        setRichContent(content?.published ? content : null);
        track('country_topic_view', { country: c.slug, topic: topic.slug });
      })
      .catch(() => setMissing(true))
      .finally(() => setLoading(false));
  }, [countrySlug, topic?.slug]);

  const pageSettings = (richContent?.settings ?? {}) as Record<string, any>;
  const ranked = useMemo(() => {
    if (!country || !topic) return [];
    const base = rankBrokers(topic, brokers, country);
    const excluded = new Set(Array.isArray(pageSettings.excludedBrokerSlugs) ? pageSettings.excludedBrokerSlugs : []);
    const filtered = base.filter(b => !excluded.has(b.slug));
    if (pageSettings.rankingMode === 'manual' && Array.isArray(pageSettings.pinnedBrokerSlugs)) {
      const order = new Map(pageSettings.pinnedBrokerSlugs.map((slug: string, i: number) => [slug, i]));
      return [...filtered].sort((a,b) => (order.has(a.slug)?Number(order.get(a.slug)):9999) - (order.has(b.slug)?Number(order.get(b.slug)):9999));
    }
    return filtered;
  }, [country, brokers, topic, richContent]);

  const seo = country && topic
    ? {
        title: richContent?.seo_title || topicMeta(topic, country.name).metaTitle,
        description: richContent?.seo_description || topicMeta(topic, country.name).description,
        path: `/${country.slug}/${topic.slug}`,
        type: 'website' as const,
        alternates: [
          { hreflang: englishHreflangForCountry(country.slug), path: `/${country.slug}/${topic.slug}` },
          { hreflang: 'x-default', path: `/${country.slug}/${topic.slug}` },
          ...localizedAlts
            .filter((r) => r.url_prefix && r.slug)
            .map((r) => ({
              hreflang: r.locale || r.language_code || 'und',
              path: `/${country.slug}/${r.url_prefix}/${r.slug}`,
            })),
        ],
      }
    : null;

  const faqs = country && topic ? (Array.isArray(pageSettings.faqs) && pageSettings.faqs.length ? pageSettings.faqs : topicFaq(topic, country.name)) : [];
  const reviewer = useMemo(() => reviewerFor(`${countrySlug ?? ''}-${topic?.slug ?? ''}`), [countrySlug, topic?.slug]);

  useEffect(() => {
    if (!countrySlug || !topic) return;
    fetchLocalizedSeoPagesForCountry(countrySlug)
      .then((rows) => {
        const list = Array.isArray(rows) ? rows : [];
        const byKey = list.filter((r) => r.published && r.indexable && r.topic_key === topic.key);
        setLocalizedAlts(byKey);
      })
      .catch(() => setLocalizedAlts([]));
  }, [countrySlug, topic?.key]);


  useSEO(
    seo,
    seo && country && topic
      ? [
          { ...buildWebPageJsonLd(seo), author: { '@type': 'Person', name: reviewer.penName, jobTitle: reviewer.role, url: absoluteUrl(`/authors#${reviewer.slug}`) } },
          buildBreadcrumbJsonLd([
            { name: 'Home', path: '/' },
            { name: country.name, path: `/${country.slug}` },
            { name: topic.title, path: seo.path },
          ]),
          buildItemListJsonLd(
            `${topic.title} in ${country.name}`,
            ranked.slice(0, 10).map((b) => ({ name: b.name, path: `/brokers/${b.slug}` })),
          ),
          buildFAQPageJsonLd(faqs.map((f) => ({ question: f.q, answer: f.a }))),
        ]
      : undefined,
  );

  if (missing) return <NotFound />;
  if (loading || !country || !topic) {
    return <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6"><div className="h-52 animate-pulse rounded-3xl border border-line bg-white" /><div className="mt-8 h-64 animate-pulse rounded-3xl border border-line bg-white" /></div>;
  }

  const eligibleCount = ranked.length;
  const year = new Date().getFullYear();

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <nav aria-label="Breadcrumb" className="mb-5 flex flex-wrap items-center gap-1.5 text-xs font-medium text-slate-400">
        <Link to="/" className="hover:text-ink-900">Home</Link><span>/</span>
        <Link to={`/${country.slug}`} className="hover:text-ink-900">{country.name}</Link><span>/</span>
        <span className="text-ink-900">{topic.title}</span>
      </nav>

      <header className="relative overflow-hidden rounded-3xl bg-ink-950 p-7 sm:p-10">
        <div className="absolute inset-0 bg-grid-dark" />
        <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-emerald-500/20 blur-[110px]" />
        <div className="relative">
          <div className="flex items-center gap-3 text-sm font-semibold text-emerald-300"><span className="text-3xl">{country.flag}</span>{country.name}</div>
          <h1 className="mt-5 max-w-4xl font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">{topic.title} in {country.name} <span className="text-slate-500">({year})</span></h1>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-400">
            <Monogram name={reviewer.penName} color={reviewer.color} size={20} />
            <span>
              Reviewed by{' '}
              <Link to={`/authors#${reviewer.slug}`} className="font-semibold text-slate-200 hover:text-emerald-300">
                {reviewer.penName}
              </Link>
              , {reviewer.role}
            </span>
            {richContent?.updated_at && (
              <>
                <span aria-hidden="true">·</span>
                <span>Updated {new Date(richContent.updated_at).toISOString().slice(0, 10)}</span>
              </>
            )}
          </div>
          {topicIntro(topic, country.name).map((p, i) => <p key={i} className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-400 sm:text-[15px]">{p}</p>)}
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/quiz" className="inline-flex items-center gap-2 rounded-xl bg-emerald-400 px-4 py-2.5 text-sm font-bold text-ink-950 hover:bg-emerald-300"><Sparkles size={16} /> Find my best broker</Link>
            <a href="#comparison" className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2.5 text-sm font-bold text-white hover:bg-white/10">Compare brokers <ArrowRight size={15} /></a>
          </div>
        </div>
      </header>

      <section className="mt-8 grid gap-3 sm:grid-cols-3" aria-label="Country-specific page facts">
        <div className="rounded-2xl border border-line bg-white p-4"><p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Country</p><p className="mt-1 font-bold text-ink-900">{country.name}</p></div>
        <div className="rounded-2xl border border-line bg-white p-4"><p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Qualified brokers</p><p className="mt-1 font-bold text-ink-900">{eligibleCount}</p></div>
        <div className="rounded-2xl border border-line bg-white p-4"><p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">PipRank approach</p><p className="mt-1 font-bold text-ink-900">Country-specific recommendations</p></div>
      </section>

      <section id="comparison" aria-labelledby="comparison-title" className="mt-10">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-emerald-700">PipRank recommendations</p>
          <h2 id="comparison-title" className="mt-1 font-display text-2xl font-bold text-ink-950">Best {topic.shortTitle} brokers in {country.name}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-500">These recommendations are restricted to brokers in PipRank's current {country.name} recommendation set and then filtered for this trading need. Confirm current availability and terms before opening an account.</p>
        </div>

        {ranked.length ? (
          <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
            {ranked.slice(0, 8).map((broker, i) => (
              <Reveal key={broker.slug} delay={Math.min(i, 5) * 0.05}>
                <BrokerCard broker={broker} rank={i + 1} countrySlug={country.slug} note={topicNote(topic, broker)} />
              </Reveal>
            ))}
          </div>
        ) : (
          <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">PipRank does not currently have enough country-specific broker data to make a reliable recommendation for this category. We will not substitute a global broker list.</div>
        )}
      </section>

      {richContent?.published && richContent.html && (
        <section className="mt-10 rounded-2xl border border-line bg-white p-6 sm:p-8" aria-label="Additional editorial content">
          {richContent.title && <h2 className="font-display text-2xl font-bold text-ink-950">{richContent.title}</h2>}
          {richContent.excerpt && <p className="mt-2 text-sm leading-6 text-slate-500">{richContent.excerpt}</p>}
          <div className="piprank-rich-content mt-6" dangerouslySetInnerHTML={{ __html: (hasVisualContent(richContent.blocks) ? blocksToHtml(richContent.blocks as any) : richContent.html) }} />
        </section>
      )}

      <section className="mt-10 rounded-2xl border border-line bg-white p-6">
        <h2 className="font-display text-xl font-bold text-ink-950">How PipRank evaluates this category</h2>
        <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
          <li className="flex gap-2"><Check size={17} className="mt-0.5 shrink-0 text-emerald-600" /> Country-specific broker recommendations are used instead of a generic global list.</li>
          <li className="flex gap-2"><Check size={17} className="mt-0.5 shrink-0 text-emerald-600" /> The page filters brokers for the specific trading need represented by this URL.</li>
          <li className="flex gap-2"><Check size={17} className="mt-0.5 shrink-0 text-emerald-600" /> Costs, platform support, account features and broker quality are considered where the data supports them.</li>
          <li className="flex gap-2"><Check size={17} className="mt-0.5 shrink-0 text-emerald-600" /> Country availability and broker terms should always be confirmed before depositing funds.</li>
        </ul>
      </section>

      <section className="mt-10 space-y-4">
        {faqs.map((f) => <details key={f.q} className="rounded-2xl border border-line bg-white p-5"><summary className="cursor-pointer font-bold text-ink-900">{f.q}</summary><p className="mt-3 text-sm leading-7 text-slate-600">{f.a}</p></details>)}
      </section>

      {Array.isArray(pageSettings.internalLinks) && pageSettings.internalLinks.length > 0 && (
        <section className="mt-10 rounded-2xl border border-line bg-white p-6" aria-label="Related PipRank pages">
          <p className="text-xs font-bold uppercase tracking-widest text-emerald-700">Related pages</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">{pageSettings.internalLinks.map((link:any,i:number)=><Link key={i} to={link.href} className="rounded-xl border border-line px-4 py-3 text-sm font-semibold text-ink-900 hover:border-emerald-300 hover:bg-emerald-50">{link.label}</Link>)}</div>
        </section>
      )}

      <section className="mt-10 rounded-3xl bg-ink-950 p-7 text-white sm:p-9">
        <p className="text-xs font-bold uppercase tracking-widest text-emerald-300">Continue your research</p>
        <h2 className="mt-2 font-display text-2xl font-bold">Compare more forex brokers in {country.name}</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">Explore the main {country.name} broker page or tell PipRank what you need and get a personalized match.</p>
        <div className="mt-5 flex flex-wrap gap-3"><Link to={`/${country.slug}`} className="rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-ink-950">View all {country.name} brokers</Link><Link to="/quiz" className="rounded-xl border border-white/15 px-4 py-2.5 text-sm font-bold">Find my broker</Link></div>
      </section>
    </div>
  );
}
