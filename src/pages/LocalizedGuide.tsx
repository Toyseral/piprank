import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { fetchContentDocument, fetchCountry, fetchCountryLanguages } from '../lib/api';
import type { ContentDocument, CountryLanguage, CountryPage } from '../lib/types';
import { blocksToHtml } from '../components/PageBuilder';
import { useSEO } from '../hooks/useSEO';

export default function LocalizedGuide() {
  const { countrySlug = '', locale = '', slug = '' } = useParams<{ countrySlug: string; locale: string; slug: string }>();
  const [country, setCountry] = useState<CountryPage | null>(null);
  const [language, setLanguage] = useState<CountryLanguage | null>(null);
  const [doc, setDoc] = useState<ContentDocument | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let alive = true;
    Promise.all([fetchCountry(countrySlug), fetchCountryLanguages(countrySlug), fetchContentDocument(`localized-guide:${countrySlug}:${locale}:${slug}`)])
      .then(([c, langs, d]) => {
        if (!alive) return;
        const lang = (langs || []).find((item) => item.url_prefix === locale || item.code === locale) ?? null;
        setCountry(c); setLanguage(lang); setDoc(d && d.content_type === 'localized-guide' ? d : null);
        setMissing(!c || !lang || !d || d.content_type !== 'localized-guide' || (!d.published && new URLSearchParams(window.location.search).get('preview') !== '1'));
      }).catch(() => alive && setMissing(true));
    return () => { alive = false; };
  }, [countrySlug, locale, slug]);

  const isPreview = new URLSearchParams(window.location.search).get('preview') === '1';
  useSEO({
    title: doc?.seo_title || doc?.title || `${slug} | PipRank`,
    description: doc?.seo_description || doc?.excerpt || '',
    canonical: country && language ? `/${country.slug}/${language.url_prefix}/guides/${doc?.slug || slug}` : undefined,
    noindex: missing || !doc?.indexable || isPreview,
  });

  if (missing) return <main className="mx-auto max-w-3xl px-5 py-20"><h1 className="font-display text-3xl font-bold text-ink-950">Guide not found</h1><p className="mt-3 text-slate-500">This localized guide is not published.</p></main>;
  if (!doc) return null;
  const html = doc.html || blocksToHtml((doc.blocks || []) as any);

  return <main className="mx-auto max-w-4xl px-5 py-10 sm:px-8 sm:py-16">
    <nav className="mb-8 text-xs text-slate-400">{country?.name} · {language?.native_name} · Guides</nav>
    <article>
      <h1 className="font-display text-4xl font-bold tracking-tight text-ink-950 sm:text-5xl">{doc.title}</h1>
      {doc.excerpt && <p className="mt-5 text-lg leading-8 text-slate-600">{doc.excerpt}</p>}
      <div className="prose prose-slate mt-10 max-w-none" dangerouslySetInnerHTML={{ __html: html }} />
    </article>
  </main>;
}
