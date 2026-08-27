# PipRank Phase 5 — Internal Linking + Conversion Architecture

Implemented on top of Phase 4.1.

## Internal-link mesh
- Country pages link to broker profiles, comparisons, Best-For pages and methodology.
- Country Best-For pages link to their country hub, the global Best-For page, other published country Best-For pages, brokers and a top-two comparison.
- Global Best-For pages link to broker profiles and country hubs.
- Broker pages link to global Best-For categories, supported country pages and broker comparisons.
- Comparison pages link to both broker reviews, methodology, country availability and relevant Best-For pages.
- The UI only links to country Best-For URLs that actually exist, reducing soft/real 404 internal links.

## Conversion path
Search → recommendation → broker review/comparison → affiliate CTA → broker registration/FTD.

PipRank cannot guarantee that a broker website URL is a direct account-opening form, so the existing outbound CTA remains "Visit [Broker]" until affiliate destinations are explicitly modeled as account-opening URLs.

## Measurement
Existing events capture `affiliate_click`, `cta_click`, broker clicks and comparison activity. The next analytics layer should join these with affiliate-network reporting for registration and FTD data rather than treating an outbound click as an account opening.

## Phase 5 principle
SEO pages should not be isolated content islands. Every commercial page should provide a clear next step toward a broker decision while retaining links back to supporting country, Best-For, methodology and comparison pages.
