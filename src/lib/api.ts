import type { Broker, BrokerContent, BrokerCountryAvailability, BrokerCountryVerification, CountryBestFor, CountryPage, Guide, Intent, Review, ContentDocument, CountryLanguage, LocalizedSeoPage, CountryIntentBrokerRanking } from './types';

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
export const fetchIntent = async (slug: string) => {
  const mapped = publicIntentSlug(slug);
  try { return await get<Intent>(`/api/intents?slug=${encodeURIComponent(mapped)}`); }
  catch (e) { if (mapped === slug) throw e; return get<Intent>(`/api/intents?slug=${encodeURIComponent(slug)}`); }
};
export const fetchGuides = () => get<Guide[]>('/api/guides');
export const fetchGuide = (slug: string) => get<Guide>(`/api/guides?slug=${encodeURIComponent(slug)}`);
export const fetchReviews = (brokerId: number) => get<Review[]>(`/api/reviews?broker_id=${brokerId}`);
export const fetchBrokerContent = (brokerId: number) => get<BrokerContent | null>(`/api/broker-assets?resource=content&broker_id=${brokerId}`);
export const fetchBrokerAvailability = (brokerId: number) => get<BrokerCountryAvailability[]>(`/api/broker-assets?resource=availability&broker_id=${brokerId}`);
export const fetchBrokerVerification = (brokerId?: number, countrySlug?: string) => get<BrokerCountryVerification[]>(`/api/broker-assets?resource=verification${brokerId ? `&broker_id=${brokerId}` : ''}${countrySlug ? `&country_slug=${encodeURIComponent(countrySlug)}` : ''}`);
export const saveBrokerVerification = (payload: Partial<BrokerCountryVerification>) => send<BrokerCountryVerification>('/api/broker-assets?resource=verification', 'PUT', payload);
export const fetchCountries = () => get<CountryPage[]>('/api/countries');
export const fetchCountry = (slug: string) => get<CountryPage>(`/api/countries?slug=${encodeURIComponent(slug)}`);
export const fetchCountryIntentRankings = (countrySlug: string, intentSlug: string) => get<CountryIntentBrokerRanking[]>(`/api/country-intent-rankings?country=${encodeURIComponent(countrySlug)}&intent=${encodeURIComponent(publicIntentSlug(intentSlug))}`);
export const fetchCountryBestFors = (countrySlug: string) => get<CountryBestFor[]>(`/api/country-best-for?country=${encodeURIComponent(countrySlug)}`);
export const fetchCountryBestFor = async (countrySlug: string, slug: string) => {
  const mapped = publicIntentSlug(slug);
  try {
    return await get<CountryBestFor>(`/api/country-best-for?country=${encodeURIComponent(countrySlug)}&slug=${encodeURIComponent(mapped)}`);
  } catch (e) {
    if (mapped === slug) throw e;
    return get<CountryBestFor>(`/api/country-best-for?country=${encodeURIComponent(countrySlug)}&slug=${encodeURIComponent(slug)}`);
  }
};
export const createReview = async (payload: { broker_id: number; author: string; country: string; rating: number; title: string; body: string }, authToken?: string): Promise<Review> => { const res = await fetch('/api/reviews', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}) }, body: JSON.stringify(payload) }); const data = await res.json().catch(() => ({})); if (!res.ok) throw new Error((data as { error?: string }).error || `Request failed (${res.status})`); return data as Review; };
export const voteHelpful = (id: number) => send<Review>('/api/reviews', 'PUT', { id });
export const subscribeNewsletter = (email: string) => send<{ ok: boolean; duplicate?: boolean }>('/api/newsletter', 'POST', { email });
export const trackClick = (broker_id: number, page: string) => send<{ ok: boolean }>('/api/track?resource=clicks', 'POST', { broker_id, page }).catch(() => ({ ok: false }));

