import { GEO_OPTIONS } from './geo';
import { countrySeoTopics } from '../data/countrySeoMatrix.js';

/** Map localization topic_key → English country SEO topic slug. */
export function englishSlugForTopicKey(topicKey: string | null | undefined): string | null {
  if (!topicKey || topicKey === 'all') return null;
  const topic = countrySeoTopics.find((t) => t.key === topicKey);
  return topic?.slug ?? null;
}

/** English alternate path for a localized commercial page. */
export function englishAlternatePath(countrySlug: string, topicKey: string | null | undefined): string {
  const topicSlug = englishSlugForTopicKey(topicKey);
  if (!topicSlug) return `/${countrySlug}`;
  return `/${countrySlug}/${topicSlug}`;
}

/** BCP 47 region code for a country slug (e.g. vietnam → VN). */
export function iso2ForCountrySlug(countrySlug: string): string | null {
  return GEO_OPTIONS.find((g) => g.slug === countrySlug)?.iso2 ?? null;
}

/** English hreflang for a country (e.g. en-VN). Falls back to "en". */
export function englishHreflangForCountry(countrySlug: string): string {
  const iso = iso2ForCountrySlug(countrySlug);
  return iso ? `en-${iso}` : 'en';
}

/** Human-readable default titles when seeding draft localized pages. */
export const LOCALIZATION_TOPIC_TITLES: Record<string, string> = {
  all: 'Best Forex Brokers',
  beginners: 'Best Forex Brokers for Beginners',
  mt4: 'Best MT4 Forex Brokers',
  mt5: 'Best MT5 Forex Brokers',
  gold: 'Best Gold Forex Brokers',
  'low-spread': 'Low Spread Forex Brokers',
};

export function defaultLocalizedTitle(topicKey: string, countryName?: string | null): string {
  const base = LOCALIZATION_TOPIC_TITLES[topicKey] ?? topicKey.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  return countryName ? `${base} in ${countryName}` : base;
}

export const DEFAULT_LOCALIZATION_TOPIC_KEYS = ['all', 'beginners', 'mt4', 'mt5', 'gold', 'low-spread'] as const;

export type WorkflowStatus = 'draft' | 'in_review' | 'ready' | 'published';

export function deriveWorkflowStatus(page: {
  published?: boolean;
  indexable?: boolean;
  content?: string;
  workflow_status?: string | null;
}): WorkflowStatus {
  if (page.workflow_status === 'draft' || page.workflow_status === 'in_review' || page.workflow_status === 'ready' || page.workflow_status === 'published') {
    if (page.published) return 'published';
    return page.workflow_status;
  }
  if (page.published) return 'published';
  if (page.indexable) return 'ready';
  if ((page.content ?? '').trim().length > 40) return 'in_review';
  return 'draft';
}

/** Per-language editorial defaults for slug/title seeds (#10). */
export type LanguageTopicTemplate = {
  slug: string;
  title: string;
  metaTitle?: string;
  description?: string;
  intro?: string[];
  faqs?: { q: string; a: string }[];
};

export type LanguageTemplatePack = {
  code: string;
  topics: Record<string, LanguageTopicTemplate>;
};

