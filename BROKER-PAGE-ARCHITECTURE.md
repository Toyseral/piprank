# Broker Page Architecture

This is the current contract for PipRank broker profile pages.

## Route

Canonical broker route:

`/brokers/{broker-slug}`

The runtime page and broker prerender must represent the same canonical page.

## Page order

1. Broker Hero
2. Anchor Navigation
3. `{Broker} at a glance`
4. Broker Assessment
5. PipRank Verdict
6. In-depth Editorial Analysis
7. Fees & Commissions
8. Trading Platforms
9. Trust & Regulation
10. Account Types
11. Deposits & Withdrawals
12. Additional Editorial
13. FAQ
14. Open `{Broker} Account`
15. Author Bio

## Hero rules

The hero contains:

- Broker name
- H1: `{Broker Name} Broker Review`
- Regulation
- Platform
- Minimum deposit
- Founded year
- EUR/USD spread
- Primary CTA: `Open {Broker Name} Account`

Regulation badges use regulator names such as FCA, CySEC, FSCA, and FSA. Do not append a country or region to the regulator badge.

The PipRank Score remains the primary score and uses a 100-point scale. Do not introduce a competing primary rating scale as part of broker-page redesign work.

## At a glance

The existing `BrokerAtAGlance` presentation is the structured overview component. It should not be replaced with a separate editorial implementation.

## Assessment

The assessment uses the existing structured broker data presentation for the broker assessment/pros/cons layer.

## PipRank Verdict

Use the existing `PipRankVerdictCard`. Do not redesign or replace it merely to change the broker-page layout.

## Editorial

The broker's canonical rich document is:

`broker:{broker-slug}:main`

Published PageBuilder blocks are filtered by `editorialSection` and rendered into the matching section.

Untagged blocks are treated as `editorial` for backward compatibility.

## Structured sections

Each section has two possible content layers:

1. the existing structured broker component
2. authored editorial content from PageBuilder

The sections are:

| Section | Structured presentation | Editorial ownership |
|---|---|---|
| Fees & Commissions | existing structured pricing card | `pricing` |
| Trading Platforms | locked Trading Platforms card | `platforms` |
| Trust & Regulation | existing structured trust card | `trust` |
| Account Types | existing structured accounts card | `accounts` |
| Deposits & Withdrawals | existing structured funding card | `funding` |

The in-depth analysis uses the `editorial` section.

## Trading Platforms exception

There are two platform renderers in the codebase for different contexts.

- `OriginalTradingPlatformsCard` is the broker-profile presentation and preserves the established tabbed design.
- `StructuredBrokerDataCard` has a generic `platforms` renderer because PageBuilder structured broker blocks in Guides and Best-For pages still require it.

This is intentional. Do not remove the generic renderer or globally replace it with the broker-profile card.

## Sticky CTA

The broker sticky CTA format is:

`Broker Name | 98/100 | Open Account | ×`

The exact score is dynamic. The CTA label in the sticky bar is `Open Account`.

## Broker CMS

The existing BrokerEditor remains the source of truth for structured broker fields. Its six source-of-truth tabs remain intact:

- Basics
- Pricing
- Trust
- Categories
- Editorial
- FAQ & Lab

Rich broker editorial is authored through the existing PageBuilder integration. Do not introduce another broker content editor.

## PageBuilder rules

Broker editorial PageBuilder context must not expose a dedicated `structured_broker_data` insertion block because the broker profile already owns those structured sections.

Guides and Best-For contexts must continue to expose structured broker blocks.

## SEO rules

The broker page must have:

- exactly one H1
- H1 ending in `Broker Review`
- canonical `/brokers/{slug}`
- matching runtime/prerender metadata
- indexable production HTML
- required semantic broker sections
- Article/Breadcrumb structured data where applicable
- FAQ structured data when published FAQs exist

Do not add alternate broker-review URLs that compete with the canonical profile.
