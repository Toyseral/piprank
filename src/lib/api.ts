import type { Broker, BrokerAssets, BrokerCountryAvailability, BrokerCountryVerification, CountryPage, FAQ, HealthFactors, Intent, Review, ContentDocument, CountryLanguage, CountryIntentBrokerRanking, BrokerPlatform, BrokerPlatforms, CountryBrokerRanking, Regulation, TestResult } from './types';

export class ApiError extends Error {\n  constructor(message: string, public readonly status: number) { super(message); this.name = 'ApiError'; }\n}\n\nasync function get<T>(url: string, token?: string): Promise<T> {
  const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : undefined });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError((data && (data as { error?: string }).error) || `Request failed (${res.status})`, res.status);
  return data as T;
}
async function send<T>(url: string, method: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || `Request failed (${res.status})`);
  return data as T;
}

function normalizePlatforms(value: unknown): BrokerPlatforms {
  const raw = Array.isArray(value) ? value : [];
  const items = raw.map((platform): BrokerPlatform | null => {
    if (typeof platform === 'string') {
      const name = platform.trim();
      if (!name) return null;
      return { name, summary: '', features: [], toString: () => name, toLowerCase: () => name.toLowerCase() };
    }
    if (!platform || typeof platform !== 'object') return null;
    const candidate = platform as Record<string, unknown>;
    const name = String(candidate.name ?? '').trim();
    if (!name) return null;
    return {
      name,
      summary: typeof candidate.summary === 'string' ? candidate.summary : '',
      features: Array.isArray(candidate.features) ? candidate.features.map(String).filter(Boolean) : [],
      toString: () => name,
      toLowerCase: () => name.toLowerCase(),
    };
  }).filter((platform): platform is BrokerPlatform => Boolean(platform));

  return new Proxy(items as BrokerPlatforms, {
    get(target, property, receiver) {
      if (property === 'includes') {
        return (searchElement: string | BrokerPlatform, fromIndex = 0) => {
          const needle = typeof searchElement === 'string' ? searchElement.toLowerCase() : searchElement.name.toLowerCase();
          return target.slice(fromIndex).some((platform) => platform.name.toLowerCase() === needle);
        };
      }
      return Reflect.get(target, property, receiver);
    },
  });
}

function asFiniteNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function asBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    if (value.toLowerCase() === 'true') return true;
    if (value.toLowerCase() === 'false') return false;
  }
  return fallback;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item).trim()).filter(Boolean) : [];
}

function normalizeRegulations(value: unknown): Regulation[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
    .map((item) => ({
      body: String(item.body ?? '').trim(),
      country: String(item.country ?? '').trim(),
      tier: asFiniteNumber(item.tier, 3),
    }))
    .filter((item) => item.body || item.country);
}

function normalizeHealth(value: unknown): HealthFactors {
  const h = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return {
    regulation: asFiniteNumber(h.regulation),
    longevity: asFiniteNumber(h.longevity),
    withdrawals: asFiniteNumber(h.withdrawals),
    execution: asFiniteNumber(h.execution),
    support: asFiniteNumber(h.support),
    sentiment: asFiniteNumber(h.sentiment),
  };
}

function normalizeAssets(value: unknown): BrokerAssets {
  const a = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return {
    forex: asFiniteNumber(a.forex),
    indices: asFiniteNumber(a.indices),
    commodities: asFiniteNumber(a.commodities),
    crypto: asFiniteNumber(a.crypto),
    stocks: asFiniteNumber(a.stocks),
  };
}

function normalizeFaqs(value: unknown): FAQ[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
    .map((item) => ({ q: String(item.q ?? '').trim(), a: String(item.a ?? '').trim() }))
    .filter((item) => item.q && item.a);
}

function normalizeTesting(value: unknown): TestResult[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
    .map((item) => ({
      label: String(item.label ?? '').trim(),
      result: String(item.result ?? '').trim(),
      detail: String(item.detail ?? '').trim(),
    }))
    .filter((item) => item.label || item.result || item.detail);
}

