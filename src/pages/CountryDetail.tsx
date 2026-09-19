import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, BookOpen, CheckCircle2, ChevronRight, ExternalLink, Globe2, Scale, ShieldCheck } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import type { ContentDocument, CountryBrokerRanking } from '../lib/types';
import { fetchCountryHubPageModel, type CountryHubPageModel } from '../lib/countryHubModel';
import PageBlocksRenderer from '../components/PageBlocksRenderer';
import BrokerCard from '../components/BrokerCard';
import CountryBrokerMatcher from '../components/CountryBrokerMatcher';
import { ButtonLink } from '../components/Button';
import { useSEO } from '../hooks/useSEO';
import { buildBreadcrumbJsonLd, buildFAQPageJsonLd, buildItemListJsonLd, countrySeo } from '../lib/seo';
import NotFound from './NotFound';

function documentPath(doc: ContentDocument, countrySlug: string) {
  if (doc.content_type === 'country-guide') return `/${countrySlug}/guides/${doc.slug}`;
  if (doc.content_type === 'country-best-for') return `/${countrySlug}/${doc.slug}`;
  if (doc.content_type === 'localized-guide') return `/${countrySlug}/${String(doc.settings?.locale || doc.settings?.language || 'en')}/guides/${doc.slug}`;
  if (doc.content_type === 'localized-best-for') return `/${countrySlug}/${String(doc.settings?.locale || doc.settings?.language || 'en')}/${doc.slug}`;
  return `/${countrySlug}`;
}

function localeOf(doc: ContentDocument) {
  return String(doc.settings?.locale || doc.settings?.language || '').trim().toLowerCase();
}

function SectionHeading({ eyebrow, title, copy }: { eyebrow: string; title: string; copy?: string }) {
  return <div className="max-w-3xl"><p className="text-[10px] font-bold uppercase tracking-[0.22em] text-emerald-700">{eyebrow}</p><h2 className="mt-2 font-display text-2xl font-bold tracking-tight text-ink-950 sm:text-3xl">{title}</h2>{copy && <p className="mt-3 text-sm leading-7 text-slate-600 sm:text-base">{copy}</p>}</div>;
}

function BestForCard({ doc, countrySlug }: { doc: ContentDocument; countrySlug: string }) {
  return <Link to={documentPath(doc, countrySlug)} className="group rounded-2xl border border-line bg-white p-5 transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-soft"><div className="flex items-center justify-between gap-3"><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-700">Best for</span><ChevronRight size={15} className="text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-emerald-600" /></div><h3 className="mt-4 font-display text-lg font-bold text-ink-950 group-hover:text-emerald-700">{doc.title}</h3>{doc.excerpt && <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-500">{doc.excerpt}</p>}</Link>;
}

