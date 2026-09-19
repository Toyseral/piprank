-- Harden country ranking editorial controls against unavailable brokers.
-- Overrides may only target brokers that are currently eligible in the country.

CREATE OR REPLACE FUNCTION public.guard_country_intent_broker_override_availability()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_blocked boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.broker_country_availability a
    WHERE a.country_id = NEW.country_id AND a.broker_id = NEW.broker_id
      AND (a.is_available = false OR LOWER(COALESCE(a.status, 'available')) IN ('unavailable', 'restricted'))
  ) INTO v_blocked;
  IF v_blocked THEN
    RAISE EXCEPTION 'Cannot create ranking override for an unavailable or restricted broker in this country' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_guard_country_intent_broker_override_availability ON public.country_intent_broker_overrides;
CREATE TRIGGER trg_guard_country_intent_broker_override_availability
BEFORE INSERT OR UPDATE OF country_id, broker_id, force_include, force_exclude, manual_rank, score_adjustment, featured_override, editorial_note
ON public.country_intent_broker_overrides
FOR EACH ROW EXECUTE FUNCTION public.guard_country_intent_broker_override_availability();

CREATE OR REPLACE FUNCTION public.cleanup_country_ranking_overrides_on_availability_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.is_available = false OR LOWER(COALESCE(NEW.status, 'available')) IN ('unavailable', 'restricted') THEN
    DELETE FROM public.country_intent_broker_overrides WHERE country_id = NEW.country_id AND broker_id = NEW.broker_id;
    DELETE FROM public.country_broker_overrides WHERE country_id = NEW.country_id AND broker_id = NEW.broker_id;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_cleanup_country_ranking_overrides_on_availability_change ON public.broker_country_availability;
CREATE TRIGGER trg_cleanup_country_ranking_overrides_on_availability_change
AFTER INSERT OR UPDATE OF is_available, status
ON public.broker_country_availability
FOR EACH ROW EXECUTE FUNCTION public.cleanup_country_ranking_overrides_on_availability_change();

DELETE FROM public.country_intent_broker_overrides o USING public.broker_country_availability a
WHERE a.country_id = o.country_id AND a.broker_id = o.broker_id
  AND (a.is_available = false OR LOWER(COALESCE(a.status, 'available')) IN ('unavailable', 'restricted'));

DELETE FROM public.country_broker_overrides o USING public.broker_country_availability a
WHERE a.country_id = o.country_id AND a.broker_id = o.broker_id
  AND (a.is_available = false OR LOWER(COALESCE(a.status, 'available')) IN ('unavailable', 'restricted'));
