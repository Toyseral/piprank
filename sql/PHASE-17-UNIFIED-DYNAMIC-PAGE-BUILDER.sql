-- Phase 17 — Unified dynamic page-builder storage
-- Keeps broker facts in their existing source-of-truth tables. These JSONB
-- arrays store editorial composition only: text, broker references, tables,
-- CTAs, FAQs, etc. Empty arrays preserve all existing legacy content.

ALTER TABLE public.guides
  ADD COLUMN IF NOT EXISTS blocks jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.intents
  ADD COLUMN IF NOT EXISTS blocks jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.country_best_for
  ADD COLUMN IF NOT EXISTS blocks jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.guides
  DROP CONSTRAINT IF EXISTS guides_blocks_is_array;
ALTER TABLE public.guides
  ADD CONSTRAINT guides_blocks_is_array CHECK (jsonb_typeof(blocks) = 'array');

ALTER TABLE public.intents
  DROP CONSTRAINT IF EXISTS intents_blocks_is_array;
ALTER TABLE public.intents
  ADD CONSTRAINT intents_blocks_is_array CHECK (jsonb_typeof(blocks) = 'array');

ALTER TABLE public.country_best_for
  DROP CONSTRAINT IF EXISTS country_best_for_blocks_is_array;
ALTER TABLE public.country_best_for
  ADD CONSTRAINT country_best_for_blocks_is_array CHECK (jsonb_typeof(blocks) = 'array');
