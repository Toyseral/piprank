# PipRank Phase 9 — Country-First SEO Architecture

Implemented in this build:

- Added country-first commercial routes such as `/malaysia/eur-usd-forex-brokers/` and `/ghana/gold-forex-brokers/`.
- Added a reusable country SEO topic registry covering EUR/USD, gold, MT5, low spread, beginners, scalping, Islamic/swap-free, and low minimum deposit.
- New topic pages only recommend brokers already present in the country's recommendation set. No global fallback is used.
- Added country-first country hubs such as `/ghana/` and `/malaysia/` while retaining the existing `/countries/{slug}` route for compatibility.
- Added canonical SEO metadata, breadcrumbs, ItemList JSON-LD and FAQ JSON-LD for country-topic pages.
- Added build-time prerendering for country-topic pages and country-first country hubs.
- Added sitemap generation for eligible country-topic pages only.
- Added redirects from legacy country hubs and the main existing `/countries/{country}/best/{intent}` URLs to the new country-first commercial URLs.
- Updated country-page Best For navigation to point to the new country-first URLs where an equivalent topic exists.

## Current initial topic set

- `/[country]/eur-usd-forex-brokers/`
- `/[country]/gold-forex-brokers/`
- `/[country]/mt5-forex-brokers/`
- `/[country]/low-spread-forex-brokers/`
- `/[country]/forex-brokers-for-beginners/`
- `/[country]/forex-brokers-for-scalping/`
- `/[country]/islamic-forex-brokers/`
- `/[country]/low-minimum-deposit-forex-brokers/`

## Important

The local environment could not complete `npm ci` within the available execution window, so a full TypeScript/Vite production build could not be completed in this runtime. The JavaScript build scripts were syntax-checked with Node. Run `npm ci` and `npm run build` in the project environment before production deployment.
