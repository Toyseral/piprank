# PipRank Phase 0 — Technical SEO Implementation

This build hardens the existing SEO system without changing the UI, React/Vite architecture, Supabase schema, or the final domain choice.

## What was implemented

- Configurable site origin via `VITE_SITE_URL`; no permanent domain is hard-coded.
- Production canonical/sitemap/robots generation uses the configured origin.
- Preview and local builds receive `noindex` defaults and blocked `robots.txt`.
- Client-side `useSEO` preserves preview/local noindex after React mounts.
- Build-time prerendering remains the SEO rendering strategy.
- Production prerendering fails the build instead of silently falling back to CSR.
- Production sitemap generation fails on real data/credential errors instead of publishing a partial sitemap.
- Sitemap uses `<lastmod>` when `updated_at` is available and safely falls back if that optional column does not exist.
- Top-level SEO pages are prerendered with crawlable HTML snapshots.
- Country pages are classified as `WebPage` rather than `Article`.
- JSON-LD generation is normalized and uses absolute configured URLs.
- `ItemList` schema now respects the supplied path instead of assuming every item is a broker.
- Broker prerender snapshots link to real `/compare/broker-a-vs-broker-b` URLs rather than query-parameter comparison URLs.
- A production SEO validation script checks generated HTML, metadata, canonicals, H1s, JSON-LD, sitemap, robots and temporary-domain leakage.

## Final domain

The final domain has intentionally **not** been selected.

Before the first real production deployment, set:

```env
VITE_SITE_URL=https://YOUR-FINAL-DOMAIN.com
```

Do not set a temporary Vercel URL as the permanent production domain unless that is genuinely the final choice.

## Required production environment

The production build requires:

```env
VITE_SITE_URL=https://YOUR-FINAL-DOMAIN.com
NEXT_PUBLIC_SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
```

The service-role key is used only during the build-time prerender/sitemap process. It is not exposed to browser code by these changes.

## Build behavior

Production:

1. TypeScript build
2. Vite build
3. Default robots/noindex state
4. Production robots.txt
5. Production sitemap.xml
6. Static prerendering
7. SEO validation

If an indexable page cannot be prerendered or the sitemap/metadata integrity checks fail, the production build fails.

Preview/local builds are deliberately blocked from indexing.

## Important verification

The supplied archive did not contain a usable installed dependency tree for a complete local `npm run build` in this environment, so the final TypeScript/Vite compilation must be run in your normal development/Vercel environment after dependencies are installed.

The new `.mjs` build scripts were syntax-checked successfully, and the preview robots/noindex path was exercised locally.

## Phase 0 scope boundary

This phase does **not** attempt to turn the country pages into the final long-form SEO content assets. That belongs in Phase 1.

Phase 0 makes sure that when Phase 1 content is added, Google can reliably receive and index it.
