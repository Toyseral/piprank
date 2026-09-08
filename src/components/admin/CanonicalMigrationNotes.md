# Canonical editor migration

## Global Best-For

Canonical owners:
- /forex-brokers-for-beginners
- /mt4-forex-brokers
- /mt5-forex-brokers
- /gold-forex-brokers
- /low-spread-forex-brokers
- /forex-brokers-for-scalping
- /islamic-forex-brokers
- /ecn-forex-brokers
- /copy-trading-forex-brokers
- /forex-brokers-for-swing-trading
- /high-leverage-forex-brokers

Legacy `/best/*` URLs redirect and are not editors.

## Country Best-For

Canonical owner: `/{country}/{canonical-topic}` backed by `country-topic:{country}:{topic}` in `content_documents`.

## Broker

Canonical owner: `/brokers/{slug}` backed by `broker:{slug}:main`.

## Guides

Global: `/guides/{slug}` → `guide:{slug}`.
Country: `/{country}/guides/{slug}` → `country-guide:{country}:{slug}`.

## Editor zones

Broker: overview → editorial → pricing → platforms → trust → editorial → FAQ → final CTA.
Best-For: hero/intro → broker rankings → editorial → FAQ → final CTA.

All editable content is PageBuilder blocks. Dynamic broker blocks reference broker IDs and resolve through the current broker catalogue. Comparison-table CTAs are per broker and resolve through `/go/{broker}`; there is no shared CTA destination.
