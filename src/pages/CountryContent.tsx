import { useParams } from 'react-router-dom';
import CountrySeoTopic from './CountrySeoTopic';
import GuideTopic from './GuideTopic';

// Informational guides are authored in Content Studio; remaining slugs use
// the established country-ranking topic registry.
const GUIDE_SLUGS = new Set([
  'forex-trading-cost',
  'how-to-choose-a-forex-broker',
  'forex-regulation',
  'forex-payment-methods',
]);

export default function CountryContent() {
  const { topicSlug = '' } = useParams<{ topicSlug: string }>();
  return GUIDE_SLUGS.has(topicSlug) ? <GuideTopic /> : <CountrySeoTopic />;
}
