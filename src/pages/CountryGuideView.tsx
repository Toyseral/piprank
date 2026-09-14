import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Broker, ContentDocument, CountryPage, FAQ } from '../lib/types';
import { fetchBrokers, fetchCountry } from '../lib/api';
import { fetchPublishedContentDocument } from '../lib/canonicalContent';
import PageBlocksRenderer from '../components/PageBlocksRenderer';
import NewsletterForm from '../components/NewsletterForm';
import { buildBreadcrumbJsonLd, buildFAQPageJsonLd, buildWebPageJsonLd } from '../lib/seo';
import { useSEO } from '../hooks/useSEO';
import NotFound from './NotFound';

function settingsOf(doc: ContentDocument | null): Record<string, any> { return (doc?.settings ?? {}) as Record<string, any>; }
function faqsOf(doc: ContentDocument | null): FAQ[] { const faqs = settingsOf(doc).faqs; return Array.isArray(faqs) ? faqs.filter((x: any) => x?.q && x?.a) : []; }

export default function CountryGuideView({ countrySlug, slug, contentKey, document: initialDocument }: { countrySlug: string; slug: string; contentKey?: string; document?: ContentDocument | null }) {
  const [country, setCountry] = useState<CountryPage | null>(null);
  const [doc, setDoc] = useState<ContentDocument | null>(initialDocument ?? null);
  const [brokers, setBrokers] = useState<Broker[]>([]);
  const [loading, setLoading] = useState(!initialDocument);

  useEffect(() => {
    let active = true;
    Promise.all([
      fetchCountry(countrySlug),
      initialDocument ? Promise.resolve(initialDocument) : fetchPublishedContentDocument(contentKey || `country-guide:${countrySlug}:${slug}`),
      fetchBrokers(),
    ]).then(([c, d, b]) => {
      if (!active) return;
      setCountry(c);
      setDoc(d);
      setBrokers(b);
    }).catch(() => {
      if (active) { setCountry(null); setDoc(null); }
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [countrySlug, slug, contentKey, initialDocument]);

  const faqs = faqsOf(doc);
  const settings = settingsOf(doc);
  const seo = country && doc ? {
    title: doc.seo_title || doc.title,
    description: doc.seo_description || doc.excerpt,
    path: `/${country.slug}/guides/${slug}`,
    type: 'article' as const,
  } : null;

  useSEO(seo, seo && country && doc ? [
    buildWebPageJsonLd(seo),
    buildBreadcrumbJsonLd([
      { name: 'Home', path: '/' },
      { name: country.name, path: `/${country.slug}` },
      { name: doc.title, path: seo.path },
    ]),
    ...(faqs.length ? [buildFAQPageJsonLd(faqs.map((f) => ({ question: f.q, answer: f.a })))] : []),
  ] : undefined);

  if (loading) return <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6"><div className="h-80 animate-pulse rounded-3xl border border-line bg-white"/><div className="mt-8 h-96 animate-pulse rounded-3xl border border-line bg-white"/></div>;
  if (!country || !doc || !doc.published) return <NotFound />;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <nav aria-label="Breadcrumb" className="flex gap-1.5 text-xs text-slate-400">
        <Link to="/">Home</Link><span>/</span><Link to={`/${country.slug}`}>{country.name}</Link><span>/</span><span className="text-ink-900">{doc.title}</span>
      </nav>

      <header className="mt-6 rounded-3xl bg-ink-950 p-7 text-white sm:p-10">
        {settings.image && <img src={String(settings.image)} alt="" className="mb-7 aspect-[21/8] w-full rounded-2xl object-cover" />}
        <p className="text-xs font-bold uppercase tracking-widest text-emerald-300">PipRank Guide</p>
        <h1 className="mt-2 font-display text-3xl font-bold sm:text-4xl">{doc.title}</h1>
        {doc.excerpt && <p className="mt-3 max-w-3xl text-slate-300">{doc.excerpt}</p>}
      </header>

      <article className="mt-8 rounded-3xl border border-line bg-white p-6 sm:p-9">
        {Array.isArray(doc.blocks) && doc.blocks.length > 0
          ? <PageBlocksRenderer blocks={doc.blocks as any} brokers={brokers} countrySlug={country.slug} className="piprank-rich-content space-y-8" />
          : doc.html
            ? <div className="piprank-rich-content" dangerouslySetInnerHTML={{ __html: doc.html }} />
            : null}
        {faqs.length > 0 && <section className="mt-10 space-y-3"><h2 className="font-display text-xl font-bold">Frequently asked questions</h2>{faqs.map((f) => <details key={f.q} className="rounded-2xl border border-line p-5"><summary className="cursor-pointer font-bold">{f.q}</summary><p className="mt-3 text-sm leading-7 text-slate-600">{f.a}</p></details>)}</section>}
      </article>

      <div className="mt-10"><NewsletterForm /></div>
    </div>
  );
}
