-- broker_content is no longer a runtime source of truth.
-- Broker editorial content lives in content_documents; structured broker facts
-- remain in brokers and the six Broker Editor source-of-truth areas.
--
-- This migration deliberately verifies the legacy rows still have a canonical
-- broker document before removing the legacy table. It does not use CASCADE.

DO $$
DECLARE
  legacy_count integer;
  uncovered_count integer;
BEGIN
  IF to_regclass('public.broker_content') IS NULL THEN
    RETURN;
  END IF;

  SELECT count(*) INTO legacy_count
  FROM public.broker_content;

  SELECT count(*) INTO uncovered_count
  FROM public.broker_content bc
  JOIN public.brokers b ON b.id = bc.broker_id
  LEFT JOIN public.content_documents cd
    ON cd.content_type = 'broker'
   AND cd.slug = b.slug
  WHERE cd.id IS NULL;

  IF uncovered_count > 0 THEN
    RAISE EXCEPTION
      'Cannot retire broker_content: % legacy row(s) have no canonical broker content document',
      uncovered_count;
  END IF;

  -- All legacy rows are covered by canonical broker documents. Remove the
  -- obsolete rows explicitly before dropping the table.
  DELETE FROM public.broker_content;

  DROP TABLE public.broker_content;

  RAISE NOTICE 'Retired broker_content after verifying % legacy row(s) were covered by canonical documents', legacy_count;
END $$;
