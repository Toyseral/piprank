/** Canonical URL builders for the country-first content architecture. */
export const countryHubPath = (countrySlug: string) => `/countries/${countrySlug}`;

export const countryRankingPath = (countrySlug: string) =>
  `${countryHubPath(countrySlug)}/forex-brokers`;

export const countryGuidePath = (countrySlug: string, guideSlug: string) =>
  `${countryHubPath(countrySlug)}/${guideSlug}`;

export const localizedCountryHubPath = (countrySlug: string, locale: string) =>
  `${countryHubPath(countrySlug)}/${locale}`;

export const localizedCountryPath = (countrySlug: string, locale: string, slug: string) =>
  `${localizedCountryHubPath(countrySlug, locale)}/${slug}`;
