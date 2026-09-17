import { Link } from 'react-router-dom';
import type { Broker, ContentDocument, FAQ } from '../lib/types';
import PageBlocksRenderer from './PageBlocksRenderer';
import PipRankComparisonTable from './PipRankComparisonTable';
import StructuredBrokerDataCard from './StructuredBrokerDataCard';
import PipRankVerdictCard from './PipRankVerdictCard';
import BestForQuickFacts from './BestForQuickFacts';
import Monogram from './Monogram';
import { ButtonLink } from './Button';
import { isBlockShape } from '../lib/contentBlocks';
import { pipRankScore } from '../lib/score';
import { reviewerFor } from '../lib/team';

type Props = { document: ContentDocument; brokers: Broker[]; ranked: Broker[]; intentSlug: string; criteria: string[]; faqs: FAQ[]; countryName?: string; countrySlug?: string; localized?: boolean; locale?: string };
type ScopedBlock = { id: string; type: string; editorialSection?: string; [key: string]: unknown };

const blocksFor = (blocks: unknown, section: string, brokerSlug?: string) => {
  if (!isBlockShape(blocks)) return [] as ScopedBlock[];
  return (blocks as ScopedBlock[]).filter((block) => {
    if ((block.editorialSection || 'introduction') !== section) return false;
    return brokerSlug
      ? String(block.id || '').startsWith(`bestfor-broker:${brokerSlug}:`)
      : !String(block.id || '').startsWith('bestfor-broker:');
  });
};

function EditorialZone({ blocks, brokers, intentSlug, countrySlug, section }: { blocks: unknown; brokers: Broker[]; intentSlug: string; countrySlug?: string; section: string }) {
  const scoped = blocksFor(blocks, section);
  return scoped.length ? (
    <PageBlocksRenderer blocks={scoped as any} brokers={brokers} intent={intentSlug} countrySlug={countrySlug} className="piprank-rich-content" />
  ) : null;
}

function SectionIntro({ eyebrow, title, copy }: { eyebrow: string; title: string; copy?: string }) {
  return (
    <div className="mb-7 max-w-3xl">
      <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-emerald-700">{eyebrow}</p>
      <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-ink-950 sm:text-4xl">{title}</h2>
      {copy && <p className="mt-3 text-[15px] leading-7 text-slate-600 sm:text-base">{copy}</p>}
    </div>
  );
}

function RankingList({ ranked }: { ranked: Broker[] }) {
  return (
    <div className="overflow-hidden rounded-[24px] border border-line bg-white shadow-soft">
      {ranked.slice(0, 9).map((broker, index) => (
        <a
          key={broker.id}
          href={`#bestfor-${broker.slug}`}
          className="group grid grid-cols-[40px_44px_minmax(0,1fr)_auto] items-center gap-3 border-b border-line px-4 py-4 transition last:border-b-0 hover:bg-paper sm:grid-cols-[48px_52px_minmax(0,1fr)_auto] sm:px-6 sm:py-5"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-ink-950 font-display text-sm font-bold text-white sm:h-9 sm:w-9">{index + 1}</span>
          <Monogram name={broker.name} color={broker.brand_color} logoUrl={broker.logo_url} size={44} className="rounded-xl" />
          <span className="min-w-0">
            <span className="block truncate font-display text-[15px] font-bold text-ink-950 group-hover:text-emerald-700 sm:text-base">{broker.name}</span>
            <span className="mt-0.5 block truncate text-xs text-slate-500 sm:text-sm">{broker.tagline}</span>
          </span>
          <span className="text-right">
            <span className="tnum block font-display text-base font-bold text-emerald-700 sm:text-lg">{pipRankScore(broker)}</span>
            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">score</span>
          </span>
        </a>
      ))}
    </div>
  );
}

