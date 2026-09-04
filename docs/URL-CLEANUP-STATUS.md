# URL Cleanup Status

Branch: `feature/url-cleanup-v3`

## Done

| Item | Status |
|------|--------|
| `src/lib/topicPaths.ts` shared mapping | Done |
| `vercel.json` 301 `/best/:intent` → flat path | Done |
| `vercel.json` country `/best/` → country-first | Done (expanded) |
| `App.tsx` flat global topic routes | Done |
| `BestFor.tsx` resolves flat path + legacy | Done |
| `seo.ts` canonical paths | Done |
| `VisitButton.tsx` detects flat topic paths | Done |
| `Footer.tsx` links | Done |
| `Navbar.tsx` links | Done (uses `globalIntentPath`) |
| `Tools.tsx` low-spread CTA | Done → `/low-spread-forex-brokers` |
| `ComparePair.tsx` best-for chips | Done |

## Still using `/best/` on branch (redirects still catch these)

| File | What to change |
|------|----------------|
| `src/pages/Home.tsx` | `to={globalIntentPath(intent.slug)}` |
| `src/pages/CountryDetail.tsx` | Global version link → `globalIntentPath(page.slug)` |
| `scripts/generate-sitemap.mjs` | Emit `globalIntentPath` / country-first |
| `scripts/prerender.mjs` | Write flat global pages + country-first |

Until those four are updated, old internal links still work via **301 redirects** in `vercel.json`.

## Target public URLs

```
/forex-brokers-for-beginners
/mt5-forex-brokers
/low-spread-forex-brokers
...
/vietnam/forex-brokers-for-beginners
```

Legacy:

```
/best/beginners              → 301 → /forex-brokers-for-beginners
/countries/x/best/beginners  → 301 → /x/forex-brokers-for-beginners
```
