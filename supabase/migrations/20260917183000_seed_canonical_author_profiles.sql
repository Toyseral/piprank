-- Seed the existing PipRank editorial identities into the canonical author model.
-- Idempotent: never overwrites an author profile that an admin has already edited.
insert into public.content_documents
  (content_key, content_type, slug, title, excerpt, html, blocks, settings, indexable, published)
values
  (
    'author:r-adeyemi', 'author', 'r-adeyemi', 'R. Adeyemi',
    'Leads broker onboarding at PipRank: verifying licence status against regulator registers, identifying the specific legal entity behind each account, and writing the regulation sections of our reviews.',
    '', '[]'::jsonb,
    '{"role":"Lead Broker Reviewer","expertise":["Regulation & entity verification"],"credentials":[],"links":[],"photo_url":"","display_order":1}'::jsonb,
    false, true
  ),
  (
    'author:j-okafor', 'author', 'j-okafor', 'J. Okafor',
    'Runs the real-money testing process behind every spread, execution-speed and withdrawal-timing figure published on PipRank, and maintains the trading-cost sections of broker reviews.',
    '', '[]'::jsonb,
    '{"role":"Trading Costs & Execution Editor","expertise":["Spreads, execution and withdrawal testing"],"credentials":[],"links":[],"photo_url":"","display_order":2}'::jsonb,
    false, true
  ),
  (
    'author:l-mensah', 'author', 'l-mensah', 'L. Mensah',
    'Maintains the Health Score methodology and the data pipeline behind it — refresh cadence, factor weighting, and keeping scores consistent as broker conditions change.',
    '', '[]'::jsonb,
    '{"role":"Data & Methodology Lead","expertise":["Health Score formula & data pipeline"],"credentials":[],"links":[],"photo_url":"","display_order":3}'::jsonb,
    false, true
  ),
  (
    'author:s-nwachukwu', 'author', 's-nwachukwu', 'S. Nwachukwu',
    'Covers country-level broker availability, local regulatory context, and the country-specific guides published on PipRank.',
    '', '[]'::jsonb,
    '{"role":"Country & Compliance Editor","expertise":["Country-specific availability & regulatory context"],"credentials":[],"links":[],"photo_url":"","display_order":4}'::jsonb,
    false, true
  )
on conflict (content_key) do nothing;
