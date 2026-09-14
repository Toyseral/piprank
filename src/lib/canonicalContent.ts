import type { ContentDocument } from './types';

type PublicContentFilters = {
  key?: string;
  id?: number;
  type?: string;
  country?: string;
  topic?: string;
  slug?: string;
};

async function publicContent<T>(filters: PublicContentFilters): Promise<T> {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
  });
  const res = await fetch(`/api/public-content?${params.toString()}`);
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error((data && (data as { error?: string }).error) || `Request failed (${res.status})`);
  return data as T;
}

export async function fetchPublishedContentDocument(key: string): Promise<ContentDocument | null> {
  const data = await publicContent<ContentDocument | null>({ key });
  return data && data.published ? data : null;
}

export async function fetchPublishedContentDocumentById(id: number): Promise<ContentDocument | null> {
  const data = await publicContent<ContentDocument | null>({ id });
  return data && data.published ? data : null;
}

export async function fetchPublishedContentDocuments(filters: PublicContentFilters = {}): Promise<ContentDocument[]> {
  const data = await publicContent<ContentDocument[]>(filters);
  return Array.isArray(data) ? data.filter((doc) => doc.published) : [];
}

export async function fetchCanonicalCountryTopic(countrySlug: string, topicSlug: string): Promise<ContentDocument | null> {
  const data = await fetchPublishedContentDocument(`country-topic:${countrySlug}:${topicSlug}`);
  return data?.content_type === 'country-topic' ? data : null;
}
