import type { Broker, ContentDocument, CountryPage, CountryBrokerRanking } from './types';
import { fetchBrokers, fetchCountry, fetchCountryBrokerAvailability, fetchCountryBrokerRankings } from './api';
import { fetchPublishedContentDocument, fetchPublishedContentDocuments } from './canonicalContent';

export type CountryHubPageModel = {
  country: CountryPage;
  countryDocument: ContentDocument;
  availableBrokers: Broker[];
  topBrokers: CountryBrokerRanking[];
  countryGuides: ContentDocument[];
  countryBestFor: ContentDocument[];
  localizedGuides: ContentDocument[];
  localizedBestFor: ContentDocument[];
};

export async function fetchCountryHubPageModel(slug: string): Promise<CountryHubPageModel | null> {
  const country = await fetchCountry(slug).catch(() => null);
  if (!country || country.publishing_state === 'closed' || country.publishing_state === 'draft') return null;

  const [countryDocument, brokers, availability, topBrokers, countryGuides, countryBestFor, localizedGuides, localizedBestFor] = await Promise.all([
    fetchPublishedContentDocument(`country:${country.slug}:hub`),
    fetchBrokers(),
    fetchCountryBrokerAvailability(country.slug),
    fetchCountryBrokerRankings(country.slug),
    fetchPublishedContentDocuments({ type: 'country-guide', country: country.slug }),
    fetchPublishedContentDocuments({ type: 'country-best-for', country: country.slug }),
    fetchPublishedContentDocuments({ type: 'localized-guide', country: country.slug }),
    fetchPublishedContentDocuments({ type: 'localized-best-for', country: country.slug }),
  ]);

  if (!countryDocument) return null;

  return {
    country,
    countryDocument,
    availableBrokers: (() => {
      const availableIds = new Set(availability.filter((row) => row.status === 'available' && row.is_available !== false).map((row) => Number(row.broker_id)));
      return brokers.filter((broker) => availableIds.has(Number(broker.id)));
    })(),
    topBrokers: topBrokers.filter((row) => row.availability_status === 'available' && row.broker),
    countryGuides: countryGuides.filter((doc) => doc.content_type === 'country-guide'),
    countryBestFor: countryBestFor.filter((doc) => doc.content_type === 'country-best-for'),
    localizedGuides: localizedGuides.filter((doc) => doc.content_type === 'localized-guide'),
    localizedBestFor: localizedBestFor.filter((doc) => doc.content_type === 'localized-best-for'),
  };
}
