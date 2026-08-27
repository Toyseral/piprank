# Phase 16 — Admin Localization Manager

Admin-managed Country × Language localization with workflow, templates, commercial intents, UI packs, glossary, health checks, draft preview, and full hreflang.

## Content body (Option B + embedded editor)

Localization embeds the same **PageBuilder** as Content Studio for rich body editing on one screen.
Studio status badges: No link / draft / live / missing.
Publish can **publish the Studio document together** with the page (confirm dialog).
On publish, optional **VERCEL_DEPLOY_HOOK_URL** triggers a rebuild so CDN/prerender refresh.

## Content body (Option B)

Localized pages can link a **Content Studio** document (`content_document_id`) for rich HTML/blocks.
- Admin: **Create & link Studio doc** on each localized page (content_key `localized:{country}:{lang}:{topic}`).
- Public page renders Studio HTML when linked; otherwise falls back to plain `content` text.
- Publish rules accept either plain body ≥ 40 chars **or** a published linked Studio document.

## Admin (`/archypage` → Localization)

1. Add a language for a country (seeds six commercial drafts; uses `vi`/`ms` template packs when available).
2. Edit title, slug, meta, H1, body, FAQs; set workflow draft → in review → ready → published.
3. **Add commercial intent** from the SEO matrix beyond the default six.
4. **Copy English seed**, **draft preview** (`?preview=1`, admin session required).
5. **UI string packs** — edit chrome labels per language code (DB-backed; falls back to built-in en/vi/ms).
6. **Glossary** — preferred EN → local terms shown while editing.
7. **Health panel** — thin published content, missing meta/FAQs, zero recommended brokers.

Publish/Ready requires: body ≥ 40 chars, meta description, ≥1 FAQ, H1 or title (UI + API).

## Database

```bash
psql $DATABASE_URL -f sql/PHASE-16-ADMIN-LOCALIZATION.sql
psql $DATABASE_URL -f sql/PHASE-16-VIETNAMESE-LOCALIZATION-REGISTRY.sql   # optional VI seed
```

Tables: `country_languages`, `localized_seo_pages` (+ `workflow_status`), `localization_ui_packs`, `localization_glossary`.

## SEO

- Sitemap/prerender: DB localized pages are source of truth; legacy hard-coded VI URLs only if not already emitted from DB.
- `lastmod` from `localized_seo_pages.updated_at` (deduped by loc).
- Hreflang on localized pages, English topics, and **country hubs** (localized `topic_key=all`).
- Includes `en-{ISO2}` and `x-default`.

## Routing & preview

- Locale segment must match active language code or URL prefix.
- Draft preview: `/{country}/{prefix}/{slug}?preview=1` with admin Bearer session via Supabase auth in the browser.

## Caching

`vercel.json` sets `Cache-Control: public, max-age=300, s-maxage=600, stale-while-revalidate=86400` on country and localized paths so updates appear within minutes after redeploy without disabling CDN entirely.

## Validate

```bash
node scripts/validate-phase16.mjs
```
