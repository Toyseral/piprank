import { ArrowUpRight } from 'lucide-react';
import type { Broker } from '../lib/types';
import { btnCls } from './Button';
import { track, getSessionId } from '../lib/track';
import { isGlobalTopicPath } from '../lib/topicPaths';

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

interface Props {
  broker: Broker;
  intent?: string;
  countrySlug?: string;
  className?: string;
  children?: React.ReactNode;
}

export default function VisitButton({ broker, intent, countrySlug, className = '', children }: Props) {
  const label = children ?? `Visit ${broker.name}`;

  const onClick = () => {
    const pathname = typeof window !== 'undefined' ? window.location.pathname : '';
    track('affiliate_click', {
      broker: broker.slug,
      intent,
      country: countrySlug,
      page_type: inferPageType(pathname),
      session_id: getSessionId(),
    });
  };

  return (
    <a
      href={`/go/${broker.slug}`}
      target="_blank"
      rel="noopener noreferrer sponsored"
      onClick={onClick}
      className={`${btnCls('emerald', 'md')} ${className}`}
    >
      {label}
      <ArrowUpRight size={15} />
    </a>
  );
}
