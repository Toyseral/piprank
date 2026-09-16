import { Link } from 'react-router-dom';
import type { Broker, ContentDocument, FAQ } from '../lib/types';
import PageBlocksRenderer from './PageBlocksRenderer';
import BrokerCard from './BrokerCard';
import Reveal from './Reveal';
import { ButtonLink } from './Button';
import { isBlockShape } from '../lib/contentBlocks';

type Props = {
  document: ContentDocument;
  brokers: Broker[];
  ranked: Broker[];
  intentSlug: string;
  criteria: string[];
  faqs: FAQ[];
  countryName?: string;
  countrySlug?: string;
  localized?: boolean;
  locale?: string;
};

type ScopedBlock = { id: string; type: string; editorialSection?: string; [key: string]: unknown };

const sectionBlocks = (blocks: unknown, section: string) => {
  if (!isBlockShape(blocks)) return [];
  return (blocks as ScopedBlock[]).filter((block) => (block.editorialSection || 'introduction') === section);
};

function EditorialZone({ blocks, brokers, intentSlug, countrySlug, section }: { blocks: unknown; brokers: Broker[]; intentSlug: string; countrySlug?: string; section: string }) {
  const scoped = sectionBlocks(blocks, section);
  if (!scoped.length) return null;
  return <PageBlocksRenderer blocks={scoped as any} brokers={brokers} intent={intentSlug} countrySlug={countrySlug} className="piprank-rich-content space-y-8" />;
}

