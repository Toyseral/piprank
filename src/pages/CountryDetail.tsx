import { useEffect, useState } from 'react';
import { ArrowRight, CheckCircle2, ExternalLink } from 'lucide-react';
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
  if (doc.content_type === 'country-guide') return `/${countrySlug}/guides/${doc.slug}`;
  if (doc.content_type === 'country-best-for') return `/${countrySlug}/${doc.slug}`;
  if (doc.content_type === 'localized-guide') return `/${countrySlug}/${String(doc.settings?.locale || doc.settings?.language || 'en')}/guides/${doc.slug}`;
  if (doc.content_type === 'localized-best-for') return `/${countrySlug}/${String(doc.settings?.locale || doc.settings?.language || 'en')}/${doc.slug}`;
  return `/${countrySlug}`;
}

function SectionIntro({ eyebrow, title, copy }: { eyebrow: string; title: string; copy?: string }) {
  return (
    <div className="mb-7 max-w-3xl">
      <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-emerald-700">{eyebrow}</p>
      <h2 className="mt-2 font-display text-2xl font-bold tracking-tight text-ink-950 sm:text-3xl">{title}</h2>
      {copy && <p className="mt-3 text-sm leading-7 text-slate-600 sm:text-base">{copy}</p>}
    </div>
  );
}

