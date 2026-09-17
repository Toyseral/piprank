import type { Broker, BrokerContent, BrokerCountryAvailability, BrokerCountryVerification, CountryPage, Intent, Review, ContentDocument, CountryLanguage, CountryIntentBrokerRanking, BrokerPlatform, BrokerPlatforms } from './types';

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

function normalizePlatforms(value: unknown): BrokerPlatforms {
  const raw = Array.isArray(value) ? value : [];
  const items = raw.map((platform): BrokerPlatform | null => {
    if (typeof platform === 'string') {
      const name = platform.trim();
      if (!name) return null;
      return {
        name,
        summary: '',
        features: [],
        toString: () => name,
        toLowerCase: () => name.toLowerCase(),
      };
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

function normalizeBroker(broker: Broker): Broker {
  return { ...broker, platforms: normalizePlatforms(broker.platforms) };
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

function htmlToParagraphs(html: string): string[] {
  return String(html || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|li|div|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .split(/\n+/)
    .map((value) => value.trim())
    .filter(Boolean);
}

const BROKER_EDITORIAL_HEADINGS: Record<string, keyof Omit<BrokerContent, 'broker_id' | 'faqs' | 'platforms' | 'accounts' | 'payments'>> = {
  'overview': 'overview',
  'our verdict': 'verdict',
  'why we recommend this broker': 'why_recommend',
  'best for': 'best_for_detail',
  'consider avoiding if': 'avoid_if',
  'regulation': 'regulation_detail',
  'fees & costs': 'fees_detail',
  'trading platforms': 'platform_intro',
  'account types': 'accounts_intro',
  'deposits & withdrawals': 'funding_intro',
};

/**
 * Compatibility adapter for callers that still consume the old BrokerContent
 * shape. The database source is now canonical content_documents; no
 * broker_content table read is performed here. This lets the public broker
 * page move off the legacy table without changing its rendering contract in
 * the same commit.
 */
export const fetchBrokerContent = async (brokerId: number): Promise<BrokerContent | null> => {
  const brokers = await fetchBrokers();
  const broker = brokers.find((item) => Number(item.id) === Number(brokerId));
  if (!broker?.slug) return null;

  const document = await fetchContentDocument(`broker:${broker.slug}:main`);
  if (!document) return null;

  const result: BrokerContent = {
    broker_id: Number(broker.id), overview: [], verdict: [], why_recommend: [], best_for_detail: [], avoid_if: [],
    regulation_detail: [], fees_detail: [], platform_intro: [], accounts_intro: [], funding_intro: [], faqs: [],
    platforms: [], accounts: [], payments: [],
  };
  let section: keyof typeof result = 'overview';
  const blocks = Array.isArray(document.blocks) ? document.blocks : [];
  for (const raw of blocks) {
    const block = raw as Record<string, unknown>;
    if (block.type === 'heading') {
      const heading = String(block.title || '').trim().toLowerCase();
      section = BROKER_EDITORIAL_HEADINGS[heading] ?? section;
      continue;
    }
    if (block.type === 'richtext' && typeof block.html === 'string') {
      const paragraphs = htmlToParagraphs(block.html);
      if (section in result && Array.isArray(result[section])) (result[section] as string[]).push(...paragraphs);
    }
  }
  return result;
};

export const fetchBrokerAvailability = (brokerId: number) => get<BrokerCountryAvailability[]>(`/api/broker-assets?resource=availability&broker_id=${brokerId}`);
export const fetchCountryBrokerAvailability = (countrySlug: string) => get<BrokerCountryAvailability[]>(`/api/broker-assets?resource=availability&country_slug=${encodeURIComponent(countrySlug)}`);
export const fetchBrokerVerification = (brokerId?: number, countrySlug?: string) => get<BrokerCountryVerification[]>(`/api/broker-assets?resource=verification${brokerId ? `&broker_id=${brokerId}` : ''}${countrySlug ? `&country_slug=${encodeURIComponent(countrySlug)}` : ''}`);
export const saveBrokerVerification = (payload: Partial<BrokerCountryVerification>) => send<BrokerCountryVerification>('/api/broker-assets?resource=verification', 'PUT', payload);

// Country reads go directly to the canonical content function. This avoids the
// legacy /api/countries Vercel rewrite being part of public route resolution.
export const fetchCountries = () => get<CountryPage[]>('/api/content?resource=countries');
export const fetchCountry = (slug: string) => get<CountryPage>(`/api/content?resource=countries&slug=${encodeURIComponent(slug)}`);
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
export const saveGlossaryTerm = (payload: { language_code: string; term_en: string; term_local: string; notes?: string; id?: number }, token: string) => fetch('/api/localization-glossary', { method: payload.id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ language_code: payload.language_code, term_en: payload.term_en, term_local: payload.term_local, notes: payload.notes, id: payload.id }) }).then(async (res) => { const data = await res.json().catch(() => ({})); if (!res.ok) throw new Error((data as { error?: string }).error || 'Failed to save glossary term'); return data; });

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
