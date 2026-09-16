import { ArrowRight, Languages } from 'lucide-react';

export type LocalizedContentLink = {
  label: string;
  href: string;
  type?: 'guide' | 'best-for';
};

type Props = {
  language: string;
  countryName: string;
  links: LocalizedContentLink[];
  className?: string;
};

/**
 * Country-hub presentation for canonical localized-guide and
 * localized-best-for documents. The data source remains content_documents;
 * this component only presents the internal-linking layer.
 */
export default function LocalizedContentSection({ language, countryName, links, className = '' }: Props) {
  if (!links.length) return null;

  return (
    <section className={`rounded-3xl border border-line bg-white p-6 shadow-soft sm:p-8 ${className}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
            <Languages size={15} aria-hidden="true" />
            Read in {language}
          </div>
          <h2 className="font-display text-2xl font-bold tracking-tight text-ink-950 sm:text-3xl">
            Forex guides and broker picks for {countryName}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Explore PipRank content in {language}, with links back to the relevant country, broker and trading pages.
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {links.map((link) => (
          <a
            key={`${link.type ?? 'content'}:${link.href}`}
            href={link.href}
            className="group flex items-center justify-between rounded-2xl border border-line bg-paper px-4 py-4 transition hover:-translate-y-0.5 hover:bg-white hover:shadow-sm"
          >
            <span className="min-w-0 pr-4">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {link.type === 'best-for' ? 'Best for' : 'Guide'}
              </span>
              <span className="mt-1 block text-sm font-bold text-ink-950">{link.label}</span>
            </span>
            <ArrowRight size={17} className="shrink-0 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-ink-950" aria-hidden="true" />
          </a>
        ))}
      </div>
    </section>
  );
}
