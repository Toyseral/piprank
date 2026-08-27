# PipRank Phase 4 — Unified Best-For SEO

## 1. Global Best-For pages remain the master taxonomy

Existing global intent pages such as:

- `/best/forex-brokers-for-beginners`
- `/best/low-spread-forex-brokers`
- `/best/mt5-forex-brokers`

remain the primary global SEO pages.

The existing broker `best_for` field remains the recommendation eligibility source. Admins assign broker categories in the broker editor; global Best-For pages rank eligible brokers.

## 2. Country Best-For pages are localized SEO variants

Country pages use:

`/countries/{country}/best/{intent}`

These pages can link to a master global intent through `country_best_for.intent_id`, while retaining their own country-specific:

- H1
- SEO title
- meta description
- introduction
- ranking criteria
- sections
- FAQs
- indexability

This prevents the country layer from becoming a second independent recommendation taxonomy.

## 3. Admin editing

Admin, Super Admin and Content Admin roles can edit both:

- Global Best-For SEO content
- Country Best-For SEO content

Country editors can select the master Best-For category. The country page can then localize the content without creating a separate broker-category system.

## 4. SEO generation

Both global and country Best-For pages are:

- prerendered
- included in the production sitemap when indexable
- given canonical URLs
- given WebPage/BreadcrumbList/ItemList schema
- given FAQPage schema when visible FAQs exist

## 5. Comparison duplicate protection

Reversed comparison URLs now receive a real HTTP 301 before React executes.

Example:

`/compare/pepperstone-vs-vantage`

→ HTTP 301 →

`/compare/vantage-vs-pepperstone`

The canonical comparison HTML is served from the prerendered file through the comparison server function.

React's `<Navigate>` remains only as a client-side fallback.

Trailing-slash comparison URLs also receive a server-level HTTP 301.

## 6. Required migration

Run the complete `PHASE-4-COUNTRY-BEST-FOR.sql` migration. The migration is additive and preserves existing rows while adding the SEO fields and optional `intent_id` relationship.

## 7. Final-domain independence

No final PipRank domain is hardcoded. Continue using `VITE_SITE_URL` when the permanent domain is selected.
