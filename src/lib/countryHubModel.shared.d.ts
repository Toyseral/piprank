import type { Broker, ContentDocument, CountryPage, CountryBrokerRanking } from './types';
export function buildCountryHubModel(input: {
 country: CountryPage; countryDocument?: ContentDocument | null; brokers: Broker[];
 availability: Array<{ broker_id: number | string; is_available?: boolean | null; status?: string | null }>;
 topBrokers: CountryBrokerRanking[]; countryGuides: ContentDocument[]; countryBestFor: ContentDocument[];
 localizedGuides: ContentDocument[]; localizedBestFor: ContentDocument[];
}): {
 country: CountryPage; countryDocument: ContentDocument; availableBrokers: Broker[]; topBrokers: CountryBrokerRanking[];
 countryGuides: ContentDocument[]; countryBestFor: ContentDocument[]; localizedGuides: ContentDocument[];
 localizedBestFor: ContentDocument[]; faqs: Array<{q:string;a:string}>; comparisonPath: '/compare'; methodologyPath: '/methodology';
};