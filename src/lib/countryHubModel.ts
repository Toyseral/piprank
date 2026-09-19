import type { Broker, ContentDocument, CountryPage, CountryBrokerRanking, FAQ } from './types';
import { fetchBrokers, fetchCountry, fetchCountryBrokerAvailability, fetchCountryBrokerRankings } from './api';
import { fetchPublishedContentDocument, fetchPublishedContentDocuments } from './canonicalContent';
import { buildCountryHubModel } from './countryHubModel.shared';

export type CountryHubPageModel = {
  country: CountryPage;
  countryDocument: ContentDocument;
  availableBrokers: Broker[];
  topBrokers: CountryBrokerRanking[];
  countryGuides: ContentDocument[];
  countryBestFor: ContentDocument[];
  localizedGuides: ContentDocument[];
  localizedBestFor: ContentDocument[];
  /** Canonical FAQ source is the country hub document. */
  faqs: FAQ[];
  /** Country comparison pages are dynamic /compare/:pair routes, not country-owned documents. */
  comparisonPath: '/compare';
  /** Methodology is global and linked from country hubs; it is not duplicated per country. */
  methodologyPath: '/methodology';
  /** Supporting-source failures are explicit; an empty array means a successful empty query. */
  errors: Partial<Record<'brokers' | 'availability' | 'rankings' | 'countryGuides' | 'countryBestFor' | 'localizedGuides' | 'localizedBestFor' | 'countryDocument', string>>;
};

export async function fetchCountryHubPageModel(slug: string, resolvedCountry?: CountryPage | null): Promise<CountryHubPageModel | null> {
  const country = resolvedCountry ?? await fetchCountry(slug);
  if (!country || country.publishing_state === 'closed' || country.publishing_state === 'draft') return null;

  const sources = await Promise.all([
    fetchPublishedContentDocument(`country:${country.slug}:hub`).then((data) => ({ data, error: null })).catch((error) => ({ data: null, error })),
    fetchBrokers().then((data) => ({ data, error: null })).catch((error) => ({ data: [], error })),
    fetchCountryBrokerAvailability(country.slug).then((data) => ({ data, error: null })).catch((error) => ({ data: [], error })),
    fetchCountryBrokerRankings(country.slug).then((data) => ({ data, error: null })).catch((error) => ({ data: [], error })),
    fetchPublishedContentDocuments({ type: 'country-guide', country: country.slug }).then((data) => ({ data, error: null })).catch((error) => ({ data: [], error })),
    fetchPublishedContentDocuments({ type: 'country-best-for', country: country.slug }).then((data) => ({ data, error: null })).catch((error) => ({ data: [], error })),
    fetchPublishedContentDocuments({ type: 'localized-guide', country: country.slug }).then((data) => ({ data, error: null })).catch((error) => ({ data: [], error })),
    fetchPublishedContentDocuments({ type: 'localized-best-for', country: country.slug }).then((data) => ({ data, error: null })).catch((error) => ({ data: [], error })),
  ]);
  const [documentSource, brokersSource, availabilitySource, rankingsSource, guidesSource, bestForSource, localizedGuidesSource, localizedBestForSource] = sources;
  const model = buildCountryHubModel({
    country,
    countryDocument: documentSource.data,
    brokers: brokersSource.data,
    availability: availabilitySource.data,
    topBrokers: rankingsSource.data,
    countryGuides: guidesSource.data,
    countryBestFor: bestForSource.data,
    localizedGuides: localizedGuidesSource.data,
    localizedBestFor: localizedBestForSource.data,
  });
  return {
    ...model,
    errors: {
      ...(documentSource.error ? { countryDocument: String(documentSource.error?.message || documentSource.error) } : {}),
      ...(brokersSource.error ? { brokers: String(brokersSource.error?.message || brokersSource.error) } : {}),
      ...(availabilitySource.error ? { availability: String(availabilitySource.error?.message || availabilitySource.error) } : {}),
      ...(rankingsSource.error ? { rankings: String(rankingsSource.error?.message || rankingsSource.error) } : {}),
      ...(guidesSource.error ? { countryGuides: String(guidesSource.error?.message || guidesSource.error) } : {}),
      ...(bestForSource.error ? { countryBestFor: String(bestForSource.error?.message || bestForSource.error) } : {}),
      ...(localizedGuidesSource.error ? { localizedGuides: String(localizedGuidesSource.error?.message || localizedGuidesSource.error) } : {}),
      ...(localizedBestForSource.error ? { localizedBestFor: String(localizedBestForSource.error?.message || localizedBestForSource.error) } : {}),
    },
  };
}
