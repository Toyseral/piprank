# PipRank Phase 16 — Bulk SEO Generation

## Purpose
Adds a bulk publishing workflow to the Phase 15 SEO Page Generator.

## Admin workflow
Admin → Page Manager → Bulk generate

1. Select a country.
2. Select any number of the 24 supported SEO topics, or select all.
3. Generate selected drafts.
4. PipRank processes each topic through the existing Phase 15 eligibility engine.
5. Existing pages return 409 and are shown as skipped.
6. Eligible pages are created as unpublished drafts with indexable=true.
7. Pages below the broker threshold are still created as drafts but remain noindex.
8. Errors are isolated per topic so one failed page does not stop the batch.
9. Results show Created / Skipped / Noindex / Errors.
10. Refresh Page Manager to review and edit the generated drafts.

## Safety
- Uses the existing authenticated `/api/seo-page-generator` endpoint.
- Does not auto-publish pages.
- Does not bypass country broker eligibility.
- Does not use a global broker fallback.
- Existing pages are never overwritten.
- The same 24-topic taxonomy is used as Phase 15.

## Scaling note
The first implementation deliberately uses sequential requests from the admin UI. This avoids a burst of writes and makes progress/error reporting reliable. A future queue/worker implementation can move large multi-country batches server-side once the publishing workflow is validated.

## Phase 16 remediation
- Fixed the Page Manager render-order bug that made the Generate and Bulk Generate modals unreachable.
- Normalized country recommendations to support the current `{ slug, note }` schema and legacy string arrays.
- Excluded explicitly unavailable brokers from generated country pools.
- Raised the indexability threshold to 2 qualifying brokers for every commercial comparison page.
- Added a unique `content_key` migration and duplicate-safe API handling for concurrent generation attempts.
