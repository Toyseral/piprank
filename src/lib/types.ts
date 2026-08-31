export interface Regulation {
  body: string;
  country: string;
  tier: number;
}

export interface HealthFactors {
  regulation: number;
  longevity: number;
  withdrawals: number;
  execution: number;
  support: number;
  sentiment: number;
}

export interface BrokerAssets {
  forex: number;
  indices: number;
  commodities: number;
  crypto: number;
  stocks: number;
}

export interface TestResult {
  label: string;
  result: string;
  detail: string;
}

export interface FAQ {
  q: string;
  a: string;
}

export interface Broker {
  id: number;
  name: string;
  slug: string;
  tagline: string;
  brand_color: string;
  logo_url?: string | null;
  rating: number;
  trust_score: number;
  founded: number;
  headquarters: string;
  website: string;
  affiliate_url?: string | null;
  min_deposit: number;
  spread_eurusd: number;
  commission: string;
  commission_value: number;
  max_leverage: string;
  leverage_value: number;
  execution_ms: number;
  withdrawal_hours: number;
  deposit_time: string;
  uptime: number;
  withdrawal_fee: number;
  inactivity_fee: string;
  demo_account: boolean;
  islamic_account: boolean;
  copy_trading: boolean;
  scalping: boolean;
  hedging: boolean;
  nbp: boolean;
  segregated: boolean;
  bonus: string | null;
  support_channels: string[];
  support_score: number;
  regulations: Regulation[];
  platforms: string[];
  payments: string[];
  account_types: string[];
  assets: BrokerAssets;
  best_for: string[];
  pros: string[];
  cons: string[];
  review: string[];
  testing: TestResult[];
  faqs: FAQ[];
  health: HealthFactors;
  featured: boolean;
  updated_at?: string | null;
  /**
   * The broker's own regulator-mandated retail loss disclosure, verbatim
   * from their regulated entity's marketing material (e.g. "76% of retail
   * investor accounts lose money when trading CFDs with this provider").
   * Admin-entered and sourced per broker — never a generic/estimated figure.
   * Null until an admin has verified and entered the real figure.
   */
  risk_warning?: string | null;
}

export interface Review {
  id: number;
  broker_id: number;
  author: string;
  country: string;
  rating: number;
  title: string;
  body: string;
  helpful: number;
  verified: boolean;
  created_at: string;
}

export interface GuideSection {
  heading: string;
  body: string[];
  bullets?: string[];
}

export interface Guide {
  id: number;
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  level: string;
  minutes: number;
  image: string;
  sections: GuideSection[];
  published: string;
}

export interface Intent {
  id: number;
  slug: string;
  label: string;
  title: string;
  meta_title?: string | null;
  meta_description?: string | null;
  intro: string[];
  icon: string;
  criteria: string[];
  sections?: { heading: string; body: string[]; bullets?: string[] }[];
  faqs?: FAQ[];
  indexable?: boolean;
  sort_order?: number;
}

export interface CountryBestFor {
  id: number;
  country_id: number;
  intent_id?: number | null;
  country_slug?: string;
  country_name?: string;
  slug: string;
  label: string;
  title: string;
  meta_title?: string | null;
  meta_description?: string | null;
  intro: string[];
  icon: string;
  criteria: string[];
  sections: { heading: string; body: string[]; bullets?: string[] }[];
  faqs: FAQ[];
  indexable: boolean;
  sort_order: number;
  updated_at?: string;
}

export interface Promotion {
  id: number;
  broker_id: number;
  title: string;
  description: string;
  badge: string;
  terms: string;
  ends_on: string | null;
  active: boolean;
  created_at?: string;
}

export interface PlatformDetail {
  name: string;
  summary: string;
  features: string[];
}

export interface AccountType {
  name: string;
  spread_from: string;
  commission: string;
  min_deposit: string;
  best_for: string;
}

export interface PaymentRail {
  method: string;
  deposit: string;
  withdrawal: string;
  fee: string;
}

export interface BrokerContent {
  broker_id: number;
  overview?: string[];
  verdict?: string[];
  why_recommend?: string[];
  best_for_detail?: string[];
  avoid_if?: string[];
  regulation_detail?: string[];
  fees_detail?: string[];
  platform_intro?: string[];
  accounts_intro?: string[];
  funding_intro?: string[];
  faqs?: FAQ[];
  platforms: PlatformDetail[];
  accounts: AccountType[];
  payments: PaymentRail[];
  updated_at?: string;
}

export interface BrokerCountryAvailability {
  id: number;
  broker_id: number;
  country_id: number;
  country_slug?: string;
  country_name?: string;
  status: 'available' | 'restricted' | 'unavailable' | 'unknown';
  note?: string | null;
  priority?: number;
  updated_at?: string;
}

export interface BrokerCountryVerification {
  id: number;
  broker_id: number;
  country_id: number;
  broker_slug?: string;
  broker_name?: string;
  country_slug?: string;
  country_name?: string;
  availability_verified: boolean;
  local_authorisation_status: 'authorised' | 'not_authorised' | 'not_applicable' | 'not_verified';
  client_entity?: string | null;
  regulator?: string | null;
  affiliate_eligible?: boolean | null;
  verification_date?: string | null;
  source_url?: string | null;
  notes?: string | null;
  updated_at?: string;
}

export interface CountryFact {
  label: string;
  value: string;
}

export interface CountryRec {
  slug: string;
  note: string;
}

export interface CountryPage {
  id: number;
  slug: string;
  name: string;
  flag: string;
  subtitle: string;
  intro: string[];
  facts: CountryFact[];
  recommended: CountryRec[];
  unavailable: string[];
  seo_title?: string | null;
  seo_description?: string | null;
  seo_intro?: string[];
  seo_sections?: { heading: string; body: string[]; bullets?: string[] }[];
  seo_faqs?: FAQ[];
  publishing_state?: 'draft' | 'published' | 'closed';
}


export interface ContentDocument {
  id: number;
  content_key: string;
  content_type: string;
  country_slug: string | null;
  topic_slug: string | null;
  slug: string | null;
  title: string;
  excerpt: string;
  html: string;
  blocks: unknown[];
  seo_title: string | null;
  seo_description: string | null;
  indexable: boolean;
  published: boolean;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  settings?: Record<string, unknown>;
}


export interface CountryLanguage {
  id: number;
  country_id: number;
  country_slug?: string;
  country_name?: string;
  name: string;
  native_name: string;
  code: string;
  locale: string;
  url_prefix: string;
  is_default: boolean;
  active: boolean;
  updated_at?: string;
}

export interface LocalizedSeoPage {
  id: number;
  country_id: number;
  language_id: number;
  country_slug?: string;
  country_name?: string;
  language_code?: string;
  language_name?: string;
  language_native_name?: string;
  locale?: string;
  url_prefix?: string;
  topic_key: string;
  slug: string;
  title: string;
  meta_title?: string | null;
  meta_description?: string | null;
  h1?: string | null;
  content: string;
  /** Optional Content Studio document for rich body (Option B). */
  content_document_id?: number | null;
  faqs: FAQ[];
  indexable: boolean;
  published: boolean;
  /** draft | in_review | ready | published */
  workflow_status?: string | null;
  updated_by?: string | null;
  updated_at?: string;
}

export interface CountryIntentBrokerRanking {
  country_id:number; intent_id:number; broker_id:number; final_rank:number; final_score:number;
  featured:boolean; force_include?:boolean; force_exclude?:boolean; manual_rank?:number|null;
  score_adjustment?:number; featured_override?:boolean|null; editorial_note?:string|null; broker?:Broker;
}
