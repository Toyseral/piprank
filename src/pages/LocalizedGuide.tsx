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
  const isPreview = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('preview') === '1';

  useEffect(() => {
    let alive = true;
    setMissing(false);
    setDoc(null);
    Promise.all([fetchCountry(countrySlug), fetchCountryLanguages(countrySlug)])
      .then(async ([c, langs]) => {
        if (!alive) return;
        const lang = (langs || []).find((item) => item.url_prefix === locale || item.code === locale) ?? null;
        setCountry(c);
        setLanguage(lang);
        if (!c || !lang) {
          setMissing(true);
          return;
        }
        const d = await fetchContentDocument(`localized-guide:${c.slug}:${lang.code}:${slug}`);
        if (!alive) return;
        setDoc(d && d.content_type === 'localized-guide' ? d : null);
        setMissing(!d || d.content_type !== 'localized-guide' || (!d.published && !isPreview));
      })
      .catch(() => alive && setMissing(true));
    return () => { alive = false; };
  }, [countrySlug, locale, slug, isPreview]);

  useSEO(doc ? {
    title: doc.seo_title || doc.title,
    description: doc.seo_description || doc.excerpt || '',
    path: country && language ? `/${country.slug}/${language.url_prefix}/guides/${doc.slug || slug}` : `/${countrySlug}/${locale}/guides/${slug}`,
    noindex: missing || !doc.indexable || isPreview,
    type: 'article',
    lang: language?.locale || language?.code || undefined,
  } : null);

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
