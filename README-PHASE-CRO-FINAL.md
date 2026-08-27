# PipRank CRO — Broker Card + Hero Final

## Changes

### Hero
- One primary CTA only: **Find My Broker**.
- Removed the hero Compare CTA.
- Removed hero broker search UI.
- Removed secondary CTA/badge links beneath the primary CTA.

### Broker cards
- One primary CTA only: **Open Account**.
- Removed the Compare button from broker cards.
- Changed Review button to a secondary text link: **Read full review →**.
- Removed the technical **Execution (ms)** metric.
- Added intent-aware fourth metric selection.

### Intent-aware card metrics
- General: Regulation
- Beginners: Demo account
- Low spread / ECN / Scalping: Commission
- MT5: MT5 availability
- Copy trading: Copy trading availability
- Swing trading: Regulation
- Country pages: Payment methods
- Other intents: Platforms / context-appropriate metric

The card keeps Min. Deposit, EUR/USD Spread and Max Leverage as core metrics, with the contextual metric replacing Execution.

## Build note
The package source was updated and checked for the requested code changes. A full production build could not be completed in the execution environment because npm dependency installation timed out; run `npm ci` and `npm run build` in the project/Vercel environment before deployment.
