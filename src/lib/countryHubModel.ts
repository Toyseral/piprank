import type { Broker, ContentDocument, CountryPage, CountryBrokerRanking, FAQ } from './types';
import { fetchBrokers, fetchCountry, fetchCountryBrokerAvailability, fetchCountryBrokerRankings } from './api';
import { fetchPublishedContentDocument, fetchPublishedContentDocuments } from './canonicalContent';

export type CountryHubPageModel = {
  country: CountryPage;
  countryDocument: ContentDocument;
  availableBrokers: Broker[];
  topBrokers: CountryBrokerRanking[];
  countryGuides: ContentDocument[];
  countryBestFor: ContentDocument[];
  /** Canonical FAQ source is the country hub document. */
  faqs: FAQ[];
  /** Country comparison pages are dynamic /compare/:pair routes, not country-owned documents. */
  comparisonPath: '/compare';
  /** Methodology is global and linked from country hubs; it is not duplicated per country. */
  methodologyPath: '/methodology';
};

export async function fetchCountryHubPageModel(slug: string): Promise<CountryHubPageModel | null> {
  const country = await fetchCountry(slug).catch(() => null);
  if (!country || country.publishing_state === 'closed' || country.publishing_state === 'draft') return null;

  const [countryDocument, brokers, availability, topBrokers, countryGuides, countryBestFor] = await Promise.all([
    fetchPublishedContentDocument(`country:${country.slug}:hub`),
    fetchBrokers(),
    fetchCountryBrokerAvailability(country.slug),
    fetchCountryBrokerRankings(country.slug),
    fetchPublishedContentDocuments({ type: 'country-guide', country: country.slug }),
    fetchPublishedContentDocuments({ type: 'country-best-for', country: country.slug }),
  ]);

  if (!countryDocument) return null;

  const documentSettings = countryDocument.settings || {};
  const documentFaqs = Array.isArray(documentSettings.faqs) ? documentSettings.faqs : [];

  return {
    country,
    countryDocument,
    availableBrokers: (() => {
      // Eligibility is opt-out: brokers are eligible unless country data explicitly
      // marks them unavailable/restricted or is_available=false.
      const ineligibleIds = new Set(availability
        .filter((row) => ['unavailable', 'restricted'].includes(String(row.status || '').toLowerCase()))
        .map((row) => Number(row.broker_id)));
      return brokers.filter((broker) => !ineligibleIds.has(Number(broker.id)));
    })(),
    topBrokers: topBrokers.filter((row) => row.broker && row.availability_status !== 'unavailable' && row.availability_status !== 'restricted'),
    countryGuides: countryGuides.filter((doc) => doc.content_type === 'country-guide'),
    countryBestFor: countryBestFor.filter((doc) => doc.content_type === 'country-best-for'),
    faqs: documentFaqs.filter((faq): faq is FAQ => Boolean(faq && typeof faq.q === 'string' && typeof faq.a === 'string')),
    comparisonPath: '/compare',
    methodologyPath: '/methodology',
  };
}
