# PipRank — Next Engineering & Audit Plan

**Updated:** 2026-09-18  
**Baseline:** `develop` after PR #42 (Best-For prerender parity)  
**PR merged:** #42 — `feat: close Best-For prerender content parity gap`

## 1. Verify the merged build and deployment

- [ ] Confirm the merged `develop` commit receives a completed CI/build result.
- [ ] Confirm Vercel deployment status.
- [ ] If Vercel reports the `build-rate-limit` account/platform gate, treat that separately from source-code failures.
- [ ] Run/verify:
  - `npm ci`
  - `npx tsc -b`
  - `npm run build`
  - API function count
  - country SEO matrix validation
  - retired-content reference validation
  - prerender safety validation
  - author attribution validation
  - Best-For prerender parity validation
  - canonical ownership validation
  - SEO validation

**Acceptance:** build completes without source/runtime errors and all production validators pass.

## 2. Complete Best-For shared page-model architecture

PR #42 closes the immediate SEO-critical prerender gap, but the long-term architecture should avoid continuously adding HTML fragments to the enrichment script.

Build a complete shared `BestForPageModel` containing:

- [ ] Canonical document/settings
- [ ] Intent
- [ ] Country and eligibility
- [ ] Ranking mode
- [ ] Ranked brokers
- [ ] Top match
- [ ] Top 9
- [ ] Comparison fields
- [ ] Editorial sections
- [ ] Criteria
- [ ] FAQs
- [ ] Methodology
- [ ] Broker analysis data
- [ ] PipRank verdict data
- [ ] Attribution
- [ ] Canonical metadata

Then make both React and prerender consume this model.

**Important:** do not duplicate the React component in Node.

## 3. Prove runtime/prerender ranking parity

- [ ] Trace the exact runtime data loader feeding `BestForTemplate`.
- [ ] Confirm global Best-For ranking behavior against `bestForModel.js`.
- [ ] Confirm country Best-For ranking against `country_intent_broker_final_rankings`.
- [ ] Confirm manual `pinnedBrokerSlugs` behavior.
- [ ] Confirm `excludedBrokerSlugs` behavior.
- [ ] Confirm country eligibility uses the same registry.
- [ ] Add deterministic tests for representative global and country intents.

**Acceptance:** the same canonical document + database state produces the same ranked broker IDs in runtime and prerender.

## 4. Strengthen Best-For prerender parity validation

Current validation primarily checks ranking and presence of major sections.

Add validation for:

- [ ] Comparison fields/content
- [ ] Criteria values
- [ ] Additional editorial sections
- [ ] Broker analysis entries
- [ ] PipRank scores
- [ ] FAQ count/content
- [ ] Author/reviewer attribution
- [ ] JSON-LD author data
- [ ] Canonical URL
- [ ] noindex/indexable state
- [ ] absence of duplicate Best-For content

## 5. Finish attribution architecture

Author profiles are now canonical and editable.

Next:

- [ ] Decide whether `fact_checked_by_slug` is metadata-only or a real rendered role.
- [ ] If real, add fact-checker selector to canonical editors.
- [ ] Render fact-checker attribution consistently on:
  - broker pages
  - guides
  - Best-For pages
- [ ] Add Person JSON-LD where appropriate.
- [ ] Extend author attribution validator to cover all canonical content types.
- [ ] Make attribution validation paginated/scalable rather than assuming a small dataset.

## 6. Audit remaining Admin content-type mismatches

Inspect the Admin UI for legacy content types that no longer belong to the canonical architecture.

Known area:

- [ ] `page`
- [ ] `section`
- [ ] `author`

Confirm that every Admin content type has a supported canonical API path.

Remove compatibility UI only after confirming no existing records/workflows depend on it.

## 7. Security hardening

### Public broker redirect

Audit `/go/:broker`:

- [ ] Rate limiting / abuse protection
- [ ] Redirect validation
- [ ] Affiliate URL validation
- [ ] Open-redirect protection
- [ ] Logging/analytics abuse controls

