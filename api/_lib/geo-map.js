// ISO 3166-1 alpha-2 -> PipRank country slug. Keep this list aligned with
// countries that can receive country-specific affiliate routing.
export const ISO2_TO_SLUG = {
  GB: 'uk', US: 'us', AU: 'australia', IN: 'india', SG: 'singapore', AE: 'uae',
  DE: 'germany', ZA: 'south-africa', NG: 'nigeria', MY: 'malaysia', GH: 'ghana',
  BH: 'bahrain', JO: 'jordan', BR: 'brazil', CH: 'switzerland', HK: 'hong-kong',
  TH: 'thailand', VN: 'vietnam', TR: 'turkey', KW: 'kuwait', LB: 'lebanon',
  OM: 'oman', QA: 'qatar', SA: 'saudi-arabia', KR: 'south-korea', ID: 'indonesia',
};

export const SLUG_TO_ISO2 = Object.fromEntries(Object.entries(ISO2_TO_SLUG).map(([iso, slug]) => [slug, iso]));

export function isoToSlug(iso2) {
  if (!iso2) return null;
  return ISO2_TO_SLUG[String(iso2).toUpperCase()] ?? null;
}

export function slugToIso2(slug) {
  if (!slug) return null;
  return SLUG_TO_ISO2[String(slug).trim().toLowerCase()] ?? null;
}

export function parseCookieCountry(cookieHeader) {
  if (!cookieHeader) return null;
  const match = String(cookieHeader).match(/(?:^|;\s*)piprank_country=([^;]+)/);
  if (!match) return null;
  try { return decodeURIComponent(match[1]) || null; } catch { return null; }
}
