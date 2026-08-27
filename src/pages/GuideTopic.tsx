import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Compass } from 'lucide-react';
import type { CountryPage, ContentDocument } from '../lib/types';
import { fetchCountry, fetchContentDocument } from '../lib/api';
import { useSEO } from '../hooks/useSEO';
import { buildBreadcrumbJsonLd, buildFAQPageJsonLd, buildWebPageJsonLd, absoluteUrl } from '../lib/seo';
import { blocksToHtml } from '../components/PageBuilder';
import Monogram from '../components/Monogram';
import { ButtonLink } from '../components/Button';
import { reviewerFor } from '../lib/team';

/**
 * Generic country guide page. One route, one component, works for any
 * country — replaces the old MalaysiaTopic.tsx/GhanaTopic.tsx pattern,
 * where every new country needed its own hardcoded route, component and
 * static data file.
 *
 * Unlike the ranking-topic matrix (CountrySeoTopic.tsx), there is no
 * template fallback here: a guide is informational content that has to be
 * genuinely written for that country, so content_documents
 * (content_type: 'country-guide') is the only source of truth. If no
 * published document exists for this country+slug, the page 404s with a
 * real noindex — not a generic fallback pretending content exists.
 */
export default function GuideTopic() {
  const { countrySlug, slug } = useParams<{ countrySlug: string; slug: string }>();
  const [country, setCountry] = useState<CountryPage | null>(null);
  const [doc, setDoc] = useState<ContentDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    if (!countrySlug || !slug) {
      setMissing(true);
      setLoading(false);
      return;
    }
    setLoading(true);
    setMissing(false);
    Promise.all([fetchCountry(countrySlug), fetchContentDocument(`country-guide:${countrySlug}:${slug}`)])
      .then(([c, content]) => {
        if (!content || content.published === false || content.content_type !== 'country-guide') {
          setMissing(true);
          return;
        }
        setCountry(c);
        setDoc(content);
      })
      .catch(() => setMissing(true))
      .finally(() => setLoading(false));
  }, [countrySlug, slug]);

  const reviewer = reviewerFor(`${countrySlug ?? ''}-guide-${slug ?? ''}`);
  const settings = (doc?.settings ?? {}) as Record<string, unknown>;
  const faqs = Array.isArray(settings.faqs) ? (settings.faqs as { q: string; a: string }[]) : [];
  const internalLinks = Array.isArray(settings.internalLinks) ? (settings.internalLinks as { label: string; href: string }[]) : [];

  const seo = country && doc
    ? {
        title: doc.seo_title || doc.title,
        description: doc.seo_description || doc.excerpt,
        path: `/${country.slug}/guides/${doc.slug}`,
        type: 'article' as const,
      }
    : null;

  useSEO(
    missing ? { title: 'Guide not found | PipRank', description: 'This guide could not be found.', path: window.location.pathname, type: 'website', noindex: true } : seo,
    seo && country && doc
      ? [
          { ...buildWebPageJsonLd(seo), author: { '@type': 'Person', name: reviewer.penName, jobTitle: reviewer.role, url: absoluteUrl(`/authors#${reviewer.slug}`) } },
          buildBreadcrumbJsonLd([
            { name: 'Home', path: '/' },
            { name: country.name, path: `/${country.slug}` },
            { name: doc.title, path: seo!.path },
          ]),
          ...(faqs.length ? [buildFAQPageJsonLd(faqs.map((f) => ({ question: f.q, answer: f.a })))] : []),
        ]
      : undefined,
  );

  if (missing) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-28 text-center sm:px-6">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-ink-950 text-emerald-400">
          <Compass size={30} />
        </div>
        <h1 className="mt-6 font-display text-2xl font-bold text-ink-900">This guide isn't published</h1>
        <p className="mt-3 text-slate-500">It may have moved, been retired, or never existed for this country.</p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <ButtonLink variant="dark" size="lg" to="/countries">Browse countries</ButtonLink>
        </div>
      </div>
    );
  }

  if (loading || !country || !doc) {
    return <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6"><div className="h-52 animate-pulse rounded-3xl border border-line bg-white" /><div className="mt-8 h-64 animate-pulse rounded-3xl border border-line bg-white" /></div>;
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <nav aria-label="Breadcrumb" className="mb-5 flex flex-wrap items-center gap-1.5 text-xs font-medium text-slate-400">
        <Link to="/" className="hover:text-ink-900">Home</Link><span>/</span>
        <Link to={`/${country.slug}`} className="hover:text-ink-900">{country.name}</Link><span>/</span>
        <span className="text-ink-900">{doc.title}</span>
      </nav>

      <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-emerald-700">
        <span className="text-lg leading-none">{country.flag}</span> {country.name} guide
      </p>
      <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-ink-900 sm:text-4xl">{doc.title}</h1>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <Monogram name={reviewer.penName} color={reviewer.color} size={20} />
        <span>
          Reviewed by{' '}
          <Link to={`/authors#${reviewer.slug}`} className="font-semibold text-ink-900 hover:text-emerald-700">
            {reviewer.penName}
          </Link>
          , {reviewer.role}
        </span>
        <span aria-hidden="true">·</span>
        <span>Updated {new Date(doc.updated_at).toISOString().slice(0, 10)}</span>
      </div>
      {doc.excerpt && <p className="mt-4 max-w-2xl text-base leading-relaxed text-slate-500">{doc.excerpt}</p>}

      <div
        className="piprank-rich-content mt-8 rounded-3xl border border-line bg-white p-6 sm:p-8"
        dangerouslySetInnerHTML={{ __html: Array.isArray(doc.blocks) && doc.blocks.length ? blocksToHtml(doc.blocks as never) : doc.html }}
      />

      {faqs.length > 0 && (
        <section className="mt-8 space-y-4">
          <h2 className="font-display text-xl font-bold text-ink-900">Frequently asked questions</h2>
          {faqs.map((f) => (
            <details key={f.q} className="rounded-2xl border border-line bg-white p-5">
              <summary className="cursor-pointer font-bold text-ink-900">{f.q}</summary>
              <p className="mt-3 text-sm leading-7 text-slate-600">{f.a}</p>
            </details>
          ))}
        </section>
      )}

      {internalLinks.length > 0 && (
        <section className="mt-8 rounded-2xl border border-line bg-white p-6">
          <p className="text-xs font-bold uppercase tracking-widest text-emerald-700">Related pages</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {internalLinks.map((link, i) => (
              <Link key={i} to={link.href} className="rounded-xl border border-line px-4 py-3 text-sm font-semibold text-ink-900 hover:border-emerald-300 hover:bg-emerald-50">{link.label}</Link>
            ))}
          </div>
        </section>
      )}

      <div className="mt-10 rounded-3xl bg-ink-950 p-7 text-white sm:p-9">
        <p className="text-xs font-bold uppercase tracking-widest text-emerald-300">Continue your research</p>
        <h2 className="mt-2 font-display text-2xl font-bold">Compare forex brokers in {country.name}</h2>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link to={`/${country.slug}`} className="rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-ink-950">View all {country.name} brokers</Link>
          <Link to="/quiz" className="rounded-xl border border-white/15 px-4 py-2.5 text-sm font-bold text-white">Find my broker</Link>
        </div>
      </div>
    </div>
  );
}
