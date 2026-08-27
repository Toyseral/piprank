# PipRank Phase 7 — Broker Content & Affiliate Data

## Implemented

- Dedicated `brokers.affiliate_url` field. Public broker CTAs use `affiliate_url` when present and fall back to `website`.
- Expanded `broker_content` with editorial fields: overview, verdict, why recommend, best-for detail, avoid-if, regulation detail, fees detail, platform/account/funding introductions, FAQs.
- `prerender.mjs` now selects all broker_content fields, so populated content automatically appears in crawler HTML on the next build.
- Admin broker content editor now manages editorial JSON, structured platforms/accounts/payments and country availability.
- Added `broker_country_availability` with available/restricted/unavailable/unknown states, notes and priority.
- Broker-content write access includes Super Admin, Admin, Brokers Manager and Content Editor.
- Server-side availability writes are protected by the existing admin guard.
- No reviews or ratings are fabricated.

## Supabase migration

Run `PHASE-7-BROKER-CONTENT-AFFILIATE-AVAILABILITY.sql` before using the new fields.

The migration is additive and creates/extends only the required structures.

## Recommended workflow

1. Run the SQL migration in Supabase.
2. Populate affiliate URLs for priority brokers.
3. Populate country availability for each priority broker.
4. Populate editorial content and structured trading data.
5. Build/deploy.
6. Verify the broker page's HTML source contains the new editorial content, not only the client-rendered page.

## Data integrity

Do not use the new fields to manufacture regulatory claims, trader reviews, performance promises or country availability. Use authoritative broker/regulatory sources and mark uncertain availability as `unknown` rather than guessing.

## Build validation

The environment used to package this phase does not contain the project's installed npm dependency tree, so a full `npm run build` was not run here. The modified server/build JavaScript files were syntax-checked with Node.
