import { useEffect, useState } from 'react';
import { ArrowRight, BookOpen, CheckCircle2, ChevronRight, ExternalLink, Globe2, ShieldCheck, Sparkles, Users } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import type { ContentDocument, CountryBrokerRanking } from '../lib/types';
import { fetchCountryHubPageModel, type CountryHubPageModel } from '../lib/countryHubModel';
import PageBlocksRenderer from '../components/PageBlocksRenderer';
import BrokerCard from '../components/BrokerCard';
import { ButtonLink } from '../components/Button';
import { useSEO } from '../hooks/useSEO';
import { buildBreadcrumbJsonLd, buildFAQPageJsonLd, buildItemListJsonLd, countrySeo } from '../lib/seo';
import NotFound from './NotFound';

function documentPath(doc: ContentDocument, countrySlug: string) {
  if (doc.content_type === 'country-guide') return \`/\${countrySlug}/guides/\${doc.slug}\`;
  if (doc.content_type === 'country-best-for') return \`/\${countrySlug}/\${doc.slug}\`;
  if (doc.content_type === 'localized-guide') return \`/\${countrySlug}/\${String(doc.settings?.locale || doc.settings?.language || 'en')}/guides/\${doc.slug}\`;
  if (doc.content_type === 'localized-best-for') return \`/\${countrySlug}/\${String(doc.settings?.locale || doc.settings?.language || 'en')}/\${doc.slug}\`;
  return \`/\${countrySlug}\`;
}

function SectionHeading({ eyebrow, title, copy }: { eyebrow: string; title: string; copy?: string }) {
  return (
    <div className="max-w-3xl">
      <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-emerald-700">{eyebrow}</p>
      <h2 className="mt-2 font-display text-2xl font-bold tracking-tight text-ink-950 sm:text-3xl">{title}</h2>
      {copy && <p className="mt-3 text-sm leading-7 text-slate-600 sm:text-base">{copy}</p>}
    </div>
  );
}

function BestForCard({ doc, countrySlug }: { doc: ContentDocument; countrySlug: string }) {
  return (
    <Link to={documentPath(doc, countrySlug)} className="group rounded-2xl border border-line bg-white p-5 transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-soft">
      <div className="flex items-center justify-between gap-3">
        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-700">Best for</span>
        <ChevronRight size={15} className="text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-emerald-600" />
      </div>
      <h3 className="mt-4 font-display text-lg font-bold text-ink-950 group-hover:text-emerald-700">{doc.title}</h3>
      {doc.excerpt && <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-500">{doc.excerpt}</p>}
    </Link>
  );
}

function GuideCard({ doc, countrySlug }: { doc: ContentDocument; countrySlug: string }) {
  return (
    <Link to={documentPath(doc, countrySlug)} className="group rounded-2xl border border-line bg-paper p-5 transition hover:-translate-y-0.5 hover:border-emerald-300 hover:bg-white hover:shadow-soft">
      <BookOpen size={18} className="text-emerald-700" />
      <h3 className="mt-4 font-display text-lg font-bold text-ink-950 group-hover:text-emerald-700">{doc.title}</h3>
      {doc.excerpt && <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-500">{doc.excerpt}</p>}
      <span className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-emerald-700">Read guide <ArrowRight size={13} /></span>
    </Link>
  );
}

function BrokerRanking({ ranked, countrySlug }: { ranked: CountryBrokerRanking[]; countrySlug: string }) {
  return (
    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
      {ranked.slice(0, 9).map((row, index) => row.broker ? (
        <BrokerCard key={row.broker.id} broker={row.broker} rank={index + 1} countrySlug={countrySlug} note={row.editorial_note || undefined} />
      ) : null)}
    </div>
  );
}

export default function CountryDetail() {
  const { slug = '' } = useParams<{ slug: string }>();
  const [model, setModel] = useState<CountryHubPageModel | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    fetchCountryHubPageModel(slug).then(setModel).catch(() => setModel(null)).finally(() => setLoading(false));
  }, [slug]);

  const country = model?.country ?? null;
  const document = model?.countryDocument ?? null;
  const brokers = model?.availableBrokers ?? [];
  const ranked = model?.topBrokers ?? [];
  const faqs = model?.faqs ?? [];
  const guides = model?.countryGuides ?? [];
  const bestFor = model?.countryBestFor ?? [];

  const seo = country && document ? countrySeo({
    name: country.name,
    slug: country.slug,
    seo_title: document.seo_title,
    seo_description: document.seo_description,
  }, \`/\${country.slug}\`) : null;

  useSEO(seo, seo && country ? [
    buildBreadcrumbJsonLd([
      { name: 'Home', path: '/' },
      { name: 'Countries', path: '/countries' },
      { name: country.name, path: \`/\${country.slug}\` },
    ]),
    buildItemListJsonLd(\`Forex brokers available in \${country.name}\`, ranked.slice(0, 9).map((r) => ({
      name: r.broker?.name || '',
      path: \`/brokers/\${r.broker?.slug || ''}\`,
    }))),
    ...(faqs.length ? [buildFAQPageJsonLd(faqs.map((faq) => ({ question: faq.q, answer: faq.a })))] : []),
  ] : undefined);

  if (loading) return <div className="mx-auto max-w-7xl px-4 py-24 text-center text-sm text-slate-500">Loading country…</div>;
  if (!country || !document) return <NotFound />;

  const comparisonPath = model?.comparisonPath ?? '/compare';
  const methodologyPath = model?.methodologyPath ?? '/methodology';

  return (
    <main className="bg-paper">
      <div className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-4 text-xs text-slate-400 sm:px-6">
          <Link to="/" className="hover:text-ink-900">Home</Link><span>/</span>
          <Link to="/countries" className="hover:text-ink-900">Countries</Link><span>/</span>
          <span className="font-semibold text-ink-900">{country.name}</span>
        </div>
      </div>

      <section className="overflow-hidden border-b border-ink-900/10 bg-ink-950 text-white">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-center lg:py-16">
          <div>
            <div className="flex flex-wrap items-center gap-3 text-xs font-bold uppercase tracking-[0.2em] text-emerald-300">
              <span>{country.flag}</span><span>{country.name} forex brokers</span>
              <span className="rounded-full border border-white/10 px-2.5 py-1 text-[9px] tracking-[0.14em] text-slate-300">Country hub</span>
            </div>
            <h1 className="mt-4 max-w-4xl font-display text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">Find the best forex broker in {country.name} for you</h1>
            {document.excerpt && <p className="mt-5 max-w-3xl text-base leading-7 text-slate-300 sm:text-lg">{document.excerpt}</p>}
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <ButtonLink variant="primary" size="lg" to="/quiz">Find My Broker <ArrowRight size={16} /></ButtonLink>
              <Link to={comparisonPath} className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/10">Compare Brokers</Link>
            </div>
            <div className="mt-8 grid max-w-2xl grid-cols-3 gap-3 border-t border-white/10 pt-6">
              <div><p className="text-2xl font-display font-bold">{ranked.length}</p><p className="mt-1 text-[10px] uppercase tracking-[0.16em] text-slate-400">Ranked brokers</p></div>
              <div><p className="text-2xl font-display font-bold">{bestFor.length}</p><p className="mt-1 text-[10px] uppercase tracking-[0.16em] text-slate-400">Trading goals</p></div>
              <div><p className="text-2xl font-display font-bold">{guides.length}</p><p className="mt-1 text-[10px] uppercase tracking-[0.16em] text-slate-400">Guides</p></div>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-5 shadow-2xl">
            <div className="flex items-center gap-2 text-emerald-300"><Sparkles size={15} /><p className="text-[10px] font-bold uppercase tracking-[0.2em]">Start here</p></div>
            <h2 className="mt-3 font-display text-2xl font-bold">Choose using country-specific data</h2>
            <p className="mt-3 text-sm leading-6 text-slate-300">PipRank starts with brokers available to traders in {country.name}, then layers in broker quality, trading costs, platform fit and your priorities.</p>
            <div className="mt-5 space-y-3">
              {[
                [Globe2, 'Country eligibility', 'Only available brokers belong in the local ranking pool.'],
                [ShieldCheck, 'Broker quality', 'Trust, regulation, execution and withdrawal signals are considered.'],
                [Users, 'Your priorities', 'Use Best-For pages or BrokerMatch to narrow the shortlist.'],
              ].map(([Icon, title, copy]) => {
                const IconComponent = Icon as typeof Globe2;
                return <div key={String(title)} className="flex gap-3 rounded-2xl border border-white/10 bg-black/10 p-3">
                  <IconComponent size={17} className="mt-0.5 shrink-0 text-emerald-300" />
                  <div><p className="text-sm font-bold">{String(title)}</p><p className="mt-1 text-xs leading-5 text-slate-400">{String(copy)}</p></div>
                </div>;
              })}
            </div>
          </div>
        </div>
      </section>

      <nav className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-7xl gap-5 overflow-x-auto px-4 py-3 text-xs font-bold text-slate-500 sm:px-6">
          <a href="#brokers" className="whitespace-nowrap hover:text-emerald-700">Top brokers</a>
          {bestFor.length > 0 && <a href="#best-for" className="whitespace-nowrap hover:text-emerald-700">Best for</a>}
          {guides.length > 0 && <a href="#guides" className="whitespace-nowrap hover:text-emerald-700">Guides</a>}
          {faqs.length > 0 && <a href="#faq" className="whitespace-nowrap hover:text-emerald-700">FAQ</a>}
          <Link to={methodologyPath} className="whitespace-nowrap hover:text-emerald-700">Methodology</Link>
        </div>
      </nav>

      {(document.blocks?.length > 0 || document.html?.trim()) && (
        <section className="border-b border-line bg-white">
          <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:py-16">
            {document.blocks?.length > 0 ? (
              <PageBlocksRenderer
                blocks={document.blocks.filter((block: any) => !['broker_card', 'broker_grid', 'comparison_table'].includes(block?.type)) as any}
                brokers={brokers}
                countrySlug={country.slug}
                className="piprank-rich-content"
              />
            ) : (
              <div className="piprank-rich-content prose prose-slate max-w-none text-[15px] leading-7" dangerouslySetInnerHTML={{ __html: document.html || '' }} />
            )}
          </div>
        </section>
      )}

      {ranked.length > 0 && (
        <section id="brokers" className="scroll-mt-16 border-b border-line bg-paper">
          <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:py-16">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <SectionHeading eyebrow="Country ranking" title={\`Top forex brokers available in \${country.name}\`} copy="This shortlist uses the country-specific broker pool and the canonical country ranking system. Open a review or compare the options before you choose." />
              <Link to="/brokers" className="inline-flex shrink-0 items-center gap-1.5 text-sm font-bold text-emerald-700">View all broker reviews <ArrowRight size={14} /></Link>
            </div>
            <div className="mt-8"><BrokerRanking ranked={ranked} countrySlug={country.slug} /></div>
            <div className="mt-7 flex flex-wrap gap-4">
              <ButtonLink variant="dark" size="md" to="/quiz">Get Matched with a Broker</ButtonLink>
              <Link to={comparisonPath} className="inline-flex items-center gap-1.5 px-1 py-3 text-sm font-bold text-emerald-700">Compare brokers <ArrowRight size={14} /></Link>
            </div>
          </div>
        </section>
      )}

      {bestFor.length > 0 && (
        <section id="best-for" className="scroll-mt-16 border-b border-line bg-white">
          <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:py-16">
            <SectionHeading eyebrow="Choose by trading goal" title={\`Find a forex broker in \${country.name} for what matters to you\`} copy="Country Best-For pages inherit the canonical global intent owner and use the country-specific ranking for the broker shortlist." />
            <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{bestFor.slice(0, 9).map((doc) => <BestForCard key={doc.content_key} doc={doc} countrySlug={country.slug} />)}</div>
          </div>
        </section>
      )}

      {guides.length > 0 && (
        <section id="guides" className="scroll-mt-16 border-b border-line bg-paper">
          <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:py-16">
            <SectionHeading eyebrow="Country guides" title={\`Forex broker guides for \${country.name}\`} copy="Country guides are informational content. They remain separate from Best-For ownership and the country ranking engine." />
            <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">{guides.slice(0, 9).map((doc) => <GuideCard key={doc.content_key} doc={doc} countrySlug={country.slug} />)}</div>
          </div>
        </section>
      )}

      <section className="border-b border-line bg-white">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-12 sm:px-6 lg:grid-cols-3 lg:py-16">
          {[
            [Globe2, 'Country-specific availability', \`Broker availability, legal entities, leverage and account conditions can differ by country. Check the current terms that apply to residents of \${country.name}.\`],
            [ShieldCheck, 'A ranking you can inspect', 'PipRank separates country eligibility from broker scoring and editorial controls, so the local shortlist can be traced back to its ranking inputs.'],
            [CheckCircle2, 'Compare before opening', 'Use full broker reviews and the comparison tool to check costs, platforms, regulation and other details before visiting a broker.'],
          ].map(([Icon, title, copy]) => {
            const IconComponent = Icon as typeof Globe2;
            return <div key={String(title)} className="rounded-2xl border border-line bg-paper p-6"><IconComponent size={20} className="text-emerald-700" /><h2 className="mt-4 font-display text-xl font-bold">{String(title)}</h2><p className="mt-2 text-sm leading-6 text-slate-600">{String(copy)}</p></div>;
          })}
        </div>
      </section>

      {faqs.length > 0 && (
        <section id="faq" className="scroll-mt-16 border-b border-line bg-paper">
          <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:py-16">
            <SectionHeading eyebrow="Country FAQ" title={\`Forex broker questions for \${country.name}\`} />
            <div className="mt-8 overflow-hidden rounded-3xl border border-line bg-white">
              {faqs.map((faq) => <details key={faq.q} className="group border-b border-line px-5 py-5 last:border-b-0 sm:px-7"><summary className="flex cursor-pointer list-none items-center justify-between gap-6 font-display text-base font-bold text-ink-950"><span>{faq.q}</span><span className="text-xl font-normal text-slate-400 transition group-open:rotate-45">+</span></summary><p className="mt-3 pr-8 text-sm leading-7 text-slate-600">{faq.a}</p></details>)}
            </div>
          </div>
        </section>
      )}

      <section className="bg-ink-950 text-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-12 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:py-16">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-emerald-300">Next step</p>
            <h2 className="mt-2 font-display text-3xl font-bold sm:text-4xl">Want a shortlist based on your needs?</h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">BrokerMatch uses your country, trading style and priorities to narrow the available brokers before you compare them.</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <ButtonLink variant="primary" size="lg" to="/quiz">Find My Broker <ArrowRight size={16} /></ButtonLink>
            <Link to={methodologyPath} className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 px-5 py-3 text-sm font-bold text-white hover:bg-white/10">Read methodology <ExternalLink size={14} /></Link>
          </div>
        </div>
      </section>
    </main>
  );
}
