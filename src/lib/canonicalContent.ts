import type { ContentDocument } from './types';

export async function fetchCanonicalCountryTopic(countrySlug: string, topicSlug: string): Promise<ContentDocument | null> {
  const res = await fetch(`/api/content-documents?key=${encodeURIComponent(`country-topic:${countrySlug}:${topicSlug}`)}`);
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error((data && (data as { error?: string }).error) || `Request failed (${res.status})`);
  if (!data || data.content_type !== 'country-topic' || data.published === false) return null;
  return data as ContentDocument;
}