/** Built-in packs. Unknown languages fall back to English-style seeds. */
export const LANGUAGE_TEMPLATE_PACKS: Record<string, LanguageTemplatePack> = {
  vi: {
    code: 'vi',
    topics: {
      all: {
        slug: 'broker-forex-tot-nhat',
        title: 'Broker Forex Tốt Nhất',
        metaTitle: 'Broker Forex Tốt Nhất tại Việt Nam | PipRank',
        description:
          'So sánh các broker forex tốt nhất tại Việt Nam. Xem phí giao dịch, nền tảng, điều kiện tài khoản và mức độ phù hợp với trader Việt Nam.',
        intro: [
          'So sánh các broker forex được PipRank đánh giá phù hợp với trader tại Việt Nam.',
          'Điều kiện giao dịch, pháp nhân, đòn bẩy, phương thức nạp rút và quy định có thể khác nhau theo quốc gia.',
        ],
        faqs: [
          {
            q: 'Broker forex nào tốt nhất tại Việt Nam?',
            a: 'PipRank bắt đầu từ nhóm broker được đề xuất cho Việt Nam và đánh giá mức độ phù hợp dựa trên chi phí, nền tảng, tính năng tài khoản và độ tin cậy.',
          },
        ],
      },
      beginners: {
        slug: 'broker-forex-tot-nhat-cho-nguoi-moi',
        title: 'Broker Forex Tốt Nhất Cho Người Mới',
        metaTitle: 'Broker Forex Tốt Nhất Cho Người Mới tại Việt Nam | PipRank',
      },
      mt4: {
        slug: 'broker-mt4-tot-nhat',
        title: 'Broker MT4 Tốt Nhất',
        metaTitle: 'Broker MT4 Tốt Nhất tại Việt Nam | PipRank',
      },
      mt5: {
        slug: 'broker-mt5-tot-nhat',
        title: 'Broker MT5 Tốt Nhất',
        metaTitle: 'Broker MT5 Tốt Nhất tại Việt Nam | PipRank',
      },
      gold: {
        slug: 'broker-giao-dich-vang-tot-nhat',
        title: 'Broker Forex Tốt Nhất Để Giao Dịch Vàng',
        metaTitle: 'Broker Giao Dịch Vàng Tốt Nhất tại Việt Nam | PipRank',
      },
      'low-spread': {
        slug: 'broker-forex-spread-thap',
        title: 'Broker Forex Có Spread Thấp',
        metaTitle: 'Broker Forex Có Spread Thấp tại Việt Nam | PipRank',
      },
    },
  },
  ms: {
    code: 'ms',
    topics: {
      all: { slug: 'broker-forex-terbaik', title: 'Broker Forex Terbaik' },
      beginners: { slug: 'broker-forex-untuk-pemula', title: 'Broker Forex untuk Pemula' },
      mt4: { slug: 'broker-mt4-terbaik', title: 'Broker MT4 Terbaik' },
      mt5: { slug: 'broker-mt5-terbaik', title: 'Broker MT5 Terbaik' },
      gold: { slug: 'broker-emas-terbaik', title: 'Broker Emas Terbaik' },
      'low-spread': { slug: 'broker-spread-rendah', title: 'Broker Forex Spread Rendah' },
    },
  },
};

export function getLanguageTopicTemplate(
  languageCode: string,
  topicKey: string,
  countryName?: string | null,
): LanguageTopicTemplate {
  const pack = LANGUAGE_TEMPLATE_PACKS[languageCode.toLowerCase()];
  const fromPack = pack?.topics[topicKey];
  if (fromPack) {
    const title =
      countryName && !fromPack.title.includes(countryName)
        ? `${fromPack.title}${languageCode === 'vi' ? ' tại ' : ' di '}${countryName}`
        : fromPack.title;
    return { ...fromPack, title };
  }
  const topic = countrySeoTopics.find((t) => t.key === topicKey);
  const baseTitle = LOCALIZATION_TOPIC_TITLES[topicKey] ?? topic?.title ?? topicKey;
  const title = countryName ? `${baseTitle} in ${countryName}` : baseTitle;
  return {
    slug: topic?.slug ?? topicKey,
    title,
    metaTitle: undefined,
    description: undefined,
    intro: [],
    faqs: [],
  };
}

/** Shared UI chrome strings for localized commercial pages (#6). */
export type LocalizationUiStrings = {
  home: string;
  recommendations: string;
  methodologyTitle: string;
  methodologyAvailability: string;
  methodologyIntent: string;
  methodologyAffiliate: string;
  findBroker: string;
  findBrokerBlurb: string;
  insufficientData: string;
  reviewedBy: string;
};

