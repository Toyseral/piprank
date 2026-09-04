# Cleanup Notes (feature/site-architecture-v2)

## Done in this branch

1. **Removed duplicate section in `BestFor.tsx`**
   - Global Best For pages previously rendered two almost identical "Local versions / by country" blocks.
   - One block was removed.

2. **Prefer country-first internal links in `BestFor.tsx`**
   - Links that pointed to `/countries/{slug}` now point to `/{slug}` (redirect already exists the other way).

## Still open (needs product decision)

### Dual Best-for systems

| System | URL example | Component |
|--------|-------------|-----------|
| Legacy Admin Best-for | `/countries/vietnam/best/beginners` | `BestFor.tsx` |
| Preferred country-first | `/vietnam/forex-brokers-for-beginners` | `CountrySeoTopic.tsx` |

- Short legacy slugs are already redirected in `vercel.json`.
- Custom Admin slugs (e.g. long names) are **not** auto-redirected.
- Recommendation: stop creating new Admin Best-for pages; use country-first topic pages instead.

### Hardcoded country guides

- `CountryDetail.tsx` still has special-cased guide blocks for `ghana` and `malaysia` only.
- Should be replaced with a dynamic guides list for all countries.

### Guides visibility

- Routes exist (`/guides`, `/:country/guides/:slug`).
- Pages only appear when content is published in the CMS.
