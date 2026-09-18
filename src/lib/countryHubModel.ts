import type { Broker, ContentDocument, CountryPage } from './types';
import { fetchBrokers, fetchCountry } from './api';
import { fetchPublishedContentDocument, fetchPublishedContentDocuments } from './canonicalContent';

export type CountryHubPageModel = {
  country: CountryPage;
  countryDocument: ContentDocument;
  availableBrokers: Broker[];
  countryGuides: ContentDocument[];
  countryBestFor: ContentDocument[];
  localizedGuides: ContentDocument[];
  localizedBestFor: ContentDocument[];
};

function availableBrokerSet(country: CountryPage, brokers: Broker[]) {
  const allowed = new Set(country.available_broker_slugs ?? brokers.map((broker) => broker.slug));
  return brokers.filter((broker) => allowed.has(broker.slug));
}

export async function fetchCountryHubPageModel(slug: string): Promise<CountryHubPageModel | null> {
  const country = await fetchCountry(slug).catch(() => null);
  if (!country || country.publishing_state === 'closed' || country.publishing_state === 'draft') return null;

  const [countryDocument, brokers, countryGuides, countryBestFor, localizedGuides, localizedBestFor] = await Promise.all([
    fetchPublishedContentDocument(`country:${country.slug}:hub`),
    fetchBrokers(),
    fetchPublishedContentDocuments({ type: 'country-guide', country: country.slug }),
    fetchPublishedContentDocuments({ type: 'country-best-for', country: country.slug }),
    fetchPublishedContentDocuments({ type: 'localized-guide', country: country.slug }),
    fetchPublishedContentDocuments({ type: 'localized-best-for', country: country.slug }),
  ]);

  if (!countryDocument) return null;

  return {
    country,
    countryDocument,
    availableBrokers: availableBrokerSet(country, brokers),
    countryGuides: countryGuides.filter((doc) => doc.content_type === 'country-guide'),
    countryBestFor: countryBestFor.filter((doc) => doc.content_type === 'country-best-for'),
    localizedGuides: localizedGuides.filter((doc) => doc.content_type === 'localized-guide'),
    localizedBestFor: localizedBestFor.filter((doc) => doc.content_type === 'localized-best-for'),
  };
}
