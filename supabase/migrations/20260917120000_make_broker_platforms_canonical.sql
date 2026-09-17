-- Canonical broker platform data now lives on brokers.platforms.
-- Legacy broker_content.platforms is read only for this one-time migration.
-- Do not drop broker_content here; retirement happens after runtime cutover verification.

DO $$
DECLARE
  has_legacy boolean;
BEGIN
  SELECT to_regclass('public.broker_content') IS NOT NULL INTO has_legacy;

  IF has_legacy THEN
    UPDATE public.brokers b
    SET platforms = src.platforms
    FROM (
      SELECT
        b2.id,
        jsonb_agg(
          jsonb_build_object(
            'name', trim(items.p->>'name'),
            'summary', coalesce(items.p->>'summary', ''),
            'features', CASE WHEN jsonb_typeof(items.p->'features') = 'array' THEN items.p->'features' ELSE '[]'::jsonb END
          ) ORDER BY items.ord
        ) AS platforms
      FROM public.brokers b2
      JOIN public.broker_content bc ON bc.broker_id = b2.id
      CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(bc.platforms) = 'array' THEN bc.platforms ELSE '[]'::jsonb END) WITH ORDINALITY AS items(p, ord)
      WHERE jsonb_typeof(bc.platforms) = 'array'
        AND jsonb_array_length(bc.platforms) > 0
        AND jsonb_typeof(items.p) = 'object'
        AND coalesce(trim(items.p->>'name'), '') <> ''
      GROUP BY b2.id
    ) src
    WHERE b.id = src.id;
  END IF;
END $$;

-- Normalize any remaining legacy string arrays without overwriting migrated rich data.
-- Mixed arrays are handled element-by-element so malformed historical rows cannot abort the migration.
UPDATE public.brokers b
SET platforms = normalized.platforms
FROM (
  SELECT
    id,
    jsonb_agg(
      CASE
        WHEN jsonb_typeof(items.item) = 'string' THEN jsonb_build_object('name', trim(items.item #>> '{}'), 'summary', '', 'features', '[]'::jsonb)
        ELSE items.item
      END
      ORDER BY items.ord
    ) AS platforms
  FROM public.brokers
  CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(platforms) = 'array' THEN platforms ELSE '[]'::jsonb END) WITH ORDINALITY AS items(item, ord)
  WHERE jsonb_typeof(platforms) = 'array'
    AND EXISTS (
      SELECT 1
      FROM jsonb_array_elements(platforms) AS raw(item)
      WHERE jsonb_typeof(raw.item) = 'string'
    )
  GROUP BY id
) normalized
WHERE b.id = normalized.id;

-- Keep the column JSONB and make the new shape explicit for future writes.
COMMENT ON COLUMN public.brokers.platforms IS 'Canonical structured trading platform data: [{"name": string, "summary": string, "features": string[]}].';
