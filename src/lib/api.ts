import type { Broker, BrokerContent, BrokerCountryAvailability, BrokerCountryVerification, CountryBestFor, CountryPage, Guide, Intent, Review, ContentDocument, CountryLanguage, LocalizedSeoPage, CountryIntentBrokerRanking } from './types';

async function get<T>(url: string, token?: string): Promise<T> {
  const res = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error((data && (data as { error?: string }).error) || `Request failed (${res.status})`);
  return data as T;
}

async function send<T>(url: string, method: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || `Request failed (${res.status})`);
  return data as T;
}

export const fetchBrokers = () => get<Broker[]>('/api/brokers');
export const fetchGeo = () => get<{ slug: string | null; iso2: string | null; source: string }>('/api/site?resource=geo');
export const fetchBroker = (slug: string) => get<Broker>(`/api/brokers?slug=${encodeURIComponent(slug)}`);
export const fetchIntents = () => get<Intent[]>('/api/intents');
export const fetchIntent = (slug: string) => get<Intent>(`/api/intents?slug=${encodeURIComponent(slug)}`);
export const fetchGuides = () => get<Guide[]>('/api/guides');
export const fetchGuide = (slug: string) => get<Guide>(`/api/guides?slug=${encodeURIComponent(slug)}`);
export const fetchReviews = (brokerId: number) => get<Review[]>(`/api/reviews?broker_id=${brokerId}`);
export const fetchBrokerContent = (brokerId: number) =>
  get<BrokerContent | null>(`/api/broker-assets?resource=content&broker_id=${brokerId}`);
export const fetchBrokerAvailability = (brokerId: number) =>
  get<BrokerCountryAvailability[]>(`/api/broker-assets?resource=availability&broker_id=${brokerId}`);
export const fetchBrokerVerification = (brokerId?: number, countrySlug?: string) => get<BrokerCountryVerification[]>(`/api/broker-assets?resource=verification${brokerId ? `&broker_id=${brokerId}` : ''}${countrySlug ? `&country_slug=${encodeURIComponent(countrySlug)}` : ''}`);
export const saveBrokerVerification = (payload: Partial<BrokerCountryVerification>) => send<BrokerCountryVerification>('/api/broker-assets?resource=verification', 'PUT', payload);

export const fetchCountries = () => get<CountryPage[]>('/api/countries');
export const fetchCountry = (slug: string) =>
  get<CountryPage>(`/api/countries?slug=${encodeURIComponent(slug)}`);
export const fetchCountryIntentRankings = (countrySlug: string, intentSlug: string) =>
  get<CountryIntentBrokerRanking[]>(`/api/country-intent-rankings?country=${encodeURIComponent(countrySlug)}&intent=${encodeURIComponent(intentSlug)}`);

export const fetchCountryBestFors = (countrySlug: string) =>
  get<CountryBestFor[]>(`/api/country-best-for?country=${encodeURIComponent(countrySlug)}`);
export const fetchCountryBestFor = (countrySlug: string, slug: string) =>
  get<CountryBestFor>(`/api/country-best-for?country=${encodeURIComponent(countrySlug)}&slug=${encodeURIComponent(slug)}`);

export const createReview = async (
  payload: {
    broker_id: number;
    author: string;
    country: string;
    rating: number;
    title: string;
    body: string;
  },
  authToken?: string
): Promise<Review> => {
  const res = await fetch('/api/reviews', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || `Request failed (${res.status})`);
  return data as Review;
};

export const voteHelpful = (id: number) => send<Review>('/api/reviews', 'PUT', { id });

export const subscribeNewsletter = (email: string) =>
  send<{ ok: boolean; duplicate?: boolean }>('/api/newsletter', 'POST', { email });

export const trackClick = (broker_id: number, page: string) =>
  send<{ ok: boolean }>('/api/track?resource=clicks', 'POST', { broker_id, page }).catch(() => ({ ok: false }));

export const fetchContentDocument = (key: string) =>
  get<ContentDocument | null>(`/api/content-documents?key=${encodeURIComponent(key)}`);
export const fetchContentDocumentById = (id: number) =>
  get<ContentDocument | null>(`/api/content-documents?id=${id}`);

export const fetchCountryLanguages = (countrySlug?: string) =>
  get<CountryLanguage[]>(`/api/country-languages${countrySlug ? `?country=${encodeURIComponent(countrySlug)}` : ''}`);
export const fetchLocalizedSeoPage = (countrySlug: string, languageCode: string, slug: string) =>
  get<LocalizedSeoPage | null>(`/api/localized-seo-pages?country=${encodeURIComponent(countrySlug)}&language=${encodeURIComponent(languageCode)}&slug=${encodeURIComponent(slug)}`);
export const fetchLocalizedSeoPagesForCountry = (countrySlug: string) =>
  get<LocalizedSeoPage[]>(`/api/localized-seo-pages?country=${encodeURIComponent(countrySlug)}`);

export const fetchLocalizationUiPack = (languageCode: string) =>
  get<{ language_code: string; strings: Record<string, string> } | null>(
    `/api/localization-ui-packs?language=${encodeURIComponent(languageCode)}`,
  );

export const fetchLocalizationGlossary = (languageCode?: string) =>
  get<{ id: number; language_code: string; term_en: string; term_local: string; notes?: string }[]>(
    `/api/localization-glossary${languageCode ? `?language=${encodeURIComponent(languageCode)}` : ''}`,
  );

export const fetchLocalizedSeoPagePreview = (countrySlug: string, languageCode: string, slug: string, token: string) =>
  get<LocalizedSeoPage | null>(
    `/api/localized-seo-pages?country=${encodeURIComponent(countrySlug)}&language=${encodeURIComponent(languageCode)}&slug=${encodeURIComponent(slug)}&preview=1`,
    token,
  );

export const fetchLocalizationHealth = (token: string) =>
  get<{ totals: { pages: number; published: number; issues: number }; issues: { id: number; type: string; message: string; slug?: string; country?: string }[] }>(
    '/api/localization-health',
    token,
  );

export const saveLocalizationUiPack = (language_code: string, strings: Record<string, string>, token: string) =>
  fetch('/api/localization-ui-packs', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ language_code, strings }),
  }).then(async (res) => {
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((data as { error?: string }).error || 'Failed to save UI pack');
    return data;
  });

export const saveGlossaryTerm = (
  payload: { language_code: string; term_en: string; term_local: string; notes?: string; id?: number },
  token: string,
) =>
  fetch('/api/localization-glossary', {
    method: payload.id ? 'PUT' : 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  }).then(async (res) => {
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((data as { error?: string }).error || 'Failed to save glossary term');
    return data;
  });
