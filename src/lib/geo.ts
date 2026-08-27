export interface GeoGuess {
  slug: string;
  name: string;
  flag: string;
  iso2: string;
}

// Keep these aligned with the country slugs used by affiliate routing. The
// database remains the source of truth for which countries have content.
export const GEO_OPTIONS: GeoGuess[] = [
  { slug: 'uk', name: 'United Kingdom', flag: '🇬🇧', iso2: 'GB' },
  { slug: 'us', name: 'United States', flag: '🇺🇸', iso2: 'US' },
  { slug: 'australia', name: 'Australia', flag: '🇦🇺', iso2: 'AU' },
  { slug: 'india', name: 'India', flag: '🇮🇳', iso2: 'IN' },
  { slug: 'singapore', name: 'Singapore', flag: '🇸🇬', iso2: 'SG' },
  { slug: 'uae', name: 'United Arab Emirates', flag: '🇦🇪', iso2: 'AE' },
  { slug: 'germany', name: 'Germany', flag: '🇩🇪', iso2: 'DE' },
  { slug: 'south-africa', name: 'South Africa', flag: '🇿🇦', iso2: 'ZA' },
  { slug: 'nigeria', name: 'Nigeria', flag: '🇳🇬', iso2: 'NG' },
  { slug: 'malaysia', name: 'Malaysia', flag: '🇲🇾', iso2: 'MY' },
  { slug: 'ghana', name: 'Ghana', flag: '🇬🇭', iso2: 'GH' },
  { slug: 'bahrain', name: 'Bahrain', flag: '🇧🇭', iso2: 'BH' },
  { slug: 'jordan', name: 'Jordan', flag: '🇯🇴', iso2: 'JO' },
  { slug: 'brazil', name: 'Brazil', flag: '🇧🇷', iso2: 'BR' },
  { slug: 'switzerland', name: 'Switzerland', flag: '🇨🇭', iso2: 'CH' },
  { slug: 'hong-kong', name: 'Hong Kong', flag: '🇭🇰', iso2: 'HK' },
  { slug: 'thailand', name: 'Thailand', flag: '🇹🇭', iso2: 'TH' },
  { slug: 'vietnam', name: 'Vietnam', flag: '🇻🇳', iso2: 'VN' },
  { slug: 'turkey', name: 'Turkey', flag: '🇹🇷', iso2: 'TR' },
  { slug: 'kuwait', name: 'Kuwait', flag: '🇰🇼', iso2: 'KW' },
  { slug: 'lebanon', name: 'Lebanon', flag: '🇱🇧', iso2: 'LB' },
  { slug: 'oman', name: 'Oman', flag: '🇴🇲', iso2: 'OM' },
  { slug: 'qatar', name: 'Qatar', flag: '🇶🇦', iso2: 'QA' },
  { slug: 'saudi-arabia', name: 'Saudi Arabia', flag: '🇸🇦', iso2: 'SA' },
  { slug: 'south-korea', name: 'South Korea', flag: '🇰🇷', iso2: 'KR' },
  { slug: 'indonesia', name: 'Indonesia', flag: '🇮🇩', iso2: 'ID' },
];

const G = (slug: string) => GEO_OPTIONS.find((o) => o.slug === slug) ?? null;

const TZ_MAP: Record<string, GeoGuess> = Object.fromEntries(
  [
    ['Europe/London', 'uk'], ['America/New_York', 'us'], ['America/Chicago', 'us'],
    ['America/Denver', 'us'], ['America/Los_Angeles', 'us'], ['America/Phoenix', 'us'],
    ['America/Anchorage', 'us'], ['Pacific/Honolulu', 'us'], ['Australia/Sydney', 'australia'],
    ['Australia/Melbourne', 'australia'], ['Australia/Brisbane', 'australia'], ['Australia/Perth', 'australia'],
    ['Australia/Adelaide', 'australia'], ['Asia/Kolkata', 'india'], ['Asia/Calcutta', 'india'],
    ['Asia/Singapore', 'singapore'], ['Asia/Dubai', 'uae'], ['Europe/Berlin', 'germany'],
    ['Europe/Munich', 'germany'], ['Africa/Johannesburg', 'south-africa'], ['Africa/Lagos', 'nigeria'],
    ['Asia/Kuala_Lumpur', 'malaysia'], ['Africa/Accra', 'ghana'], ['Asia/Bahrain', 'bahrain'],
    ['Asia/Amman', 'jordan'], ['America/Sao_Paulo', 'brazil'], ['Europe/Zurich', 'switzerland'],
    ['Asia/Hong_Kong', 'hong-kong'], ['Asia/Bangkok', 'thailand'], ['Asia/Ho_Chi_Minh', 'vietnam'],
    ['Europe/Istanbul', 'turkey'], ['Asia/Kuwait', 'kuwait'], ['Asia/Beirut', 'lebanon'],
    ['Asia/Muscat', 'oman'], ['Asia/Qatar', 'qatar'], ['Asia/Riyadh', 'saudi-arabia'],
    ['Asia/Seoul', 'south-korea'], ['Asia/Jakarta', 'indonesia'],
  ].map(([tz, slug]) => [tz, G(slug)!]).filter(([, value]) => value),
);

