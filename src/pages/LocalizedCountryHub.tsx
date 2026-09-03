import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { CountryPage, LocalizedSeoPage } from '../lib/types';
import { fetchCountry, fetchLocalizedSeoPagesForCountry } from '../lib/api';
import { countryHubPath, localizedCountryPath } from '../lib/countryRoutes';
import { useSEO } from '../hooks/useSEO';
import { buildBreadcrumbJsonLd, buildWebPageJsonLd } from '../lib/seo';
import NotFound from './NotFound';

export default function LocalizedCountryHub() {
  const { countrySlug = '', locale = '' } = useParams<{ countrySlug: string; locale: string }>();
  const [country, setCountry] = useState<CountryPage | null>(null);
  const [pages, setPages] = useState<LocalizedSeoPage[]>([]);
  const [missing, setMissing] = useState(false);
  useEffect(() => { Promise.all([fetchCountry(countrySlug), fetchLocalizedSeoPagesForCountry(countrySlug)]).then(([c, p]) => { const localized = p.filter((item) => item.published && item.indexable && (item.url_prefix === locale || item.language_code === locale)); if (!localized.length) setMissing(true); else { setCountry(c); setPages(localized); } }).catch(() => setMissing(true)); }, [countrySlug, locale]);
  const path = `/countries/${countrySlug}/${locale}`;
  const languageName = pages[0]?.language_native_name || pages[0]?.language_name || locale.toUpperCase();
  const seo = country ? { title: `Forex Trading in ${country.name} in ${languageName} | PipRank`, description: `Explore PipRank's ${languageName} forex broker guides for ${country.name}.`, path, lang: pages[0]?.locale || locale } : null;
  useSEO(seo, seo && country ? [buildWebPageJsonLd(seo), buildBreadcrumbJsonLd([{ name: 'Home', path: '/' }, { name: 'Countries', path: '/countries' }, { name: country.name, path: countryHubPath(country.slug) }, { name: languageName, path }])] : undefined);
  if (missing) return <NotFound />;
  if (!country) return <div className="mx-auto max-w-5xl px-4 py-12"><div className="h-56 animate-pulse rounded-3xl border border-line bg-white" /></div>;
  return <main className="mx-auto max-w-5xl px-4 py-12 sm:px-6" lang={locale}><nav className="mb-5 flex gap-1.5 text-xs text-slate-400"><Link to="/">Home</Link><span>/</span><Link to={countryHubPath(country.slug)}>{country.name}</Link></nav><header className="rounded-3xl bg-ink-950 p-7 text-white sm:p-10"><p className="text-sm font-bold text-emerald-300">{country.flag} {country.name}</p><h1 className="mt-3 font-display text-3xl font-bold sm:text-4xl">Forex Trading in {country.name}</h1><p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">{languageName} guides and broker comparisons for traders in {country.name}.</p></header><section className="mt-10"><h2 className="font-display text-2xl font-bold text-ink-950">{languageName} guides</h2><div className="mt-5 grid gap-4 sm:grid-cols-2">{pages.map((page) => <Link key={page.id} to={localizedCountryPath(country.slug, locale, page.slug)} className="rounded-2xl border border-line bg-white p-5 transition hover:border-emerald-300 hover:bg-emerald-50"><h3 className="font-display font-bold text-ink-900">{page.title}</h3><p className="mt-2 text-sm text-emerald-700">Read more →</p></Link>)}</div></section></main>;
}
