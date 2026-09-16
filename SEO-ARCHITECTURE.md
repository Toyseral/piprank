# PipRank SEO Architecture

## Canonical principle

Every indexable page must have one canonical purpose, one canonical URL, and one content owner.

The SEO system is designed around page ownership rather than generating many overlapping versions of the same intent.

## Canonical page families

### Broker profiles

Canonical format:

`/brokers/{broker-slug}`

Broker review pages are the commercial/entity pages for individual brokers.

### Country pages

Country-first URLs are the primary country SEO model. Country pages provide localized broker discovery and country-specific information.

Do not restore retired `/countries/...` ownership as a competing canonical system.

### Best-For pages

Best-For pages target commercial intent such as:

- Forex brokers for beginners
- Low-spread forex brokers
- MT4 forex brokers
- MT5 forex brokers
- Gold forex brokers
- other supported commercial intents

Each intent has one canonical page owner. Country-specific variations must follow the canonical country/intent architecture rather than creating duplicate generic pages.

### Guides

Guides are editorial/knowledge-first content. Country guides should remain guides and use the unified guide editor/content model.

The retired country-topic system should not be revived as a second owner for country guides.

## Broker SEO

Broker metadata is centralized in the broker SEO helper.

The current broker title pattern is based on:

`{Broker} Review {year} | PipRank`

The canonical URL is:

`https://piprank.com/brokers/{slug}`

The runtime and prerendered page must agree on the canonical URL, H1, title, description, and major semantic sections.

## Prerendering

Production builds generate and finalize canonical prerenders. Broker prerendering reads the canonical published broker rich document and respects `editorialSection` ownership.

The broker prerender includes the semantic page shell and section-specific editorial content rather than flattening every authored block into In-depth Analysis.

## SEO validation

The production build validates:

- canonical ownership
- broker H1 uniqueness and format
- broker semantic section presence
- section separation
- metadata consistency
- robots/indexability
- sitemap integrity
- temporary-domain leakage
- generated-page integrity

These checks are part of `npm run build` and should remain blocking checks.

## Indexability rules

Preview deployments may send `x-robots-tag: noindex` through Vercel infrastructure. That does not replace the production HTML robots metadata.

Production canonical pages should be indexable and must not intentionally emit `noindex`.

## Internal linking

Internal links should reinforce canonical ownership. Do not create links to retired or duplicate versions of a page when a canonical route exists.

When adding a new SEO page, first determine:

1. the search intent
2. the canonical page family
3. the canonical URL
4. the content owner
5. the internal-link role
6. whether an existing page already owns the intent

## Adding new SEO content

Before creating a new route:

1. Search the existing route/content architecture.
2. Check CanonicalHub/page ownership.
3. Check whether the intent already belongs to a Best-For page or Guide.
4. Reuse the existing content editor.
5. Add SEO metadata through the established SEO system.
6. Add prerender support if the page requires it.
7. Run the full build and SEO validation.
