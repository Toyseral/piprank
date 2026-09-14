declare module './types' {
  export interface LocalizedSeoPage {
    id?: number;
    country_slug?: string | null;
    locale?: string | null;
    language_code?: string | null;
    topic_key?: string | null;
    slug?: string | null;
    url_prefix?: string | null;
    published?: boolean;
    indexable?: boolean;
    [key: string]: unknown;
  }
}

export {};