export const fetchContentDocument = async (key: string): Promise<ContentDocument | null> => {
  const direct = await get<ContentDocument | null>(`/api/content-documents?key=${encodeURIComponent(key)}`);
  if (direct) return direct;
  const parts = key.split(':');
  if (parts.length === 3 && (parts[0] === 'country-topic' || parts[0] === 'country-guide')) {
    const [, countrySlug, slug] = parts;
    try {
      if (parts[0] === 'country-topic') {
        const legacy = await fetchCountryBestFor(countrySlug, slug);
        if (legacy) {
          const paragraphs = Array.isArray(legacy.intro) ? legacy.intro : [];
          const sections = Array.isArray(legacy.sections) ? legacy.sections : [];
          const html = [...paragraphs.map((p) => `<p>${String(p)}</p>`), ...sections.map((s) => `<section><h2>${String(s.heading ?? '')}</h2>${(Array.isArray(s.body) ? s.body : []).map((p) => `<p>${String(p)}</p>`).join('')}${(Array.isArray(s.bullets) ? s.bullets : []).length ? `<ul>${(Array.isArray(s.bullets) ? s.bullets : []).map((b) => `<li>${String(b)}</li>`).join('')}</ul>` : ''}</section>`)].join('');
          return { id: Number(legacy.id), content_key: key, content_type: 'country-topic', country_slug: countrySlug, topic_slug: slug, slug, title: legacy.title, excerpt: paragraphs[0] ?? '', html, blocks: [], seo_title: legacy.meta_title ?? null, seo_description: legacy.meta_description ?? null, indexable: legacy.indexable !== false, published: true, updated_by: null, created_at: '', updated_at: '', settings: { faqs: legacy.faqs ?? [], internalLinks: [] } };
        }
      }
      const docs = await get<ContentDocument[]>(`/api/content-documents?country=${encodeURIComponent(countrySlug)}&slug=${encodeURIComponent(slug)}`);
      const candidate = Array.isArray(docs) ? docs.find((doc) => doc.content_type === 'country-guide' || doc.content_type === 'guide') : null;
      if (candidate) return candidate;
    } catch { /* preserve not-found behavior */ }
  }
  return null;
};

export const fetchLocalizedGuide = async (countrySlug: string, languageCode: string, slug: string): Promise<ContentDocument | null> => {
  const docs = await get<ContentDocument[]>(`/api/content-documents?country=${encodeURIComponent(countrySlug)}&slug=${encodeURIComponent(slug)}&type=localized-guide`);
  const lang = languageCode.toLowerCase();
  return Array.isArray(docs) ? docs.find((doc) => String(doc.settings?.languageCode || '').toLowerCase() === lang) ?? null : null;
};

export const fetchContentDocumentById = (id: number) => get<ContentDocument | null>(`/api/content-documents?id=${id}`);
export const fetchCountryLanguages = (countrySlug?: string) => get<CountryLanguage[]>(`/api/country-languages${countrySlug ? `?country=${encodeURIComponent(countrySlug)}` : ''}`);
export const fetchLocalizedSeoPage = (countrySlug: string, languageCode: string, slug: string) => get<LocalizedSeoPage | null>(`/api/localized-seo-pages?country=${encodeURIComponent(countrySlug)}&language=${encodeURIComponent(languageCode)}&slug=${encodeURIComponent(slug)}`);
export const fetchLocalizedSeoPagesForCountry = (countrySlug: string) => get<LocalizedSeoPage[]>(`/api/localized-seo-pages?country=${encodeURIComponent(countrySlug)}`);
export const fetchLocalizationUiPack = (languageCode: string) => get<{ language_code: string; strings: Record<string, string> | null } | null>(`/api/localization-ui-packs?language=${encodeURIComponent(languageCode)}`);
export const fetchLocalizationGlossary = (languageCode?: string) => get<{ id: number; language_code: string; term_en: string; term_local: string; notes?: string }[]>(`/api/localization-glossary${languageCode ? `?language=${encodeURIComponent(languageCode)}` : ''}`);
export const fetchLocalizedSeoPagePreview = (countrySlug: string, languageCode: string, slug: string, token: string) => get<LocalizedSeoPage | null>(`/api/localized-seo-pages?country=${encodeURIComponent(countrySlug)}&language=${encodeURIComponent(languageCode)}&slug=${encodeURIComponent(slug)}&preview=1`, token);
export const fetchLocalizationHealth = (token: string) => get<{ totals: { pages: number; published: number; issues: number }; issues: { id: number; type: string; message: string; slug?: string; country?: string }[] }>('/api/localization-health', token);
export const saveLocalizationUiPack = (language_code: string, strings: Record<string, string>, token: string) => fetch('/api/localization-ui-packs', { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ language_code, strings }) }).then(async (res) => { const data = await res.json().catch(() => ({})); if (!res.ok) throw new Error((data as { error?: string }).error || 'Failed to save UI pack'); return data; });
export const saveGlossaryTerm = (payload: { language_code: string; term_en: string; term_local: string; notes?: string; id?: number }, token: string) => fetch('/api/localization-glossary', { method: payload.id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(payload) }).then(async (res) => { const data = await res.json().catch(() => ({})); if (!res.ok) throw new Error((data as { error?: string }).error || 'Failed to save glossary term'); return data; });
