# Phase 6 — Country-Unique SEO Content

Each country page now supports its own SEO title, meta description, introduction, SEO sections and FAQs. These fields live on `countries` and are editable by Admin, Super Admin and Content Admin through the existing Country Editor.

The global Best-For system remains separate. Country Best-For pages remain linked to the master intent taxonomy but retain their own unique copy.

## Important SEO rule

Do not create country pages by replacing the country name inside a global template. Each indexable country should have genuinely useful local information: broker availability, applicable legal entities/regulatory context, funding considerations, trading preferences, local search intent and country-specific FAQs.

## Migration

Run `PHASE-6-COUNTRY-UNIQUE-SEO.sql` in Supabase.

## Validation

Node syntax checks pass for the modified API and prerender files. A complete Vite/TypeScript production build could not be completed in this environment because the dependency tree is not installed. Run `npm ci && npm run build` before deployment.
