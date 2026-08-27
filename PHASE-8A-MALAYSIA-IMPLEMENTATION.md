# PipRank Phase 8A — Malaysia Commercial Cluster

## Included

- Malaysia-specific country SEO content seed migration.
- Four Malaysia Best-For pages: beginners, low-spread, MT5 and gold.
- Country pages now render their unique `seo_intro` and `seo_sections` in the visible HTML, not just metadata/prerender output.
- Country Best-For pages no longer fall back to the global broker pool when Malaysia-specific recommendations are missing.
- Prerendering no longer falls back to global brokers for a country Best-For page.
- Country prerender title/description now respect the admin-editable country SEO fields.

## Important data-safety rule

This phase does **not** seed `broker_country_availability` or invent Malaysia broker eligibility. Those rows must be populated only after each broker/entity has been verified for Malaysia.

It also does not automatically overwrite `countries.recommended`. The existing Malaysia recommendation list remains the editorial source of truth until it is deliberately reviewed.

## SQL

Run:

`PHASE-8A-MALAYSIA-COMMERCIAL-CLUSTER.sql`

after the final schema migrations from Phase 7A/9.

The migration:

- updates the Malaysia country row with unique SEO title, description, introduction, sections and FAQs;
- creates the four country Best-For pages only when the corresponding global intent exists;
- marks those pages indexable only when at least two Malaysia recommendations exist;
- does not fabricate broker availability.

## Verification

Before deployment:

1. Run the SQL migration.
2. Confirm Malaysia has at least two verified/reviewed recommendations before indexing the Best-For pages.
3. Populate `broker_country_availability` only with verified broker/entity data.
4. Run `npm ci` and `npm run build` in the project environment.
5. Confirm the build reports 11 top-level Vercel API functions.
6. Inspect raw HTML for `/countries/malaysia` and the four Best-For URLs.
7. Confirm every indexed country page has a self-canonical and appears in the sitemap.
