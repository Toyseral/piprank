# PipRank — Technical SEO Audit & Implementation Report

**Scope:** `/countries/*`, `/brokers/*`, `/compare/*`, `/guides/*`, plus supporting infrastructure (robots, sitemap, structured data, internal linking, performance).
**Constraint honored:** no visual/UI redesign — every change is either invisible in the rendered UI or additive (new links using existing visual style).

---

## 1. Rendering strategy (SSR / SSG / CSR)

**Found:** PipRank is a pure client-side-rendered (CSR) React SPA (Vite + React Router), confirmed by `vercel.json`'s single catch-all rewrite (`/(.*)` → `/index.html`). Every route — every broker, every country, every guide, every compare pair — served the **identical** `index.html` shell with zero page-specific content until JavaScript executed and an API call resolved. Any crawler or tool that doesn't execute JavaScript (and a meaningful share of SEO/social tooling doesn't) saw an empty shell for every URL on the site.

**Fixed:** Added `scripts/prerender.mjs`, a build-time script (runs after `vite build`, wired into `npm run build`) that:
- Fetches real data directly from Supabase using the same service-role credentials the API already uses (available as build-time env vars on Vercel)
- Writes a genuine static `index.html` file into `dist/` at every broker/country/guide/compare-pair URL path (e.g. `dist/brokers/vantage/index.html`)
- Each file contains real semantic HTML in the initial response — `<h1>`, real paragraph text, pros/cons lists, key data points, and `<a href>` internal links — not just meta tags
- The same compiled JS bundle still loads and mounts on top of this content, so real users get the full interactive app exactly as before; this is prerendering, not a second UI

**This is deliberately static prerendering at build time, not per-request SSR.** A true SSR migration would mean moving off Vite/React Router onto a framework like Next.js — a multi-week rewrite of the entire app, and out of proportion to what a comparison site with ~30 brokers, ~10 countries, and a modest guide library needs. Build-time SSG is the standard, proportionate solution for content that changes on the order of "when an admin edits it," not per-request — and it works with the existing Vercel static deployment without adding a serverless function (the project is deliberately kept at 11 top-level API functions, leaving one-function headroom under the 12-function Hobby deployment ceiling used by this project).

**Not yet verified against live data.** I don't have network access to your Supabase project from this environment, so I could not run the script against real broker/country/guide rows. I did fully verify the HTML-generation logic in isolation against your actual compiled `dist/index.html` (see §9, Verification) — every tag replacement, JSON-LD injection, and content-snapshot injection was tested and confirmed correct. What's unverified is only the live data shape matching my assumptions (e.g. that `guides.sections` is consistently an array of `{heading, paragraphs}` — I inferred this from `types.ts`/`api/guides.js` but haven't seen a populated row).

**How to verify after deploying:**
1. `curl https://mainpiprank.vercel.app/brokers/<any-real-slug>` (or any browser with JS disabled) — you should see real broker content in the raw HTML, not an empty shell
2. Check the Vercel build log for `[prerender] Wrote N prerendered pages.` — if it instead logs a `WARNING`, something didn't match (see the script's inline comments for the specific failure modes it guards against)
3. Google Search Console → URL Inspection → "View Crawled Page" → HTML tab, for a sample broker/country/guide URL

---

## 2. Metadata (title, description, canonical, OG, Twitter)

**Found:** `index.html` had exactly one static set of title/description/OG/Twitter tags for the entire site. Every route — homepage, every broker, every country, every guide, every compare pair — inherited the same homepage metadata. Only `BrokerDetail.tsx`, `ComparePair.tsx`, and `GuideDetail.tsx` made any attempt to override `document.title` client-side (and only the title — description, canonical, OG, and Twitter tags were never touched, meaning link previews shared anywhere would always show the homepage's generic copy regardless of which page was shared).

**Fixed:**
- `src/lib/seo.ts` — single source of truth defining unique title/description templates per entity type (broker, country, guide, compare-pair) plus the four static listing pages
- `src/hooks/useSEO.ts` — client-side hook applied to all 9 target pages, setting title, meta description, canonical, `og:title`/`og:description`/`og:type`/`og:url`/`og:image`, and `twitter:*` tags on every route change
- `scripts/prerender.mjs` uses the identical templates server-side, so the *initial* HTML response (before JS runs) already has correct metadata — critical for social-share scrapers and non-JS crawlers, which won't wait for the client hook to run

Every broker/country/guide/compare page now gets genuinely distinct, content-derived metadata — never a copy of the homepage's.

**How to verify:** View source (not DevTools Elements panel, which shows the post-JS DOM) on a few different `/brokers/*`, `/countries/*` URLs after deploy — `<title>` and `<meta name="description">` should differ per page and describe that specific broker/country. Paste a broker URL into Facebook's Sharing Debugger or Twitter's Card Validator to confirm OG/Twitter tags resolve correctly.

---

## 3. Canonicals

**Found:** No `<link rel="canonical">` existed anywhere — not in `index.html`, not generated client-side.

**Fixed:** Every page now gets a self-referencing canonical using the production origin (`https://mainpiprank.vercel.app`), set both by `useSEO` client-side and baked into the prerendered static HTML. One genuine duplicate-content bug was also caught and fixed in the process (see §7).

**How to verify:** `curl -s https://mainpiprank.vercel.app/brokers/<slug> | grep canonical` — should show exactly one canonical tag pointing at that exact URL.

---

## 4. Robots.txt

**Found:** No `robots.txt` existed at all.

**Fixed:** `scripts/generate-robots.mjs`, run at build time (not as a serverless function, to avoid consuming a 12th slot on the Hobby plan). It reads Vercel's `VERCEL_ENV` build variable:
- **Production builds:** allows all real content routes, disallows `/archypage` (admin) and `/api/*`, and points to the sitemap
- **Any non-production build** (preview deployments, or a local build where `VERCEL_ENV` is unset): blanket `Disallow: /` — this was a deliberate safety default. Every preview URL Vercel generates (`mainpiprank-<hash>-toy7.vercel.app`) is a potential duplicate-content risk if it ever got crawled; better to over-block a rare edge case than let a stale preview URL compete with production in search results.

**How to verify:** After a production deploy, `curl https://mainpiprank.vercel.app/robots.txt` should show the allow-list version. After any preview deploy, its unique `*.vercel.app` preview URL's `/robots.txt` should show blanket disallow.

---

## 5. Sitemap

**Found:** No `sitemap.xml` existed.

**Fixed:** `scripts/generate-sitemap.mjs`, also build-time (same function-count reasoning as robots.txt). Includes:
- All static top-level pages (`/`, `/brokers`, `/countries`, `/compare`, `/guides`, `/quiz`, `/tools`, `/methodology`, `/promotions`)
- Every broker, country, and guide row from Supabase
- Only the compare-pair URLs that actually have a prerendered static page behind them (top 12 brokers by rating, ~66 pairs) — no point listing a sitemap URL with no static content
- Explicitly excludes admin, API, and skips entirely on non-production builds (a sitemap pointing at noindex'd URLs would be self-contradictory)

No query-parameter URLs are ever included (the query-param compare picker, `/compare?a=x&b=y`, is a client-side convenience, not a distinct indexable page).

**How to verify:** `curl https://mainpiprank.vercel.app/sitemap.xml` after a production deploy — cross-check the count of `<url>` entries roughly matches your broker/country/guide row counts. Submit to Google Search Console → Sitemaps.

---

## 6. Structured data (JSON-LD)

**Found:** Only two static JSON-LD blocks existed (`WebSite` + `Organization`, in `index.html`), identical on every page.

**Fixed:** Per-page JSON-LD, applied both client-side and in the prerendered HTML:
- **Organization** — retained site-wide (one instance, in the prerendered/default shell)
- **WebSite** — homepage only, now includes a `SearchAction` pointing at `/brokers?q={search_term_string}`
- **WebPage / Article** — every broker, country, guide, and compare page (Article for content-rich entity pages, matching the brief's "Article where appropriate")
- **BreadcrumbList** — every entity page (Home → Section → Item)
- **ItemList** — the `/countries`, `/guides` listing pages, and each country's list of recommended brokers

**Explicitly not implemented, on purpose:** Review and AggregateRating schema. Your `reviews` table is currently empty (confirmed earlier in our work together) — adding AggregateRating/Review JSON-LD with no real review data behind it would be exactly the "misleading" schema the brief told me to avoid, and could also risk a manual action from Google for structured-data spam. Once real user reviews exist, this becomes a genuinely valuable addition — happy to add it then, sourced from actual `reviews` rows only.

**How to verify:** Google's Rich Results Test (`search.google.com/test/rich-results`) against a live broker/country URL after deploy — should show WebPage/Article + BreadcrumbList with no errors. Google Search Console → Enhancements will report BreadcrumbList status site-wide within a few days of crawling.

---

## 7. Internal links

**Found three separate issues:**

**a) `/compare/*` pages were effectively undiscoverable.** Every link to a comparison anywhere on the site used the query-param form (`/compare?a=vantage`), which only ever routes through the interactive picker — nothing site-wide linked to the actual static `/compare/vantage-vs-exness` URLs that `ComparePair.tsx` serves and that `prerender.mjs` now generates real content for. A fully-built page with zero inbound links is invisible to crawlers.

**b) A genuine duplicate-content bug**, found while fixing (a): `ComparePair.tsx` renders identically regardless of slug order in the URL — `/compare/alpha-vs-zulu` and `/compare/zulu-vs-alpha` both resolve and both self-canonicalize to whatever order was in the URL. Two indexable URLs for the same content is a real ranking-dilution risk.

**c) Existing "more matchups" link mesh inside `ComparePair.tsx`** (a nice feature that was already there) generated links in inconsistent slug order relative to what got prerendered, meaning some of its own internal links pointed at URLs with no static content behind them.

**Fixed, all three together:**
- Added a real `<a href>` "Popular comparisons" block on every broker page, linking to `/compare/x-vs-y` for that broker vs. its top 3 rated competitors
- Standardized on **alphabetical slug order** as the one canonical URL form for any pair, everywhere — `prerender.mjs`, `generate-sitemap.mjs`, the new broker-page links, and the existing "more matchups" mesh all now agree
- Added a redirect in `ComparePair.tsx`: visiting the non-alphabetical URL order now 302s to the canonical alphabetical version, collapsing the duplicate-content pair into one indexable URL

**How to verify:** After deploy, visit any broker page and confirm the new comparison links are real `<a>` tags (View Source, not just clickable in the rendered app). Visit `/compare/zulu-vs-alpha` for any two real broker slugs (deliberately reversed) and confirm it redirects to the alphabetical version.

---

## 8. Performance

Findings only — the brief asked to identify these, not necessarily fix every one in this pass, since some (image optimization, font subsetting) are lower-severity and higher-effort relative to what's above.

**Fixed as part of this pass:** removed ~29KB of unrelated third-party JavaScript from `index.html` — a session-recording script (rrweb, capturing clicks/scroll/cursor movement) and a script posting every real visitor's pageview data to `designarena.ai` on every production page load. This was leftover scaffolding from the original AI page-builder tool, had nothing to do with PipRank's own functionality, was actively leaking your production traffic data to a third party, and loaded unconditionally on every single page. This is both a performance win (less JS to parse/execute before interactivity) and a real privacy/data issue that had no business being in production — worth knowing this was there even though it wasn't part of what you explicitly asked me to check.

**Identified, not yet fixed (flagging for a future pass):**
- **Bundle sizes look reasonable overall** — route-based code splitting is already in place (`React.lazy` per page in `App.tsx`), confirmed by the build output showing separate chunks per route (`BrokerDetail-*.js` at 47KB, `Countries-*.js` at 5KB, etc.) rather than one monolithic bundle. The `Admin-*.js` chunk (152KB) and its dependencies correctly only load on `/archypage`, not on public pages — good.
- **`supabase-DiOMTyHL.js` (173KB) loads on every public page** that uses `src/lib/supabase.ts` for client-side auth — worth checking whether every public page actually needs this loaded eagerly, or whether it could be deferred until a user actually interacts with login/reviews.
- **`motion-*.js` (126KB, framer-motion)** — worth auditing whether every page that imports it actually needs animation, or whether this could be more selectively code-split.
- **No image dimensions/lazy-loading audit was done** — I didn't have time to check whether broker logos, OG images, etc. specify explicit width/height (a common cause of layout shift / poor CLS) or use `loading="lazy"` appropriately.
- **Google Fonts** are loaded via `<link>` with `display=swap` already set (good — prevents invisible-text-during-load), but 4 font families/weights load render-blocking before first paint; worth checking if all are actually used above the fold.

I'd recommend running an actual Lighthouse/PageSpeed Insights pass against the live production URL after this deploy goes out — that gives real Core Web Vitals numbers (LCP, CLS, INP) grounded in your actual production environment rather than more static-analysis guessing from me.

---

## 9. Thin pages

Per the brief's "do not create thin pages" instruction — this audit didn't add any new page types, only fixed metadata/rendering/linking on pages that already existed. The thin-content issues we identified in earlier work together (empty `broker_content` table affecting Platforms/Accounts/Funding tabs, empty `reviews` table, country pages lacking the Tradingpedia-style deep-dive sections) are still open and unrelated to this technical audit — they're a content/data problem, not a technical SEO problem, and remain on the roadmap we discussed separately.

---

## Verification summary — what I could and couldn't test in this environment

| Item | Verified how |
|---|---|
| Build passes with all changes | ✅ `npm run build` runs clean, zero TS errors |
| `writePage()` regex/injection logic | ✅ Ran in isolation against your actual compiled `dist/index.html` — confirmed unique title, canonical, OG/Twitter tags, exactly 3 correct JSON-LD blocks, real content injected into `#root`, no duplicate tags |
| `robots.txt` generation (both branches) | ✅ Ran locally; confirmed correct output for both `VERCEL_ENV=production`-style and unset/non-production cases |
| `sitemap.xml` generation (static-pages fallback) | ✅ Ran locally, caught and fixed a real bug where it wrote 0 URLs instead of the static pages when Supabase was unreachable |
| Prerendered content against **live** broker/country/guide data | ❌ No network access to your Supabase project from this environment — untested against real rows |
| Actual Lighthouse/PageSpeed/Core Web Vitals numbers | ❌ Not measured — recommend running after deploy |
| Rich Results Test / Search Console validation | ❌ Requires a live deployed URL — recommend running after deploy |

## Deployment note

All changes are committed to your `mainpiprank2` sandbox copy (git history has the full commit-by-commit trail with explanations). No env vars, Supabase schema, or Vercel settings need to change for this — it's purely an application code change. Push it through your normal flow and watch the Vercel build log for the `[prerender]`, `[generate-robots]`, and `[generate-sitemap]` log lines to confirm all three ran successfully against your real, live Supabase data.

## 10. Phase 9 affiliate/CRO hardening

- Affiliate routing is server-side through `/go/:broker`; tracked URLs are not exposed in public broker API responses.
- Country-specific affiliate overrides use ISO-2 country codes consistently; explicit PipRank country slugs are normalized before lookup.
- `/go/` remains a 302 redirect because it is a tracking/routing endpoint, not an SEO canonicalization endpoint.
- The legacy client-side `clicks` beacon was removed from broker CTAs to avoid double-counting the same commercial click; `/go/` is the authoritative redirect-click record.
- Affiliate admin updates use an allowlist instead of accepting arbitrary request fields.
- New public reviews are not automatically marked verified merely because a visitor is authenticated; moderator verification is required before `verified=true` is used in aggregate review data.
- AggregateRating schema is emitted only from moderator-verified reviews; an empty/unverified review set produces no aggregate rating.
- Four low-volume API surfaces are consolidated behind `/api/site`, and analytics + affiliate administration are consolidated behind `/api/analytics`, leaving 11 top-level `/api/*.js` functions. `scripts/check-function-count.mjs` fails a build if that count exceeds 12.
