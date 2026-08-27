import { Link } from 'react-router-dom';
import {
  BadgeCheck,
  BookOpen,
  Database,
  Landmark,
  Mail,
  PencilLine,
  RefreshCw,
  ShieldCheck,
  Target,
  Users,
  Wallet,
} from 'lucide-react';
import Reveal from '../components/Reveal';
import { useSEO } from '../hooks/useSEO';
import { buildBreadcrumbJsonLd, buildWebPageJsonLd, staticPageSeo } from '../lib/seo';

const SECTIONS = [
  { id: 'about', label: 'About PipRank' },
  { id: 'editorial-policy', label: 'Editorial policy' },
  { id: 'how-we-make-money', label: 'How we make money' },
  { id: 'methodology', label: 'Review & scoring methodology' },
  { id: 'data-sources', label: 'Data sources' },
  { id: 'update-policy', label: 'Update policy' },
  { id: 'corrections-policy', label: 'Corrections policy' },
  { id: 'author-reviewer-info', label: 'Author & reviewer information' },
  { id: 'regulatory-explanations', label: 'Understanding regulators' },
];

const REGULATORS = [
  {
    code: 'FCA',
    name: 'Financial Conduct Authority (UK)',
    note: 'Requires segregated client funds and participation in the Financial Services Compensation Scheme (FSCS) for eligible clients. Widely regarded as one of the stricter tier-1 regulators.',
  },
  {
    code: 'ASIC',
    name: 'Australian Securities & Investments Commission',
    note: 'Regulates leverage limits for retail clients and enforces negative balance protection on CFD accounts.',
  },
  {
    code: 'CySEC',
    name: 'Cyprus Securities & Exchange Commission',
    note: 'An EU/MiFID-passportable regulator. Oversight standards are real but historically lighter in practice than FCA or ASIC — entity matters more than the licence badge alone.',
  },
  {
    code: 'SEC / FINRA',
    name: 'U.S. Securities and Exchange Commission / FINRA',
    note: 'The U.S. retail forex market is narrow by design — very few brokers accept U.S. residents due to strict capital and leverage rules (typically 50:1 max on majors).',
  },
  {
    code: 'FSCA',
    name: 'Financial Sector Conduct Authority (South Africa)',
    note: 'A growing regulator for brokers serving African markets. Enforcement history is shorter than tier-1 regulators, so we weight it accordingly in the Health Score.',
  },
  {
    code: 'FSA (Seychelles) / IFSC (Belize) / offshore',
    name: 'Offshore / low-oversight jurisdictions',
    note: 'Common for the entity that actually holds your funds even when a broker also advertises a tier-1 licence elsewhere. Always check which entity your specific account is opened under.',
  },
];

