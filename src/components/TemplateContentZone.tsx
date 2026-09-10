import type { Broker } from '../lib/types';
import type { PageBlock } from './PageBuilder';
import PageBlocksRenderer from './PageBlocksRenderer';

type Props = {
  blocks?: PageBlock[];
  brokers: Broker[];
  intent?: string;
  countrySlug?: string;
  className?: string;
  label?: string;
};

/**
 * Shared editable-content slot used by fixed SEO templates.
 * The template owns the surrounding section; PageBuilder owns only the
 * editorial content inserted into that section.
 */
export default function TemplateContentZone({ blocks = [], brokers, intent, countrySlug, className = '', label }: Props) {
  if (!Array.isArray(blocks) || blocks.length === 0) return null;

  return (
    <div className={`template-content-zone ${className}`} data-content-zone={label || undefined}>
      <PageBlocksRenderer blocks={blocks} brokers={brokers} intent={intent} countrySlug={countrySlug} />
    </div>
  );
}