### Reviews

- [ ] Confirm public reads only expose verified reviews.
- [ ] Audit review submission abuse protection.
- [ ] Add appropriate rate limiting.
- [ ] Confirm moderation/admin paths remain unrestricted where intended.

### Newsletter

- [ ] Add server-side anti-abuse/rate limiting.
- [ ] Validate email input.
- [ ] Prevent repeated automated submissions.

### General APIs

- [ ] Audit authentication/authorization on every admin mutation.
- [ ] Check IDOR risks.
- [ ] Check input size limits.
- [ ] Check HTML/URL sanitization boundaries.
- [ ] Check error responses for sensitive information.

**Important:** do not rely on in-memory Vercel rate limiting as the sole security boundary.

## 8. Canonical ownership audit

The canonical ownership validator should become the authoritative page-ownership check.

- [ ] Generate/maintain a canonical route manifest.
- [ ] Detect two documents claiming the same canonical URL.
- [ ] Detect duplicate keyword/page ownership.
- [ ] Detect orphaned canonical documents.
- [ ] Detect published/indexable documents without a valid route.
- [ ] Detect route aliases that can create duplicate indexable pages.
- [ ] Confirm country-first URLs remain canonical.

## 9. SEO/rendering audit

After the architecture work:

- [ ] Crawl every canonical indexable route.
- [ ] Check HTTP status.
- [ ] Check canonical URL.
- [ ] Check robots/noindex.
- [ ] Check title/meta description.
- [ ] Check H1.
- [ ] Check JSON-LD.
- [ ] Check internal links.
- [ ] Check orphan pages.
- [ ] Check duplicate titles/descriptions.
- [ ] Check duplicate keyword ownership.
- [ ] Check static prerender HTML versus hydrated React content.
- [ ] Check country/language URL consistency.
- [ ] Check sitemap inclusion.

## 10. Performance and scalability

- [ ] Audit all Supabase queries used during build.
- [ ] Identify unpaginated queries in prerender scripts.
- [ ] Add pagination for brokers, documents, rankings and authors where appropriate.
- [ ] Avoid fetching unnecessary columns.
- [ ] Check build duration as document/broker counts grow.
- [ ] Keep Vercel at or below the 12-function Hobby limit.
- [ ] Avoid creating new top-level API functions unless absolutely necessary.

## 11. Dependency/security batch

Handle separately from application architecture:

- [ ] Review the previously identified high-severity npm vulnerabilities.
- [ ] Determine vulnerable packages and dependency paths.
- [ ] Upgrade with controlled version changes.
- [ ] Run TypeScript/build/regression validation.
- [ ] Do **not** use blanket `npm audit fix` without reviewing the resulting dependency changes.

## 12. Legacy-system cleanup

After runtime references are proven absent:

- [ ] Verify retired `broker_content` references remain only in intentional guards/history where appropriate.
- [ ] Verify retired `country-topic` system is not reachable.
- [ ] Verify retired `localized-seo` system is not reachable.
- [ ] Verify old API routes cannot mutate/create retired content.
- [ ] Verify old Admin compatibility paths are either intentionally supported or removed.
- [ ] Remove dead code only after reference validation.

## Recommended execution order

1. **Verify merged build/deployment**
2. **Finish Best-For shared page model**
3. **Prove runtime/prerender ranking parity**
4. **Strengthen Best-For parity validator**
5. **Finish fact-checker/author attribution**
6. **Audit Admin canonical content types**
7. **Security hardening**
8. **Canonical ownership + route audit**
9. **Full SEO/rendering crawl**
10. **Performance/scalability**
11. **Dependency security**
12. **Final legacy cleanup**

## Definition of done for the next phase

PipRank should have:

- one canonical content architecture
- one Best-For ranking/model source of truth
- runtime and prerender parity
- deterministic canonical URL ownership
- complete author attribution
- no reachable retired content systems
- hardened public mutation/redirect endpoints
- production-safe build validators
- no duplicate indexable page systems
- a verified production deployment
