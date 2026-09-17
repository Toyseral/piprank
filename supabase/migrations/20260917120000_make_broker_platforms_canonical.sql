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
            'name', trim(p->>'name'),
            'summary', coalesce(p->>'summary', ''),
            'features', CASE WHEN jsonb_typeof(p->'features') = 'array' THEN p->'features' ELSE '[]'::jsonb END
          ) ORDER BY ord
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
UPDATE public.brokers
SET platforms = (
  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object('name', trim(item), 'summary', '', 'features', '[]'::jsonb)
      ORDER BY ord
    ),
    '[]'::jsonb
  )
  FROM jsonb_array_elements_text(platforms) WITH ORDINALITY AS items(item, ord)
)
WHERE jsonb_typeof(platforms) = 'array'
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(platforms) AS raw(item)
    WHERE jsonb_typeof(raw.item) = 'string'
  );

-- Keep the column JSONB and make the new shape explicit for future writes.
COMMENT ON COLUMN public.brokers.platforms IS 'Canonical structured trading platform data: [{"name": string, "summary": string, "features": string[]}].';
