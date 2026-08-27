import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowRight, Check, Sparkles } from 'lucide-react';
import type { Broker, ContentDocument, CountryPage, LocalizedSeoPage } from '../lib/types';
import { fetchBrokers, fetchCountry, fetchCountryLanguages, fetchLocalizedSeoPage, fetchLocalizedSeoPagePreview, fetchLocalizationUiPack, fetchContentDocumentById } from '../lib/api';
import { useSEO } from '../hooks/useSEO';
import { buildBreadcrumbJsonLd, buildFAQPageJsonLd, buildItemListJsonLd, buildWebPageJsonLd, absoluteUrl } from '../lib/seo';
import { countrySeoTopics, rankCountryTopicBrokers, topicNote } from '../data/countrySeoTopics';
import {
  englishAlternatePath,
  englishHreflangForCountry,
  getLocalizationUi,
  mergeLocalizationUi,
  type LocalizationUiStrings,
} from '../lib/localization';
import supabase from '../lib/supabase';
import { blocksToHtml } from '../components/PageBuilder';
import BrokerCard from '../components/BrokerCard';
import Monogram from '../components/Monogram';
import Reveal from '../components/Reveal';
import NotFound from './NotFound';
import { reviewerFor } from '../lib/team';
import VietnameseCountrySeoTopic from './VietnameseCountrySeoTopic';

