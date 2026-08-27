# PipRank Phase 14 — Unified Page Manager

Phase 14 adds one CMS workflow for country SEO pages and broker profiles.

## Admin workflow
Admin → Page Manager → choose a country SEO page or broker profile.

Supports:
- title and introduction
- rich content page builder
- headings, rich text, images, image uploads, tables, callouts, dividers
- internal-link blocks
- SEO title and meta description
- publish/draft and index/noindex
- FAQs
- country-page broker ranking controls: automatic/manual, pinned and excluded brokers
- live URL and editor preview

## Storage
`content_documents.settings` stores page-level editorial settings including ranking controls, FAQs and internal links.
Run `sql/PHASE-14-PAGE-MANAGER.sql` after the Phase 11 content-document migration.

## Public rendering
Country topic pages consume custom SEO metadata, FAQs, ranking overrides/exclusions and internal links.
Broker profiles consume custom SEO metadata, FAQs and internal links.

Existing HTML-only content remains supported; structured blocks are preferred when present.

A full dependency-backed production build could not be completed in this runtime because package installation timed out. Run `npm ci` and `npm run build` in the normal development/Vercel environment before deployment.
