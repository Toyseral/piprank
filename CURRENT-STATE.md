# PipRank Current State

This document is the handoff point for the next development phase.

## Current baseline

The current baseline is `develop` after the broker-page redesign and broker editorial PageBuilder work were merged.

The latest broker-page merge established:

- broker profile redesign
- canonical broker H1 format
- section-aware broker editorial content
- broker CMS/PageBuilder integration
- broker prerender section ownership
- broker SEO validation
- sticky broker CTA
- preservation of existing structured broker components

## Broker page status

The current broker profile structure is considered established and should be treated as a stable foundation for the next phase.

The remaining work should focus on improvements or gaps discovered through fresh audit/testing rather than re-architecting the broker page again.

## Content system status

The current model is:

```text
Structured broker data
        +
Canonical broker rich document
        |
        v
PageBuilder blocks
        |
        +-- editorial
        +-- pricing
        +-- platforms
        +-- trust
        +-- accounts
        +-- funding
```

The API preserves `editorialSection`, and the broker runtime renders each section in its correct location.

## Guide and Best-For status

Guides and Best-For pages continue to use the generic PageBuilder renderer and can use structured broker blocks.

This must not be broken by broker-profile-specific changes.

Country guides are guides. The retired country-topic ownership model should not be reintroduced.

## SEO status

Canonical ownership and broker prerender validation are part of the production build.

The current build must continue to validate:

- canonical ownership
- broker H1 structure
- semantic section separation
- metadata consistency
- indexability
- sitemap integrity
- generated-page integrity

## Immediate development priorities

Before starting another large redesign, the next phase should be driven by a fresh audit of `develop` covering:

1. code architecture and dead code
2. page ownership and route duplication
3. SEO/indexability
4. CMS/editor consistency
5. security and API boundaries
6. mobile UX and CRO
7. runtime/prerender parity
8. remaining legacy components and data paths

Any findings should be classified as:

- **Critical** — blocks production or risks data/security/SEO integrity
- **High** — materially affects architecture, conversion, or discoverability
- **Medium** — correctness/maintainability issue
- **Low** — cleanup or polish

## Do not regress

- Do not create a second content/editor system.
- Do not reintroduce retired country-topic content ownership.
- Do not create duplicate Best-For page systems.
- Do not remove generic structured broker rendering from PageBlocksRenderer.
- Do not replace the locked broker Trading Platforms card without an explicit redesign decision.
- Do not change broker scoring formulas during UI work.
- Do not bypass canonical/prerender validation.
