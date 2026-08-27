# PipRank — Country Localization + CRO

## Implemented

- Automatic country detection from Vercel/Cloudflare country headers, with timezone/browser-language fallback.
- Explicit country selection persisted in localStorage + `piprank_country` cookie.
- One country selector in the global navigation (desktop and mobile).
- Homepage recommendations are immediately localized after detection; no automatic redirect away from `/`.
- Homepage broker ticker uses the localized broker pool.
- `/brokers` localizes its broker pool when country recommendations exist.
- Global `/best/:intent` pages use country recommendations for localized users while preserving their global SEO URL/canonical.
- Quiz country step uses the detected country and the same country preference.
- Country pages pin the active site country context.
- `/go/:broker` already resolves country-specific affiliate links server-side using the same country cookie/IP signal.

## SEO rule

Automatic personalization does not change the canonical URL or the prerendered SEO metadata of global pages. Country-specific SEO pages remain at `/countries/{country}` and `/countries/{country}/best/{intent}`. This avoids creating multiple country variants of the same URL for crawlers.

## Country resolution priority

1. Explicit country selection (cookie/localStorage)
2. Server-side IP country (`x-vercel-ip-country` / `cf-ipcountry`)
3. Browser timezone
4. Browser locale
5. Global fallback

## Data safety

A localized homepage/broker directory only uses the country's configured `recommended` broker set. If the country has no configured recommendations, PipRank keeps the global pool rather than pretending that global brokers are country-specific recommendations.

## Validation

`npm run build` should be run in the project/Vercel environment after `npm ci`. The current execution environment did not contain `@types/node` or `vite/client`, so TypeScript compilation could not be completed here. The modified server JS passed Node syntax checks and the existing function-count guard remains in place.
