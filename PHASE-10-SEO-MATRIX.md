# PipRank Phase 10 — Country-First SEO Matrix + Dynamic Intent Engine

## What changed

Phase 10 turns the Phase 9 country-first route into a reusable SEO matrix. The React route remains the same:

`/:countrySlug/:topicSlug`

The topic registry now determines the title, metadata, eligibility rules, ranking logic, dimensions and FAQs for every commercial topic.

## Initial matrix

### Base dimensions

- Instrument: EUR/USD, Gold
- Platform: MT5
- Cost: Low Spread, Low Minimum Deposit, Raw Spread
- Trader: Beginners
- Strategy: Scalping, Hedging
- Account: Islamic, ECN, Standard
- Feature: Copy Trading, Demo Accounts

### High-value intersections

- EUR/USD + MT5
- EUR/USD + Scalping
- Gold + MT5
- Gold + Scalping
- MT5 + Scalping
- Low Spread + MT5
- Low Spread + Scalping
- Islamic + MT5
- Beginners + MT5
- Gold + Low Spread

## URL model

Every indexable commercial page is country-first:

- `/malaysia/eur-usd-forex-brokers/`
- `/malaysia/gold-forex-brokers/`
- `/malaysia/mt5-forex-brokers/`
- `/malaysia/eur-usd-mt5-forex-brokers/`
- `/malaysia/gold-forex-brokers-for-scalping/`
- `/ghana/eur-usd-forex-brokers/`

## Eligibility / anti-thin-page rules

A page is generated only when its country-specific broker recommendation set contains enough brokers that satisfy every requirement in the topic registry.

- Base topics require at least 1 qualifying broker.
- Intersection topics require at least 2 qualifying brokers.
- No global broker fallback is permitted.
- The same eligibility engine powers the React page, prerenderer and sitemap.

This prevents the matrix from becoming thousands of empty or near-empty pages.

## Canonical SEO principle

The country-first commercial URL is the canonical destination. Legacy `/countries/{country}/best/{intent}` routes remain for compatibility, while the Phase 9 redirects cover the major legacy intents.

## Next expansion

Do not generate every mathematical combination. Add a new matrix topic only when:

1. search demand exists;
2. the country materially changes the answer;
3. PipRank has enough structured broker data;
4. at least two brokers can be meaningfully compared for intersection pages; and
5. the page has a distinct commercial intent from existing URLs.

The next data expansion should be country × instrument, then country × platform/strategy, followed by selected three-dimensional combinations based on demand.
