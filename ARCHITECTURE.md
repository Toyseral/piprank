# PipRank Architecture

This document describes the architecture that is currently authoritative on `develop`.

## 1. Application layers

### Frontend

The application is a React 19 SPA built with Vite and React Router. Page components own route-level composition while shared components own reusable UI and content rendering.

Important areas include:

- `src/pages/` — route/page composition
- `src/components/` — reusable UI and content components
- `src/lib/` — API, SEO, scoring, and domain helpers
- `src/hooks/` — reusable React behavior
- `api/` — Vercel serverless endpoints
- `scripts/` — build, prerender, SEO, and validation tooling

### Data

Supabase is the application data layer. Structured broker data and published rich content are intentionally separate concerns.

## 2. Canonical content ownership

PipRank uses one canonical owner for each page/content purpose.

| Content purpose | Canonical owner |
|---|---|
| Structured broker facts | Broker data / BrokerEditor |
| Broker authored editorial | `broker:{slug}:main` content document + PageBuilder |
| Country guides | Unified guide/editorial system |
| Best-For pages | Canonical Best-For content |
| Global guides | Guide content |
| SEO metadata | Page-specific canonical SEO configuration |
| URL ownership | CanonicalHub / canonical routing rules |

Do not create a second editor, table, document type, or route to solve a problem already covered by one of these owners.

## 3. PageBuilder

PageBuilder is the shared visual authoring system. It supports reusable content blocks rather than page-specific HTML templates.

Supported block families include:

- rich text
- headings
- structured broker data
- broker cards
- broker grids
- comparison tables
- broker CTAs
- PipRank Verdict
- images
- tables
- callouts
- links
- dividers

### Contexts

PageBuilder supports normal/default content plus specialized guide, Best-For, and broker-editorial contexts.

Broker editorial context intentionally prevents authors from inserting another dedicated `structured_broker_data` block into the authored editorial stream. The broker page already renders its structured sections. Guides and Best-For pages must retain access to structured broker blocks.

## 4. Broker editorial sections

Broker authored blocks use `editorialSection` ownership:

- `editorial` — in-depth analysis
- `pricing` — Fees & Commissions editorial
- `platforms` — Trading Platforms editorial
- `trust` — Trust & Regulation editorial
- `accounts` — Account Types editorial
- `funding` — Deposits & Withdrawals editorial

The content API validates and persists this field. Removing it from sanitization or serialization breaks section ownership and causes content to collapse into the default editorial section.

## 5. Broker rendering

`BrokerDetailNew` is the current broker profile composition.

It combines:

- existing structured broker cards
- the existing PipRank Verdict Card
- PageBuilder-rendered authored content
- the locked Trading Platforms presentation
- section-aware editorial blocks
- broker FAQ and author content
- sticky broker CTA

`PageBlocksRenderer` remains generic. It must continue to render structured broker blocks for Guides and Best-For pages.

## 6. Structured data vs editorial data

Structured broker data is not a replacement for editorial content.

Structured data provides deterministic facts and UI such as pricing, regulation, account types, platforms, and funding information. Editorial blocks provide authored analysis around those sections.

For broker pages, the runtime composes the two rather than flattening them into one content stream.

## 7. API architecture

The Vercel API layer is intentionally consolidated to stay within the project's function-count limit. Build validation prevents accidental growth beyond the configured limit.

Affiliate routing uses `/go/{broker}` as the authoritative click logger.

## 8. Build architecture

The production build is not only a TypeScript/Vite build. It also performs content, canonical, prerender, and SEO validation.

The current build sequence is defined in `package.json` and includes:

1. TypeScript build
2. Vite build
3. Vercel function count validation
4. Country SEO matrix validation
5. robots/index/meta generation
6. sitemap generation
7. canonical prerendering
8. broker prerender finalization
9. removal of non-canonical country prerenders
10. removal of non-indexable canonical prerenders
11. canonical ownership validation
12. SEO validation

Any architecture change affecting URLs, page ownership, metadata, or prerendered content should be tested through the full build.

## 9. Retired architecture

The following patterns are not part of the current architecture:

- separate country-topic ownership for country guides
- duplicate Best-For page systems
- broker-page-specific replacements for generic PageBuilder structured broker rendering
- parallel broker editorial stores
- raw JSON-only authoring for rich broker editorial content
- page-specific content editors that duplicate PageBuilder functionality

Legacy files may remain temporarily in Git history, but new work must follow the current architecture.