function BrokerModule({ broker, rank, blocks, brokers, intentSlug, countrySlug }: { broker: Broker; rank: number; blocks: unknown; brokers: Broker[]; intentSlug: string; countrySlug?: string }) {
  const editorial = blocksFor(blocks, 'detailed_analysis', broker.slug);
  return (
    <article id={`bestfor-${broker.slug}`} className="scroll-mt-28 overflow-hidden rounded-[28px] border border-line bg-white shadow-soft-lg">
      <header className="relative overflow-hidden bg-ink-950 px-5 py-6 text-white sm:px-8 sm:py-7">
        <div className="absolute right-0 top-0 h-40 w-40 translate-x-1/3 -translate-y-1/3 rounded-full bg-emerald-400/10 blur-2xl" />
        <div className="relative flex flex-wrap items-center gap-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/10 font-display text-sm font-bold">{rank}</span>
          <Monogram name={broker.name} color={broker.brand_color} logoUrl={broker.logo_url} size={56} className="rounded-2xl" />
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-300">Broker {rank}</p>
            <h3 className="mt-1 font-display text-2xl font-bold tracking-tight sm:text-3xl">{broker.name}</h3>
            <p className="mt-1 max-w-2xl text-sm text-slate-300">{broker.tagline}</p>
          </div>
          <div className="min-w-[86px] rounded-2xl border border-white/10 bg-white/[0.07] px-4 py-3 text-center">
            <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">PipRank</p>
            <p className="tnum mt-0.5 font-display text-2xl font-bold text-white">{pipRankScore(broker)}<span className="text-xs font-semibold text-slate-400">/100</span></p>
          </div>
        </div>
      </header>

      <div className="space-y-7 p-5 sm:p-8 lg:p-9">
        <BestForQuickFacts broker={broker} />
        <StructuredBrokerDataCard broker={broker} section="editorial" />
        {editorial.length ? (
          <section className="border-t border-line pt-7">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-700">Editorial analysis</p>
            <h4 className="mt-2 font-display text-xl font-bold tracking-tight text-ink-950 sm:text-2xl">Why {broker.name} fits this category</h4>
            <div className="mt-5 max-w-4xl">
              <PageBlocksRenderer blocks={editorial as any} brokers={brokers} intent={intentSlug} countrySlug={countrySlug} className="piprank-rich-content" editorialSection="detailed_analysis" />
            </div>
          </section>
        ) : null}
        <PipRankVerdictCard broker={broker} headline={`${broker.name} for this category`} showCta={false} />
      </div>
    </article>
  );
}

