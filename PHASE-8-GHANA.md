# PipRank Ghana Cluster — Phase 8

This package extends the current CRO + automatic country-localization build with Ghana-specific commercial and topical SEO content.

## New Ghana content

### Country page
`/countries/ghana`

### Best-For pages
- `/countries/ghana/best/beginners`
- `/countries/ghana/best/low-spread`
- `/countries/ghana/best/mt5`
- `/countries/ghana/best/gold`

These pages are indexed only when the database has at least two verified Ghana-available brokers matching the relevant intent.

### Guides
- `/countries/ghana/guides/is-forex-trading-legal-in-ghana`
- `/countries/ghana/guides/forex-trading-in-ghana`
- `/countries/ghana/guides/how-to-choose-a-forex-broker-in-ghana`
- `/countries/ghana/guides/forex-broker-regulation-in-ghana`
- `/countries/ghana/guides/best-forex-trading-platforms-in-ghana`
- `/countries/ghana/guides/forex-trading-for-beginners-in-ghana`
- `/countries/ghana/guides/minimum-deposit-for-forex-trading-in-ghana`
- `/countries/ghana/guides/forex-spreads-explained-for-ghanaian-traders`
- `/countries/ghana/guides/funding-a-forex-account-in-ghana`

## SQL

Run only:

`sql/PHASE-8-GHANA-COMMERCIAL-TOPICAL.sql`

Run it after the existing final schema migration.

The SQL deliberately does **not** invent broker eligibility. It builds Ghana recommendations only from existing `broker_country_availability` rows where:

`country_id = Ghana` AND `status = 'available'`

If no verified Ghana availability exists, the recommendation pool stays empty and the commercial Best-For pages remain non-indexable.

## Important regulatory distinction

The content distinguishes:
- Bank of Ghana FX broker authorisation
- SEC Ghana securities-market licensing
- foreign broker regulation
- country availability

Do not change a broker's Ghana status based solely on affiliate eligibility.

## Build

```bash
npm ci
npm run build
```

The production build should run:
1. Vite build
2. prerender
3. sitemap generation
4. robots generation
5. SEO validation
6. function-count validation

