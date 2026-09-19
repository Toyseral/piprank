import type { Broker, ContentDocument, CountryPage, CountryBrokerRanking, FAQ } from './types';
import { fetchBrokers, fetchCountry, fetchCountryBrokerAvailability, fetchCountryBrokerRankings } from './api';
import { fetchPublishedContentDocuments } from './canonicalContent';
import { buildCountryHubModel } from './countryHubModel.shared.mjs';

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
    fetchPublishedContentDocuments({ country: country.slug }).then((data) => ({ data, error: null })).catch((error) => ({ data: [], error })),
    fetchBrokers().then((data) => ({ data, error: null })).catch((error) => ({ data: [], error })),
    fetchCountryBrokerAvailability(country.slug).then((data) => ({ data, error: null })).catch((error) => ({ data: [], error })),
    fetchCountryBrokerRankings(country.slug).then((data) => ({ data, error: null })).catch((error) => ({ data: [], error })),
  ]);
  const [contentSource, brokersSource, availabilitySource, rankingsSource] = sources;
  const countryContent = contentSource.data;
  const documentSource = countryContent.find((document) => document.content_key === `country:${country.slug}:hub`) ?? null;
  const guidesSource = countryContent.filter((document) => document.content_type === 'country-guide');
  const bestForSource = countryContent.filter((document) => document.content_type === 'country-best-for');
  const localizedGuidesSource = countryContent.filter((document) => document.content_type === 'localized-guide');
  const localizedBestForSource = countryContent.filter((document) => document.content_type === 'localized-best-for');
  const model = buildCountryHubModel({
    country,
    countryDocument: documentSource,
    brokers: brokersSource.data,
    availability: availabilitySource.data,
    topBrokers: rankingsSource.data,
    countryGuides: guidesSource,
    countryBestFor: bestForSource,
    localizedGuides: localizedGuidesSource,
    localizedBestFor: localizedBestForSource,
  });
  return {
    ...model,
    errors: {
      ...(contentSource.error ? { countryDocument: String(contentSource.error?.message || contentSource.error) } : {}),
      ...(brokersSource.error ? { brokers: String(brokersSource.error?.message || brokersSource.error) } : {}),
      ...(availabilitySource.error ? { availability: String(availabilitySource.error?.message || availabilitySource.error) } : {}),
      ...(rankingsSource.error ? { rankings: String(rankingsSource.error?.message || rankingsSource.error) } : {}),
      ...(contentSource.error ? { countryGuides: String(contentSource.error?.message || contentSource.error) } : {}),
      ...(contentSource.error ? { countryBestFor: String(contentSource.error?.message || contentSource.error) } : {}),
      ...(contentSource.error ? { localizedGuides: String(contentSource.error?.message || contentSource.error) } : {}),
      ...(contentSource.error ? { localizedBestFor: String(contentSource.error?.message || contentSource.error) } : {}),
    },
  };
}
