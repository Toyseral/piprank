-- Treat explicit unknown availability as ineligible and guard both country ranking override tables.

CREATE OR REPLACE FUNCTION public.guard_country_ranking_override_availability()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE v_blocked boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.broker_country_availability a
    WHERE a.country_id=NEW.country_id AND a.broker_id=NEW.broker_id
      AND (a.is_available=false OR LOWER(COALESCE(a.status,'available')) <> 'available')
  ) INTO v_blocked;
  IF v_blocked THEN
    RAISE EXCEPTION 'Cannot create ranking override for a broker that is not explicitly available in this country' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_guard_country_broker_override_availability ON public.country_broker_overrides;
CREATE TRIGGER trg_guard_country_broker_override_availability
BEFORE INSERT OR UPDATE OF country_id, broker_id, force_include, force_exclude, manual_rank, score_adjustment, featured_override, editorial_note
ON public.country_broker_overrides FOR EACH ROW EXECUTE FUNCTION public.guard_country_ranking_override_availability();

DROP TRIGGER IF EXISTS trg_guard_country_intent_broker_override_availability ON public.country_intent_broker_overrides;
CREATE TRIGGER trg_guard_country_intent_broker_override_availability
BEFORE INSERT OR UPDATE OF country_id, broker_id, force_include, force_exclude, manual_rank, score_adjustment, featured_override, editorial_note
ON public.country_intent_broker_overrides FOR EACH ROW EXECUTE FUNCTION public.guard_country_ranking_override_availability();

CREATE OR REPLACE VIEW public.country_broker_final_rankings AS
WITH base AS (
 SELECT c.id::bigint AS country_id,b.id::bigint AS broker_id,COALESCE(b.trust_score,0)::numeric AS score,
   CASE WHEN a.id IS NULL THEN 'available' ELSE COALESCE(a.status,CASE WHEN COALESCE(a.is_available,true) THEN 'available' ELSE 'unavailable' END) END AS availability_status,
   COALESCE(a.note,a.notes) AS availability_note,o.force_include,o.force_exclude,o.manual_rank,o.score_adjustment,o.featured_override,o.editorial_note
 FROM public.countries c CROSS JOIN public.brokers b
 LEFT JOIN public.broker_country_availability a ON a.country_id=c.id AND a.broker_id=b.id
 LEFT JOIN public.country_broker_overrides o ON o.country_id=c.id AND o.broker_id=b.id
 WHERE (a.id IS NULL OR (COALESCE(a.is_available,true)=true AND LOWER(COALESCE(a.status,'available'))='available'))
   AND COALESCE(o.force_exclude,false)=false
), resolved AS (
 SELECT base.country_id,base.broker_id,base.score,base.availability_status,base.availability_note,base.force_include,base.force_exclude,base.manual_rank,base.score_adjustment,base.featured_override,base.editorial_note,base.score+COALESCE(base.score_adjustment,0) AS final_score FROM base
), ordered AS (
 SELECT resolved.country_id,resolved.broker_id,resolved.score,resolved.availability_status,resolved.availability_note,resolved.force_include,resolved.force_exclude,resolved.manual_rank,resolved.score_adjustment,resolved.featured_override,resolved.editorial_note,resolved.final_score,
 row_number() OVER (PARTITION BY resolved.country_id ORDER BY CASE WHEN resolved.force_include THEN 0 ELSE 1 END,resolved.manual_rank,resolved.final_score DESC,resolved.broker_id)::integer AS final_rank FROM resolved
)
SELECT country_id,broker_id,final_rank,final_score,availability_status,availability_note,force_include,force_exclude,manual_rank,score_adjustment,COALESCE(featured_override,false) AS featured,featured_override,editorial_note FROM ordered;

DELETE FROM public.country_broker_overrides o USING public.broker_country_availability a
WHERE a.country_id=o.country_id AND a.broker_id=o.broker_id AND (a.is_available=false OR LOWER(COALESCE(a.status,'available')) <> 'available');
DELETE FROM public.country_intent_broker_overrides o USING public.broker_country_availability a
WHERE a.country_id=o.country_id AND a.broker_id=o.broker_id AND (a.is_available=false OR LOWER(COALESCE(a.status,'available')) <> 'available');
