import { Link, useLocation, useNavigate } from 'react-router-dom';
import { globalIntentPath } from '../lib/topicPaths';
import { Mail, Sparkles } from 'lucide-react';
import { ButtonLink } from './Button';
import { Logo } from './Navbar';

const BEST_FOR = [
  { slug: 'beginners', label: 'Beginners' },
  { slug: 'low-spread', label: 'Low spreads' },
  { slug: 'mt5', label: 'MT5 brokers' },
  { slug: 'scalping', label: 'Scalping' },
  { slug: 'copy-trading', label: 'Copy trading' },
  { slug: 'islamic', label: 'Islamic accounts' },
];

const COMPANY = [
  { to: '/about', label: 'About' },
  { to: '/methodology', label: 'Methodology' },
  { to: '/authors', label: 'Authors' },
  { to: '/promotions', label: 'Promotions' },
];

export default function Footer() {
  const { pathname } = useLocation();
  if (pathname.startsWith('/archypage')) return null;

  return (
    <footer className="mt-auto border-t border-line bg-ink-950 text-slate-300">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-12">
        <div className="md:col-span-5">
          <Logo />
          <p className="mt-4 max-w-sm text-sm leading-7 text-slate-400">
            Independent forex broker reviews based on real-money testing. We rank brokers by spreads,
            execution, regulation and cost — not by who pays the highest commission.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <ButtonLink to="/quiz" variant="primary" size="sm">
              <Sparkles size={14} /> Find your broker
            </ButtonLink>
            <ButtonLink to="/brokers" variant="ghost" size="sm" className="text-slate-300 hover:text-white">
              All brokers
            </ButtonLink>
          </div>
        </div>

        <div className="md:col-span-2">
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

        <div className="md:col-span-2">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Explore</p>
          <ul className="mt-4 space-y-2.5 text-sm">
            <li><Link to="/brokers" className="transition hover:text-emerald-400">Brokers</Link></li>
            <li><Link to="/countries" className="transition hover:text-emerald-400">By country</Link></li>
            <li><Link to="/compare" className="transition hover:text-emerald-400">Compare</Link></li>
            <li><Link to="/guides" className="transition hover:text-emerald-400">Guides</Link></li>
            <li><Link to="/tools" className="transition hover:text-emerald-400">Tools</Link></li>
          </ul>
        </div>

        <div className="md:col-span-3">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Company</p>
          <ul className="mt-4 space-y-2.5 text-sm">
            {COMPANY.map((c) => (
              <li key={c.to}>
                <Link to={c.to} className="transition hover:text-emerald-400">{c.label}</Link>
              </li>
            ))}
          </ul>
          <p className="mt-6 flex items-center gap-2 text-xs text-slate-500">
            <Mail size={13} /> editorial@piprank.com
          </p>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-6 text-xs leading-relaxed text-slate-500 sm:px-6 md:flex-row md:items-center md:justify-between">
          <p>© {new Date().getFullYear()} PipRank. All rights reserved.</p>
          <p className="max-w-xl">
            Affiliate disclosure: some links are affiliate links and we may earn a commission when you open an account — at no extra cost to you. Compensation never changes scores, rankings or review content.
          </p>
        </div>
      </div>
    </footer>
  );
}