export default function About() {
  useSEO(staticPageSeo.about, [
    { ...buildWebPageJsonLd(staticPageSeo.about), '@type': 'AboutPage' },
    buildBreadcrumbJsonLd([
      { name: 'Home', path: '/' },
      { name: 'About PipRank', path: '/about' },
    ]),
  ]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-emerald-700">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        Trust &amp; transparency
      </p>
      <h1 className="mt-2 font-display text-4xl font-bold tracking-tight text-ink-900 sm:text-5xl">
        About <em className="serif-accent text-emerald-700">PipRank</em>
      </h1>
      <p className="mt-4 max-w-2xl text-base leading-relaxed text-slate-500">
        Who we are, how we make money, how brokers are scored, where our data comes from, and how to get
        something corrected if we get it wrong — all in one place, on purpose.
      </p>

      {/* quick nav */}
      <nav aria-label="Trust center sections" className="mt-8 flex flex-wrap gap-2">
        {SECTIONS.map((s) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            className="rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-emerald-400 hover:text-emerald-800"
          >
            {s.label}
          </a>
        ))}
      </nav>

      <div className="mt-10 space-y-6">
        {/* About PipRank */}
        <Reveal>
          <section id="about" className="scroll-mt-28 rounded-3xl border border-line bg-white p-6 sm:p-8">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                <BookOpen size={18} />
              </div>
              <h2 className="font-display text-2xl font-bold text-ink-900">About PipRank</h2>
            </div>
            <div className="prose-sm mt-4 space-y-3 text-[15px] leading-relaxed text-slate-600">
              <p>
                PipRank is an independent forex broker research site. We compare brokers on regulation,
                real-money-tested trading costs, execution quality, withdrawal reliability and platform
                features, and roll those factors into a single Health Score so traders can compare brokers
                without reading twenty separate PDFs of terms and conditions.
              </p>
              <p>
                We don't operate as a brokerage, we don't hold client funds, and we don't provide investment
                advice. PipRank is a research and comparison resource — the final decision on which broker to
                use, and how much risk to take, is always yours.
              </p>
            </div>
          </section>
        </Reveal>

        {/* Editorial policy */}
        <Reveal>
          <section id="editorial-policy" className="scroll-mt-28 rounded-3xl border border-line bg-white p-6 sm:p-8">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                <ShieldCheck size={18} />
              </div>
              <h2 className="font-display text-2xl font-bold text-ink-900">Editorial policy</h2>
            </div>
            <div className="prose-sm mt-4 space-y-3 text-[15px] leading-relaxed text-slate-600">
              <p>
                Broker Health Scores are computed from the methodology described below, applied identically to
                every broker we cover. No broker can pay for a higher score, a better rank, or a more
                favorable review — commission arrangements are entirely separate from scoring, and reviewed on
                a different team workflow than editorial content.
              </p>
              <ul className="space-y-1.5">
                <li>• Brokers do not see review or scoring content before publication.</li>
                <li>• Affiliate relationships have zero weight in the Health Score formula.</li>
                <li>• We do not delete verified negative reviews because a broker objects to them.</li>
                <li>• If a broker is not a current affiliate partner, that has no bearing on its score.</li>
              </ul>
            </div>
          </section>
        </Reveal>

        {/* How we make money */}
        <Reveal>
          <section id="how-we-make-money" className="scroll-mt-28 rounded-3xl border border-line bg-white p-6 sm:p-8">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                <Wallet size={18} />
              </div>
              <h2 className="font-display text-2xl font-bold text-ink-900">
                How we make money &amp; affiliate disclosure
              </h2>
            </div>
            <div className="prose-sm mt-4 space-y-3 text-[15px] leading-relaxed text-slate-600">
              <p>
                PipRank is reader-supported. Links marked <strong className="text-ink-900">Visit</strong> are
                partner links, and we may earn a commission if you open an account through one — at no extra
                cost to you. This is how we fund real-money testing, licence checks and ongoing broker
                monitoring without charging readers directly.
              </p>
              <p>
                Compensation never changes a Health Score, a ranking position, or the content of a review.
                Brokers that aren't affiliate partners are scored and covered on exactly the same terms as
                brokers that are. We'd rather send you to the broker the data supports than the one that pays
                the highest commission.
              </p>
            </div>
          </section>
        </Reveal>

        {/* Methodology */}
        <Reveal>
          <section id="methodology" className="scroll-mt-28 rounded-3xl border border-line bg-white p-6 sm:p-8">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                <Target size={18} />
              </div>
              <h2 className="font-display text-2xl font-bold text-ink-900">Review &amp; scoring methodology</h2>
            </div>
            <div className="prose-sm mt-4 space-y-3 text-[15px] leading-relaxed text-slate-600">
              <p>
                Every broker review follows the same structure: regulation and entity check, real-money
                trading-cost measurement, execution testing, withdrawal timing, support testing, and a
                sentiment read from verified user reviews. Those six factors are weighted into the Health Score
                shown on every broker page.
              </p>
              <p>
                We publish the full formula, factor weights and testing method on a dedicated page rather than
                summarizing it here.
              </p>
              <Link
                to="/methodology"
                className="inline-flex items-center gap-1.5 text-sm font-bold text-emerald-700 hover:text-emerald-800"
              >
                See the full Health Score methodology →
              </Link>
            </div>
          </section>
        </Reveal>

        {/* Data sources */}
        <Reveal>
          <section id="data-sources" className="scroll-mt-28 rounded-3xl border border-line bg-white p-6 sm:p-8">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                <Database size={18} />
              </div>
              <h2 className="font-display text-2xl font-bold text-ink-900">Data sources</h2>
            </div>
            <div className="prose-sm mt-4 space-y-3 text-[15px] leading-relaxed text-slate-600">
              <p>Figures on PipRank come from a mix of sources, each used for what it's actually good for:</p>
              <ul className="space-y-1.5">
                <li>
                  <strong className="text-ink-900">Regulator registers</strong> — licence status and entity
                  names are checked directly against the relevant regulator's public register, not taken from a
                  broker's marketing page.
                </li>
                <li>
                  <strong className="text-ink-900">Real-money testing</strong> — spreads, execution speed and
                  withdrawal timing are measured from live funded accounts, not demo accounts or advertised
                  "as low as" figures.
                </li>
                <li>
                  <strong className="text-ink-900">Verified user reviews</strong> — submitted by readers, used
                  as one input into the sentiment factor of the Health Score.
                </li>
                <li>
                  <strong className="text-ink-900">Broker-provided information</strong> — used only for factual,
                  non-scored details such as platform names and account types, and clearly distinguished from
                  independently tested figures.
                </li>
              </ul>
            </div>
          </section>
        </Reveal>

        {/* Update policy */}
        <Reveal>
          <section id="update-policy" className="scroll-mt-28 rounded-3xl border border-line bg-white p-6 sm:p-8">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                <RefreshCw size={18} />
              </div>
              <h2 className="font-display text-2xl font-bold text-ink-900">Update policy</h2>
            </div>
            <div className="prose-sm mt-4 space-y-3 text-[15px] leading-relaxed text-slate-600">
              <ul className="space-y-1.5">
                <li>• Health Scores are fully recomputed monthly.</li>
                <li>• Real-money withdrawal timing is re-tested quarterly.</li>
                <li>• Regulator licence registers are scanned twice a year, and immediately after any known licence event.</li>
                <li>• Complaint and sentiment signals are refreshed weekly.</li>
              </ul>
              <p>
                Figures can still go stale between refresh cycles — a broker's spreads or a regulator's status
                can change without notice. Always verify current conditions and licence status directly with
                the broker and regulator before funding an account.
              </p>
            </div>
          </section>
        </Reveal>

        {/* Corrections policy */}
        <Reveal>
          <section id="corrections-policy" className="scroll-mt-28 rounded-3xl border border-line bg-white p-6 sm:p-8">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                <PencilLine size={18} />
              </div>
              <h2 className="font-display text-2xl font-bold text-ink-900">Corrections policy</h2>
            </div>
            <div className="prose-sm mt-4 space-y-3 text-[15px] leading-relaxed text-slate-600">
              <p>
                If you spot something inaccurate — a stale spread, an out-of-date licence, a broken link, or a
                factual error in a review — tell us and we'll look into it.
              </p>
              <ul className="space-y-1.5">
                <li>• We re-verify the specific claim against its original source (regulator register or our own test data).</li>
                <li>• Confirmed errors are corrected as soon as the fix is verified, not queued for the next scheduled refresh.</li>
                <li>• Corrections that affect a Health Score are reflected in that broker's score on the same update.</li>
              </ul>
              <a
                href="mailto:hello@piprank.io?subject=Correction%20request"
                className="inline-flex items-center gap-1.5 text-sm font-bold text-emerald-700 hover:text-emerald-800"
              >
                <Mail size={14} /> Report an error to hello@piprank.io
              </a>
            </div>
          </section>
        </Reveal>

        {/* Author / reviewer info */}
        <Reveal>
          <section id="author-reviewer-info" className="scroll-mt-28 rounded-3xl border border-line bg-white p-6 sm:p-8">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                <Users size={18} />
              </div>
              <h2 className="font-display text-2xl font-bold text-ink-900">Author &amp; reviewer information</h2>
            </div>
            <div className="prose-sm mt-4 space-y-3 text-[15px] leading-relaxed text-slate-600">
              <p>
                Reviews, scores and guides on PipRank are produced and maintained by the PipRank editorial
                team, following the review and scoring methodology described above rather than any individual
                reviewer's personal opinion of a broker.
              </p>
              <p>
                Bylines on PipRank are editorial identities used consistently across our reviews — see who
                covers regulation, trading-cost testing, methodology and country-specific compliance on our
                editorial team page.
              </p>
              <Link
                to="/authors"
                className="inline-flex items-center gap-1.5 text-sm font-bold text-emerald-700 hover:text-emerald-800"
              >
                Meet the editorial team →
              </Link>
            </div>
          </section>
        </Reveal>

        {/* Regulatory explanations */}
        <Reveal>
          <section id="regulatory-explanations" className="scroll-mt-28 rounded-3xl border border-line bg-white p-6 sm:p-8">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                <Landmark size={18} />
              </div>
              <h2 className="font-display text-2xl font-bold text-ink-900">Understanding forex regulators</h2>
            </div>
            <p className="mt-4 text-[15px] leading-relaxed text-slate-600">
              Not all "regulated" claims mean the same thing. A broker can hold a strong licence in one
              jurisdiction while your specific account is opened under a much lighter-touch entity elsewhere —
              always check which entity you're actually contracting with.
            </p>
            <div className="mt-4 space-y-3">
              {REGULATORS.map((r) => (
                <div key={r.code} className="rounded-2xl bg-paper p-4">
                  <p className="font-display text-sm font-bold text-ink-900">
                    {r.code} <span className="font-normal text-slate-500">— {r.name}</span>
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-500">{r.note}</p>
                </div>
              ))}
            </div>
          </section>
        </Reveal>
      </div>

      <div className="mt-10 flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-white p-5 shadow-soft">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
          <BadgeCheck size={16} />
        </div>
        <p className="text-sm font-semibold text-ink-900">
          See how these principles apply in practice on any broker review, or read the full scoring
          methodology.
        </p>
        <div className="ml-auto flex gap-2">
          <Link
            to="/methodology"
            className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-white px-4 py-2 text-sm font-bold text-ink-900 transition hover:border-emerald-400"
          >
            Methodology
          </Link>
          <Link
            to="/brokers"
            className="inline-flex items-center gap-1.5 rounded-xl bg-ink-950 px-4 py-2 text-sm font-bold text-white transition hover:bg-ink-800"
          >
            Browse brokers
          </Link>
        </div>
      </div>
    </div>
  );
}
