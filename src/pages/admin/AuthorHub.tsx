import { Plus } from 'lucide-react';
import type { ContentDocument } from '../../lib/types';
import EntityPanel from './components/EntityPanel';

export default function AuthorHub({
  authors,
  allContent,
  onNewAuthor,
  onEditAuthor,
}: {
  authors: ContentDocument[];
  allContent: ContentDocument[];
  onNewAuthor: () => void;
  onEditAuthor: (doc: ContentDocument) => void;
}) {
  const sorted = [...authors].sort(
    (a, b) =>
      Number(a.settings?.display_order ?? 0) -
      Number(b.settings?.display_order ?? 0)
  );

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-line bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-emerald-700">
              Author Hub
            </p>
            <h2 className="font-display text-2xl font-bold text-ink-900">
              Editorial authors and reviewers
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Manage public bios, roles, expertise, credentials, professional
              links, photos and attribution.
            </p>
          </div>

          <button
            onClick={onNewAuthor}
            className="inline-flex items-center gap-1.5 rounded-xl bg-ink-950 px-4 py-2 text-xs font-bold text-white"
          >
            <Plus size={14} /> New author
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {sorted.map((author) => (
          <button
            key={author.id || author.content_key}
            onClick={() => onEditAuthor(author)}
            className="rounded-2xl border border-line bg-white p-5 text-left transition hover:-translate-y-0.5 hover:shadow-soft"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-emerald-50 text-sm font-bold text-emerald-700">
                {author.settings?.photo_url ? (
                  <img
                    src={String(author.settings.photo_url)}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  author.title.slice(0, 2).toUpperCase()
                )}
              </div>

              <div>
                <p className="font-display text-lg font-bold text-ink-900">
                  {author.title || 'Untitled author'}
                </p>
                <p className="text-xs text-slate-400">
                  {String(author.settings?.role ?? 'Author')} ·{' '}
                  {author.published ? 'Published' : 'Draft'}
                </p>
              </div>
            </div>

            <p className="mt-3 line-clamp-3 text-sm text-slate-600">
              {String(author.settings?.short_bio ?? author.excerpt ?? '')}
            </p>

            <div className="mt-3 flex flex-wrap gap-1.5">
              {(
                (author.settings?.expertise as string[] | undefined) ?? []
              )
                .slice(0, 4)
                .map((x) => (
                  <span
                    key={x}
                    className="rounded-full bg-paper px-2 py-1 text-[11px] font-bold text-slate-500"
                  >
                    {x}
                  </span>
                ))}
            </div>
          </button>
        ))}

        {!sorted.length && (
          <div className="rounded-2xl border border-dashed border-line bg-white p-8 text-center text-sm text-slate-500">
            No author profiles yet. Create the first author to enable
            written-by, reviewed-by and fact-checked-by attribution.
          </div>
        )}
      </div>

      <EntityPanel
        title="Attribution readiness"
        items={[
          `${authors.length} author records`,
          `${
            allContent.filter(
              (d) =>
                d.settings?.written_by ||
                d.settings?.reviewed_by ||
                d.settings?.fact_checked_by
            ).length
          } content documents with attribution metadata`,
          'Use author records for Written by, Reviewed by and Fact checked by roles',
        ]}
      />
    </div>
  );
}
