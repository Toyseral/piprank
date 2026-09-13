import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { Broker, ContentDocument } from '../lib/types';
import { fetchBrokers, fetchContentDocument } from '../lib/api';
import PageBlocksRenderer from '../components/PageBlocksRenderer';
import { useSEO } from '../hooks/useSEO';
import { buildBreadcrumbJsonLd, buildWebPageJsonLd, type SeoInput } from '../lib/seo';
import NotFound from './NotFound';

/** Canonical global Best-For pages are PageBuilder content documents. */
export default function GlobalBestFor() {
  const { slug } = useParams<{ slug: string }>();
  const [document, setDocument] = useState<ContentDocument | null>(null);
  const [brokers, setBrokers] = useState<Broker[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) { setLoading(false); return; }
    let active = true;
    setLoading(true);
    Promise.all([fetchContentDocument(`best-for:${slug}`), fetchBrokers()])
      .then(([doc, brokerRows]) => {
        if (!active) return;
        if (!doc || doc.content_type !== 'global-best-for' || doc.published === false) {
          setDocument(null);
          return;
        }
        setDocument(doc);
        setBrokers(brokerRows ?? []);
        if (typeof window !== 'undefined') window.document.title = `${doc.title} | PipRank`;
      })
      .catch(() => { if (active) setDocument(null); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [slug]);

  const seoInput: SeoInput | null = document ? {
    title: document.seo_title || document.title,
    description: document.seo_description || document.excerpt || '',
    path: `/${document.slug}`,
    type: 'website',
    noindex: document.indexable === false,
  } : null;

  useSEO(
    seoInput,
    document && seoInput ? [
      buildWebPageJsonLd(seoInput),
      buildBreadcrumbJsonLd([
        { name: 'Home', path: '/' },
        { name: document.title, path: seoInput.path },
      ]),
    ] : undefined,
  );

  if (loading) return <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6"><div className="h-56 animate-pulse rounded-3xl border border-line bg-white"/><div className="mt-8 h-96 animate-pulse rounded-3xl border border-line bg-white"/></div>;
  if (!document) return <NotFound />;

  const blocks = Array.isArray(document.blocks) ? document.blocks : [];

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <nav className="text-xs font-medium text-slate-400">
        <Link to="/" className="hover:text-ink-900">Home</Link>
        <span className="mx-1.5">/</span>
        <span className="text-ink-900">{document.title}</span>
      </nav>
      <header className="mt-6">
        <h1 className="font-display text-3xl font-bold tracking-tight text-ink-900 sm:text-4xl">{document.title}</h1>
        {document.excerpt && <p className="mt-4 max-w-3xl text-lg leading-relaxed text-slate-500">{document.excerpt}</p>}
      </header>
      {blocks.length > 0 ? (
        <article className="mt-10">
          <PageBlocksRenderer blocks={blocks as any} brokers={brokers} className="piprank-rich-content space-y-8" />
        </article>
      ) : (
        <article className="mt-10 rounded-2xl border border-line bg-white p-6 text-sm text-slate-500">
          This page has no published content blocks yet.
        </article>
      )}
    </div>
  );
}