function normalizeBroker(broker: Broker): Broker {
  const raw = broker && typeof broker === 'object' ? broker as Partial<Broker> & Record<string, unknown> : {};
  const normalized = {
    ...broker,
    id: asFiniteNumber(raw.id),
    name: String(raw.name ?? ''),
    slug: String(raw.slug ?? ''),
    tagline: String(raw.tagline ?? ''),
    brand_color: String(raw.brand_color ?? '#0a1224'),
    logo_url: raw.logo_url == null ? null : String(raw.logo_url),
    rating: asFiniteNumber(raw.rating),
    trust_score: asFiniteNumber(raw.trust_score),
    founded: asFiniteNumber(raw.founded),
    headquarters: String(raw.headquarters ?? ''),
    website: String(raw.website ?? ''),
    affiliate_url: raw.affiliate_url == null ? null : String(raw.affiliate_url),
    min_deposit: asFiniteNumber(raw.min_deposit),
    spread_eurusd: asFiniteNumber(raw.spread_eurusd),
    commission: String(raw.commission ?? ''),
    commission_value: asFiniteNumber(raw.commission_value),
    max_leverage: String(raw.max_leverage ?? ''),
    leverage_value: asFiniteNumber(raw.leverage_value),
    execution_ms: asFiniteNumber(raw.execution_ms),
    withdrawal_hours: asFiniteNumber(raw.withdrawal_hours),
    deposit_time: String(raw.deposit_time ?? ''),
    uptime: asFiniteNumber(raw.uptime),
    withdrawal_fee: asFiniteNumber(raw.withdrawal_fee),
    inactivity_fee: String(raw.inactivity_fee ?? ''),
    demo_account: asBoolean(raw.demo_account),
    islamic_account: asBoolean(raw.islamic_account),
    copy_trading: asBoolean(raw.copy_trading),
    scalping: asBoolean(raw.scalping),
    hedging: asBoolean(raw.hedging),
    nbp: asBoolean(raw.nbp),
    segregated: asBoolean(raw.segregated),
    bonus: raw.bonus == null ? null : String(raw.bonus),
    support_channels: asStringArray(raw.support_channels),
    support_score: asFiniteNumber(raw.support_score),
    regulations: normalizeRegulations(raw.regulations),
    platforms: normalizePlatforms(raw.platforms),
    payments: asStringArray(raw.payments),
    account_types: asStringArray(raw.account_types),
    assets: normalizeAssets(raw.assets),
    best_for: asStringArray(raw.best_for),
    pros: asStringArray(raw.pros),
    cons: asStringArray(raw.cons),
    review: asStringArray(raw.review),
    testing: normalizeTesting(raw.testing),
    faqs: normalizeFaqs(raw.faqs),
    health: normalizeHealth(raw.health),
    featured: asBoolean(raw.featured),
    updated_at: raw.updated_at == null ? null : String(raw.updated_at),
    risk_warning: raw.risk_warning == null ? null : String(raw.risk_warning),
  } satisfies Broker;
  return normalized;
}

export const CANONICAL_INTENT_SLUGS: Record<string, string> = {
  'forex-brokers-for-beginners': 'beginners', 'low-spread-forex-brokers': 'low-spread', mt5: 'mt5', gold: 'gold',
  'forex-brokers-for-scalping': 'scalping', 'islamic-forex-brokers': 'islamic', 'ecn-forex-brokers': 'ecn',
  'copy-trading-forex-brokers': 'copy-trading', 'forex-brokers-for-swing-trading': 'swing-trading', 'high-leverage-forex-brokers': 'high-leverage',
};
export const publicIntentSlug = (slug: string) => CANONICAL_INTENT_SLUGS[slug] ?? slug;

export const fetchBrokers = async () => (await get<Broker[]>('/api/brokers')).map(normalizeBroker);
export const fetchGeo = () => get<{ slug: string | null; iso2: string | null; source: string }>('/api/site?resource=geo');
export const fetchBroker = async (slug: string) => normalizeBroker(await get<Broker>(`/api/brokers?slug=${encodeURIComponent(slug)}`));
export const fetchIntents = () => get<Intent[]>('/api/intents');
export const fetchIntent = async (slug: string) => { const mapped = publicIntentSlug(slug); try { return await get<Intent>(`/api/intents?slug=${encodeURIComponent(mapped)}`); } catch (e) { if (mapped === slug) throw e; return get<Intent>(`/api/intents?slug=${encodeURIComponent(slug)}`); } };
export const fetchReviews = (brokerId: number) => get<Review[]>(`/api/reviews?broker_id=${brokerId}`);

