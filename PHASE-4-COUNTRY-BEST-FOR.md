# PipRank Phase 4 — Country Best-For SEO

Phase 4 adds country-specific commercial SEO pages at:

`/countries/[country]/best/[intent]`

Examples:
- `/countries/malaysia/best/low-spread-brokers`
- `/countries/malaysia/best/mt5-brokers`
- `/countries/malaysia/best/forex-brokers-for-beginners`

## Admin / Super Admin editing

The existing Admin, Super Admin and Content Editor roles can manage these pages from:

`/archypage` → Content → Country Best-For SEO pages

They can create, edit and delete:
- country
- slug
- label
- H1/title
- SEO title
- meta description
- intro paragraphs
- ranking criteria
- SEO content sections
- FAQs
- index/noindex
- sort order

This is intentionally controlled rather than generating every possible country/category combination.

## Database migration

Run:

`PHASE-4-COUNTRY-BEST-FOR.sql`

in the Supabase SQL editor before deploying.

The table stores structured content as JSONB so editors can change content without a code deployment.

## SEO behavior

Indexable pages are:
- statically prerendered into HTML during production builds
- given unique metadata and canonicals
- included in the XML sitemap
- given BreadcrumbList and ItemList structured data
- given FAQPage structured data when visible FAQs exist
- internally linked from the corresponding country page

Non-indexable pages are not included in the sitemap and are marked noindex at runtime.

## Important

Only publish pages where there is enough unique country-specific content, broker data, search demand and commercial value. Do not mass-generate thin pages.
