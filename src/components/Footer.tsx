import { Link, useLocation, useNavigate } from 'react-router-dom';
import { globalIntentPath } from '../lib/topicPaths';
import { Mail, Sparkles } from 'lucide-react';
import { ButtonLink } from './Button';
import { Logo } from './Navbar';

const BEST_FOR = [
  { slug: 'beginners', label: 'Beginners' },
  { slug: 'low-spread', label: 'Lowest spreads' },
  { slug: 'scalping', label: 'Scalping' },
  { slug: 'copy-trading', label: 'Copy trading' },
  { slug: 'ecn', label: 'ECN brokers' },
  { slug: 'mt5', label: 'MT5 brokers' },
];

export default function Footer() {
  const navigate = useNavigate();
  const location = useLocation();

  const goMethodology = () => {
    if (location.pathname !== '/') {
      navigate('/');
      setTimeout(() => document.getElementById('methodology')?.scrollIntoView({ behavior: 'smooth' }), 250);
    } else {
      document.getElementById('methodology')?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <footer className="bg-ink-950 text-slate-300">
      <div className="h-px bg-gradient-to-r from-transparent via-emerald-500/60 to-transparent" />
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
        <div className="grid gap-10 lg:grid-cols-[1.3fr_1fr_1fr_1.4fr]">
          <div>
            <Logo />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-slate-400">
              Independent forex broker intelligence. Real-money testing, measured spreads and withdrawal
              timing — so you can pick a broker the data can defend.
            </p>
            <a
              href="mailto:hello@piprank.io"
              className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-slate-300 transition hover:text-emerald-400"
            >
              <Mail size={15} /> hello@piprank.io
            </a>
          </div>

          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Explore</p>
            <ul className="mt-4 space-y-2.5 text-sm">
              <li><Link to="/brokers" className="transition hover:text-emerald-400">All brokers</Link></li>
              <li><Link to="/countries" className="transition hover:text-emerald-400">Countries</Link></li>
              <li><Link to="/promotions" className="transition hover:text-emerald-400">Current promotions</Link></li>
              <li><Link to="/compare" className="transition hover:text-emerald-400">Compare brokers</Link></li>
              <li><Link to="/quiz" className="transition hover:text-emerald-400">Broker match quiz</Link></li>
              <li><Link to="/tools" className="transition hover:text-emerald-400">Trading tools</Link></li>
              <li><Link to="/guides" className="transition hover:text-emerald-400">Guides</Link></li>
              <li><button onClick={goMethodology} className="transition hover:text-emerald-400">How we test brokers</button></li>
              <li><Link to="/methodology" className="transition hover:text-emerald-400">Health score methodology</Link></li>
              <li><Link to="/about" className="transition hover:text-emerald-400">About &amp; editorial policy</Link></li>
              <li><Link to="/authors" className="transition hover:text-emerald-400">Editorial team</Link></li>
            </ul>
          </div>

          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Best for</p>
            <ul className="mt-4 space-y-2.5 text-sm">
              {BEST_FOR.map((b) => (
                <li key={b.slug}>
                  <Link to={globalIntentPath(b.slug)} className="transition hover:text-emerald-400">
                    {b.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Not sure where to start?</p>
            <p className="mt-4 font-display text-xl font-bold leading-snug text-white">
              60 seconds to your{' '}
              <em className="serif-accent text-emerald-300">top 3</em> brokers.
            </p>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">
              Six questions. Live scoring across every broker we track — with more joining as we grow.
            </p>
            <ButtonLink variant="primary" size="md" icon={Sparkles} to="/quiz" className="mt-5">
              Take the broker quiz
            </ButtonLink>
          </div>
        </div>

        <div className="mt-12 space-y-4 rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-xs leading-relaxed text-slate-400">
          <div>
            <p className="font-bold uppercase tracking-widest text-slate-200">Advertiser disclosure</p>
            <p className="mt-1.5">
              PipRank is reader-supported: links marked <em className="text-slate-300">Visit</em> are partner
              links and we may earn a commission when you open an account — at no extra cost to you. Compensation
              never changes scores, rankings or review content. Brokers never see reviews before publication,
              and every test is funded with our own money. Read our full{' '}
              <Link to="/about#how-we-make-money" className="text-slate-300 underline hover:text-emerald-400">
                editorial policy and affiliate disclosure
              </Link>
              .
            </p>
          </div>
          <div className="border-t border-white/10 pt-4">
            <p className="font-bold uppercase tracking-widest text-slate-200">Risk warning &amp; disclaimer</p>
            <p className="mt-1.5">
              CFDs and forex are complex, leveraged instruments and carry a high risk of losing money rapidly.
              Between 62% and 84% of retail investor accounts lose money when trading CFDs with the brokers
              reviewed on this site. You should consider whether you understand how these products work and
              whether you can afford the risk. Nothing here is investment advice; figures are lab measurements
              refreshed monthly. Verify the entity and licence on the regulator's register before funding.
            </p>
          </div>
        </div>

        <div className="mt-8 flex flex-col items-center justify-between gap-3 border-t border-white/10 pt-6 text-xs text-slate-500 sm:flex-row">
          <p>© {new Date().getFullYear()} PipRank. All rights reserved.</p>
          <p>Scores computed from live testing data · Updated monthly</p>
        </div>
      </div>
    </footer>
  );
}
