import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, Clock, ListOrdered } from 'lucide-react';
import type { Guide } from '../lib/types';
import { fetchGuide, fetchGuides } from '../lib/api';
import { ButtonLink } from '../components/Button';
import NewsletterForm from '../components/NewsletterForm';
import { fmtDate } from '../lib/format';
import { useSEO } from '../hooks/useSEO';
import { guideSeo, buildBreadcrumbJsonLd, buildWebPageJsonLd } from '../lib/seo';

export default function GuideDetail() {
  const { slug } = useParams<{ slug: string }>();
  const [guide, setGuide] = useState<Guide | null>(null);
  const [all, setAll] = useState<Guide[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    setError('');
    fetchGuide(slug)
      .then((g) => {
        setGuide(g);
        fetchGuides().then(setAll).catch(() => {});
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Guide not found'))
      .finally(() => setLoading(false));
  }, [slug]);

  const seoInput = guide ? guideSeo(guide) : null;
  useSEO(
    seoInput,
    guide
      ? [
          buildWebPageJsonLd(seoInput!),
          buildBreadcrumbJsonLd([
            { name: 'Home', path: '/' },
            { name: 'Guides', path: '/guides' },
            { name: guide.title, path: `/guides/${guide.slug}` },
          ]),
        ]
      : undefined,
  );

  const related = useMemo(() => {
    if (!guide) return [];
    const same = all.filter((g) => g.slug !== guide.slug && g.category === guide.category);
    const rest = all.filter((g) => g.slug !== guide.slug && g.category !== guide.category);
    return [...same, ...rest].slice(0, 3);
  }, [all, guide]);

  if (loading)
    return (
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
        <div className="h-64 animate-pulse rounded-3xl bg-slate-200" />
        <div className="mt-8 h-96 animate-pulse rounded-3xl border border-line bg-white" />
      </div>
    );

  if (error || !guide)
    return (
      <div className="mx-auto max-w-3xl px-4 py-24 text-center sm:px-6">
        <p className="font-display text-4xl font-bold text-ink-900">Guide not found</p>
        <p className="mt-3 text-slate-500">{error}</p>
        <Link
          to="/guides"
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-ink-900 px-5 py-3 text-sm font-semibold text-white"
        >
          <ArrowLeft size={15} /> Back to Guides
        </Link>
      </div>
    );

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <nav className="flex items-center gap-1.5 text-xs font-medium text-slate-400">
        <Link to="/" className="transition hover:text-ink-900">Home</Link>
        <span>/</span>
        <Link to="/guides" className="transition hover:text-ink-900">Guides</Link>
        <span>/</span>
        <span className="text-ink-900">{guide.category}</span>
      </nav>

      <div className="mt-6 overflow-hidden rounded-3xl">
        <img src={guide.image} alt={guide.title} className="aspect-[21/9] w-full object-cover" />
      </div>

      <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_280px]">
        <article className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-full bg-ink-900 px-3 py-1 font-bold text-white">{guide.category}</span>
            <span className="rounded-full border border-line bg-white px-3 py-1 font-semibold text-slate-500">
              {guide.level}
            </span>
            <span className="inline-flex items-center gap-1 font-medium text-slate-400">
              <Clock size={12} /> {guide.minutes} min read
            </span>
            <span className="text-slate-400">Updated {fmtDate(guide.published)}</span>
          </div>

          <h1 className="mt-4 font-display text-3xl font-bold leading-tight tracking-tight text-ink-900 sm:text-4xl">
            {guide.title}
          </h1>
          <p className="mt-3 text-lg leading-relaxed text-slate-500">{guide.excerpt}</p>

          <div className="mt-8 space-y-10">
            {guide.sections.map((sec, i) => (
              <section key={i} id={`sec-${i}`} className="scroll-mt-28">
                <h2 className="flex items-baseline gap-3 font-display text-2xl font-bold text-ink-900">
                  <span className="tnum text-sm font-bold text-emerald-600">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  {sec.heading}
                </h2>
                <div className="mt-3 space-y-4 text-[15.5px] leading-relaxed text-slate-600">
                  {sec.body.map((p, j) => (
                    <p key={j}>{p}</p>
                  ))}
                </div>
                {sec.bullets && (
                  <ul className="mt-4 space-y-2.5 rounded-2xl border border-line bg-white p-5">
                    {sec.bullets.map((b) => (
                      <li key={b} className="flex gap-2.5 text-sm font-medium text-slate-700">
                        <Check size={16} className="mt-0.5 shrink-0 text-emerald-600" strokeWidth={3} />
                        {b}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ))}
          </div>

          <div className="mt-12 rounded-2xl border border-line bg-white p-6">
            <p className="font-display text-lg font-bold text-ink-900">Keep learning, weekly</p>
            <p className="mt-1 text-sm text-slate-500">
              One research note every Friday — no noise.
            </p>
            <div className="mt-4">
              <NewsletterForm />
            </div>
          </div>
        </article>

        <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-2xl border border-line bg-white p-5">
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-400">
              <ListOrdered size={14} /> In this guide
            </p>
            <ol className="mt-3 space-y-2">
              {guide.sections.map((sec, i) => (
                <li key={i}>
                  <button
                    onClick={() => document.getElementById(`sec-${i}`)?.scrollIntoView({ behavior: 'smooth' })}
                    className="flex items-baseline gap-2 text-left text-sm font-medium text-slate-600 transition hover:text-emerald-700"
                  >
                    <span className="tnum text-xs font-bold text-slate-400">{i + 1}.</span>
                    {sec.heading}
                  </button>
                </li>
              ))}
            </ol>
          </div>

          <div className="rounded-2xl border border-line bg-ink-950 p-5">
            <p className="font-display text-sm font-bold text-white">Put it into practice</p>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-400">
              Ready to trade what you learned? Compare brokers graded on real testing data.
            </p>
            <ButtonLink variant="primary" size="sm" icon={ArrowRight} iconRight to="/brokers" className="mt-4">
              Browse brokers
            </ButtonLink>
          </div>
        </aside>
      </div>

      {/* related */}
      {related.length > 0 && (
        <div className="mt-16">
          <h2 className="font-display text-2xl font-bold text-ink-900">Read next</h2>
          <div className="mt-6 grid gap-5 sm:grid-cols-3">
            {related.map((g) => (
              <Link
                key={g.slug}
                to={`/guides/${g.slug}`}
                className="group overflow-hidden rounded-2xl border border-line bg-white"
              >
                <img
                  src={g.image}
                  alt={g.title}
                  className="aspect-[16/8] w-full object-cover transition duration-500 group-hover:scale-105"
                  loading="lazy"
                />
                <div className="p-4">
                  <span className="text-[10px] font-bold uppercase tracking-wide text-emerald-600">
                    {g.category}
                  </span>
                  <p className="mt-1 line-clamp-2 font-display text-sm font-bold leading-snug text-ink-900 transition group-hover:text-emerald-700">
                    {g.title}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
