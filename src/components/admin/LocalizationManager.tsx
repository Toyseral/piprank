import { FormEvent, useEffect, useMemo, useState } from 'react';
import PageBuilder, { blocksToHtml, type PageBlock } from '../PageBuilder';
import { Globe2, Loader2, Plus } from 'lucide-react';
import type { ContentDocument, CountryLanguage, CountryPage, LocalizedSeoPage } from '../../lib/types';
import { countrySeoTopics } from '../../data/countrySeoMatrix.js';
import {
  deriveWorkflowStatus,
  getLanguageTopicTemplate,
  getLocalizationUi,
  localizationReadyIssues,
  LOCALIZATION_UI_KEYS,
  MIN_LOCALIZED_CONTENT_LENGTH,
  type WorkflowStatus,
} from '../../lib/localization';
import {
  fetchLocalizationGlossary,
  fetchLocalizationHealth,
  fetchLocalizationUiPack,
  saveGlossaryTerm,
  saveLocalizationUiPack,
} from '../../lib/api';

type Mutate = (path: string, method: string, body: unknown, msg: string) => Promise<void>;

const WORKFLOW_LABELS: Record<WorkflowStatus, string> = {
  draft: 'Draft',
  in_review: 'In review',
  ready: 'Ready',
  published: 'Published',
};

