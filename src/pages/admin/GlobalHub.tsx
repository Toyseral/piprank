import { Eye, Pencil, Plus } from 'lucide-react';
import type { Guide, Intent } from '../../lib/types';

export default function GlobalHub({
  guides,
  intents,
  onNewGuide,
  onEditGuide,
  onNewIntent,
  onEditIntent,
  intentToTopic,
}: {
  guides: Guide[];
  intents: Intent[];
  onNewGuide: () => void;
  onEditGuide: (g: Guide) => void;
  onNewIntent: () => void;
  onEditIntent: (i: Intent) => void;
  intentToTopic: Record<string, string>;
}) {
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <div className="rounded-2xl border border-line bg-white shadow-soft">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <p className="font-display text-base font-bold text-ink-900">
            Guides ({guides.length})
          </p>
          <button
            onClick={onNewGuide}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 px-3.5 py-1.5 text-xs font-bold text-white transition hover:bg-emerald-600"
          >
            <Plus size={13} /> New guide
          </button>
        </div>

        <div className="divide-y divide-line">
          {guides.map((g) => (
            <div key={g.id} className="flex items-center gap-3 px-5 py-3.5">
              <img
                src={g.image}
                alt=""
                className="h-10 w-16 shrink-0 rounded-lg object-cover"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-ink-900">
                  {g.title}
                </p>
                <p className="text-xs text-slate-400">
                  {g.category} · {g.level} · {g.minutes} min
                </p>
              </div>

              <a
                href={`/guides/${g.slug}`}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg p-2 text-slate-400 hover:bg-paper hover:text-ink-900"
                title="Preview live page"
              >
                <Eye size={14} />
              </a>

              <button
                onClick={() => onEditGuide(g)}
                className="rounded-lg p-2 text-slate-400 hover:bg-paper hover:text-ink-900"
                title="Edit guide"
              >
                <Pencil size={14} />
              </button>
            </div>
          ))}

          {!guides.length && (
            <p className="p-5 text-sm text-slate-400">No guides yet.</p>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-line bg-white shadow-soft">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <p className="font-display text-base font-bold text-ink-900">
            Best-For pages ({intents.length})
          </p>
          <button
            onClick={onNewIntent}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 px-3.5 py-1.5 text-xs font-bold text-white transition hover:bg-emerald-600"
          >
            <Plus size={13} /> New page
          </button>
        </div>

        <div className="divide-y divide-line">
          {intents.map((i) => (
            <div key={i.id} className="flex items-center gap-3 px-5 py-3.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-ink-900">
                  {i.label}
                </p>
                <p className="text-xs text-slate-400">
                  /{intentToTopic[i.slug] ?? i.slug}
                </p>
              </div>

              <a
                href={`/${intentToTopic[i.slug] ?? i.slug}`}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg p-2 text-slate-400 hover:bg-paper hover:text-ink-900"
                title="Preview live page"
              >
                <Eye size={14} />
              </a>

              <button
                onClick={() => onEditIntent(i)}
                className="rounded-lg p-2 text-slate-400 hover:bg-paper hover:text-ink-900"
                title="Edit page"
              >
                <Pencil size={14} />
              </button>
            </div>
          ))}

          {!intents.length && (
            <p className="p-5 text-sm text-slate-400">
              No best-for pages yet.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