export default function BestForTemplate({ document, brokers, ranked, intentSlug, criteria, faqs, countryName, countrySlug, localized, locale }: Props) {
  const settings = (document.settings ?? {}) as Record<string, unknown>;
  const top9 = ranked.slice(0, 9);
  const top3 = top9.slice(0, 3);
  const top = top9[0];
  const author = reviewerFor(`best-for-${countrySlug ?? 'global'}-${intentSlug}-${locale ?? ''}`);
  const categoryLabel = intentSlug.replace(/-/g, ' ');
  const heroEyebrow = String(settings.label || (countryName ? `${countryName} · PipRank` : 'PipRank Best For'));
  const additional = Array.isArray(settings.sections) ? settings.sections as { title?: string; html?: string }[] : [];
  const updated = new Date(document.updated_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <main className="w-full overflow-x-clip bg-paper">
      <div className="w-full border-b border-line bg-paper px-4 py-4 sm:px-6 lg:px-8">
        <div className="mx-auto flex w-full max-w-[1440px] items-center gap-2 overflow-x-auto whitespace-nowrap text-xs text-slate-400">
          <Link to="/" className="transition hover:text-ink-950">Home</Link>
          <span>/</span>
          {countrySlug ? <><Link to={`/${countrySlug}`} className="transition hover:text-ink-950">{countryName || countrySlug}</Link><span>/</span></> : <><Link to="/best-for" className="transition hover:text-ink-950">Best For</Link><span>/</span></>}
          <span className="text-ink-900">{document.title}</span>
        </div>
      </div>

      <header className="w-full bg-ink-950 text-white">
        <div className="mx-auto grid w-full max-w-[1440px] gap-10 px-5 py-12 sm:px-8 sm:py-16 lg:grid-cols-[minmax(0,1fr)_470px] lg:items-center lg:px-12 lg:py-20 xl:px-16">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3 text-[10px] font-bold uppercase tracking-[0.22em]">
              <span className="text-emerald-300">{heroEyebrow}</span>
              <span className="h-1 w-1 rounded-full bg-slate-600" />
              <span className="text-slate-500">Updated {updated}</span>
            </div>
            <h1 className="mt-5 max-w-4xl font-display text-[clamp(2.5rem,6vw,5.5rem)] font-bold leading-[0.96] tracking-[-0.045em]">{document.title}</h1>
            {document.excerpt && <p className="mt-6 max-w-2xl text-[15px] leading-7 text-slate-300 sm:text-lg sm:leading-8">{document.excerpt}</p>}
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <ButtonLink variant="white" size="md" to="/find-my-broker">Match Me With a Broker</ButtonLink>
              {top && <a href="#bestfor-brokers" className="text-sm font-semibold text-slate-300 transition hover:text-white">Explore the rankings <span aria-hidden="true">↓</span></a>}
            </div>
          </div>

          <div className="grid grid-cols-2 overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.045] shadow-2xl sm:grid-cols-4 lg:grid-cols-2">
            <div className="border-b border-r border-white/10 p-5 sm:border-b-0 sm:border-r lg:border-b lg:border-r">
              <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-slate-500">Top match</p>
              <p className="mt-2 truncate font-display text-lg font-bold text-white">{top?.name || '—'}</p>
              {top && <p className="mt-1 text-xs text-emerald-300">{pipRankScore(top)}/100 PipRank</p>}
            </div>
            <div className="border-b border-white/10 p-5 sm:border-b-0 lg:border-b">
              <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-slate-500">Brokers ranked</p>
              <p className="mt-2 font-display text-3xl font-bold text-white">{top9.length}</p>
              <p className="mt-1 text-xs text-slate-400">eligible options</p>
            </div>
            <div className="border-r border-white/10 p-5 sm:border-r lg:border-r">
              <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-slate-500">Criteria</p>
              <p className="mt-2 font-display text-3xl font-bold text-white">{criteria.length}</p>
              <p className="mt-1 text-xs text-slate-400">evaluation factors</p>
            </div>
            <div className="p-5">
              <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-slate-500">Page type</p>
              <p className="mt-2 font-display text-lg font-bold capitalize text-white">{localized ? locale || 'Localized' : countryName ? countryName : 'Global'}</p>
              <p className="mt-1 text-xs text-slate-400">{categoryLabel}</p>
            </div>
          </div>
        </div>
      </header>

      <section className="w-full bg-white">
        <div className="mx-auto w-full max-w-[1440px] px-5 py-10 sm:px-8 sm:py-14 lg:px-12 xl:px-16">
          <div className="mx-auto max-w-5xl">
            <EditorialZone blocks={document.blocks} brokers={brokers} intentSlug={intentSlug} countrySlug={countrySlug} section="introduction" />
          </div>
        </div>
      </section>

      {top && (
        <section className="w-full border-y border-line bg-paper">
          <div className="mx-auto w-full max-w-[1440px] px-5 py-12 sm:px-8 sm:py-16 lg:px-12 xl:px-16">
            <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-center">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-emerald-700">PipRank Top Broker for {categoryLabel}</p>
                <h2 className="mt-3 max-w-3xl font-display text-3xl font-bold tracking-tight text-ink-950 sm:text-4xl lg:text-5xl">{top.name}</h2>
                <p className="mt-3 max-w-2xl text-[15px] leading-7 text-slate-600">{top.tagline}</p>
                <p className="mt-5 max-w-2xl text-sm leading-7 text-slate-600">Our current top match for this category, based on the same eligibility and ranking rules used for the full shortlist.</p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <ButtonLink variant="dark" size="md" to={`/brokers/${top.slug}`}>Review {top.name}</ButtonLink>
                  <a href="#bestfor-brokers" className="inline-flex items-center rounded-xl border border-line px-4 py-2.5 text-sm font-bold text-ink-950 transition hover:bg-white">See all 9</a>
                </div>
              </div>
              <div className="flex items-center gap-4 rounded-[24px] border border-line bg-white p-5 shadow-soft sm:p-6">
                <Monogram name={top.name} color={top.brand_color} logoUrl={top.logo_url} size={68} className="rounded-2xl" />
                <div className="min-w-0 flex-1">
                  <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-slate-400">PipRank Score</p>
                  <p className="tnum mt-1 font-display text-4xl font-bold tracking-tight text-ink-950">{pipRankScore(top)}<span className="text-sm font-semibold text-slate-400">/100</span></p>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {top9.length > 0 && (
        <section id="bestfor-brokers" className="w-full bg-white">
          <div className="mx-auto w-full max-w-[1440px] px-5 py-12 sm:px-8 sm:py-16 lg:px-12 xl:px-16">
            <SectionIntro eyebrow="Ranked shortlist" title={`Best 9 forex brokers for ${categoryLabel}`} copy="Explore the nine eligible brokers selected for this category. Each result links directly to its full analysis below." />
            <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
              <RankingList ranked={top9} />
              <aside className="hidden rounded-[24px] bg-paper p-6 lg:block">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">How to use this list</p>
                <p className="mt-3 text-sm leading-6 text-slate-600">Start with the ranking, then jump to any broker below for quick facts, the assessment, editorial analysis and verdict.</p>
                <a href="#bestfor-detail" className="mt-5 inline-flex text-sm font-bold text-emerald-700">Jump to broker analysis →</a>
              </aside>
            </div>
          </div>
        </section>
      )}

      {top3.length > 1 && (
        <section className="w-full bg-paper">
          <div className="mx-auto w-full max-w-[1440px] px-5 py-12 sm:px-8 sm:py-16 lg:px-12 xl:px-16">
            <SectionIntro eyebrow="Quick comparison" title="Compare the top 3" />
            <div className="overflow-x-auto">
              <PipRankComparisonTable brokers={top3} title="Top 3 broker comparison" showCta={false} />
            </div>
          </div>
        </section>
      )}

      <section id="bestfor-detail" className="w-full bg-[#f7f7f5]">
        <div className="mx-auto w-full max-w-[1440px] px-5 py-14 sm:px-8 sm:py-20 lg:px-12 xl:px-16">
          <SectionIntro eyebrow="Detailed broker analysis" title={`Best forex broker for ${categoryLabel}`} copy="A closer look at each broker in the shortlist, with the same structured facts, assessment and verdict used across PipRank." />
          <div className="space-y-8">{top9.map((broker, index) => <BrokerModule key={broker.id} broker={broker} rank={index + 1} blocks={document.blocks} brokers={brokers} intentSlug={intentSlug} countrySlug={countrySlug} />)}</div>
        </div>
      </section>

      {(blocksFor(document.blocks, 'why_these_brokers').length || blocksFor(document.blocks, 'who_its_for').length || blocksFor(document.blocks, 'who_its_not_for').length) ? (
        <section className="w-full bg-white">
          <div className="mx-auto w-full max-w-[1440px] px-5 py-14 sm:px-8 sm:py-18 lg:px-12 xl:px-16">
            <div className="mx-auto max-w-5xl space-y-12">
              <SectionIntro eyebrow="Editorial content" title="More about these recommendations" />
              <EditorialZone blocks={document.blocks} brokers={brokers} intentSlug={intentSlug} countrySlug={countrySlug} section="why_these_brokers" />
              <EditorialZone blocks={document.blocks} brokers={brokers} intentSlug={intentSlug} countrySlug={countrySlug} section="who_its_for" />
              <EditorialZone blocks={document.blocks} brokers={brokers} intentSlug={intentSlug} countrySlug={countrySlug} section="who_its_not_for" />
            </div>
          </div>
        </section>
      ) : null}

      {additional.length > 0 && (
        <section className="w-full bg-paper">
          <div className="mx-auto w-full max-w-[1440px] px-5 py-14 sm:px-8 lg:px-12 xl:px-16">
            <SectionIntro eyebrow="Other relevant content" title={`More on ${categoryLabel}`} />
            <div className="grid gap-5 md:grid-cols-2">{additional.map((section, index) => section.title || section.html ? (
              <article key={`${section.title}-${index}`} className="rounded-[24px] bg-white p-6 shadow-soft sm:p-8">
                {section.title && <h3 className="font-display text-xl font-bold text-ink-950">{section.title}</h3>}
                {section.html && <div className="piprank-rich-content mt-4" dangerouslySetInnerHTML={{ __html: section.html }} />}
              </article>
            ) : null)}</div>
          </div>
        </section>
      )}

      <section className="w-full bg-white">
        <div className="mx-auto w-full max-w-[1440px] px-5 py-14 sm:px-8 lg:px-12 xl:px-16">
          <div className="mx-auto max-w-5xl">
            <EditorialZone blocks={document.blocks} brokers={brokers} intentSlug={intentSlug} countrySlug={countrySlug} section="detailed_analysis" />
          </div>
        </div>
      </section>

      {faqs.length > 0 && (
        <section className="w-full bg-paper">
          <div className="mx-auto w-full max-w-[1440px] px-5 py-14 sm:px-8 sm:py-18 lg:px-12 xl:px-16">
            <div className="mx-auto max-w-4xl">
              <SectionIntro eyebrow="FAQ" title="Frequently asked questions" />
              <div className="divide-y divide-line overflow-hidden rounded-[24px] border border-line bg-white">{faqs.map((faq) => <details key={faq.q} className="group px-5 py-5 sm:px-7"><summary className="flex cursor-pointer list-none items-center justify-between gap-6 font-display text-base font-bold text-ink-950 sm:text-lg"><span>{faq.q}</span><span className="text-xl font-normal text-slate-400 transition group-open:rotate-45">+</span></summary><p className="mt-3 max-w-3xl pr-8 text-sm leading-7 text-slate-600">{faq.a}</p></details>)}</div>
            </div>
          </div>
        </section>
      )}

      {criteria.length > 0 && (
        <section className="w-full bg-white">
          <div className="mx-auto w-full max-w-[1440px] px-5 py-14 sm:px-8 lg:px-12 xl:px-16">
            <div className="mx-auto max-w-5xl">
              <SectionIntro eyebrow="Criteria" title="What we considered" />
              <div className="grid gap-px overflow-hidden rounded-[24px] border border-line bg-line sm:grid-cols-2">{criteria.map((criterion) => <div key={criterion} className="bg-paper p-5 text-sm leading-6 text-slate-600 sm:p-6">{criterion}</div>)}</div>
            </div>
          </div>
        </section>
      )}

      <section className="w-full bg-ink-950 text-white">
        <div className="mx-auto grid w-full max-w-[1440px] gap-8 px-5 py-14 sm:px-8 sm:py-18 lg:grid-cols-[1fr_auto] lg:items-center lg:px-12 xl:px-16">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-emerald-300">Methodology</p>
            <h2 className="mt-2 font-display text-3xl font-bold tracking-tight sm:text-4xl">How PipRank ranks brokers</h2>
            <p className="mt-3 max-w-2xl text-[15px] leading-7 text-slate-300">See the factors, scoring approach and review process used to evaluate brokers.</p>
          </div>
          <ButtonLink variant="white" size="md" to="/methodology">See our methodology</ButtonLink>
        </div>
      </section>

      <section className="w-full bg-white">
        <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-5 py-14 sm:px-8 sm:py-18 lg:flex-row lg:items-center lg:justify-between lg:px-12 xl:px-16">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-emerald-700">Personalized matching</p>
            <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-ink-950 sm:text-4xl">Get matched with a broker that fits you</h2>
            <p className="mt-3 max-w-2xl text-[15px] leading-7 text-slate-600">Tell us where you live, what you trade and what matters most. We’ll narrow down the brokers available to you.</p>
          </div>
          <ButtonLink variant="dark" size="md" to="/find-my-broker">Match Me With a Broker</ButtonLink>
        </div>
      </section>

      <section className="w-full border-t border-line bg-paper">
        <div className="mx-auto w-full max-w-[1440px] px-5 py-12 sm:px-8 sm:py-14 lg:px-12 xl:px-16">
          <div className="mx-auto flex max-w-5xl flex-col gap-5 sm:flex-row sm:items-start">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-sm font-black text-white" style={{ backgroundColor: author.color }}>{author.penName.split(' ').map((part) => part[0]).join('').slice(0, 2)}</div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-700">Author & reviewer</p>
              <h2 className="mt-1 font-display text-xl font-bold text-ink-950">Written & reviewed by {author.penName}</h2>
              <p className="mt-1 text-sm font-semibold text-slate-600">{author.role}</p>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">{author.bio}</p>
              <Link to={`/authors#${author.slug}`} className="mt-4 inline-flex text-xs font-bold text-emerald-700 hover:text-emerald-800">View author profile →</Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