const LANG_MAP: Record<string, GeoGuess> = Object.fromEntries(
  [
    ['en-GB', 'uk'], ['en-US', 'us'], ['en-AU', 'australia'], ['en-IN', 'india'], ['en-SG', 'singapore'],
    ['ar-AE', 'uae'], ['de-DE', 'germany'], ['de-AT', 'germany'], ['en-ZA', 'south-africa'],
    ['af-ZA', 'south-africa'], ['en-NG', 'nigeria'], ['ha-NG', 'nigeria'], ['yo-NG', 'nigeria'],
    ['ig-NG', 'nigeria'], ['ms-MY', 'malaysia'], ['en-MY', 'malaysia'], ['en-GH', 'ghana'],
    ['ar-BH', 'bahrain'], ['ar-JO', 'jordan'], ['pt-BR', 'brazil'], ['de-CH', 'switzerland'],
    ['zh-HK', 'hong-kong'], ['th-TH', 'thailand'], ['vi-VN', 'vietnam'], ['tr-TR', 'turkey'],
    ['ar-KW', 'kuwait'], ['ar-LB', 'lebanon'], ['ar-OM', 'oman'], ['ar-QA', 'qatar'],
    ['ar-SA', 'saudi-arabia'], ['ko-KR', 'south-korea'], ['id-ID', 'indonesia'],
  ].map(([lang, slug]) => [lang, G(slug)!]).filter(([, value]) => value),
);

const PREF_KEY = 'piprank_geo';
const SOURCE_KEY = 'piprank_geo_source';

export function detectGeo(): GeoGuess | null {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz && TZ_MAP[tz]) return TZ_MAP[tz];
    const language = navigator.language;
    if (language && LANG_MAP[language]) return LANG_MAP[language];
    const prefix = language?.split('-')[0];
    if (prefix) {
      const match = Object.entries(LANG_MAP).find(([key]) => key.startsWith(`${prefix}-`));
      if (match) return match[1];
    }
  } catch { /* unavailable */ }
  return null;
}

export function getGeo(): GeoGuess | null {
  try {
    const saved = localStorage.getItem(PREF_KEY);
    if (saved === 'off') return null;
    if (saved) return GEO_OPTIONS.find((g) => g.slug === saved) ?? null;
  } catch { /* private mode */ }
  return detectGeo();
}

export function setGeoPreference(slug: string | null, source: 'manual' | 'auto' = 'manual') {
  try {
    localStorage.setItem(PREF_KEY, slug ?? 'off');
    localStorage.setItem(SOURCE_KEY, source);
  } catch { /* private mode */ }
  try {
    // Only a deliberate user selection becomes a server-side override.
    // Automatic detection stays client-side so a user travelling countries
    // can be re-localized by IP on the next visit.
    if (slug && source === 'manual') document.cookie = `piprank_country=${encodeURIComponent(slug)}; path=/; max-age=31536000; samesite=lax`;
    else document.cookie = 'piprank_country=; path=/; max-age=0';
  } catch { /* ignore */ }
}

export function getGeoSource(): 'manual' | 'auto' | null {
  try {
    const value = localStorage.getItem(SOURCE_KEY);
    return value === 'manual' || value === 'auto' ? value : null;
  } catch { return null; }
}

export function geoShortName(g: GeoGuess): string {
  return { 'United States': 'the US', 'United Kingdom': 'the UK', 'South Africa': 'South Africa', 'United Arab Emirates': 'the UAE' }[g.name] ?? g.name;
}
