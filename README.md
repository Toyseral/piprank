# PipRank

PipRank is a React/Vite forex-broker comparison and affiliate platform focused on country-aware broker discovery, editorial broker reviews, SEO landing pages, and broker matching.

## Current stack

- React 19 + TypeScript
- Vite 7
- React Router DOM 7
- Tailwind CSS 4
- Supabase for PostgreSQL, Auth, and Storage
- Vercel serverless API functions
- Framer Motion
- PageBuilder for reusable editorial content

## Project architecture

PipRank uses a canonical page/content ownership model rather than separate content systems for each page type.

### Page types

- **Broker profiles** — `/brokers/{broker}`
- **Country pages** — country-first SEO and discovery pages
- **Best-For pages** — commercial intent pages such as beginner, low-spread, MT5, gold, and similar intents
- **Guides** — editorial/knowledge content
- **Tools** — matching, comparison, and other utility experiences

Canonical ownership is enforced by the application and build-time SEO validation. Do not create alternate page systems for content that already belongs to one of these canonical types.

## Content architecture

The PageBuilder is the shared visual content system. It supports rich text and reusable broker/content blocks including:

- Broker cards and broker grids
- Comparison tables
- Broker CTAs
- PipRank Verdict blocks
- Structured broker data
- Images, tables, callouts, links, headings, and dividers

Broker editorial content uses the same PageBuilder with section ownership. The broker editorial sections are:

- `editorial`
- `pricing`
- `platforms`
- `trust`
- `accounts`
- `funding`

The BrokerEditor remains the source of truth for structured broker fields. The rich broker document is the source for authored editorial blocks. Do not introduce another broker content store or editor.

## Broker page

The current broker profile redesign is implemented in `BrokerDetailNew.tsx` and uses the existing structured broker components.

The page order is:

1. Broker hero
2. Anchor navigation
3. Broker at a glance
4. Broker assessment
5. Existing PipRank Verdict Card
6. In-depth editorial analysis
7. Fees & Commissions
8. Trading Platforms
9. Trust & Regulation
10. Account Types
11. Deposits & Withdrawals
12. Additional editorial
13. FAQ
14. Open Account CTA
15. Author bio

The Trading Platforms card on the broker profile is intentionally locked to its established design. `StructuredBrokerDataCard` still has a generic platforms renderer because Guides and Best-For PageBuilder blocks require it. These are different rendering contexts and should not be consolidated blindly.

## SEO and prerendering

Production builds run the SEO and canonical validation pipeline after the Vite build. The pipeline includes:

- Country SEO matrix validation
- Robots/meta generation
- Sitemap generation
- Canonical prerendering
- Broker prerender finalization
- Removal of non-canonical/non-indexable prerenders
- Canonical ownership validation
- SEO validation

Broker canonical URLs are `/brokers/{slug}`. Runtime and prerendered broker pages must agree on the H1, canonical URL, metadata, and major semantic sections.

## API guardrail

Vercel Hobby compatibility requires the top-level API function count to remain within the project's configured limit. `scripts/check-function-count.mjs` is part of the production build and must continue to pass.

Affiliate clicks are routed through `/go/{broker}`. This is the authoritative broker click path.

## Development

Install dependencies and run the development server:

```bash
npm ci
npm run dev
```

Useful checks:

```bash
npm run lint
npx tsc -b
npm run check:function-count
npm run check:seo-matrix
npm run check:retired-content
npm run build
```

`npm run build` is the main production integrity check because it also runs the prerender and SEO validation pipeline.

## Working rules

1. Reuse existing canonical components before creating new ones.
2. Do not reintroduce retired page/content systems.
3. Do not change broker scoring as part of visual or editorial work unless explicitly required.
4. Keep structured broker data separate from authored editorial content.
5. Preserve PageBuilder support for Guides and Best-For pages.
6. Keep canonical URL ownership explicit.
7. Validate both runtime behavior and prerendered HTML for SEO-sensitive changes.
8. Update this documentation when the architecture materially changes.

## Documentation

- `ARCHITECTURE.md` — system architecture and ownership rules
- `BROKER-PAGE-ARCHITECTURE.md` — current broker profile structure and locked UI rules
- `SEO-ARCHITECTURE.md` — canonical URLs, prerendering, and SEO validation
- `DEVELOPMENT.md` — development workflow, checks, and change rules
- `CURRENT-STATE.md` — current implementation state and immediate priorities
