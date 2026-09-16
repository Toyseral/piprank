# PipRank Development Guide

## Branching

Use focused feature/fix branches from `develop`.

Before starting work:

```bash
git checkout develop
git pull origin develop
git checkout -b <type>/<short-description>
```

Keep commits focused enough that a regression can be traced to a specific architectural change.

## Local checks

For normal code changes:

```bash
npx tsc -b
npm run lint
```

For SEO, routing, content, API, or build changes, run:

```bash
npm run build
```

The build includes the canonical/prerender/SEO pipeline and is therefore the preferred final verification.

## Build pipeline

`npm run build` currently runs:

```text
tsc -b
vite build
check-function-count
validate-country-seo-matrix
generate-index-robots-meta
generate-robots
generate-sitemap
prerender-canonical
finalize-broker-prerender
remove-noncanonical-country-prerenders
remove-nonindexable-canonical-prerenders
validate-canonical-ownership
validate-seo
```

Do not bypass the later validation steps when making SEO-sensitive changes.

## Content changes

Before changing a content system, identify the existing canonical owner.

Use:

- BrokerEditor for structured broker facts
- Broker PageBuilder integration for broker editorial
- Unified Guide Editor for guides
- Canonical Best-For editor/content for Best-For pages
- existing PageBuilder blocks for reusable broker/content elements

Do not create a parallel editor because an existing editor needs another block type or section.

## Broker changes

Broker-page changes must preserve:

- PipRank 100-point scoring model
- existing PipRank Verdict Card
- existing structured broker cards
- locked Trading Platforms presentation
- broker editorial section ownership
- canonical `/brokers/{slug}` routing
- runtime/prerender parity

When changing authored broker content, verify that `editorialSection` survives the full persistence path.

## SEO-sensitive changes

When changing any of the following, test both runtime and generated HTML:

- route ownership
- canonical URLs
- H1s
- metadata
- robots directives
- sitemap generation
- prerendering
- PageBuilder section ownership
- internal links

## API changes

The API layer has a deliberate function-count limit for Vercel Hobby compatibility. Run:

```bash
npm run check:function-count
```

Do not add a new top-level serverless function when an existing consolidated endpoint can own the operation.

Affiliate click routing is centralized through `/go/{broker}`.

## Safe change process

1. Read the current architecture documentation.
2. Inspect the existing implementation before adding a component/system.
3. Make the smallest architectural change that solves the problem.
4. Run TypeScript checks.
5. Run lint where relevant.
6. Run the full build for routing/content/SEO/API changes.
7. Inspect the generated or deployed page for user-visible and SEO-sensitive changes.
8. Merge to `develop` only after verification.

## Documentation rule

Documentation should describe the current architecture, not the history of every implementation phase. When a design is replaced, update the current document and remove obsolete phase instructions instead of adding another phase README.
