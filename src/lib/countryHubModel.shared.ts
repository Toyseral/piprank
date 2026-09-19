import type { Broker, ContentDocument, CountryPage, CountryBrokerRanking, FAQ } from './types';

export type CountryHubBuildInput = {
  country: CountryPage;
  countryDocument?: ContentDocument | null;
  brokers: Broker[];
  availability: Array<{ broker_id: number | string; is_available?: boolean | null; status?: string | null }>;
  topBrokers: CountryBrokerRanking[];
  countryGuides: ContentDocument[];
  countryBestFor: ContentDocument[];
  localizedGuides: ContentDocument[];
  localizedBestFor: ContentDocument[];
};

export function buildCountryHubModel(input: CountryHubBuildInput) {
  const country = input.country;
  const countryDocument: ContentDocument = input.countryDocument ?? {
    id: 0,
    content_key: `country:${country.slug}:hub`,
    content_type: 'country',
    country_slug: country.slug,
    topic_slug: null,
    slug: country.slug,
    title: `Forex brokers in ${country.name}`,
    excerpt: '',
    html: '',
    blocks: [],
    seo_title: `Forex Brokers in ${country.name} | PipRank`,
    seo_description: `Compare forex brokers available to traders in ${country.name}.`,
    indexable: true,
    published: true,
    updated_by: null,
    created_at: new Date(0).toISOString(),
    updated_at: new Date(0).toISOString(),
    settings: {},
  };

  const ineligibleIds = new Set(input.availability
    .filter((row) => row.is_available === false || String(row.status || 'available').toLowerCase() !== 'available')
    .map((row) => Number(row.broker_id)));
  const eligibleBrokerIds = new Set(input.brokers
    .filter((broker) => !ineligibleIds.has(Number(broker.id)))
    .map((broker) => Number(broker.id)));

  const faqs = Array.isArray(countryDocument.settings?.faqs)
    ? countryDocument.settings.faqs.filter((faq): faq is FAQ => Boolean(faq && typeof faq.q === 'string' && typeof faq.a === 'string'))
    : [];

  return {
    country,
    countryDocument,
    availableBrokers: input.brokers.filter((broker) => eligibleBrokerIds.has(Number(broker.id))),
    topBrokers: input.topBrokers.filter((row) =>
      row.broker &&
      eligibleBrokerIds.has(Number(row.broker_id)) &&
      row.availability_status === 'available',
    ),
    countryGuides: input.countryGuides.filter((doc) => doc.content_type === 'country-guide'),
    countryBestFor: input.countryBestFor.filter((doc) => doc.content_type === 'country-best-for'),
    localizedGuides: input.localizedGuides.filter((doc) => doc.content_type === 'localized-guide'),
    localizedBestFor: input.localizedBestFor.filter((doc) => doc.content_type === 'localized-best-for'),
    faqs,
    comparisonPath: '/compare',
    methodologyPath: '/methodology',
  };
}
