ALTER TABLE public.intents
  ADD COLUMN IF NOT EXISTS meta_title text,
  ADD COLUMN IF NOT EXISTS meta_description text,
  ADD COLUMN IF NOT EXISTS sections jsonb NOT NULL DEFAULT '[]'::jsonb;

UPDATE public.content_documents
SET content_type = 'global-best-for',
    content_key = 'best-for:islamic',
    country_slug = NULL,
    topic_slug = 'islamic',
    slug = 'islamic-forex-brokers',
    settings = COALESCE(settings, '{}'::jsonb) || jsonb_build_object('legacyIntentSlug', 'islamic')
WHERE id = 211;
