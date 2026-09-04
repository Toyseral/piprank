# URL Cleanup Plan

Branch: `feature/url-cleanup-v3` (from current `develop` @ dc99a431)

## Goal

One clear public URL pattern for ranking pages. No competing systems.

## Recommended public URLs

### Global ranking pages (replace `/best/:slug`)

| Old | New (preferred) |
|-----|-----------------|
| `/best/beginners` | `/forex-brokers-for-beginners` |
| `/best/mt5` | `/mt5-forex-brokers` |
| `/best/low-spread` | `/low-spread-forex-brokers` |
| `/best/scalping` | `/forex-brokers-for-scalping` |
| `/best/islamic` | `/islamic-forex-brokers` |
| `/best/ecn` | `/ecn-forex-brokers` |
| `/best/copy-trading` | `/copy-trading-forex-brokers` |
| `/best/swing-trading` | `/forex-brokers-for-swing-trading` |
| `/best/high-leverage` | `/high-leverage-forex-brokers` |
| `/best/gold` | `/gold-forex-brokers` |

Why this is better than `/best/...`:

- Matches search intent in the path ("forex brokers for beginners")
- Same slug style as country pages already use
- No useless `/best/` segment
- Aligns global and country patterns

### Country ranking pages (keep / strengthen)

| Pattern | Example |
|---------|---------|
| `/:country/:topicSlug` | `/vietnam/forex-brokers-for-beginners` |

### Country overview

| Preferred | Legacy (redirect) |
|-----------|-------------------|
| `/:country` e.g. `/vietnam` | `/countries/vietnam` → 301 to `/vietnam` |

### Retire

| Retire | Action |
|--------|--------|
| `/countries/:country/best/:slug` | 301 → `/:country/:mappedTopicSlug` |
| `/best/:slug` | 301 → `/:mappedTopicSlug` (global flat) |

Keep `/countries` as the **list of all countries** hub only.

### Unchanged

- `/brokers`, `/brokers/:slug`
- `/guides`, `/guides/:slug`
- `/:country/guides/:slug`
- `/compare`, `/quiz`, `/tools`, etc.

---

## Route design (important)

Global topic slugs must be registered **before** the country catch-all `/:slug`.

Options:

1. **Explicit routes** for each known global topic slug (safest)
2. **Shared allow-list** of topic slugs: if `params.slug` is a known topic → BestFor/global topic page; else → CountryDetail

Country topics already use `/:countrySlug/:topicSlug`. Global uses the same topic slug at root.

---

## Implementation checklist

### Phase A — Inventory (no code break)

- [ ] List all live global intent slugs from DB / Admin
- [ ] List all live `/countries/*/best/*` URLs
- [ ] Confirm mapping old short slug → new descriptive slug (see table above)
- [ ] Note any **custom** Admin Best-for slugs that are not in the standard map

### Phase B — Redirects first (SEO safety)

In `vercel.json`:

- [ ] `/best/beginners` → `/forex-brokers-for-beginners` (etc. for all standard intents)
- [ ] `/countries/:country/best/beginners` → `/:country/forex-brokers-for-beginners` (already partly done)
- [ ] Policy for unknown custom `/countries/.../best/:slug` → `/:country` (hub) or manual map

Keep redirects long-term (months).

### Phase C — Routing

- [ ] Add global flat routes (or allow-list handler) for topic slugs
- [ ] Keep `/best/:slug` temporarily as redirect-only (or soft alias)
- [ ] Remove public reliance on `/countries/:country/best/:slug`

### Phase D — Code touch list

| Area | Files / systems |
|------|-----------------|
| Routes | `src/App.tsx` |
| SEO paths | `src/lib/seo.ts` (`intentSeo` path) |
| Links | `Home.tsx`, `Navbar.tsx`, `Footer.tsx`, `BestFor.tsx`, `BrokerDetail.tsx`, `ComparePair.tsx`, `Tools.tsx`, `CountryDetail.tsx` |
| Analytics | `VisitButton.tsx` (`/best/` page type) |
| Sitemap / prerender | `scripts/generate-sitemap.mjs`, `scripts/prerender.mjs` |
| Admin copy | `Admin.tsx` text that mentions `/best/*` |
| API | Intent slug vs public path mapping if they diverge |

### Phase E — Admin product decision

- [ ] Stop creating **country** pages under Best-for; use country-first topic + content docs
- [ ] Global intents: either keep internal slug `beginners` and map to public path `forex-brokers-for-beginners`, or rename slugs in DB (harder)
- [ ] Prefer **path mapping** in code over renaming DB slugs

### Phase F — Cleanup

- [ ] Remove duplicate UI bugs if still present on latest develop
- [ ] Prefer `/:country` links over `/countries/:country` everywhere
- [ ] Dynamic country guides section (replace hardcoded Ghana/Malaysia only)

---

## Suggested public path map (code constant)

```ts
export const GLOBAL_TOPIC_PATH: Record<string, string> = {
  beginners: 'forex-brokers-for-beginners',
  'low-spread': 'low-spread-forex-brokers',
  mt5: 'mt5-forex-brokers',
  gold: 'gold-forex-brokers',
  scalping: 'forex-brokers-for-scalping',
  islamic: 'islamic-forex-brokers',
  ecn: 'ecn-forex-brokers',
  'copy-trading': 'copy-trading-forex-brokers',
  'swing-trading': 'forex-brokers-for-swing-trading',
  'high-leverage': 'high-leverage-forex-brokers',
};
// public URL: `/${GLOBAL_TOPIC_PATH[intent.slug]}`
```

Same values already used for country-first topics (`LEGACY_TOPIC_TO_NEW`).

---

## Out of scope for this plan

- Full redesign of homepage content
- Removing `/countries` hub
- Changing guide URL architecture

---

## Risk notes

1. Root-level topic routes can collide with country slugs if a country is ever named like a topic. Mitigate with an allow-list of topic paths.
2. Incomplete redirects = ranking loss. Always ship redirects before removing old routes.
3. Do not implement on top of stale branches; always branch from latest `develop`.