const UI_BY_LANG: Record<string, LocalizationUiStrings> = {
  en: {
    home: 'Home',
    recommendations: 'Recommendations',
    methodologyTitle: 'How PipRank evaluates brokers',
    methodologyAvailability: 'Country-specific availability is considered first.',
    methodologyIntent: 'The page intent determines the relevant filters.',
    methodologyAffiliate: 'Affiliate economics do not determine ranking.',
    findBroker: 'Find My Broker',
    findBrokerBlurb: "Use PipRank's broker matching tool for a recommendation based on your trading needs.",
    insufficientData: 'PipRank does not have enough country-specific broker data to make a reliable recommendation yet.',
    reviewedBy: 'Reviewed by',
  },
  vi: {
    home: 'Trang chủ',
    recommendations: 'Khuyến nghị của PipRank',
    methodologyTitle: 'PipRank đánh giá broker như thế nào?',
    methodologyAvailability: 'Khả năng tiếp cận theo quốc gia được xem xét trước.',
    methodologyIntent: 'Nhu cầu giao dịch của trang quyết định bộ lọc liên quan.',
    methodologyAffiliate: 'Kinh tế liên kết không quyết định thứ hạng.',
    findBroker: 'Tìm broker phù hợp',
    findBrokerBlurb: 'Dùng công cụ khớp broker của PipRank để nhận gợi ý theo nhu cầu giao dịch của bạn.',
    insufficientData: 'PipRank chưa có đủ dữ liệu broker theo quốc gia để đưa ra khuyến nghị đáng tin cậy.',
    reviewedBy: 'Đánh giá bởi',
  },
  ms: {
    home: 'Laman utama',
    recommendations: 'Cadangan PipRank',
    methodologyTitle: 'Bagaimana PipRank menilai broker',
    methodologyAvailability: 'Ketersediaan mengikut negara dipertimbangkan dahulu.',
    methodologyIntent: 'Niat halaman menentukan penapis yang relevan.',
    methodologyAffiliate: 'Ekonomi afiliasi tidak menentukan kedudukan.',
    findBroker: 'Cari Broker Saya',
    findBrokerBlurb: 'Gunakan alat padanan broker PipRank untuk cadangan berdasarkan keperluan dagangan anda.',
    insufficientData: 'PipRank belum mempunyai data broker khusus negara yang mencukupi untuk cadangan yang boleh dipercayai.',
    reviewedBy: 'Disemak oleh',
  },
};

export function getLocalizationUi(languageCode?: string | null): LocalizationUiStrings {
  const code = (languageCode || 'en').toLowerCase().split('-')[0];
  return UI_BY_LANG[code] ?? UI_BY_LANG.en;
}

/** Merge built-in defaults with optional DB pack (admin-editable). */
export function mergeLocalizationUi(
  languageCode: string | null | undefined,
  packStrings?: Record<string, string> | null,
): LocalizationUiStrings {
  const base = getLocalizationUi(languageCode);
  if (!packStrings) return base;
  return {
    home: packStrings.home || base.home,
    recommendations: packStrings.recommendations || base.recommendations,
    methodologyTitle: packStrings.methodologyTitle || base.methodologyTitle,
    methodologyAvailability: packStrings.methodologyAvailability || base.methodologyAvailability,
    methodologyIntent: packStrings.methodologyIntent || base.methodologyIntent,
    methodologyAffiliate: packStrings.methodologyAffiliate || base.methodologyAffiliate,
    findBroker: packStrings.findBroker || base.findBroker,
    findBrokerBlurb: packStrings.findBrokerBlurb || base.findBrokerBlurb,
    insufficientData: packStrings.insufficientData || base.insufficientData,
    reviewedBy: packStrings.reviewedBy || base.reviewedBy,
  };
}

export const LOCALIZATION_UI_KEYS: (keyof LocalizationUiStrings)[] = [
  'home', 'recommendations', 'methodologyTitle', 'methodologyAvailability',
  'methodologyIntent', 'methodologyAffiliate', 'findBroker', 'findBrokerBlurb',
  'insufficientData', 'reviewedBy',
];

/** Client-side ready checklist (mirrors API assertPublishableContent). */
export function localizationReadyIssues(page: {
  content?: string;
  content_document_id?: number | null;
  meta_description?: string | null;
  h1?: string | null;
  title?: string;
  faqs?: unknown;
  /** When true, a linked Content Studio doc is treated as satisfying body requirements. */
  hasStudioBody?: boolean;
}): string[] {
  const issues: string[] = [];
  const contentLen = String(page.content || '').trim().length;
  // Linked Studio counts only when caller confirms body is usable (published + non-empty).
  const bodyOk =
    contentLen >= MIN_LOCALIZED_CONTENT_LENGTH || Boolean(page.hasStudioBody);
  if (!bodyOk) {
    issues.push(
      page.content_document_id
        ? 'Linked Content Studio document must be published with body content (or add plain-text body)'
        : `Body needs at least ${MIN_LOCALIZED_CONTENT_LENGTH} characters, or link a published Content Studio document`,
    );
  }
  if (!String(page.meta_description || '').trim()) issues.push('Meta description is required');
  const faqs = Array.isArray(page.faqs) ? page.faqs : [];
  if (faqs.length < 1) issues.push('At least one FAQ is required');
  if (!String(page.h1 || page.title || '').trim()) issues.push('H1 or title is required');
  return issues;
}

/** Minimum body length required to publish or index. */
export const MIN_LOCALIZED_CONTENT_LENGTH = 40;
