-- Read-only Ghana verification audit.
-- Run after PHASE-8-GHANA-BROKER-VERIFICATION.sql.

SELECT
  b.name AS broker,
  a.status AS availability_status,
  v.availability_verified,
  v.local_authorisation_status,
  v.client_entity,
  v.regulator,
  v.affiliate_eligible,
  v.verification_date,
  v.source_url
FROM public.broker_country_availability a
JOIN public.brokers b ON b.id=a.broker_id
LEFT JOIN public.broker_country_verification v
  ON v.broker_id=a.broker_id AND v.country_id=a.country_id
JOIN public.countries c ON c.id=a.country_id
WHERE c.slug='ghana'
ORDER BY v.availability_verified DESC NULLS LAST, b.name;

SELECT
  c.name AS country,
  jsonb_array_length(COALESCE(c.recommended,'[]'::jsonb)) AS recommended_count,
  (SELECT count(*)
   FROM public.broker_country_verification v
   WHERE v.country_id=c.id AND v.availability_verified=true) AS verified_count
FROM public.countries c
WHERE c.slug='ghana';

SELECT slug, label, indexable
FROM public.country_best_for cbf
JOIN public.countries c ON c.id=cbf.country_id
WHERE c.slug='ghana'
ORDER BY sort_order;
