# PipRank Phase 8B — Malaysia Topical Authority

This build extends Phase 8A with a Malaysia-specific informational cluster.

## New URLs

- /countries/malaysia/guides/is-forex-trading-legal-in-malaysia
- /countries/malaysia/guides/forex-trading-in-malaysia
- /countries/malaysia/guides/how-to-choose-a-forex-broker-in-malaysia
- /countries/malaysia/guides/forex-broker-regulation-in-malaysia
- /countries/malaysia/guides/best-forex-trading-platforms-in-malaysia
- /countries/malaysia/guides/forex-trading-for-beginners-in-malaysia
- /countries/malaysia/guides/minimum-deposit-for-forex-trading-in-malaysia
- /countries/malaysia/guides/forex-spreads-explained-for-malaysian-traders

## SEO implementation

- Unique title/description per page
- Canonical URLs through the shared SEO system
- Article/WebPage JSON-LD
- BreadcrumbList JSON-LD
- FAQPage JSON-LD
- Build-time prerendering for non-JS crawlers
- Sitemap inclusion
- Internal links to Malaysia country and Best-For pages
- Related-guide links between the topical pages

## Database

No new schema migration is required for Phase 8B. The content is editorial/static and lives in `src/data/malaysiaTopics.js`.

Run `PHASE-8B-VALIDATE-MALAYSIA.sql` after Phase 8A to check the Malaysia recommendation, availability and broker-content data.

## Build

Set the production `VITE_SITE_URL`, Supabase URL and service-role key, then run `npm ci && npm run build`.

## Ghana Phase 8 verification follow-up

Use `PHASE-8-GHANA-BROKER-VERIFICATION.md` and the two verification SQL files for the Ghana broker verification layer. Ghana recommendations should be promoted only after country availability is explicitly verified with a current source.
