import { useEffect, useMemo, useState } from 'react';
import type { Broker, ContentDocument, CountryPage } from '../../lib/types';
import UnifiedGuideEditor from '../../components/admin/UnifiedGuideEditor';
import { Eye, Loader2, Pencil, Plus } from 'lucide-react';

type Props = {
  country: CountryPage;
  countries: CountryPage[];
  brokers: Broker[];
  token: string;
  notify: (message: string) => void;
};

export default function CountryGuides({ country, countries, brokers, token, notify }: Props) {
  const [documents, setDocuments] = useState<ContentDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<ContentDocument | null | 'new'>(null);

  const headers = useMemo(
    () => ({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    }),
    [token]
  );

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/content-documents', { headers });
      const data = await res.json().catch(() => []);
      if (!res.ok || !Array.isArray(data)) throw new Error('Could not load country guides');
      setDocuments(
        data.filter(
          (doc: ContentDocument) =>
            doc.content_type === 'country-guide' && doc.country_slug === country.slug
        )
      );
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not load country guides');
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [country.slug, token]);

  const save = async (fields: Record<string, unknown>, isNew: boolean) => {
    const slug = String(fields.slug ?? '').trim();
    if (!slug) throw new Error('Guide slug is required.');

    const payload = {
      ...fields,
      content_type: 'country-guide',
      country_slug: country.slug,
      content_key: `country-guide:${country.slug}:${slug}`,
    };

    const res = await fetch('/api/content-documents', {
      method: isNew ? 'POST' : 'PUT',
      headers,
      body: JSON.stringify(
        isNew
          ? payload
          : { ...payload, id: editing && editing !== 'new' ? editing.id : undefined }
      ),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Could not save country guide');

    notify(isNew ? 'Country guide created' : 'Country guide saved');
    setEditing(null);
    await load();
  };

  return (
    <>
      <div className="rounded-2xl border border-line bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="font-display text-lg font-bold text-ink-900">Country Guides</h3>
            <p className="mt-0.5 text-xs text-slate-500">
              Canonical editorial guides for {country.name}. Localized guides and Country Best-For pages are managed separately.
            </p>
          </div>
          <button
            onClick={() => setEditing('new')}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 px-3.5 py-1.5 text-xs font-bold text-white"
          >
            <Plus size={13} /> Add new guide
          </button>
        </div>

        <div className="mt-3 divide-y divide-line rounded-xl border border-line">
          {loading ? (
            <div className="flex items-center justify-center gap-2 p-8 text-sm text-slate-400">
              <Loader2 size={15} className="animate-spin" /> Loading country guides…
            </div>
          ) : documents.length ? (
            documents.map((doc) => (
              <div key={doc.id} className="flex items-center justify-between px-4 py-3">
                <button onClick={() => setEditing(doc)} className="min-w-0 flex-1 text-left">
                  <span className="block truncate text-sm font-bold text-ink-900">
                    {doc.title || doc.slug || doc.content_key}
                  </span>
                  <span className="text-xs text-slate-400">
                    /{country.slug}/guides/{doc.slug} · {doc.published ? 'Published' : 'Draft'} · {doc.indexable ? 'Indexable' : 'Noindex'}
                  </span>
                </button>
                <div className="flex shrink-0 items-center gap-1">
                  {doc.slug && (
                    <a
                      href={`/${country.slug}/guides/${doc.slug}`}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-lg p-2 text-slate-400 hover:bg-paper"
                      title="Preview live guide"
                    >
                      <Eye size={14} />
                    </a>
                  )}
                  <button
                    onClick={() => setEditing(doc)}
                    className="rounded-lg p-2 text-slate-400 hover:bg-paper"
                    title="Edit guide"
                  >
                    <Pencil size={14} />
                  </button>
                </div>
              </div>
            ))
          ) : (
            <p className="p-5 text-sm text-slate-400">
              No country guides yet. Create the first guide with the unified guide editor.
            </p>
          )}
        </div>
      </div>

      {editing && (
        <UnifiedGuideEditor
          document={editing === 'new' ? null : editing}
          countries={countries}
          brokers={brokers}
          token={token}
          defaultContentType="country-guide"
          defaultCountrySlug={country.slug}
          onClose={() => setEditing(null)}
          onSave={save}
        />
      )}
    </>
  );
}
