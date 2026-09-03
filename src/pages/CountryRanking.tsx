import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowRight, Check, Sparkles } from 'lucide-react';
import type { Broker, CountryPage } from '../lib/types';
import { fetchBrokers, fetchCountry } from '../lib/api';
import { countryHubPath } from '../lib/countryRoutes';
import { useSEO } from '../hooks/useSEO';
import { buildBreadcrumbJsonLd, buildFAQPageJsonLd, buildItemListJsonLd, buildWebPageJsonLd } from '../lib/seo';
import BrokerCard from '../components/BrokerCard';
import NotFound from './NotFound';

export default function CountryRanking() {
  const { countrySlug = '' } = useParams<{ countrySlug: string }>();
  const [country, setCountry] = useState<CountryPage | null>(null);
  const [brokers, setBrokers] = useState<Broker[]>([]);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    if (!countrySlug) return;
    Promise.all([fetchCountry(countrySlug), fetchBrokers()])
      .then(([c, all]) => { setCountry(c); setBrokers(all); })
      .catch(() => setMissing(true));
  }, [countrySlug]);

  const ranked = useMemo(() => country?.recommended
    .map((item) => ({ broker: brokers.find((broker) => broker.slug === item.slug), note: item.note }))
    .filter((item): item is { broker: Broker; note: string } => Boolean(item.broker)) ?? [], [country, brokers]);
  const path = `${countryHubPath(countrySlug)}/forex-brokers`;
  const faqs = country?.seo_faqs?.length ? country.seo_faqs : [];
  const seo = country ? {
    title: `Best Forex Brokers in ${country.name} 2026 | PipRank`,
    description: `Compare forex brokers available in ${country.name}, including ratings, minimum deposits, spreads, platforms and key trading advantages.`,
    path,
  } : null;
  useSEO(seo, seo && country ? [
    buildWebPageJsonLd(seo),
    buildBreadcrumbJsonLd([{ name: 'Home', path: '/' }, { name: 'Countries', path: '/countries' }, { name: country.name, path: countryHubPath(country.slug) }, { name: 'Forex Brokers', path }]),
    buildItemListJsonLd(`Best forex brokers in ${country.name}`, ranked.map(({ broker }) => ({ name: broker.name, path: `/brokers/${broker.slug}` }))),
    ...(faqs.length ? [buildFAQPageJsonLd(faqs.map((faq) => ({ question: faq.q, answer: faq.a })))] : []),
  ] : undefined);

  if (missing) return <NotFound />;
  if (!country) return <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6"><div className="h-64 animate-pulse rounded-3xl border border-line bg-white" /></div>;

  return <main className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
    <nav aria-label="Breadcrumb" className="mb-5 flex gap-1.5 text-xs font-medium text-slate-400"><Link to="/">Home</Link><span>/</span><Link to="/countries">Countries</Link><span>/</span><Link to={countryHubPath(country.slug)}>{country.name}</Link><span>/</span><span className="text-ink-900">Forex Brokers</span></nav>
    <header className="relative overflow-hidden rounded-3xl bg-ink-950 p-7 text-white sm:p-10"><div className="absolute inset-0 bg-grid-dark" /><div className="relative"><span className="text-5xl">{country.flag}</span><p className="mt-5 text-xs font-bold uppercase tracking-widest text-emerald-300">Country ranking</p><h1 className="mt-2 font-display text-3xl font-bold tracking-tight sm:text-4xl">Best Forex Brokers in {country.name} <span className="text-slate-500">(2026)</span></h1><p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300">Compare the brokers currently recommended for traders in {country.name}. Review the legal entity, current account terms and availability directly with each broker before funding an account.</p><Link to="/quiz" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-emerald-400 px-4 py-2.5 text-sm font-bold text-ink-950"><Sparkles size={16} /> Find my best broker</Link></div></header>
    <section className="mt-10" aria-labelledby="ranking"><p className="text-xs font-bold uppercase tracking-widest text-emerald-700">PipRank recommendations</p><h2 id="ranking" className="mt-1 font-display text-2xl font-bold text-ink-950">Compare Forex Brokers Available in {country.name}</h2><div className="mt-5 grid gap-5 lg:grid-cols-2">{ranked.map(({ broker, note }, index) => <BrokerCard key={broker.slug} broker={broker} rank={index + 1} note={note} countrySlug={country.slug} />)}</div></section>
    <section className="mt-10 rounded-3xl border border-line bg-white p-6 sm:p-8"><h2 className="font-display text-2xl font-bold text-ink-950">How we rank brokers</h2><div className="mt-4 grid gap-3 text-sm leading-6 text-slate-600 sm:grid-cols-3">{['Country availability and the entity serving local clients.', 'Trading costs, platforms and account requirements.', 'Trust signals, regulation and trader-fit factors.'].map((item) => <p key={item} className="flex gap-2"><Check className="shrink-0 text-emerald-600" size={18} />{item}</p>)}</div></section>
    <section className="mt-10 rounded-3xl bg-ink-950 p-7 text-white"><h2 className="font-display text-2xl font-bold">Explore Forex Trading in {country.name}</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">Read local trading guidance, payment considerations and regulation context before making a broker choice.</p><Link to={countryHubPath(country.slug)} className="mt-5 inline-flex items-center gap-2 font-bold text-emerald-300">Visit the {country.name} hub <ArrowRight size={16} /></Link></section>
  </main>;
}
