import type { Broker, BrokerContent, BrokerCountryAvailability, BrokerCountryVerification, CountryPage, Intent, Review, ContentDocument, CountryLanguage, CountryIntentBrokerRanking } from './types';

async function get<T>(url: string, token?: string): Promise<T> {
  const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : undefined });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error((data && (data as { error?: string }).error) || `Request failed (${res.status})`);
  return data as T;
}
async function send<T>(url: string, method: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || `Request failed (${res.status})`);
  return data as T;
}

export const CANONICAL_INTENT_SLUGS: Record<string, string> = {
  'forex-brokers-for-beginners': 'beginners', 'low-spread-forex-brokers': 'low-spread', mt5: 'mt5', gold: 'gold',
  'forex-brokers-for-scalping': 'scalping', 'islamic-forex-brokers': 'islamic', 'ecn-forex-brokers': 'ecn',
  'copy-trading-forex-brokers': 'copy-trading', 'forex-brokers-for-swing-trading': 'swing-trading', 'high-leverage-forex-brokers': 'high-leverage',
};
export const publicIntentSlug = (slug: string) => CANONICAL_INTENT_SLUGS[slug] ?? slug;

export const fetchBrokers = () => get<Broker[]>('/api/brokers');
export const fetchGeo = () => get<{ slug: string | null; iso2: string | null; source: string }>('/api/site?resource=geo');
export const fetchBroker = (slug: string) => get<Broker>(`/api/brokers?slug=${encodeURIComponent(slug)}`);
export const fetchIntents = () => get<Intent[]>('/api/intents');
export const fetchIntent = async (slug: string) => { const mapped = publicIntentSlug(slug); try { return await get<Intent>(`/api/intents?slug=${encodeURIComponent(mapped)}`); } catch (e) { if (mapped === slug) throw e; return get<Intent>(`/api/intents?slug=${encodeURIComponent(slug)}`); } };
export const fetchReviews = (brokerId: number) => get<Review[]>(`/api/reviews?broker_id=${brokerId}`);
export const fetchBrokerContent = (brokerId: number) => get<BrokerContent | null>(`/api/broker-assets?resource=content&broker_id=${brokerId}`);
export const fetchBrokerAvailability = (brokerId: number) => get<BrokerCountryAvailability[]>(`/api/broker-assets?resource=availability&broker_id=${brokerId}`);
export const fetchBrokerVerification = (brokerId?: number, countrySlug?: string) => get<BrokerCountryVerification[]>(`/api/broker-assets?resource=verification${brokerId ? `&broker_id=${brokerId}` : ''}${countrySlug ? `&country_slug=${encodeURIComponent(countrySlug)}` : ''}`);
export const saveBrokerVerification = (payload: Partial<BrokerCountryVerification>) => send<BrokerCountryVerification>('/api/broker-assets?resource=verification', 'PUT', payload);

export const fetchCountries = async () => {
  try {
    return await get<CountryPage[]>('/api/countries');
  } catch (error) {
    return get<CountryPage[]>('/api/content?resource=countries');
  }
};
export const fetchCountry = async (slug: string) => {
  const encoded = encodeURIComponent(slug);
  try {
    return await get<CountryPage>(`/api/countries?slug=${encoded}`);
  } catch (error) {
    return get<CountryPage>(`/api/content?resource=countries&slug=${encoded}`);
  }
};
export const fetchCountryIntentRankings = (countrySlug: string, intentSlug: string) => get<CountryIntentBrokerRanking[]>(`/api/country-intent-rankings?country=${encodeURIComponent(countrySlug)}&intent=${encodeURIComponent(publicIntentSlug(intentSlug))}`);
export const createReview = async (payload: { broker_id: number; author: string; country: string; rating: number; title: string; body: string }, authToken?: string): Promise<Review> => { const res = await fetch('/api/reviews', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}) }, body: JSON.stringify(payload) }); const data = await res.json().catch(() => ({})); if (!res.ok) throw new Error((data as { error?: string }).error || `Request failed (${res.status})`); return data as Review; };
export const voteHelpful = (id: number) => send<Review>('/api/reviews', 'PUT', { id });
export const subscribeNewsletter = (email: string) => send<{ ok: boolean; duplicate?: boolean }>('/api/newsletter', 'POST', { email });
export const trackClick = (broker_id: number, page: string) => send<{ ok: boolean }>('/api/track?resource=clicks', 'POST', { broker_id, page }).catch(() => ({ ok: false }));
export const fetchCountryLanguages = (countrySlug?: string) => get<CountryLanguage[]>(`/api/country-languages${countrySlug ? `?country=${encodeURIComponent(countrySlug)}` : ''}`);
export const fetchLocalizationUiPack = (languageCode: string) => get<{ language_code: string; strings: Record<string, string> | null } | null>(`/api/localization-ui-packs?language=${encodeURIComponent(languageCode)}`);
export const fetchLocalizationGlossary = (languageCode?: string) => get<{ id: number; language_code: string; term_en: string; term_local: string; notes?: string }[]>(`/api/localization-glossary${languageCode ? `?language=${encodeURIComponent(languageCode)}` : ''}`);
export const fetchLocalizationHealth = (token: string) => get<{ totals: { pages: number; published: number; issues: number }; issues: { id: number; type: string; message: string; slug?: string; country?: string }[] }>('/api/localization-health', token);
export const saveLocalizationUiPack = (language_code: string, strings: Record<string, string>, token: string) => fetch('/api/localization-ui-packs', { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ language_code, strings }) }).then(async (res) => { const data = await res.json().catch(() => ({})); if (!res.ok) throw new Error((data as { error?: string }).error || 'Failed to save UI pack'); return data; });
export const saveGlossaryTerm = (payload: { language_code: string; term_en: string; term_local: string; notes?: string; id?: number }, token: string) => fetch('/api/localization-glossary', { method: payload.id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ language_code, term_en, term_local, notes: payload.notes, id: payload.id }) }).then(async (res) => { const data = await res.json().catch(() => ({})); if (!res.ok) throw new Error((data as { error?: string }).error || 'Failed to save glossary term'); return data; });

export const fetchContentDocument = (key: string) => get<ContentDocument | null>(`/api/content-documents?key=${encodeURIComponent(key)}`);
export const fetchAdminContentDocument = (key: string, token: string) => get<ContentDocument | null>(`/api/content-documents?admin=true&key=${encodeURIComponent(key)}`, token);
export const fetchContentDocuments = (params?: { type?: string; country?: string; topic?: string; slug?: string }) => {
  const query = new URLSearchParams();
  if (params?.type) query.set('type', params.type);
  if (params?.country) query.set('country', params.country);
  if (params?.topic) query.set('topic', params.topic);
  if (params?.slug) query.set('slug', params.slug);
  const suffix = query.toString();
  return get<ContentDocument[]>(`/api/content-documents${suffix ? `?${suffix}` : ''}`);
};