function GuideCard({ doc, countrySlug }: { doc: ContentDocument; countrySlug: string }) {
  return (
    <Link to={documentPath(doc, countrySlug)} className="group rounded-2xl border border-line bg-white p-5 transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-soft">
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-700">PipRank Guide</p>
      <h3 className="mt-2 font-display text-lg font-bold text-ink-950 group-hover:text-emerald-700">{doc.title}</h3>
      {doc.excerpt && <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-500">{doc.excerpt}</p>}
      <span className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-emerald-700">Read guide <ArrowRight size={13} /></span>
    </Link>
  );
}

function BestForCard({ doc, countrySlug }: { doc: ContentDocument; countrySlug: string }) {
  return (
    <Link to={documentPath(doc, countrySlug)} className="group rounded-2xl border border-line bg-white p-5 transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-soft">
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-700">Best for</p>
      <h3 className="mt-2 font-display text-lg font-bold text-ink-950 group-hover:text-emerald-700">{doc.title}</h3>
      {doc.excerpt && <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-500">{doc.excerpt}</p>}
      <span className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-emerald-700">Explore brokers <ArrowRight size={13} /></span>
    </Link>
  );
}

function BrokerRanking({ ranked, countrySlug }: { ranked: CountryBrokerRanking[]; countrySlug: string }) {
  return (
    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
      {ranked.slice(0, 9).map((row, index) => row.broker && (
        <BrokerCard key={row.broker.id} broker={row.broker} rank={index + 1} countrySlug={countrySlug} note={row.editorial_note || undefined} />
      ))}
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
    fetchCountryHubPageModel(slug)
      .then(setModel)
      .catch(() => setModel(null))
      .finally(() => setLoading(false));
  }, [slug]);

  const country = model?.country ?? null;
  const document = model?.countryDocument ?? null;
  const brokers = model?.availableBrokers ?? [];
  const ranked = model?.topBrokers ?? [];
  const faqs = model?.faqs ?? [];
  const guides = model?.countryGuides ?? [];
  const bestFor = model?.countryBestFor ?? [];
  // Localized documents are intentionally not mixed into the default country hub.
  // The hub has no locale selector, so rendering every locale here would create
  // duplicate/competing navigation. They remain discoverable through canonical localized routes.

  const seo = country && document
    ? countrySeo(
        { ...country, seo_title: document.seo_title ?? country.seo_title, seo_description: document.seo_description ?? country.seo_description },
        `/${country.slug}`,
      )
    : null;

  useSEO(
    seo,
    seo && country
      ? [
          buildBreadcrumbJsonLd([
            { name: 'Home', path: '/' },
            { name: 'Countries', path: '/countries' },
            { name: country.name, path: `/${country.slug}` },
          ]),
          buildItemListJsonLd(
            `Forex brokers available in ${country.name}`,
            ranked.slice(0, 9).map((r) => ({ name: r.broker?.name || '', path: `/brokers/${r.broker?.slug || ''}` })),
          ),
          ...(faqs.length ? [buildFAQPageJsonLd(faqs.map((faq) => ({ question: faq.q, answer: faq.a })))] : []),
        ]
      : undefined,
  );

  if (loading) return <div className="mx-auto max-w-7xl px-4 py-20 text-center text-sm text-slate-500">Loading country…</div>;
  if (!country || !document) return <NotFound />;

  return (
    <main className="bg-paper">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <nav className="flex gap-1.5 text-xs text-slate-400">
          <Link to="/" className="hover:text-ink-900">Home</Link><span>/</span>
          <Link to="/countries" className="hover:text-ink-900">Countries</Link><span>/</span>
          <span className="text-ink-900">{country.name}</span>
        </nav>
      </div>

      <section className="border-y border-line bg-ink-950 text-white">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-center lg:py-16">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-300">{country.flag} {country.name} forex brokers</p>
            <h1 className="mt-3 max-w-4xl font-display text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">{document.title}</h1>
            {document.excerpt && <p className="mt-5 max-w-3xl text-base leading-7 text-slate-300 sm:text-lg">{document.excerpt}</p>}
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <ButtonLink variant="primary" size="lg" to="/find-my-broker">Get Matched with a Broker <ArrowRight size={16} /></ButtonLink>
              <Link to="/compare" className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/10">Compare Brokers</Link>
            </div>
            <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-300">
              <span className="inline-flex items-center gap-1.5"><CheckCircle2 size={14} className="text-emerald-300" /> Country eligibility is opt-out</span>
              <span className="inline-flex items-center gap-1.5"><CheckCircle2 size={14} className="text-emerald-300" /> Live broker data</span>
            </div>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-300">Quick start</p>
            <h2 className="mt-2 font-display text-xl font-bold">Find a broker that fits your needs</h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">Tell PipRank where you trade from and what matters to you. We’ll narrow the available brokers before you compare them.</p>
            <ButtonLink variant="primary" size="md" to="/find-my-broker" className="mt-5 w-full">Find My Broker</ButtonLink>
          </div>
        </div>
      </section>

      {document.blocks?.length > 0 && (
        <section className="border-b border-line bg-white">
          <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:py-16">
            <PageBlocksRenderer
              blocks={document.blocks.filter((block: any) => !['broker_card', 'broker_grid', 'comparison_table'].includes(block?.type)) as any}
              brokers={brokers}
              countrySlug={country.slug}
              className="piprank-rich-content"
            />
          </div>
        </section>
      )}

      {ranked.length > 0 && (
        <section className="border-b border-line bg-paper">
          <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:py-16">
            <SectionIntro
              eyebrow="Top brokers for this country"
              title={`Forex brokers available in ${country.name}`}
              copy={`These brokers are selected from PipRank’s country eligibility and ranking system. Open a full review or compare options before you choose.`}
            />
            <BrokerRanking ranked={ranked} countrySlug={country.slug} />
            <div className="mt-7 flex flex-wrap gap-4">
              <ButtonLink variant="dark" size="md" to="/find-my-broker">Get Matched with a Broker</ButtonLink>
              <Link to="/compare" className="inline-flex items-center gap-1.5 px-1 py-3 text-sm font-bold text-emerald-700">Compare brokers <ArrowRight size={14} /></Link>
            </div>
          </div>
        </section>
      )}

      {bestFor.length > 0 && (
        <section className="border-b border-line bg-white">
          <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:py-16">
            <SectionIntro eyebrow="Choose by trading need" title={`Best forex brokers in ${country.name} by need`} copy="Explore the country-specific broker pages for the features and trading styles that matter to you." />
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {bestFor.slice(0, 9).map((doc) => <BestForCard key={doc.content_key} doc={doc} countrySlug={country.slug} />)}
            </div>
          </div>
        </section>
      )}

      {guides.length > 0 && (
        <section className="border-b border-line bg-paper">
          <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:py-16">
            <SectionIntro eyebrow="Forex broker guides" title={`Forex broker guides for ${country.name}`} copy="Country-specific guides live in the canonical guide system and are kept separate from the country hub itself." />
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {guides.slice(0, 9).map((doc) => <GuideCard key={doc.content_key} doc={doc} countrySlug={country.slug} />)}
            </div>
          </div>
        </section>
      )}

      {faqs.length > 0 && (
        <section className="border-b border-line bg-white">
          <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:py-16">
            <SectionIntro eyebrow="Country FAQ" title={`Forex broker questions for ${country.name}`} />
            <div className="overflow-hidden rounded-3xl border border-line bg-white">
              {faqs.map((faq) => (
                <details key={faq.q} className="group border-b border-line px-5 py-5 last:border-b-0 sm:px-7">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-6 font-display text-base font-bold text-ink-950">
                    <span>{faq.q}</span><span className="text-xl font-normal text-slate-400 transition group-open:rotate-45">+</span>
                  </summary>
                  <p className="mt-3 pr-8 text-sm leading-7 text-slate-600">{faq.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="border-b border-line bg-paper">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 lg:grid-cols-[1fr_320px] lg:items-center lg:py-16">
          <div>
            <SectionIntro eyebrow="Compare & verify" title={`Compare brokers available in ${country.name}`} copy="Use PipRank’s comparison tools to review pricing, platforms, trust signals and other broker data side by side." />
            <Link to={model.comparisonPath} className="inline-flex items-center gap-1.5 text-sm font-bold text-emerald-700">Open broker comparison <ArrowRight size={14} /></Link>
          </div>
          <div className="rounded-2xl border border-line bg-white p-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">PipRank methodology</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">Learn how PipRank evaluates broker data, eligibility and category fit.</p>
            <Link to={model.methodologyPath} className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-emerald-700">Read methodology <ArrowRight size={13} /></Link>
          </div>
        </div>
      </section>

      <section className="bg-ink-950 text-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-12 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:py-16">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-emerald-300">Personalized matching</p>
            <h2 className="mt-2 font-display text-3xl font-bold sm:text-4xl">Find the broker that fits you</h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">Tell us where you trade from, what you trade and which features matter most. PipRank will narrow the available options for you.</p>
          </div>
          <ButtonLink variant="primary" size="lg" to="/find-my-broker">Match Me With a Broker <ArrowRight size={16} /></ButtonLink>
        </div>
      </section>

      <section className="border-t border-line bg-paper">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
          <Link to={model.methodologyPath} className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-emerald-700"><ExternalLink size={13} /> How PipRank evaluates brokers</Link>
        </div>
      </section>
    </main>
  );
}