export const fetchBrokerAvailability = (brokerId: number) => get<BrokerCountryAvailability[]>(`/api/broker-assets?resource=availability&broker_id=${brokerId}`);
export const fetchCountryBrokerAvailability = (countrySlug: string) => get<BrokerCountryAvailability[]>(`/api/broker-assets?resource=availability&country_slug=${encodeURIComponent(countrySlug)}`);
export const fetchBrokerVerification = (brokerId?: number, countrySlug?: string) => get<BrokerCountryVerification[]>(`/api/broker-assets?resource=verification${brokerId ? `&broker_id=${brokerId}` : ''}${countrySlug ? `&country_slug=${encodeURIComponent(countrySlug)}` : ''}`);
export const saveBrokerVerification = (payload: Partial<BrokerCountryVerification>) => send<BrokerCountryVerification>('/api/broker-assets?resource=verification', 'PUT', payload);

// Country reads go directly to the canonical content function. This avoids the
// legacy /api/countries Vercel rewrite being part of public route resolution.
export const fetchCountries = () => get<CountryPage[]>('/api/content?resource=countries');
export const fetchCountry = (slug: string) => get<CountryPage>(`/api/content?resource=countries&slug=${encodeURIComponent(slug)}`);
export const fetchCountryIntentRankings = async (countrySlug: string, intentSlug: string) => {
  const rows = await get<CountryIntentBrokerRanking[]>(`/api/content?resource=country-intent-rankings?country=${encodeURIComponent(countrySlug)}&intent=${encodeURIComponent(publicIntentSlug(intentSlug))}`);
  return rows.map((row) => ({ ...row, broker: row.broker ? normalizeBroker(row.broker) : row.broker }));
};
export const createReview = async (payload: { broker_id: number; author: string; country: string; rating: number; title: string; body: string }, authToken?: string): Promise<Review> => { const res = await fetch('/api/reviews', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}) }, body: JSON.stringify(payload) }); const data = await res.json().catch(() => ({})); if (!res.ok) throw new Error((data as { error?: string }).error || `Request failed (${res.status})`); return data as Review; };
export const voteHelpful = (id: number) => send<Review>('/api/reviews', 'PUT', { id });
export const subscribeNewsletter = (email: string) => send<{ ok: boolean; duplicate?: boolean }>('/api/site?resource=newsletter', 'POST', { email });
export const trackClick = (broker_id: number, page: string) => send<{ ok: boolean }>('/api/analytics?resource=clicks', 'POST', { broker_id, page }).catch(() => ({ ok: false }));
export const fetchCountryLanguages = (countrySlug?: string) => get<CountryLanguage[]>(`/api/canonical-country-languages${countrySlug ? `?country=${encodeURIComponent(countrySlug)}` : ''}`);
export const fetchLocalizationUiPack = (languageCode: string) => get<{ language_code: string; strings: Record<string, string> | null } | null>(`/api/content?resource=localization-ui-packs?language=${encodeURIComponent(languageCode)}`);
export const fetchLocalizationGlossary = (languageCode?: string) => get<{ id: number; language_code: string; term_en: string; term_local: string; notes?: string }[]>(`/api/content?resource=localization-glossary${languageCode ? `?language=${encodeURIComponent(languageCode)}` : ''}`);
export const fetchLocalizationHealth = (token: string) => get<{ totals: { pages: number; published: number; issues: number }; issues: { id: number; type: string; message: string; slug?: string; country?: string }[] }>('/api/content?resource=localization-health', token);
export const saveLocalizationUiPack = (language_code: string, strings: Record<string, string>, token: string) => fetch('/api/content?resource=localization-ui-packs', { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ language_code, strings }) }).then(async (res) => { const data = await res.json().catch(() => ({})); if (!res.ok) throw new Error((data as { error?: string }).error || 'Failed to save UI pack'); return data; });
export const saveGlossaryTerm = (payload: { language_code: string; term_en: string; term_local: string; notes?: string; id?: number }, token: string) => fetch('/api/content?resource=localization-glossary', { method: payload.id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ language_code: payload.language_code, term_en: payload.term_en, term_local: payload.term_local, notes: payload.notes, id: payload.id }) }).then(async (res) => { const data = await res.json().catch(() => ({})); if (!res.ok) throw new Error((data as { error?: string }).error || 'Failed to save glossary term'); return data; });

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

export const fetchCountryBrokerRankings = async (countrySlug: string) => {
  const rows = await get<CountryBrokerRanking[]>(`/api/country-broker-rankings?country=${encodeURIComponent(countrySlug)}`);
  return rows.map((row) => ({ ...row, broker: row.broker ? normalizeBroker(row.broker) : row.broker }));
};
