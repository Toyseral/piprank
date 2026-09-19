-- Seed canonical Best-For owners and intents for Crypto and EUR/USD.
-- These are canonical editorial/ranking identities. Broker membership remains an
-- explicit brokers.best_for classification and is not inferred from asset counts.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.content_documents
    WHERE content_type = 'global-best-for' AND slug = 'crypto-brokers'
  ) THEN
    INSERT INTO public.content_documents (
      content_key, content_type, topic_slug, slug, title,
      excerpt, html, blocks, seo_title, seo_description,
      indexable, published, settings
    ) VALUES (
      'best-for:crypto-brokers',
      'global-best-for',
      'crypto',
      'crypto-brokers',
      'Crypto Brokers',
      '',
      '',
      '[]'::jsonb,
      'Best Crypto Brokers (2026)',
      'Compare forex brokers that offer crypto trading, with country availability and broker-level ranking context.',
      false,
      false,
      '{}'::jsonb
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.content_documents
    WHERE content_type = 'global-best-for' AND slug = 'eur-usd-forex-brokers'
  ) THEN
    INSERT INTO public.content_documents (
      content_key, content_type, topic_slug, slug, title,
      excerpt, html, blocks, seo_title, seo_description,
      indexable, published, settings
    ) VALUES (
      'best-for:eur-usd-forex-brokers',
      'global-best-for',
      'eur-usd',
      'eur-usd-forex-brokers',
      'EUR/USD Forex Brokers',
      '',
      '',
      '[]'::jsonb,
      'Best EUR/USD Forex Brokers (2026)',
      'Compare forex brokers for EUR/USD trading, including spreads, execution and country availability.',
      false,
      false,
      '{}'::jsonb
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.intents WHERE slug = 'crypto-brokers') THEN
    INSERT INTO public.intents (slug, label, title, icon, meta_title, meta_description, sort_order, indexable, blocks)
    VALUES ('crypto-brokers', 'Crypto brokers', 'Best Crypto Brokers', '', 'Best Crypto Brokers (2026)', 'Compare forex brokers that offer crypto trading.', 100, false, '[]'::jsonb);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.intents WHERE slug = 'eur-usd-forex-brokers') THEN
    INSERT INTO public.intents (slug, label, title, icon, meta_title, meta_description, sort_order, indexable, blocks)
    VALUES ('eur-usd-forex-brokers', 'EUR/USD brokers', 'Best EUR/USD Forex Brokers', '', 'Best EUR/USD Forex Brokers (2026)', 'Compare forex brokers for EUR/USD trading.', 101, false, '[]'::jsonb);
  END IF;
END $$;

-- Preserve canonical identity for the existing localized EUR/USD page.
UPDATE public.content_documents d
SET
  topic_slug = 'eur-usd-forex-brokers',
  settings = COALESCE(d.settings, '{}'::jsonb)
    || jsonb_build_object(
      'intent_slug', 'eur-usd-forex-brokers',
      'canonicalIntentSlug', 'eur-usd-forex-brokers',
      'source_best_for_id', (
        SELECT id FROM public.content_documents
        WHERE content_type = 'global-best-for'
          AND slug = 'eur-usd-forex-brokers'
        LIMIT 1
      )
    ),
  updated_at = now()
WHERE d.content_type = 'localized-best-for'
  AND (d.topic_slug = 'eur-usd' OR d.slug = 'eur-usd-forex-brokers');

-- Keep seeded owners as drafts until editorial content and broker membership are reviewed.
UPDATE public.content_documents
SET published = false, indexable = false, updated_at = now()
WHERE content_type = 'global-best-for'
  AND slug IN ('crypto-brokers', 'eur-usd-forex-brokers');

-- Re-run the ranking sync for the new canonical intents. Membership is based
-- only on explicit brokers.best_for values; no broker is auto-classified here.
DO $$
DECLARE intent_row record;
BEGIN
  FOR intent_row IN
    SELECT id FROM public.intents
    WHERE slug IN ('crypto-brokers', 'eur-usd-forex-brokers')
  LOOP
    PERFORM public.sync_country_intent_broker_rankings(intent_row.id);
  END LOOP;
END $$;