export default function BestForTemplate({ document, brokers, ranked, intentSlug, criteria, faqs, countryName, countrySlug, localized, locale }: Props) {
  const settings = (document.settings ?? {}) as Record<string, any>;
  const hasScopedEditorial = isBlockShape(document.blocks) && (document.blocks as ScopedBlock[]).some((block) => block.editorialSection);
  const editorialBlocks = hasScopedEditorial ? null : document.blocks;
  const top = ranked[0];
  const others = ranked.slice(1);
  const pageLabel = countryName ? `${document.title} in ${countryName}` : document.title;
  const ctaPath = '/find-my-broker';

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <nav aria-label="Breadcrumb" className="flex gap-1.5 text-xs text-slate-400">
        <Link to="/">Home</Link><span>/</span>
        {countrySlug ? <><Link to={`/${countrySlug}`}>{countryName || countrySlug}</Link><span>/</span></> : <><Link to="/best-for">Best For</Link><span>/</span></>}
        <span className="text-ink-900">{document.title}</span>
      </nav>
      <header className="mt-6 rounded-3xl bg-ink-950 p-7 text-white sm:p-10">
        {settings.image && <img src={String(settings.image)} alt="" className="mb-7 aspect-[21/8] w-full rounded-2xl object-cover" />}
        <p className="text-xs font-bold uppercase tracking-widest text-emerald-300">{countryName ? `${countryName}${localized && locale ? ` · ${locale}` : ''}` : 'PipRank Best For'}</p>
        <h1 className="mt-2 font-display text-3xl font-bold sm:text-4xl">{document.title}</h1>
        {document.excerpt && <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">{document.excerpt}</p>}
      </header>
      <section className="mt-8 rounded-3xl border border-emerald-200 bg-emerald-50/60 p-6 sm:p-8">
        <p className="text-xs font-bold uppercase tracking-widest text-emerald-700">Short answer</p>
        <p className="mt-2 max-w-3xl text-base leading-8 text-ink-900">These recommendations are based on the page criteria, broker eligibility and the trading characteristics relevant to {pageLabel.toLowerCase()}.</p>
        <ButtonLink variant="dark" size="md" to={ctaPath} className="mt-5">Match Me With a Broker</ButtonLink>
      </section>
      <EditorialZone blocks={document.blocks} brokers={brokers} intentSlug={intentSlug} countrySlug={countrySlug} section="introduction" />
      {!hasScopedEditorial && editorialBlocks && (isBlockShape(editorialBlocks) || document.html) && <article className="mt-8 rounded-3xl border border-line bg-white p-6 sm:p-9">{isBlockShape(editorialBlocks) ? <PageBlocksRenderer blocks={editorialBlocks as any} brokers={brokers} intent={intentSlug} countrySlug={countrySlug} className="piprank-rich-content space-y-8" /> : <div className="piprank-rich-content" dangerouslySetInnerHTML={{ __html: document.html || '' }} />}</article>}
      {top && <section className="mt-10"><p className="text-xs font-bold uppercase tracking-widest text-emerald-700">Top match</p><div className="mt-3 rounded-3xl border-2 border-emerald-200 bg-white p-6 shadow-sm sm:p-8"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-widest text-slate-400">PipRank recommendation</p><h2 className="mt-1 font-display text-2xl font-bold text-ink-950">{top.name}</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{top.tagline}</p></div><span className="rounded-full bg-ink-950 px-3 py-1.5 text-xs font-bold text-white">{top.rating}/100</span></div><div className="mt-5 grid gap-3 sm:grid-cols-3"><div className="rounded-xl bg-paper p-3"><p className="text-[10px] font-bold uppercase text-slate-400">EUR/USD spread</p><p className="mt-1 text-sm font-bold">{top.spread_eurusd} pips</p></div><div className="rounded-xl bg-paper p-3"><p className="text-[10px] font-bold uppercase text-slate-400">Minimum deposit</p><p className="mt-1 text-sm font-bold">{top.min_deposit}</p></div><div className="rounded-xl bg-paper p-3"><p className="text-[10px] font-bold uppercase text-slate-400">Regulation</p><p className="mt-1 text-sm font-bold">{top.regulations?.map((r) => r.body).filter(Boolean).join(', ') || 'See broker review'}</p></div></div><div className="mt-5 flex flex-wrap gap-3"><ButtonLink variant="dark" size="md" to={`/brokers/${top.slug}`}>Read {top.name} Review</ButtonLink><ButtonLink variant="outline" size="md" to={ctaPath}>Match Me With a Broker</ButtonLink></div></div></section>}
      {others.length > 0 && <section className="mt-10"><p className="text-xs font-bold uppercase tracking-widest text-emerald-700">Other strong matches</p><h2 className="mt-1 font-display text-2xl font-bold text-ink-950">Other brokers worth considering</h2><div className="mt-5 grid gap-5 lg:grid-cols-2">{others.map((broker, index) => <Reveal key={broker.slug}><BrokerCard broker={broker} rank={index + 2} intent={intentSlug} countrySlug={countrySlug} /></Reveal>)}</div></section>}
      {ranked.length > 0 && <section className="mt-10 overflow-hidden rounded-3xl border border-line bg-white"><div className="border-b border-line p-6"><p className="text-xs font-bold uppercase tracking-widest text-emerald-700">Quick comparison</p><h2 className="mt-1 font-display text-2xl font-bold">Compare the leading matches</h2></div><div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="bg-paper"><tr><th className="px-4 py-3 font-bold">Broker</th><th className="px-4 py-3 font-bold">PipRank score</th><th className="px-4 py-3 font-bold">EUR/USD</th><th className="px-4 py-3 font-bold">Min. deposit</th></tr></thead><tbody>{ranked.slice(0, 5).map((broker) => <tr key={broker.slug} className="border-t border-line"><td className="px-4 py-3 font-bold"><Link className="text-emerald-700" to={`/brokers/${broker.slug}`}>{broker.name}</Link></td><td className="px-4 py-3">{broker.rating}/100</td><td className="px-4 py-3">{broker.spread_eurusd} pips</td><td className="px-4 py-3">{broker.min_deposit}</td></tr>)}</tbody></table></div></section>}
      <EditorialZone blocks={document.blocks} brokers={brokers} intentSlug={intentSlug} countrySlug={countrySlug} section="why_these_brokers" />
      <EditorialZone blocks={document.blocks} brokers={brokers} intentSlug={intentSlug} countrySlug={countrySlug} section="who_its_for" />
      <EditorialZone blocks={document.blocks} brokers={brokers} intentSlug={intentSlug} countrySlug={countrySlug} section="who_its_not_for" />
      <EditorialZone blocks={document.blocks} brokers={brokers} intentSlug={intentSlug} countrySlug={countrySlug} section="detailed_analysis" />
      {criteria.length > 0 && <section className="mt-10 rounded-3xl border border-line bg-white p-6 sm:p-8"><p className="text-xs font-bold uppercase tracking-widest text-slate-400">How we choose</p><h2 className="mt-1 font-display text-2xl font-bold">The criteria behind this page</h2><ul className="mt-5 grid gap-3 sm:grid-cols-2">{criteria.map((criterion) => <li key={criterion} className="rounded-xl bg-paper p-4 text-sm leading-6 text-slate-600">{criterion}</li>)}</ul></section>}
      <EditorialZone blocks={document.blocks} brokers={brokers} intentSlug={intentSlug} countrySlug={countrySlug} section="methodology" />
      {faqs.length > 0 && <section className="mt-10 space-y-3"><p className="text-xs font-bold uppercase tracking-widest text-emerald-700">FAQ</p><h2 className="font-display text-2xl font-bold">Frequently asked questions</h2>{faqs.map((faq) => <details key={faq.q} className="rounded-2xl border border-line bg-white p-5"><summary className="cursor-pointer font-bold">{faq.q}</summary><p className="mt-3 text-sm leading-7 text-slate-600">{faq.a}</p></details>)}</section>}
      <section className="mt-10 rounded-3xl bg-ink-950 p-7 text-white sm:p-9"><p className="text-xs font-bold uppercase tracking-widest text-emerald-300">Personalized matching</p><h2 className="mt-2 font-display text-2xl font-bold">Not sure which broker fits your situation?</h2><p className="mt-2 max-w-2xl text-sm leading-7 text-slate-300">Tell PipRank where you live, what you trade and what matters most. We’ll narrow the list to brokers that fit your criteria.</p><ButtonLink variant="white" size="md" to={ctaPath} className="mt-5">Match Me With a Broker</ButtonLink></section>
    </div>
  );
}
