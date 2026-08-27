import { Link } from 'react-router-dom';
import Monogram from '../components/Monogram';
import Reveal from '../components/Reveal';
import { useSEO } from '../hooks/useSEO';
import { buildBreadcrumbJsonLd, buildWebPageJsonLd, SITE_NAME } from '../lib/seo';
import { TEAM } from '../lib/team';

const AUTHORS_SEO = {
  title: `Our Editorial Team | ${SITE_NAME}`,
  description: 'Meet the PipRank editorial team responsible for broker regulation checks, real-money testing, Health Score methodology and country coverage.',
  path: '/authors',
  type: 'website' as const,
};

export default function Authors() {
  useSEO(AUTHORS_SEO, [
    { ...buildWebPageJsonLd(AUTHORS_SEO), '@type': 'CollectionPage' },
    buildBreadcrumbJsonLd([
      { name: 'Home', path: '/' },
      { name: 'Editorial Team', path: '/authors' },
    ]),
  ]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-emerald-700">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        Editorial team
      </p>
      <h1 className="mt-2 font-display text-4xl font-bold tracking-tight text-ink-900 sm:text-5xl">
        Who writes <em className="serif-accent text-emerald-700">PipRank</em>
      </h1>
      <p className="mt-4 max-w-2xl text-base leading-relaxed text-slate-500">
        Reviews are attributed to the editor responsible for that section of our process, each following the
        same{' '}
        <Link to="/methodology" className="font-semibold text-emerald-700 hover:text-emerald-800">
          published methodology
        </Link>
        . Bylines are editorial identities used consistently across our reviews, not one-off freelance credits.
      </p>

      <div className="mt-10 space-y-4">
        {TEAM.map((t, i) => (
          <Reveal key={t.slug} delay={i * 0.05}>
            <div id={t.slug} className="scroll-mt-28 flex gap-4 rounded-2xl border border-line bg-white p-5 shadow-soft sm:p-6">
              <Monogram name={t.penName} color={t.color} size={56} className="shrink-0" />
              <div className="min-w-0">
                <p className="font-display text-lg font-bold text-ink-900">{t.penName}</p>
                <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">{t.role}</p>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{t.bio}</p>
                <p className="mt-2 text-xs font-semibold text-slate-400">Focus: {t.focus}</p>
              </div>
            </div>
          </Reveal>
        ))}
      </div>

      <div className="mt-10 rounded-2xl border border-line bg-paper p-5 text-xs leading-relaxed text-slate-500">
        Every review follows the same regulation, cost, execution, withdrawal, support and sentiment process —
        see the{' '}
        <Link to="/methodology" className="font-semibold text-emerald-700 hover:text-emerald-800">
          full Health Score methodology
        </Link>{' '}
        or the{' '}
        <Link to="/about" className="font-semibold text-emerald-700 hover:text-emerald-800">
          editorial policy
        </Link>
        .
      </div>
    </div>
  );
}
