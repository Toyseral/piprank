-- Fix: the `intents` table was missing the `faqs` column that the admin's
-- IntentEditor (global Best-For pages) has always tried to save, causing
-- "Could not find the 'faqs' column of 'intents' in the schema cache" on
-- every save. The equivalent migration for broker_content and countries
-- already added their own faqs/seo_faqs columns; intents was missed.
--
-- sort_order and indexable are included defensively with the same
-- IF NOT EXISTS safety — both are used by the current Intent type/API but
-- weren't confirmed present, so this closes that gap too without risk if
-- they already exist (a no-op in that case).

ALTER TABLE public.intents
  ADD COLUMN IF NOT EXISTS faqs jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS indexable boolean NOT NULL DEFAULT true;
