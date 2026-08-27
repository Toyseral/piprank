# Phase 16 — Vietnam Vietnamese localization

Implemented a generic country × language foundation with the first Vietnamese commercial cluster.

## Routes
- `/vietnam/` — English Vietnam country hub
- `/vietnam/best-...` — English country commercial topics
- `/vietnam/vi/...` — Vietnamese commercial topics with natural Vietnamese slugs

## Vietnamese pages
- `/vietnam/vi/broker-forex-tot-nhat`
- `/vietnam/vi/broker-forex-tot-nhat-cho-nguoi-moi`
- `/vietnam/vi/broker-mt4-tot-nhat`
- `/vietnam/vi/broker-mt5-tot-nhat`
- `/vietnam/vi/broker-giao-dich-vang-tot-nhat`
- `/vietnam/vi/broker-forex-spread-thap`

## SEO
Each page self-canonicalizes and publishes `vi-VN` and `en-VN` hreflang alternates. Sitemap/prerender generation only emits these URLs when Vietnam has a non-empty recommended broker pool.

## Important
This build does not claim Vietnamese-language regulatory status or broker availability. Broker eligibility continues to come from the existing Vietnam country recommendation set.
