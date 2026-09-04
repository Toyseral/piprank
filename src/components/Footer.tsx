import { Link, useLocation, useNavigate } from 'react-router-dom';
import { globalIntentPath } from '../lib/topicPaths';
import { Mail, Sparkles } from 'lucide-react';
import { ButtonLink } from './Button';
import { Logo } from './Navbar';

const BEST = [
  { slug: 'low-spread', label: 'Lowest spreads' },
  { slug: 'beginners', label: 'Best for beginners' },
  { slug: 'scalping', label: 'Best for scalping' },
  { slug: 'mt5', label: 'Best MT5 brokers' },
  { slug: 'copy-trading', label: 'Copy trading' },
  { slug: 'islamic', label: 'Islamic accounts' },
];

export default function Footer() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const goMethodology = () => {
    if (pathname === '/about') {
      document.getElementById('methodology')?.scrollIntoView({ behavior: 'smooth' });
    } else {
      navigate('/about');
      window.setTimeout(() => document.getElementById('methodology')?.scrollIntoView({ behavior: 'smooth' }), 80);
    }
  };

  return (
    <footer className="border-t border-line bg-ink-950 text-slate-400">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2 lg:col-span-1">
            <Logo inverse />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-slate-500">
              Independent forex broker rankings built from real-money accounts. Spreads, execution and
              withdrawals — tested, not claimed.
            </p>
            <div className="mt-5 flex items-center gap-2 text-xs text-slate-500">
              <Mail size={13} />
              <a href="mailto:hello@piprank.com" className="transition hover:text-emerald-400">
                hello@piprank.com
              </a>
            </div>
          </div>

          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Explore</p>
            <ul className="mt-4 space-y-2.5 text-sm">
              <li><Link to="/brokers" className="transition hover:text-emerald-400">All brokers</Link></li>
              <li><Link to="/countries" className="transition hover:text-emerald-400">By country</Link></li>
              <li><Link to="/compare" className="transition hover:text-emerald-400">Compare brokers</Link></li>
              <li><Link to="/quiz" className="transition hover:text-emerald-400">Broker match quiz</Link></li>
              <li><Link to="/tools" className="transition hover:text-emerald-400">Trading tools</Link></li>
              <li><Link to="/guides" className="transition hover:text-emerald-400">Guides</Link></li>
              <li><button onClick={goMethodology} className="transition hover:text-emerald-400">How we test brokers</button></li>
              <li><Link to="/methodology" className="transition hover:text-emerald-400">Health score methodology</Link></li>
              <li><Link to="/about" className="transition hover:text-emerald-400">About &amp; editorial policy</Link></li>
            </ul>
          </div>

          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Best for</p>
            <ul className="mt-4 space-y-2.5 text-sm">
              {BEST.map((b) => (
                <li key={b.slug}>
                  <Link to={globalIntentPath(b.slug)} className="transition hover:text-emerald-400">
                    {b.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Stay sharp</p>
            <p className="mt-4 text-sm leading-relaxed text-slate-500">
              New broker scores, spread changes and research notes. No noise.
            </p>
            <ButtonLink to="/quiz" variant="emerald" size="sm" icon={Sparkles} className="mt-4">
              Find your broker
            </ButtonLink>
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-white/5 pt-6 text-xs text-slate-600 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} PipRank. Independent research desk.</p>
          <p className="max-w-xl leading-relaxed">
            Some links are affiliate links and we may earn a commission when you open an account — at no extra cost to you. Compensation
              never changes scores, rankings or review content. Brokers never see reviews before publication,
              and every test is funded with our own money. Read our full{' '}
            <Link to="/about" className="text-slate-400 underline-offset-2 hover:text-emerald-400 hover:underline">editorial policy</Link>.
          </p>
        </div>
      </div>
    </footer>
  );
}
