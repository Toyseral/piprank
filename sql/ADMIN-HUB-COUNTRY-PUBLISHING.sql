-- Admin Hub + Country Publishing
-- Safe additive migration. Existing countries default to 'published'
-- so live public pages are not accidentally hidden.

ALTER TABLE public.countries
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'published';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'countries_status_check'
  ) THEN
    ALTER TABLE public.countries
      ADD CONSTRAINT countries_status_check
      CHECK (status IN ('draft', 'published', 'closed'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS countries_status_idx
  ON public.countries (status);

COMMENT ON COLUMN public.countries.status IS
  'Master public visibility: draft (hidden), published (visible when child content published), closed (hidden + suppress all child country content). Closing does not delete content.';

UPDATE public.countries SET status = 'published' WHERE status IS NULL OR status = '';

CREATE TABLE IF NOT EXISTS public.authors (
  id bigserial PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  pen_name text NOT NULL,
  role text NOT NULL DEFAULT '',
  short_bio text NOT NULL DEFAULT '',
  bio text NOT NULL DEFAULT '',
  expertise text[] NOT NULL DEFAULT '{}',
  photo_url text,
  color text NOT NULL DEFAULT '#1f8a5c',
  credentials jsonb NOT NULL DEFAULT '[]'::jsonb,
  professional_links jsonb NOT NULL DEFAULT '[]'::jsonb,
  display_order integer NOT NULL DEFAULT 100,
  published boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS authors_published_order_idx
  ON public.authors (published, display_order);

COMMENT ON TABLE public.authors IS
  'Editorial author identities. Credentials must be real and verified — do not fabricate.';

INSERT INTO public.authors (slug, pen_name, role, short_bio, bio, expertise, color, display_order, published)
SELECT v.slug, v.pen_name, v.role, v.focus, v.bio, ARRAY[v.focus], v.color, v.ord, true
FROM (VALUES
  ('r-adeyemi', 'R. Adeyemi', 'Lead Broker Reviewer', 'Regulation & entity verification',
   'Leads broker onboarding at PipRank: verifying licence status against regulator registers, identifying the specific legal entity behind each account, and writing the regulation sections of our reviews.',
   '#1f8a5c', 10),
  ('j-okafor', 'J. Okafor', 'Trading Costs & Execution Editor', 'Spreads, execution and withdrawal testing',
   'Runs the real-money testing process behind every spread, execution-speed and withdrawal-timing figure published on PipRank, and maintains the trading-cost sections of broker reviews.',
   '#38bdf8', 20),
  ('l-mensah', 'L. Mensah', 'Data & Methodology Lead', 'Health Score formula & data pipeline',
   'Maintains the Health Score methodology and the data pipeline behind it — refresh cadence, factor weighting, and keeping scores consistent as broker conditions change.',
   '#a78bfa', 30),
  ('s-nwachukwu', 'S. Nwachukwu', 'Country & Compliance Editor', 'Country-specific availability & regulatory context',
   'Covers country-level broker availability, local regulatory context, and the country-specific guides published on PipRank.',
   '#f5b53f', 40)
) AS v(slug, pen_name, role, focus, bio, color, ord)
WHERE NOT EXISTS (SELECT 1 FROM public.authors LIMIT 1);