function GuideCard({ doc, countrySlug }: { doc: ContentDocument; countrySlug: string }) {
  return <Link to={documentPath(doc, countrySlug)} className="group rounded-2xl border border-line bg-paper p-5 transition hover:-translate-y-0.5 hover:border-emerald-300 hover:bg-white hover:shadow-soft"><BookOpen size={18} className="text-emerald-700" /><h3 className="mt-4 font-display text-lg font-bold text-ink-950 group-hover:text-emerald-700">{doc.title}</h3>{doc.excerpt && <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-500">{doc.excerpt}</p>}<span className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-emerald-700">Read guide <ArrowRight size={13} /></span></Link>;
}

function BrokerRanking({ ranked, countrySlug }: { ranked: CountryBrokerRanking[]; countrySlug: string }) {
  return <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{ranked.slice(0, 9).map((row, index) => row.broker ? <BrokerCard key={row.broker.id} broker={row.broker} rank={index + 1} countrySlug={countrySlug} note={row.editorial_note || undefined} /> : null)}</div>;
}

export default function CountryDetail() {
  const { slug = '' } = useParams<{ slug: string }>();
  const [model, setModel] = useState<CountryHubPageModel | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { if (!slug) return; setLoading(true); fetchCountryHubPageModel(slug).then(setModel).catch(() => setModel(null)).finally(() => setLoading(false)); }, [slug]);

  const country = model?.country ?? null;
  const document = model?.countryDocument ?? null;
  const brokers = model?.availableBrokers ?? [];
  const ranked = model?.topBrokers ?? [];
  const faqs = model?.faqs ?? [];
  const guides = model?.countryGuides ?? [];
  const bestFor = model?.countryBestFor ?? [];
  const localizedGuides = model?.localizedGuides ?? [];
  const localizedBestFor = model?.localizedBestFor ?? [];

  const seo = country && document ? countrySeo({ name: country.name, slug: country.slug, seo_title: document.seo_title, seo_description: document.seo_description }, `/${country.slug}`) : null;
  useSEO(seo, seo && country ? [
    buildBreadcrumbJsonLd([{ name: 'Home', path: '/' }, { name: 'Countries', path: '/countries' }, { name: country.name, path: `/${country.slug}` }]),
    buildItemListJsonLd(`Forex brokers available in ${country.name}`, ranked.slice(0, 9).map((r) => ({ name: r.broker?.name || '', path: `/brokers/${r.broker?.slug || ''}` }))),
    ...(faqs.length ? [buildFAQPageJsonLd(faqs.map((faq) => ({ question: faq.q, answer: faq.a })))] : []),
  ] : undefined);

  const comparisonPairs = useMemo(() => {
    const slugs = ranked.slice(0, 4).map((r) => r.broker?.slug).filter((v): v is string => Boolean(v));
    return slugs.flatMap((a, i) => slugs.slice(i + 1).map((b) => ({ a, b }))).slice(0, 3);
  }, [ranked]);

  const whatMatters = useMemo(() => {
    const configured = document?.settings?.what_matters;
    if (Array.isArray(configured)) return configured.filter((x: any) => x && typeof x.title === 'string').slice(0, 8);
    return [
      { title: 'Regulation', description: `Check which legal entity and regulatory protections apply to residents of ${country?.name ?? 'this country'}.` },
      { title: 'Deposits & withdrawals', description: 'Funding rails, processing times and available payment methods can affect the practical cost of trading.' },
      { title: 'Trading costs', description: 'Compare spreads, commissions and other account fees rather than looking at a headline spread alone.' },
      { title: 'Platforms', description: 'Make sure the broker supports the platform, automation and tools you actually use.' },
      { title: 'Leverage', description: 'Maximum leverage and account protections can differ by country and legal entity.' },
      { title: 'Local availability', description: 'A broker can be available globally while offering different products or conditions to local residents.' },
    ];
  }, [document, country]);

  if (loading) return <div className="mx-auto max-w-7xl px-4 py-24 text-center text-sm text-slate-500">Loading country…</div>;
  if (!country || !document) return <NotFound />;

  const comparisonPath = model?.comparisonPath ?? '/compare';
  const methodologyPath = model?.methodologyPath ?? '/methodology';
  const hasLocalized = localizedGuides.length > 0 || localizedBestFor.length > 0;

  return (
    <main className="bg-paper">
      <div className="border-b border-line bg-white"><div className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-4 text-xs text-slate-400 sm:px-6"><Link to="/" className="hover:text-ink-900">Home</Link><span>/</span><Link to="/countries" className="hover:text-ink-900">Countries</Link><span>/</span><span className="font-semibold text-ink-900">{country.name}</span></div></div>

      <section className="overflow-hidden border-b border-ink-900/10 bg-ink-950 text-white">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:py-16">
          <div className="flex flex-wrap items-center gap-3 text-xs font-bold uppercase tracking-[0.2em] text-emerald-300"><span>{country.flag}</span><span>{country.name} forex brokers</span><span className="rounded-full border border-white/10 px-2.5 py-1 text-[9px] tracking-[0.14em] text-slate-300">Country hub</span></div>
          <h1 className="mt-4 max-w-4xl font-display text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">Find the best forex broker in {country.name} for you</h1>
          {document.excerpt && <p className="mt-5 max-w-3xl text-base leading-7 text-slate-300 sm:text-lg">{document.excerpt}</p>}
          <div className="mt-7 flex flex-col gap-3 sm:flex-row"><a href="#matcher" className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 text-sm font-bold text-white transition hover:bg-emerald-400">Match Me with a Broker <ArrowRight size={16}/></a><Link to={comparisonPath} className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/10">Compare Brokers</Link></div>
          <div className="mt-8 grid max-w-2xl grid-cols-3 gap-3 border-t border-white/10 pt-6"><div><p className="text-2xl font-display font-bold">{ranked.length}</p><p className="mt-1 text-[10px] uppercase tracking-[0.16em] text-slate-400">Ranked brokers</p></div><div><p className="text-2xl font-display font-bold">{bestFor.length}</p><p className="mt-1 text-[10px] uppercase tracking-[0.16em] text-slate-400">Trading goals</p></div><div><p className="text-2xl font-display font-bold">{guides.length}</p><p className="mt-1 text-[10px] uppercase tracking-[0.16em] text-slate-400">Guides</p></div></div>
        </div>
      </section>

      <section id="matcher" className="scroll-mt-20 border-b border-line bg-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-start lg:py-14">
          <div className="lg:sticky lg:top-24"><p className="text-[10px] font-bold uppercase tracking-[0.22em] text-emerald-700">Find your broker match</p><h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-ink-950">Find a forex broker that fits your needs</h2><p className="mt-4 text-sm leading-7 text-slate-600">We already know your country. Answer a few questions about experience, trading style, platform and priorities, and the matcher will narrow the {country.name} broker pool.</p><ul className="mt-5 space-y-2 text-sm text-slate-600"><li className="flex gap-2"><CheckCircle2 size={16} className="mt-0.5 text-emerald-600"/> Country-specific broker availability</li><li className="flex gap-2"><CheckCircle2 size={16} className="mt-0.5 text-emerald-600"/> Trading style and platform fit</li><li className="flex gap-2"><CheckCircle2 size={16} className="mt-0.5 text-emerald-600"/> Costs, features and personal priorities</li></ul></div>
          <div className="rounded-3xl border border-line bg-paper p-5 shadow-soft sm:p-7"><CountryBrokerMatcher countrySlug={country.slug} countryName={country.name} countryFlag={country.flag} /></div>
        </div>
      </section>

      <nav className="sticky top-0 z-20 border-b border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl gap-5 overflow-x-auto px-4 py-3 text-xs font-bold text-slate-500 sm:px-6">
          <a href="#brokers" className="whitespace-nowrap hover:text-emerald-700">Top Brokers</a><a href="#matters" className="whitespace-nowrap hover:text-emerald-700">What Matters</a><a href="#best-for" className="whitespace-nowrap hover:text-emerald-700">Best For</a><a href="#guides" className="whitespace-nowrap hover:text-emerald-700">Guides</a>{hasLocalized && <a href="#localized" className="whitespace-nowrap hover:text-emerald-700">Localised</a>}<a href="#compare" className="whitespace-nowrap hover:text-emerald-700">Compare</a><a href="#faq" className="whitespace-nowrap hover:text-emerald-700">FAQ</a><Link to={methodologyPath} className="whitespace-nowrap hover:text-emerald-700">Methodology</Link>
        </div>
      </nav>

      {(document.blocks?.length > 0 || document.html?.trim()) && <section className="border-b border-line bg-white"><div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:py-14">{document.blocks?.length > 0 ? <PageBlocksRenderer blocks={document.blocks.filter((block: any) => !['broker_card','broker_grid','comparison_table'].includes(block?.type)) as any} brokers={brokers} countrySlug={country.slug} className="piprank-rich-content" /> : <div className="piprank-rich-content prose prose-slate max-w-none text-[15px] leading-7" dangerouslySetInnerHTML={{ __html: document.html || '' }} />}</div></section>}

      {ranked.length > 0 && <section id="brokers" className="scroll-mt-20 border-b border-line bg-paper"><div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:py-16"><div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between"><SectionHeading eyebrow="Country ranking" title={`Top forex brokers available in ${country.name}`} copy="This shortlist uses the country-specific broker pool and canonical country ranking inputs. Open a review or compare the options before you choose."/><Link to="/brokers" className="inline-flex shrink-0 items-center gap-1.5 text-sm font-bold text-emerald-700">View all broker reviews <ArrowRight size={14}/></Link></div><div className="mt-8"><BrokerRanking ranked={ranked} countrySlug={country.slug}/></div><div className="mt-6 rounded-2xl border border-line bg-white p-5"><p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">Why these brokers?</p><p className="mt-2 text-sm leading-6 text-slate-600">The ranking starts with brokers available to {country.name} residents and then applies the country × intent ranking system. Availability and ranking inputs can change, so check the current broker terms before opening an account.</p></div></div></section>}

      <section id="matters" className="scroll-mt-20 border-b border-line bg-white"><div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:py-16"><SectionHeading eyebrow="Country-specific decision factors" title={`What matters for traders in ${country.name}`} copy={`The right broker depends on more than a global score. These are the country-specific factors to check before opening an account in ${country.name}.`}/><div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{whatMatters.map((item: any) => <div key={item.title} className="rounded-2xl border border-line bg-paper p-5"><Globe2 size={18} className="text-emerald-700"/><h3 className="mt-3 font-display text-lg font-bold text-ink-950">{item.title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{item.description}</p></div>)}</div></div></section>

      {bestFor.length > 0 && <section id="best-for" className="scroll-mt-20 border-b border-line bg-paper"><div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:py-16"><SectionHeading eyebrow="Choose by trading goal" title={`Find a forex broker in ${country.name} for what matters to you`} copy="Country Best-For pages are canonical content owners. This hub only aggregates and links to them."/><div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{bestFor.slice(0,9).map((doc) => <BestForCard key={doc.content_key} doc={doc} countrySlug={country.slug}/>)}</div></div></section>}

      {guides.length > 0 && <section id="guides" className="scroll-mt-20 border-b border-line bg-paper"><div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:py-16"><SectionHeading eyebrow="Country guides" title={`Forex broker guides for ${country.name}`} copy="These are informational guides, separate from Best-For ownership and the country ranking engine."/><div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">{guides.slice(0,9).map((doc) => <GuideCard key={doc.content_key} doc={doc} countrySlug={country.slug}/>)}</div><Link to={`/${country.slug}/guides`} className="mt-7 inline-flex items-center gap-2 rounded-xl bg-ink-950 px-5 py-3 text-sm font-bold text-white">Explore all {country.name} guides <ArrowRight size={15}/></Link></div></section>}

      {hasLocalized && <section id="localized" className="scroll-mt-20 border-b border-line bg-white"><div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:py-16"><SectionHeading eyebrow="Localised content" title={`Forex content for traders in ${country.name}`} copy="Where localized content exists, it is surfaced here without creating a duplicate ownership layer."/><div className="mt-8 grid gap-8 lg:grid-cols-2">{localizedBestFor.length > 0 && <div><h3 className="font-display text-xl font-bold text-ink-950">Best For</h3><div className="mt-4 grid gap-3 sm:grid-cols-2">{localizedBestFor.slice(0,6).map((doc) => <BestForCard key={doc.content_key} doc={doc} countrySlug={country.slug}/>)}</div></div>}{localizedGuides.length > 0 && <div><h3 className="font-display text-xl font-bold text-ink-950">Guides</h3><div className="mt-4 grid gap-3 sm:grid-cols-2">{localizedGuides.slice(0,6).map((doc) => <GuideCard key={doc.content_key} doc={doc} countrySlug={country.slug}/>)}</div></div>}</div></div></section>}

      <section id="compare" className="scroll-mt-20 border-b border-line bg-white"><div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:py-16"><SectionHeading eyebrow="Compare brokers" title={`Compare popular brokers in ${country.name}`} copy="Use head-to-head pages to inspect costs, platforms, execution, withdrawals and other documented metrics."/><div className="mt-7 grid gap-3 sm:grid-cols-3">{comparisonPairs.map(({a,b}) => <Link key={a+b} to={`/compare/${a}-vs-${b}`} className="group rounded-2xl border border-line bg-paper p-5 hover:border-emerald-300 hover:bg-white"><div className="flex items-center justify-between"><span className="text-sm font-bold text-ink-950">{a.replace(/-/g,' ')} <span className="text-slate-400">vs</span> {b.replace(/-/g,' ')}</span><ArrowRight size={15} className="text-emerald-700"/></div></Link>)}</div><Link to={comparisonPath} className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-emerald-700">Open the full comparison tool <Scale size={15}/></Link></div></section>

      {faqs.length > 0 && <section id="faq" className="scroll-mt-20 border-b border-line bg-paper"><div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:py-16"><SectionHeading eyebrow="Country FAQ" title={`Forex broker questions for ${country.name}`}/><div className="mt-8 overflow-hidden rounded-3xl border border-line bg-white">{faqs.map((faq) => <details key={faq.q} className="group border-b border-line px-5 py-5 last:border-b-0 sm:px-7"><summary className="flex cursor-pointer list-none items-center justify-between gap-6 font-display text-base font-bold text-ink-950"><span>{faq.q}</span><span className="text-xl font-normal text-slate-400 transition group-open:rotate-45">+</span></summary><p className="mt-3 pr-8 text-sm leading-7 text-slate-600">{faq.a}</p></details>)}</div></div></section>}

      <section id="methodology" className="scroll-mt-20 border-b border-line bg-white"><div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:py-16"><div className="grid gap-6 lg:grid-cols-3"><div className="rounded-2xl border border-line bg-paper p-6"><ShieldCheck size={20} className="text-emerald-700"/><h2 className="mt-4 font-display text-xl font-bold">How PipRank evaluates brokers</h2><p className="mt-2 text-sm leading-6 text-slate-600">We separate country eligibility, ranking inputs and editorial controls so the local shortlist can be inspected rather than treated as a black box.</p></div><div className="rounded-2xl border border-line bg-paper p-6"><CheckCircle2 size={20} className="text-emerald-700"/><h2 className="mt-4 font-display text-xl font-bold">Country availability</h2><p className="mt-2 text-sm leading-6 text-slate-600">Availability, legal entities, leverage and account conditions can differ by country. Always confirm current terms with the broker.</p></div><div className="rounded-2xl border border-line bg-paper p-6"><ExternalLink size={20} className="text-emerald-700"/><h2 className="mt-4 font-display text-xl font-bold">Affiliate transparency</h2><p className="mt-2 text-sm leading-6 text-slate-600">PipRank may earn compensation when users visit or sign up with certain brokers. This does not replace the underlying ranking and editorial rules.</p></div></div><Link to={methodologyPath} className="mt-7 inline-flex items-center gap-2 text-sm font-bold text-emerald-700">Read the full methodology <ArrowRight size={15}/></Link></div></section>

      <section className="bg-ink-950 text-white"><div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-12 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:py-16"><div><p className="text-[10px] font-bold uppercase tracking-[0.22em] text-emerald-300">Next step</p><h2 className="mt-2 font-display text-3xl font-bold sm:text-4xl">Want a shortlist based on your needs?</h2><p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">Use the country-specific matcher above or restart it with a different profile.</p></div><a href="#matcher" className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-400">Find My Broker <ArrowRight size={16}/></a></div></section>
    </main>
  );
}
