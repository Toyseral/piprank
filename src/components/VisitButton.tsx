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
  comparePair?: string;
  /** Country slug for country-specific pages. */
  country?: string;
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
  if (pathname.startsWith('/tools')) return 'tools';
  if (pathname.startsWith('/guides')) return 'guide';
  return 'other';
}

export default function VisitButton({
  broker,
  compact,
  className = '',
  context,
  bestFor,
  comparePair,
  country,
}: Props) {
  const href = `/go/${broker.slug}`;

  const onClick = () => {
    const pageType = context || (typeof window !== 'undefined' ? inferPageType(window.location.pathname) : 'other');
    track('outbound_click', {
      broker: broker.slug,
      page_type: pageType,
      best_for: bestFor,
      compare_pair: comparePair,
      country,
      session_id: getSessionId(),
    });
  };

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer sponsored"
      onClick={onClick}
      className={btnCls('primary', compact ? 'sm' : 'md', `inline-flex items-center gap-1.5 ${className}`)}
    >
      Visit {broker.name}
      <ArrowUpRight size={compact ? 14 : 16} />
    </a>
  );
}
