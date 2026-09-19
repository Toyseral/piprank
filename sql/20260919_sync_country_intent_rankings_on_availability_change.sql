-- Keep country × intent ranking rows synchronized when broker-country availability changes.
-- Availability transitions can remove or restore eligibility without changing broker.best_for.
-- The ranking sync function is therefore triggered on INSERT, UPDATE, and DELETE.

CREATE OR REPLACE FUNCTION public.sync_country_intent_rankings_on_availability()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  intent_row record;
BEGIN
  FOR intent_row IN SELECT id FROM public.intents LOOP
    PERFORM public.sync_country_intent_broker_rankings(intent_row.id);
  END LOOP;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_cleanup_country_ranking_overrides_on_availability_change
  ON public.broker_country_availability;

CREATE TRIGGER trg_sync_country_intent_rankings_on_availability_change
AFTER INSERT OR UPDATE OR DELETE ON public.broker_country_availability
FOR EACH ROW
EXECUTE FUNCTION public.sync_country_intent_rankings_on_availability();

-- Backfill after installing the trigger so any previously stale rows are repaired.
DO $$
DECLARE intent_row record;
BEGIN
  FOR intent_row IN SELECT id FROM public.intents LOOP
    PERFORM public.sync_country_intent_broker_rankings(intent_row.id);
  END LOOP;
END;
$$;