export function LocalizationManager({
  countries,
  languages,
  pages,
  mutate,
  accessToken,
}: {
  countries: CountryPage[];
  languages: CountryLanguage[];
  pages: LocalizedSeoPage[];
  mutate: Mutate;
  notify?: (msg: string) => void;
  accessToken?: string;
}) {
  const [countryId, setCountryId] = useState<number>(countries[0]?.id ?? 0);
  const [name, setName] = useState('');
  const [nativeName, setNativeName] = useState('');
  const [code, setCode] = useState('');
  const [locale, setLocale] = useState('');
  const [prefix, setPrefix] = useState('');
  const [saving, setSaving] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState<number | null>(null);

  const countryLanguages = languages.filter((l) => l.country_id === countryId);
  const selectedPages = selectedLanguage ? pages.filter((p) => p.language_id === selectedLanguage) : [];
  const selectedLang = languages.find((l) => l.id === selectedLanguage) ?? null;
  const country = countries.find((c) => c.id === countryId);

  const addLanguage = async (e: FormEvent) => {
    e.preventDefault();
    if (!countryId || !name || !nativeName || !code || !locale) return;
    setSaving(true);
    try {
      await mutate(
        '/api/country-languages',
        'POST',
        {
          country_id: countryId,
          name,
          native_name: nativeName,
          code,
          locale,
          url_prefix: prefix || code,
        },
        `${nativeName} localization created`,
      );
      setName('');
      setNativeName('');
      setCode('');
      setLocale('');
      setPrefix('');
    } finally {
      setSaving(false);
    }
  };

  const addTopic = async (topicKey: string) => {
    if (!selectedLang || !country) return;
    const template = getLanguageTopicTemplate(selectedLang.code, topicKey, country.name);
    await mutate(
      '/api/localized-seo-pages',
      'POST',
      {
        country_id: country.id,
        language_id: selectedLang.id,
        topic_key: topicKey,
        slug: template.slug,
        title: template.title,
        h1: template.title,
        meta_title: template.metaTitle ?? null,
        meta_description: template.description ?? null,
        content: (template.intro ?? []).join('\n\n'),
        faqs: template.faqs ?? [],
        published: false,
        indexable: false,
        workflow_status: 'draft',
      },
      `Added topic “${topicKey}”`,
    );
  };

  const existingKeys = new Set(selectedPages.map((p) => p.topic_key));
  const addableTopics = countrySeoTopics.filter((t) => !existingKeys.has(t.key));

  return (
    <div className="space-y-6">
      <LocalizationHealthPanel token={accessToken} />
      <LocalizationUiPackEditor token={accessToken} languages={languages} />
      <LocalizationGlossaryEditor token={accessToken} languages={languages} selectedCode={selectedLang?.code} />
      <div className="rounded-3xl border border-line bg-white p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-emerald-700">Country × Language</p>
            <h2 className="mt-1 font-display text-xl font-bold text-ink-950">Add a local language</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              Adding a language creates draft commercial SEO pages (seeded with language-aware titles/slugs when a
              template pack exists). Nothing is published until content is ready and workflow allows it.
            </p>
          </div>
          <Globe2 className="text-emerald-600" size={22} />
        </div>
        <form onSubmit={addLanguage} className="mt-6 grid gap-3 md:grid-cols-3">
          <select
            value={countryId}
            onChange={(e) => setCountryId(Number(e.target.value))}
            className="h-11 rounded-xl border border-line bg-paper px-3 text-sm"
          >
            {countries.map((c) => (
              <option key={c.id} value={c.id}>
                {c.flag} {c.name}
              </option>
            ))}
          </select>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Language name (e.g. Malay)"
            className="h-11 rounded-xl border border-line bg-paper px-3 text-sm"
          />
          <input
            value={nativeName}
            onChange={(e) => setNativeName(e.target.value)}
            placeholder="Native name (e.g. Bahasa Melayu)"
            className="h-11 rounded-xl border border-line bg-paper px-3 text-sm"
          />
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Language code (ms)"
            className="h-11 rounded-xl border border-line bg-paper px-3 text-sm"
          />
          <input
            value={locale}
            onChange={(e) => setLocale(e.target.value)}
            placeholder="Locale (ms-MY)"
            className="h-11 rounded-xl border border-line bg-paper px-3 text-sm"
          />
          <input
            value={prefix}
            onChange={(e) => setPrefix(e.target.value)}
            placeholder="URL prefix (ms)"
            className="h-11 rounded-xl border border-line bg-paper px-3 text-sm"
          />
          <button
            disabled={saving}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-ink-950 px-4 text-sm font-bold text-white disabled:opacity-60 md:col-span-3"
          >
            {saving && <Loader2 size={15} className="animate-spin" />} <Plus size={15} /> Create localization
          </button>
        </form>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {(countryId ? languages.filter((l) => l.country_id === countryId) : languages).map((l) => (
          <div
            key={l.id}
            className={`rounded-2xl border bg-white p-5 ${selectedLanguage === l.id ? 'border-emerald-300' : 'border-line'}`}
          >
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="font-bold text-ink-950">
                  {l.native_name} <span className="font-normal text-slate-400">({l.name})</span>
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {l.country_name} · {l.locale} · /{l.url_prefix}/ · {l.active ? 'Active' : 'Inactive'}
                </p>
              </div>
              <button
                onClick={() => setSelectedLanguage(selectedLanguage === l.id ? null : l.id)}
                className="rounded-xl border border-line px-3 py-2 text-xs font-bold"
              >
                {selectedLanguage === l.id ? 'Hide pages' : 'Manage pages'}
              </button>
              <button
                onClick={() =>
                  mutate(
                    '/api/country-languages',
                    'PUT',
                    { id: l.id, active: !l.active },
                    l.active ? 'Language disabled' : 'Language enabled',
                  )
                }
                className="rounded-xl border border-line px-3 py-2 text-xs font-bold"
              >
                {l.active ? 'Disable' : 'Enable'}
              </button>
            </div>

            {selectedLanguage === l.id && (
              <div className="mt-5 space-y-3 border-t border-line pt-4">
                {selectedPages.map((p) => (
                  <LocalizedPageRow key={p.id} page={p} language={l} country={country} mutate={mutate} accessToken={accessToken} />
                ))}
                {!selectedPages.length && <p className="text-sm text-slate-500">No draft pages yet.</p>}

                {addableTopics.length > 0 && (
                  <div className="rounded-xl border border-dashed border-line bg-paper p-3">
                    <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Add commercial intent</p>
                    <p className="mt-1 text-xs text-slate-500">
                      Attach any SEO matrix topic to this language (beyond the default six).
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {addableTopics.slice(0, 24).map((t) => (
                        <button
                          key={t.key}
                          type="button"
                          onClick={() => addTopic(t.key)}
                          className="rounded-lg border border-line bg-white px-2.5 py-1.5 text-xs font-semibold hover:border-emerald-400"
                        >
                          + {(t as { shortTitle?: string; title: string }).shortTitle || t.title}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {!languages.length && (
        <div className="rounded-2xl border border-dashed border-line bg-white p-8 text-center text-sm text-slate-500">
          No local languages configured yet. Add one above.
        </div>
      )}
    </div>
  );
}


function studioStatusOf(doc: ContentDocument | null, contentDocumentId: number | null): {
  key: 'none' | 'missing' | 'draft' | 'live';
  label: string;
  className: string;
} {
  if (!contentDocumentId) return { key: 'none', label: 'No Studio link', className: 'bg-slate-100 text-slate-600' };
  if (!doc) return { key: 'missing', label: 'Studio missing', className: 'bg-rose-100 text-rose-800' };
  const hasBody =
    String(doc.html || '').trim().length >= 40 ||
    (Array.isArray(doc.blocks) && doc.blocks.length > 0);
  if (doc.published === false || !hasBody) {
    return { key: 'draft', label: hasBody ? 'Studio draft' : 'Studio empty', className: 'bg-amber-100 text-amber-900' };
  }
  return { key: 'live', label: 'Studio live', className: 'bg-emerald-100 text-emerald-800' };
}

function LocalizedPageRow({
  page,
  language,
  country,
  mutate,
  accessToken,
}: {
  page: LocalizedSeoPage;
  language: CountryLanguage;
  country?: CountryPage;
  mutate: Mutate;
  accessToken?: string;
}) {
  const [title, setTitle] = useState(page.title);
  const [slug, setSlug] = useState(page.slug);
  const [meta, setMeta] = useState(page.meta_title ?? '');
  const [metaDesc, setMetaDesc] = useState(page.meta_description ?? '');
  const [h1, setH1] = useState(page.h1 ?? '');
  const [content, setContent] = useState(page.content ?? '');
  const [contentDocumentId, setContentDocumentId] = useState<number | null>(page.content_document_id ?? null);
  const [studioDoc, setStudioDoc] = useState<ContentDocument | null>(null);
  const [builderBlocks, setBuilderBlocks] = useState<PageBlock[]>([]);
  const [studioBusy, setStudioBusy] = useState(false);
  const [faqsText, setFaqsText] = useState(() => {
    const faqs = Array.isArray(page.faqs) ? page.faqs : [];
    return faqs
      .map((f: { q?: string; question?: string; a?: string; answer?: string }) => `${f.q ?? f.question ?? ''}\n${f.a ?? f.answer ?? ''}`)
      .join('\n---\n');
  });
  const [indexable, setIndexable] = useState(page.indexable);
  const [published, setPublished] = useState(page.published);
  const [workflow, setWorkflow] = useState<WorkflowStatus>(deriveWorkflowStatus(page));
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!contentDocumentId) {
      setStudioDoc(null);
      setBuilderBlocks([]);
      return;
    }
    fetch(`/api/content-documents?id=${contentDocumentId}`)
      .then((r) => r.json())
      .then((d: ContentDocument | null) => {
        setStudioDoc(d);
        const blocks = Array.isArray(d?.blocks) ? (d!.blocks as PageBlock[]) : [];
        setBuilderBlocks(blocks);
      })
      .catch(() => {
        setStudioDoc(null);
        setBuilderBlocks([]);
      });
  }, [contentDocumentId]);

  const studioStatus = studioStatusOf(studioDoc, contentDocumentId);

  const ensureStudioDoc = async (): Promise<number | null> => {
    if (!accessToken || !country) return contentDocumentId;
    if (contentDocumentId) return contentDocumentId;
    setStudioBusy(true);
    try {
      const content_key = `localized:${country.slug}:${language.code}:${page.topic_key}`;
      const existingRes = await fetch(`/api/content-documents?key=${encodeURIComponent(content_key)}`);
      const existing = await existingRes.json().catch(() => null);
      let docId = existing?.id as number | undefined;
      if (!docId) {
        const res = await fetch('/api/content-documents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
          body: JSON.stringify({
            content_key,
            content_type: 'localized-seo',
            country_slug: country.slug,
            topic_slug: page.topic_key,
            slug: page.slug,
            title: title || page.title || `${page.topic_key} (${language.code})`,
            excerpt: metaDesc || page.meta_description || '',
            html: content ? `<p>${content.split(/\n{2,}/).map((x) => x.replace(/</g, '&lt;')).join('</p><p>')}</p>` : '<p></p>',
            blocks: [],
            published: false,
            indexable: false,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error((data as { error?: string }).error || 'Failed to create Content Studio document');
        docId = data.id;
      }
      setContentDocumentId(Number(docId));
      await mutate(
        '/api/localized-seo-pages',
        'PUT',
        { id: page.id, content_document_id: Number(docId) },
        'Linked Content Studio document',
      );
      return Number(docId);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Studio link failed');
      return null;
    } finally {
      setStudioBusy(false);
    }
  };

  const previewPath = useMemo(() => {
    const countrySlug = page.country_slug || country?.slug;
    const prefix = page.url_prefix || language.url_prefix;
    if (!countrySlug || !prefix || !slug) return null;
    const base = `/${countrySlug}/${prefix}/${slug}`;
    return published ? base : `${base}?preview=1`;
  }, [page, country, language, slug, published]);

  const [glossary, setGlossary] = useState<{ term_en: string; term_local: string }[]>([]);
  useEffect(() => {
    fetchLocalizationGlossary(language.code)
      .then((rows) => setGlossary(rows || []))
      .catch(() => setGlossary([]));
  }, [language.code]);

  const parseFaqs = () => {
    if (!faqsText.trim()) return [];
    return faqsText
      .split(/\n---\n/)
      .map((block) => {
        const lines = block.trim().split('\n');
        const q = (lines[0] ?? '').trim();
        const a = lines.slice(1).join('\n').trim();
        return q ? { q, a } : null;
      })
      .filter(Boolean);
  };

  const copyFromEnglish = () => {
    const topic = countrySeoTopics.find((t) => t.key === page.topic_key);
    const countryName = country?.name || page.country_name || 'this market';
    if (!topic) {
      const template = getLanguageTopicTemplate(language.code, page.topic_key, countryName);
      if (template.intro?.length) setContent(template.intro.join('\n\n'));
      if (template.faqs?.length) setFaqsText(template.faqs.map((f) => `${f.q}\n${f.a}`).join('\n---\n'));
      return;
    }
    const lines = [
      `${topic.title} for traders in ${countryName}.`,
      `This page ranks brokers from the ${countryName} recommendation set using the “${(topic as { shortTitle?: string }).shortTitle || topic.title}” intent filters.`,
      'Always verify the legal entity, leverage, and payment methods available to residents before opening an account.',
    ];
    setContent(lines.join('\n\n'));
    setFaqsText(
      [
        `What is the best ${(topic as { shortTitle?: string }).shortTitle || topic.title} option in ${countryName}?\nPipRank starts from brokers recommended for ${countryName}, then applies intent-specific filters and quality signals.`,
        `Does availability differ by country?\nYes. Legal entity, products, leverage and payment methods can vary by residence.`,
      ].join('\n---\n'),
    );
    if (!title) setTitle(`${topic.title} in ${countryName}`);
    setWorkflow('in_review');
  };

  const hasStudioBody =
    studioStatus.key === 'live' ||
    (studioStatus.key === 'draft' &&
      (String(studioDoc?.html || '').trim().length >= 40 ||
        (Array.isArray(studioDoc?.blocks) && (studioDoc?.blocks.length ?? 0) > 0)));

  const readyIssues = localizationReadyIssues({
    content,
    content_document_id: contentDocumentId,
    hasStudioBody: Boolean(hasStudioBody && studioStatus.key === 'live'),
    meta_description: metaDesc,
    h1,
    title,
    faqs: parseFaqs(),
  });

  // Extra UX rules: cannot go live with draft/missing studio when linked
  if (contentDocumentId && (published || workflow === 'ready') && studioStatus.key !== 'live') {
    if (!readyIssues.some((x) => x.includes('Studio'))) {
      readyIssues.push('Linked Content Studio document must be published and have body content (or use Publish both)');
    }
  }

  const saveStudioBlocks = async (docId: number, alsoPublish: boolean) => {
    if (!accessToken) return;
    const html = blocksToHtml(builderBlocks);
    await fetch('/api/content-documents', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({
        id: docId,
        title: title || studioDoc?.title,
        blocks: builderBlocks,
        html,
        published: alsoPublish ? true : studioDoc?.published,
        indexable: alsoPublish ? true : studioDoc?.indexable,
      }),
    }).then(async (res) => {
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error || 'Failed to save Studio document');
      setStudioDoc(data as ContentDocument);
    });
  };

  const save = async () => {
    let publishStudio = false;
    if (published || workflow === 'ready') {
      if (contentDocumentId && studioStatus.key !== 'live') {
        const ok = window.confirm(
          'The linked Content Studio document is not live yet.\n\nClick OK to publish the Studio document together with this page.\nClick Cancel to stop.',
        );
        if (!ok) return;
        publishStudio = true;
      } else if (readyIssues.length) {
        alert(readyIssues.join('\n'));
        return;
      }
    }

    setSaving(true);
    try {
      let docId = contentDocumentId;
      if (expanded && !docId && builderBlocks.length) {
        docId = await ensureStudioDoc();
      }
      if (docId && expanded) {
        await saveStudioBlocks(docId, publishStudio);
      }
      await mutate(
        '/api/localized-seo-pages',
        'PUT',
        {
          id: page.id,
          title,
          slug,
          meta_title: meta || null,
          meta_description: metaDesc || null,
          h1: h1 || null,
          content,
          content_document_id: docId,
          faqs: parseFaqs(),
          indexable,
          published,
          workflow_status: published ? 'published' : workflow,
          publish_studio_document: publishStudio,
        },
        published ? 'Localized page published (deploy refresh queued if configured)' : 'Localized page saved',
      );
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const status = published ? 'published' : workflow;

  return (
    <div className="rounded-xl border border-line bg-paper p-4">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${studioStatus.className}`}>{studioStatus.label}</span>
        <span className="text-[11px] text-slate-400">{page.topic_key}</span>
      </div>
      <div className="grid gap-2 md:grid-cols-2">
        <input value={title} onChange={(e) => setTitle(e.target.value)} className="h-10 rounded-lg border border-line bg-white px-3 text-sm font-semibold" placeholder="Localized title" />
        <input value={slug} onChange={(e) => setSlug(e.target.value)} className="h-10 rounded-lg border border-line bg-white px-3 text-sm" placeholder="Localized slug" />
        <input value={meta} onChange={(e) => setMeta(e.target.value)} className="h-10 rounded-lg border border-line bg-white px-3 text-sm md:col-span-2" placeholder="SEO meta title" />
      </div>
      {expanded && (
        <div className="mt-2 grid gap-2">
          <input value={h1} onChange={(e) => setH1(e.target.value)} className="h-10 rounded-lg border border-line bg-white px-3 text-sm" placeholder="H1 (optional)" />
          <textarea value={metaDesc} onChange={(e) => setMetaDesc(e.target.value)} rows={2} className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm" placeholder="Meta description (140–160 chars)" />

          <div className="rounded-xl border border-emerald-200 bg-white p-3">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs font-bold uppercase tracking-widest text-emerald-700">Body editor (Content Studio)</p>
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${studioStatus.className}`}>{studioStatus.label}</span>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Edit rich content here — same PageBuilder as Content Studio. No need to leave Localization.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" disabled={studioBusy || !accessToken} onClick={() => ensureStudioDoc()} className="rounded-lg bg-ink-950 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50">
                {studioBusy ? 'Working…' : contentDocumentId ? 'Refresh Studio link' : 'Create Studio document'}
              </button>
              {contentDocumentId && (
                <button type="button" onClick={() => setContentDocumentId(null)} className="rounded-lg border border-line px-2 py-1 text-xs font-bold">
                  Unlink Studio
                </button>
              )}
              {previewPath && (
                <a href={previewPath} target="_blank" rel="noreferrer" className="rounded-lg border border-line px-3 py-1.5 text-xs font-bold">
                  {published ? 'Open live URL' : 'Draft preview'}
                </a>
              )}
            </div>
            {contentDocumentId ? (
              <div className="mt-3">
                <PageBuilder
                  key={`studio-${contentDocumentId}-${studioDoc?.updated_at || 'new'}`}
                  value={builderBlocks}
                  onChange={(blocks) => {
                    setBuilderBlocks(blocks);
                  }}
                />
              </div>
            ) : (
              <p className="mt-2 text-xs text-amber-800">Create a Studio document to unlock the visual page builder.</p>
            )}
          </div>

          <details className="rounded-lg border border-line bg-white p-3">
            <summary className="cursor-pointer text-xs font-bold text-slate-600">Fallback plain text body</summary>
            <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={4} className="mt-2 w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm" placeholder="Only used if no Studio body is published" />
          </details>

          <textarea value={faqsText} onChange={(e) => setFaqsText(e.target.value)} rows={4} className="w-full rounded-lg border border-line bg-white px-3 py-2 font-mono text-xs" placeholder={'FAQs: question on first line, answer below. Separate FAQs with ---'} />
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={copyFromEnglish} className="rounded-lg border border-line bg-white px-3 py-2 text-xs font-bold">
              Copy English seed structure
            </button>
          </div>
          {glossary.length > 0 && (
            <div className="rounded-lg border border-line bg-paper p-2 text-[11px] text-slate-600">
              <p className="font-bold text-slate-800">Glossary</p>
              <ul className="mt-1 columns-2 gap-2">
                {glossary.slice(0, 12).map((g) => (
                  <li key={g.term_en}>
                    <span className="font-semibold">{g.term_en}</span> → {g.term_local}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {readyIssues.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
              <p className="font-bold">Before Ready/Published</p>
              <ul className="mt-1 list-disc pl-4">
                {readyIssues.map((i) => (
                  <li key={i}>{i}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs font-semibold text-slate-600">
        <label className="flex items-center gap-2">
          <span className="text-slate-400">Workflow</span>
          <select
            value={status}
            onChange={(e) => {
              const v = e.target.value as WorkflowStatus;
              setWorkflow(v);
              setPublished(v === 'published');
              if (v === 'ready' || v === 'published') setIndexable(true);
            }}
            className="h-8 rounded-lg border border-line bg-white px-2 text-xs"
          >
            {(Object.keys(WORKFLOW_LABELS) as WorkflowStatus[]).map((k) => (
              <option key={k} value={k}>
                {WORKFLOW_LABELS[k]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} /> Published
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={indexable} onChange={(e) => setIndexable(e.target.checked)} /> Indexable
        </label>
        <button type="button" onClick={() => setExpanded(!expanded)} className="rounded-lg border border-line px-3 py-2 text-xs font-bold">
          {expanded ? 'Hide editor' : 'Edit content'}
        </button>
        <button onClick={save} disabled={saving} className="ml-auto rounded-lg bg-ink-950 px-3 py-2 text-xs font-bold text-white disabled:opacity-60">
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  );
}


export default LocalizationManager;

function LocalizationHealthPanel({ token }: { token?: string }) {
  const [data, setData] = useState<{ totals: { pages: number; published: number; issues: number }; issues: { id: number; type: string; message: string; slug?: string; country?: string }[] } | null>(null);
  useEffect(() => {
    if (!token) return;
    fetchLocalizationHealth(token).then(setData).catch(() => setData(null));
  }, [token]);
  if (!token || !data) return null;
  return (
    <div className="rounded-3xl border border-line bg-white p-5">
      <p className="text-xs font-bold uppercase tracking-widest text-emerald-700">Localization health</p>
      <p className="mt-1 text-sm text-slate-600">
        {data.totals.pages} pages · {data.totals.published} published ·{' '}
        <span className={data.totals.issues ? 'font-bold text-amber-700' : 'text-emerald-700'}>
          {data.totals.issues} issues
        </span>
      </p>
      {data.issues.length > 0 && (
        <ul className="mt-3 max-h-40 space-y-1 overflow-auto text-xs text-slate-600">
          {data.issues.slice(0, 20).map((i) => (
            <li key={`${i.id}-${i.type}`}>
              <span className="font-semibold text-ink-900">{i.country}/{i.slug}</span> — {i.message}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function LocalizationUiPackEditor({ token, languages }: { token?: string; languages: CountryLanguage[] }) {
  const codes = useMemo(() => {
    const set = new Set(languages.map((l) => l.code));
    ['en', 'vi', 'ms'].forEach((c) => set.add(c));
    return [...set];
  }, [languages]);
  const [code, setCode] = useState(codes[0] || 'en');
  const [strings, setStrings] = useState<Record<string, string>>({ ...getLocalizationUi(code) });
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    const base = { ...getLocalizationUi(code) };
    fetchLocalizationUiPack(code)
      .then((pack) => setStrings({ ...base, ...(pack?.strings || {}) }))
      .catch(() => setStrings(base));
  }, [code]);
  if (!token) return null;
  const save = async () => {
    setSaving(true);
    try {
      await saveLocalizationUiPack(code, strings, token);
      alert('UI pack saved');
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="rounded-3xl border border-line bg-white p-5">
      <p className="text-xs font-bold uppercase tracking-widest text-emerald-700">UI chrome packs</p>
      <p className="mt-1 text-xs text-slate-500">Edit shared labels for localized pages. Falls back to built-in defaults when empty.</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <select value={code} onChange={(e) => setCode(e.target.value)} className="h-9 rounded-lg border border-line bg-paper px-2 text-sm">
          {codes.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toLowerCase().slice(0, 10))}
          className="h-9 w-24 rounded-lg border border-line bg-paper px-2 text-sm"
          placeholder="new code"
        />
        <button type="button" onClick={save} disabled={saving} className="h-9 rounded-lg bg-ink-950 px-3 text-xs font-bold text-white disabled:opacity-60">
          {saving ? 'Saving…' : 'Save pack'}
        </button>
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-2">
        {LOCALIZATION_UI_KEYS.map((k) => (
          <label key={k} className="block text-xs">
            <span className="font-semibold text-slate-500">{k}</span>
            <input
              value={strings[k] || ''}
              onChange={(e) => setStrings({ ...strings, [k]: e.target.value })}
              className="mt-1 h-9 w-full rounded-lg border border-line bg-paper px-2 text-sm"
            />
          </label>
        ))}
      </div>
    </div>
  );
}

function LocalizationGlossaryEditor({
  token,
  languages,
  selectedCode,
}: {
  token?: string;
  languages: CountryLanguage[];
  selectedCode?: string;
}) {
  const [code, setCode] = useState(selectedCode || languages[0]?.code || 'vi');
  const [rows, setRows] = useState<{ id?: number; term_en: string; term_local: string; notes?: string }[]>([]);
  const [termEn, setTermEn] = useState('');
  const [termLocal, setTermLocal] = useState('');
  useEffect(() => {
    if (selectedCode) setCode(selectedCode);
  }, [selectedCode]);
  const reload = () => fetchLocalizationGlossary(code).then(setRows).catch(() => setRows([]));
  useEffect(() => {
    reload();
  }, [code]);
  if (!token) return null;
  const add = async () => {
    if (!termEn || !termLocal) return;
    await saveGlossaryTerm({ language_code: code, term_en: termEn, term_local: termLocal }, token);
    setTermEn('');
    setTermLocal('');
    reload();
  };
  return (
    <div className="rounded-3xl border border-line bg-white p-5">
      <p className="text-xs font-bold uppercase tracking-widest text-emerald-700">Translation glossary</p>
      <p className="mt-1 text-xs text-slate-500">Preferred terms shown while editing localized pages.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <select value={code} onChange={(e) => setCode(e.target.value)} className="h-9 rounded-lg border border-line px-2 text-sm">
          {[...new Set([...languages.map((l) => l.code), 'vi', 'ms'])].map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <input value={termEn} onChange={(e) => setTermEn(e.target.value)} placeholder="English term" className="h-9 rounded-lg border border-line px-2 text-sm" />
        <input value={termLocal} onChange={(e) => setTermLocal(e.target.value)} placeholder="Local term" className="h-9 rounded-lg border border-line px-2 text-sm" />
        <button type="button" onClick={add} className="h-9 rounded-lg bg-ink-950 px-3 text-xs font-bold text-white">Add term</button>
      </div>
      <ul className="mt-3 max-h-36 space-y-1 overflow-auto text-xs text-slate-600">
        {rows.map((r) => (
          <li key={r.id || r.term_en}>
            <span className="text-slate-400">{r.term_en}</span> → <strong>{r.term_local}</strong>
          </li>
        ))}
        {!rows.length && <li className="text-slate-400">No glossary terms yet.</li>}
      </ul>
    </div>
  );
}