export default function LocalizedCountrySeoTopic() {
  const { countrySlug = '', locale = '', topicSlug = '' } = useParams<{
    countrySlug: string;
    locale: string;
    topicSlug: string;
  }>();
  const [page, setPage] = useState<LocalizedSeoPage | null>(null);
  const [country, setCountry] = useState<CountryPage | null>(null);
  const [brokers, setBrokers] = useState<Broker[]>([]);
  const [missing, setMissing] = useState(false);
  const [localeAllowed, setLocaleAllowed] = useState<boolean | null>(null);
  const [studioDoc, setStudioDoc] = useState<ContentDocument | null>(null);
  const [ui, setUi] = useState<LocalizationUiStrings>(() => getLocalizationUi(locale));
  const [isPreview, setIsPreview] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const preview = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('preview') === '1';
        setIsPreview(preview);

        const langs = await fetchCountryLanguages(countrySlug);
        const ok = (langs ?? []).some(
          (l) => l.active !== false && (l.url_prefix === locale || l.code === locale),
        );
        if (cancelled) return;
        // Allow Vietnam/vi only as last-resort hard-coded fallback when no language row exists yet.
        const legacyVi = countrySlug === 'vietnam' && locale === 'vi';
        setLocaleAllowed(ok || legacyVi);
        if (!ok && !legacyVi) {
          setMissing(true);
          return;
        }

        let p: LocalizedSeoPage | null = null;
        if (preview) {
          const { data: sessionData } = await supabase.auth.getSession();
          const token = sessionData.session?.access_token;
          if (token) {
            p = await fetchLocalizedSeoPagePreview(countrySlug, locale, topicSlug, token);
          }
        }
        if (!p) {
          p = await fetchLocalizedSeoPage(countrySlug, locale, topicSlug);
        }

        const [c, b, pack] = await Promise.all([
          fetchCountry(countrySlug),
          fetchBrokers(),
          fetchLocalizationUiPack(locale).catch(() => null),
        ]);
        if (cancelled) return;
        if (!p) setMissing(true);
        else {
          if (p.url_prefix && p.url_prefix !== locale && p.language_code !== locale) {
            setMissing(true);
            return;
          }
          setPage(p);
          setCountry(c);
          setBrokers(b);
          setUi(mergeLocalizationUi(p.language_code || locale, pack?.strings));
          if (p.content_document_id) {
            fetchContentDocumentById(Number(p.content_document_id))
              .then((d) => { if (!cancelled) setStudioDoc(d); })
              .catch(() => { if (!cancelled) setStudioDoc(null); });
          } else {
            setStudioDoc(null);
          }
        }
      } catch {
        if (!cancelled) setMissing(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [countrySlug, locale, topicSlug]);

  const topic =
    page && page.topic_key !== 'all'
      ? (countrySeoTopics.find((t) => t.key === page.topic_key) ?? null)
      : null;

  const ranked = useMemo((): Broker[] => {
    if (!country || !page) return [];
    return topic
      ? rankCountryTopicBrokers(brokers, country, topic)
      : brokers
          .filter((b) => new Set((country.recommended ?? []).map((x) => x.slug)).has(b.slug))
          .sort((a, b) => Number(b.rating ?? 0) - Number(a.rating ?? 0));
  }, [country, page, brokers, topic]);

  const reviewer = useMemo(
    () => reviewerFor(`${countrySlug}-${locale}-${topicSlug}`),
    [countrySlug, locale, topicSlug],
  );

  const path = `/${countrySlug}/${locale}/${topicSlug}`;
  const englishPath = englishAlternatePath(countrySlug, page?.topic_key);
  const enHreflang = englishHreflangForCountry(countrySlug);

  const seo = page
    ? {
        title: page.meta_title || page.title,
        description: page.meta_description || page.title,
        path,
        type: 'website' as const,
        lang: page.locale || locale,
        alternates: [
          { hreflang: page.locale || locale, path },
          { hreflang: enHreflang, path: englishPath },
          { hreflang: 'x-default', path: englishPath },
        ],
      }
    : null;

  useSEO(
    seo,
    seo
      ? [
          {
            ...buildWebPageJsonLd(seo),
            inLanguage: page?.locale || locale,
            author: {
              '@type': 'Person',
              name: reviewer.penName,
              jobTitle: reviewer.role,
              url: absoluteUrl(`/authors#${reviewer.slug}`),
            },
          },
          buildBreadcrumbJsonLd([
            { name: ui.home, path: '/' },
            { name: country?.name ?? countrySlug, path: `/${countrySlug}` },
            { name: page!.title, path },
          ]),
          buildItemListJsonLd(
            page!.title,
            ranked.slice(0, 10).map((b) => ({ name: b.name, path: `/brokers/${b.slug}` })),
          ),
          buildFAQPageJsonLd(
            (page!.faqs ?? []).map((f: { q?: string; question?: string; a?: string; answer?: string }) => ({
              question: f.q ?? f.question ?? '',
              answer: f.a ?? f.answer ?? '',
            })),
          ),
        ]
      : undefined,
  );

  if (missing) {
    // Last-resort only: hard-coded Vietnamese cluster when DB has no published/preview row yet.
    // Prefer sql/PHASE-16-VIETNAMESE-LOCALIZATION-REGISTRY.sql + publish from admin.
    if (countrySlug === 'vietnam' && locale === 'vi' && !isPreview) return <VietnameseCountrySeoTopic />;
    return <NotFound />;
  }
  if (!page || !country || localeAllowed === null) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-16">
        <div className="h-64 animate-pulse rounded-3xl border border-line bg-white" />
      </div>
    );
  }

  const studioHtml = studioDoc
    ? (Array.isArray(studioDoc.blocks) && studioDoc.blocks.length
        ? blocksToHtml(studioDoc.blocks as any)
        : studioDoc.html)
    : '';
  const body = !studioHtml && page.content ? page.content.split(/\n{2,}/).filter(Boolean) : [];

  return (
    <main className="mx-auto max-w-5xl px-4 py-12 sm:px-6" lang={page.locale?.split('-')[0] || locale}>
      {isPreview && !page.published && (
        <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
          Draft preview — not public. Sign in as admin required. This URL is not in the sitemap.
        </div>
      )}
      <nav aria-label="Breadcrumb" className="mb-5 flex flex-wrap gap-1.5 text-xs text-slate-400">
        <Link to="/">{ui.home}</Link>
        <span>/</span>
        <Link to={`/${countrySlug}`}>{country.name}</Link>
        <span>/</span>
        <span className="text-ink-900">{page.title}</span>
      </nav>

      <header className="rounded-3xl bg-ink-950 p-7 text-white sm:p-10">
        <p className="text-sm font-semibold text-emerald-300">
          {country.flag} {country.name} · {page.language_native_name || page.language_name}
        </p>
        <h1 className="mt-4 font-display text-3xl font-bold sm:text-4xl">
          {page.h1 || page.title} <span className="text-slate-500">({new Date().getFullYear()})</span>
        </h1>
        <div className="mt-4 flex items-center gap-2 text-xs text-slate-400">
          <Monogram name={reviewer.penName} color={reviewer.color} size={20} />
          <span>
            {ui.reviewedBy}{' '}
            <Link to={`/authors#${reviewer.slug}`} className="font-semibold text-slate-200">
              {reviewer.penName}
            </Link>
          </span>
        </div>
        {studioHtml ? (
          <div className="piprank-rich-content mt-4 max-w-3xl text-sm leading-7 text-slate-300" dangerouslySetInnerHTML={{ __html: studioHtml }} />
        ) : (
          body.map((para, i) => (
            <p key={i} className="mt-3 max-w-3xl text-sm leading-7 text-slate-400">{para}</p>
          ))
        )}
        <div className="mt-6">
          <Link to="/quiz" className="inline-flex items-center gap-2 rounded-xl bg-emerald-400 px-4 py-2.5 text-sm font-bold text-ink-950">
            <Sparkles size={16} />
            {ui.findBroker}
          </Link>
        </div>
      </header>

      <section className="mt-10">
        <p className="text-xs font-bold uppercase tracking-widest text-emerald-700">{ui.recommendations}</p>
        <h2 className="mt-1 font-display text-2xl font-bold">{page.title}</h2>
        {ranked.length ? (
          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            {ranked.slice(0, 8).map((b, i) => (
              <Reveal key={b.slug} delay={Math.min(i, 5) * 0.05}>
                <BrokerCard
                  broker={b}
                  rank={i + 1}
                  countrySlug={countrySlug}
                  note={topic ? topicNote(topic, b) : `Recommended for ${country.name}.`}
                />
              </Reveal>
            ))}
          </div>
        ) : (
          <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
            {ui.insufficientData}
          </div>
        )}
      </section>

      <section className="mt-10 rounded-2xl border border-line bg-white p-6">
        <h2 className="font-display text-xl font-bold">{ui.methodologyTitle}</h2>
        <ul className="mt-4 space-y-3 text-sm text-slate-600">
          <li className="flex gap-2"><Check size={17} className="text-emerald-600" />{ui.methodologyAvailability}</li>
          <li className="flex gap-2"><Check size={17} className="text-emerald-600" />{ui.methodologyIntent}</li>
          <li className="flex gap-2"><Check size={17} className="text-emerald-600" />{ui.methodologyAffiliate}</li>
        </ul>
      </section>

      {(page.faqs ?? []).length > 0 && (
        <section className="mt-10 space-y-3">
          {page.faqs.map((f: { q?: string; question?: string; a?: string; answer?: string }) => (
            <details key={f.q || f.question} className="rounded-2xl border border-line bg-white p-5">
              <summary className="cursor-pointer font-bold">{f.q || f.question}</summary>
              <p className="mt-3 text-sm leading-7 text-slate-600">{f.a || f.answer}</p>
            </details>
          ))}
        </section>
      )}

      <section className="mt-10 rounded-3xl bg-ink-950 p-7 text-white">
        <h2 className="font-display text-2xl font-bold">{ui.findBroker}</h2>
        <p className="mt-2 text-sm text-slate-400">{ui.findBrokerBlurb}</p>
        <Link to="/quiz" className="mt-5 inline-flex rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-ink-950">
          {ui.findBroker} <ArrowRight size={15} />
        </Link>
      </section>
    </main>
  );
}
