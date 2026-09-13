import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { Broker, ContentDocument } from '../lib/types';
import { fetchBrokers } from '../lib/api';
import { BEST_FOR_CANONICAL } from '../lib/seo';
import PageBlocksRenderer from '../components/PageBlocksRenderer';
import { useSEO } from '../hooks/useSEO';
import { buildBreadcrumbJsonLd, buildWebPageJsonLd, type SeoInput } from '../lib/seo';
import NotFound from './NotFound';

interface GlobalBestForProps { slug?: string; }

async function fetchGlobalDocument(publicSlug: string): Promise<ContentDocument | null> {
  const internalSlug = BEST_FOR_CANONICAL[publicSlug] ?? publicSlug;
  const response = await fetch(`/api/content-documents?type=global-best-for&slug=${encodeURIComponent(publicSlug)}`);
  const data = await response.json().catch(() => []);
  if (response.ok && Array.isArray(data)) {
    const match = data.find((doc: ContentDocument) => doc.content_type === 'global-best-for' && doc.published !== false);
    if (match) return match;
  }

  const allResponse = await fetch('/api/content-documents?type=global-best-for');
  const allData = await allResponse.json().catch(() => []);
  if (allResponse.ok && Array.isArray(allData)) {
    const match = allData.find((doc: ContentDocument) =>
      doc.content_type === 'global-best-for' &&
      doc.published !== false &&
      (doc.slug === publicSlug || doc.slug === internalSlug || doc.content_key === `best-for:${internalSlug}`),
    );
    if (match) return match;
  }
  return null;
}

export default function GlobalBestFor({ slug: propSlug }: GlobalBestForProps) {
  const params = useParams<{ slug: string }>();
  const slug = propSlug ?? params.slug;
  const [document, setDocument] = useState<ContentDocument | null>(null);
  const [brokers, setBrokers] = useState<Broker[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) { setLoading(false); return; }
    let active = true;
    setLoading(true);
    Promise.all([fetchGlobalDocument(slug), fetchBrokers()])
      .then(([doc, brokerRows]) => {
        if (!active) return;
        setDocument(doc);
        setBrokers(brokerRows ?? []);
        if (doc) window.document.title = `${doc.title} | PipRank`;
      })
      .catch(() => { if (active) setDocument(null); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [slug]);

  const seoInput: SeoInput | null = document ? {
    title: document.seo_title || document.title,
    description: document.seo_description || document.excerpt || '',
    path: `/${slug || document.slug}`,
    type: 'website',
    noindex: document.indexable === false,
  } : null;

  useSEO(seoInput, document && seoInput ? [
    buildWebPageJsonLd(seoInput),
    buildBreadcrumbJsonLd([{ name: 'Home', path: '/' }, { name: document.title, path: seoInput.path }]),
  ] : undefined);

  if (loading) return <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6"><div className="h-56 animate-pulse rounded-3xl border border-line bg-white"/><div className="mt-8 h-96 animate-pulse rounded-3xl border border-line bg-white"/></div>;
  if (!document) return <NotFound />;

  const blocks = Array.isArray(document.blocks) ? document.blocks : [];
  return <article className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
    <nav className="text-xs font-medium text-slate-400"><Link to="/" className="hover:text-ink-900">Home</Link><span className="mx-1.5">/</span><span className="text-ink-900">{document.title}</span></nav>
    <header className="mt-6 border-b border-line pb-8"><h1 className="font-display text-3xl font-bold tracking-tight text-ink-950 sm:text-5xl">{document.title}</h1>{document.excerpt && <p className="mt-4 max-w-3xl text-lg leading-8 text-slate-500">{document.excerpt}</p>}</header>
    <div className="mt-8">{blocks.length ? <PageBlocksRenderer blocks={blocks as any} brokers={brokers} className="piprank-rich-content space-y-8"/> : <p className="rounded-2xl border border-line bg-white p-6 text-sm text-slate-500">This page has no published content blocks yet.</p>}</div>
  </article>;
}
