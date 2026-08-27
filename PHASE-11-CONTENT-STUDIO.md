# PipRank Phase 11 — Country Content + Rich Content Studio

Phase 11 adds the editorial CMS layer required to scale the country-first SEO matrix without hardcoding every paragraph into React.

## Admin/editor capabilities

Roles allowed to write content:
- `super_admin`
- `admin`
- `content_admin`

The existing Admin > Content area now includes **Rich Content Studio**. Editors can:
- create and edit rich content documents
- target a country and topic
- set title, excerpt and SEO metadata
- publish/unpublish content
- toggle indexability
- format headings, bold/italic text, lists and quotes
- add links
- insert tables
- add images by URL
- upload JPEG/PNG/WebP/GIF/SVG images to Supabase Storage

The existing broker, country, intent, guide and Best-For editors remain available. The rich editor is an additional structured layer for editorial sections and localized page content.

## Public rendering

Country topic pages look for a document with:

`country-topic:{countrySlug}:{topicSlug}`

If published, its rich HTML is rendered below the broker comparison and before the methodology section.

Example:

`country-topic:ghana:gold-forex-brokers`

renders on:

`/ghana/gold-forex-brokers/`

## Database

Run:

`sql/PHASE-11-CONTENT-STUDIO.sql`

This creates `public.content_documents` and the public `content-media` storage bucket.

The server API uses the Supabase service key and admin role checks. Browser RLS remains enabled on the content table; no public write policy is required.

## APIs

- `GET /api/content-documents?key=...`
- `GET /api/content-documents`
- `POST /api/content-documents`
- `PUT /api/content-documents`
- `DELETE /api/content-documents`
- `POST /api/content-assets`

All write operations require an active admin role, and content writes are limited to admin/super_admin/content_admin.

## Security

The server strips scripts, styles, form controls, event-handler attributes and `javascript:` URLs before storing rich HTML. Editors should still only publish trusted editorial content.

## Validation

The Phase 10 SEO matrix validator passes with 24 topics. A full Vite/TypeScript production build could not be completed in the build environment because dependency installation timed out; do not treat this package as having a verified production build until `npm install` and `npm run build` succeed in the project environment.
