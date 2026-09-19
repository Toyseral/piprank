-- Keep country Best-For indexability aligned with the canonical country x intent ranking pool.
-- A country Best-For page needs at least two currently eligible brokers to be indexable.
UPDATE public.content_documents AS d
SET indexable = false,
    settings = jsonb_set(
      COALESCE(d.settings, '{}'::jsonb),
      '{generator,eligibleForIndexing}',
      'false'::jsonb,
      true
    ),
    updated_at = now()
WHERE d.content_type = 'country-best-for'
  AND d.published = true
  AND d.indexable = true
  AND (
    SELECT count(*)
    FROM public.country_intent_broker_final_rankings r
    JOIN public.intents i ON i.id = r.intent_id
    JOIN public.countries c ON c.id = r.country_id
    WHERE c.slug = d.country_slug
      AND i.slug = d.topic_slug
      AND lower(coalesce(r.eligibility_status, '')) = 'eligible'
  ) < 2;
