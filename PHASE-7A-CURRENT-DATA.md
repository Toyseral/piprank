# Phase 7A — Populate Broker Content From Current Data

This migration populates `broker_content` for every existing broker using fields already present in `public.brokers`.

It does **not** invent regulation, reviews, country availability, affiliate URLs, or CPA claims.

It converts existing structured fields (ratings, trust, spreads, commissions, deposits, platforms, accounts, payments, demo flag, best-for categories, etc.) into crawlable editorial copy and structured content so the next prerender automatically has useful broker content.

## Run

Run `PHASE-7A-POPULATE-CURRENT-DATA.sql` in Supabase after the Phase 7 schema migration.

## Important

This is a baseline population pass. Admin/Super Admin should subsequently replace generic generated paragraphs with original editorial content for priority brokers.

Known research notes that are not automatically inserted because they require explicit broker/country matching:
- Exness does not operate in Malaysia.
- Vantage Malaysia CPA was discussed as $400 per qualifying deposit, but the exact qualification rules were not established in the supplied data.
- A higher Vantage CPA tier was described as requiring 50 QFTDs in a calendar month and net average deposits of at least 2.5× the month's CPA commissions; this is an affiliate-program condition, not consumer-facing broker content.
