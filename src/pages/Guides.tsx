import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import type { Guide } from '../lib/types';
import { fetchGuides } from '../lib/api';
import Reveal from '../components/Reveal';
import { useSEO } from '../hooks/useSEO';
import { staticPageSeo, buildBreadcrumbJsonLd, buildWebPageJsonLd, buildItemListJsonLd } from '../lib/seo';

export default function Guides() {
  const [guides, setGuides] = useState<Guide[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cat, setCat] = useState('All');

  useEffect(() => {
    fetchGuides()
      .then(setGuides)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load guides'))
      .finally(() => setLoading(false));
  }, []);

  const cats = useMemo(() => ['All', ...new Set(guides.map((g) => g.category))], [guides]);
  const list = useMemo(
    () => (cat === 'All' ? guides : guides.filter((g) => g.category === cat)),
    [guides, cat]
  );

  useSEO(staticPageSeo.guides, [
    buildWebPageJsonLd(staticPageSeo.guides),
    buildBreadcrumbJsonLd([
      { name: 'Home', path: '/' },
      { name: 'Guides', path: '/guides' },
    ]),
    buildItemListJsonLd(
      'Forex trading guides',
      guides.map((g) => ({ name: g.title, path: `/guides/${g.slug}` })),
    ),
  ]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <div className="max-w-2xl">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-600">PipRank Guides</p>
        <h1 className="mt-2 font-display text-4xl font-bold tracking-tight text-ink-900">
          Forex <em className="serif-accent text-emerald-700">trading guides</em> that teach mechanics, not hype
        </h1>
        <p className="mt-3 text-slate-500">
          Research-desk guides covering the foundations, costs, risk and the psychology that decides who
          survives their first year.
        </p>
      </div>

      <div className="mt-7 flex flex-wrap gap-2">
        {cats.map((c) => (
          <button
            key={c}
            onClick={() => setCat(c)}
            className={`rounded-full border px-4 py-2 text-xs font-bold transition ${
              cat === c
                ? 'border-ink-900 bg-ink-900 text-white'
                : 'border-line bg-white text-slate-500 hover:border-ink-900 hover:text-ink-900'
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {error && (
        <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-80 animate-pulse rounded-2xl border border-line bg-white" />
          ))}
        </div>
      ) : (
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((g, i) => (
            <Reveal key={g.slug} delay={Math.min(i, 4) * 0.06}>
              <Link
                to={`/guides/${g.slug}`}
                className="group flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-white transition hover:-translate-y-1 hover:shadow-soft-lg"
              >
                <div className="relative overflow-hidden">
                  <img
                    src={g.image}
                    alt={g.title}
                    className="aspect-[16/9] w-full object-cover transition duration-500 group-hover:scale-105"
                    loading="lazy"
                  />
                  <span className="absolute left-3 top-3 rounded-full bg-ink-950/90 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white backdrop-blur">
                    {g.category}
                  </span>
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <h2 className="font-display text-lg font-bold leading-snug text-ink-900 transition group-hover:text-emerald-700">
                    {g.title}
                  </h2>
                  <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-slate-500">{g.excerpt}</p>
                  <div className="mt-auto flex items-center justify-between pt-4">
                    <span className="text-xs font-medium text-slate-400">
                      {g.minutes} min · {g.level}
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600">
                      Read <ArrowRight size={12} className="transition group-hover:translate-x-0.5" />
                    </span>
                  </div>
                </div>
              </Link>
            </Reveal>
          ))}
        </div>
      )}
    </div>
  );
}
