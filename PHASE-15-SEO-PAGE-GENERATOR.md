# Phase 15 — SEO Page Generator

## Purpose
Turn the unified Page Manager into a scalable country SEO publishing workflow.

## Admin workflow
Page Manager → Generate SEO page → choose country → choose supported topic → Generate draft.

The generator:
- creates the canonical `country-topic:{country}:{topic}` document
- applies the country-specific recommended broker pool
- applies topic eligibility rules
- records the qualifying broker count and minimum threshold
- generates starter country-specific editorial blocks
- generates FAQs and internal links
- generates SEO title and meta description
- defaults to Draft
- defaults to `noindex` when the broker threshold is not met
- leaves the editor responsible for final review and publishing

## Eligibility
Base topics require at least 1 qualifying broker. Combination topics require at least 2. The generator never falls back to the global broker pool.

## Safety
Draft content is not consumed by the public country topic or broker profile pages. Existing published content remains live until replaced by an explicitly published document.

## API
`POST /api/seo-page-generator`

Body:
`{ country_slug, topic_slug }`

Roles:
`super_admin`, `admin`, `content_admin`

## No new database table
The generator uses the existing `content_documents` table and stores generation metadata in `settings.generator`.
