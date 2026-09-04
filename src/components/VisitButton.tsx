import { ArrowUpRight } from 'lucide-react';
import type { Broker } from '../lib/types';
import { btnCls } from './Button';
import { track, getSessionId } from '../lib/track';
import { isGlobalTopicPath } from '../lib/topicPaths';

interface Props {
  broker: Broker;
  compact?: boolean;
  className?: string;
  /** Page type context passed through to /go/ for the click dashboard. Inferred from the URL if omitted. */
  context?: string;
  /** Best-for category slug, when the CTA appears on a best-for page. */
  bestFor?: string;
  /** Comparison pair slug (e.g. "vantage-vs-pepperstone"), when on a compare page. */
  pair?: string;
}

function inferPageType(pathname: string): string {
  if (pathname === '/') return 'home';
  if (pathname.startsWith('/brokers/')) return 'broker_detail';
  if (pathname.startsWith('/best/')) return 'best_for';
  const first = pathname.replace(/^\//, '').split('/')[0];
  if (first && isGlobalTopicPath(first)) return 'best_for';
  if (pathname.startsWith('/compare/')) return 'compare_pair';
  if (pathname.startsWith('/countries/')) return 'country';
  if (pathname.startsWith('/quiz')) return 'quiz_results';
  return 'other';
}

/**
 * Every outbound broker link routes through /go/{slug} — a real server-side
 * redirect that resolves the correct (country-specific or global) affiliate
 * URL and logs the click, rather than exposing a raw affiliate URL in the
 * page. See the affiliate disclosure and "how we make money" policy at /about.
 */
export default function VisitButton({ broker, compact = false, className = '', context, bestFor, pair }: Props) {
  const pageType = context ?? inferPageType(window.location.pathname);

  const params = new URLSearchParams();
  params.set('src', window.location.pathname);
  params.set('page_type', pageType);
  if (bestFor) params.set('best_for', bestFor);
  if (pair) params.set('pair', pair);
  params.set('sid', getSessionId());
  const currentParams = new URLSearchParams(window.location.search);
  for (const key of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content']) {
    const v = currentParams.get(key);
    if (v) params.set(key, v);
  }
  const href = `/go/${broker.slug}?${params.toString()}`;

  const onClick = () => {
    // Legacy client-side beacons, kept for the existing analytics dashboard.
    // The authoritative click record is now logged server-side in /go/.
    track('affiliate_click', { broker: broker.slug, page: window.location.pathname });
    track('cta_click', { broker: broker.slug, context: 'visit_cta', page: window.location.pathname });
  };

  const button = (
    <a
      href={href}
      target="_blank"
      rel="nofollow sponsored noopener noreferrer"
      onClick={onClick}
      className={btnCls('primary', compact ? 'sm' : 'md', className)}
    >
      Open Account
      <ArrowUpRight
        size={compact ? 14 : 16}
        className="transition-transform duration-200 group-hover/btn:-translate-y-0.5 group-hover/btn:translate-x-0.5"
      />
    </a>
  );

  if (compact || !broker.risk_warning) return button;

  return (
    <div className="flex flex-col items-start gap-1">
      {button}
      <p className="text-[11px] leading-tight text-slate-400">{broker.risk_warning}</p>
    </div>
  );
}
