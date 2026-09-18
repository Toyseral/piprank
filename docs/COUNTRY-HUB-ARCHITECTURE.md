# Country Hub Architecture

## Canonical route

The canonical country hub is `/:country`, owned by `country:{country_slug}:hub`.

## Section ownership

| Section | Canonical owner |
|---|---|
| Country identity | `countries` |
| Hero title/copy | Country hub document |
| SEO title/description | Country hub document |
| Main editorial sections | Country hub document `blocks` |
| Top brokers | `country_broker_final_rankings` |
| Broker eligibility | Availability + country overrides |
| Country guides | `country-guide` documents |
| Country Best-For | `country-best-for` documents |
| Localized guides | `localized-guide` documents |
| Localized Best-For | `localized-best-for` documents |
| Comparison | Dynamic `/compare/:pair` system |
| Methodology | Global `/methodology` page |
| FAQs | Country hub document `settings.faqs` |
| Publishing state | `countries.publishing_state` |

## Broker eligibility

Eligibility is opt-out: no availability row means eligible. Explicit `available` remains eligible. Explicit `unavailable`, `restricted`, `is_available=false`, or `force_exclude=true` excludes a broker from the normal country pool.

Verification is separate from eligibility.

## Legacy migration

Legacy country SEO/content fields are compatibility sources only during migration. Do not create new country-hub content in `intro`, `seo_intro`, `seo_sections`, `facts`, `recommended`, `unavailable`, or `available_broker_slugs`.

`seo_faqs` remains a temporary read fallback only for legacy data; the admin editor now writes canonical `settings.faqs`. Country SEO title/description are canonical document fields.

`country-topic` remains retired.

## Redesign boundary

The visual redesign of `/:country` is separate from this architecture work.