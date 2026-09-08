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
  blocks?: unknown[];
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
  blocks?: unknown[];
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
  blocks?: unknown[];
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
