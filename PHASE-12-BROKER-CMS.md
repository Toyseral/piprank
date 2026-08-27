# PipRank Phase 12 — Unified Broker Profile CMS

Phase 12 extends the Phase 11 Rich Content Studio to broker profiles.

## Broker CMS
- Broker editorial content uses `content_documents` with `content_type = broker`.
- Main profile document key: `broker:{broker_slug}:main`.
- Additional sections use `broker:{broker_slug}:{section_slug}`.
- Admin, super_admin and content_admin can create/edit/delete rich broker content through the existing admin Content area.
- Rich editor supports headings, lists, links, quotes, images, image uploads and tables.
- Structured broker data remains separate from editorial HTML.
- Public broker pages render the published main rich profile document after the existing verified broker review copy.

## Roles
- `super_admin`, `admin`, `content_admin`: rich editorial broker CMS.
- `super_admin`, `admin`, `brokers_admin`: structured broker facts/pricing/availability management.
- This keeps factual/commercial fields protected while allowing editors to maintain prose and media.

## SEO
Each rich broker document supports SEO title, description, publish and index controls. Only the main document is used as the primary broker profile content in Phase 12; additional documents are editorial sections that can be rendered in later phases.
