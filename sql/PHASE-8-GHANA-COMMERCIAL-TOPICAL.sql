-- PipRank Phase 8: Ghana commercial + topical authority
-- Run AFTER the final schema migration.
-- This file does NOT invent broker availability. It only promotes brokers that
-- already have an explicit broker_country_availability row for Ghana with
-- status='available'. If no verified rows exist, Ghana recommendations remain
-- empty and Ghana Best-For pages remain non-indexable.
--
-- Ghana regulatory framing is based on current Bank of Ghana and SEC Ghana
-- publications. Re-verify official notices before changing broker eligibility.

BEGIN;

ALTER TABLE public.countries
  ADD COLUMN IF NOT EXISTS recommended jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS unavailable jsonb NOT NULL DEFAULT '[]'::jsonb;

DO $$
DECLARE
  ghana_id bigint;
BEGIN
  SELECT id INTO ghana_id FROM public.countries WHERE slug = 'ghana' LIMIT 1;

  IF ghana_id IS NULL THEN
    RAISE NOTICE 'Ghana country row not found. Create the Ghana country record first; no Ghana content was seeded.';
    RETURN;
  END IF;

  UPDATE public.countries
  SET
    seo_title = 'Best Forex Brokers in Ghana 2026 | PipRank',
    seo_description = 'Compare forex brokers for Ghanaian traders with country-specific availability, regulation, spreads, platforms, funding and Best-For recommendations.',
    seo_intro = '[
      "Choosing a forex broker in Ghana requires more than comparing a headline spread or maximum leverage. PipRank separates broker availability from regulation and evaluates the entity that actually serves the client.",
      "Bank of Ghana publishes an annual list of authorised FX brokers, while the Securities and Exchange Commission Ghana publishes licensed-operator information and warnings about unlicensed investment platforms. Check the current official information before opening an account.",
      "Our Ghana recommendations are shown only after broker availability for Ghana has been explicitly verified in the PipRank database."
    ]'::jsonb,
    seo_sections = '[
      {
        "heading": "What Ghanaian traders should check first",
        "body": [
          "Start with the legal entity, country eligibility and relevant regulatory status. Do not assume that an international licence is the same as Ghanaian authorisation.",
          "Then compare the costs that matter to your trading style: spreads, commission, swaps, funding, withdrawals and currency conversion."
        ],
        "bullets": [
          "Current Ghana availability",
          "Legal entity and regulator",
          "Trading costs",
          "Platforms and account types",
          "Funding and withdrawals"
        ]
      },
      {
        "heading": "Bank of Ghana and FX broker authorisation",
        "body": [
          "Bank of Ghana states that local and international FX brokers that want to operate in Ghana’s forex market require prior approval at the beginning of each calendar year and publishes an authorised FX broker list."
        ]
      },
      {
        "heading": "SEC Ghana and online investment platforms",
        "body": [
          "SEC Ghana regulates the securities market and publishes licensed-operator information and investor warnings. Traders should be particularly cautious about online platforms making investment claims without clear licensing information."
        ]
      },
      {
        "heading": "Funding and withdrawals in Ghana",
        "body": [
          "Payment methods can differ by broker, entity and country. Check the methods actually offered to Ghanaian clients and review conversion charges, processing times and withdrawal conditions before depositing."
        ]
      }
    ]'::jsonb,
    seo_faqs = '[
      {
        "q": "Who regulates forex brokers in Ghana?",
        "a": "Bank of Ghana publishes the current list of authorised FX brokers for operation in Ghana’s forex market. SEC Ghana separately regulates Ghana’s securities market and licensed capital-market operators."
      },
      {
        "q": "Does accepting Ghanaian clients mean a broker is regulated in Ghana?",
        "a": "No. Country availability and local regulatory authorisation are separate questions. A broker can serve Ghanaian clients through an overseas entity."
      },
      {
        "q": "Where can I check authorised FX brokers in Ghana?",
        "a": "Bank of Ghana publishes an authorised FX broker list. SEC Ghana also publishes licensed-operator information and warnings about unlicensed investment products and platforms."
      }
    ]'::jsonb
  WHERE id = ghana_id;

  -- Rebuild the recommendation set ONLY from explicit verified availability.
  UPDATE public.countries c
  SET recommended = COALESCE((
    SELECT jsonb_agg(
      jsonb_build_object(
        'slug', b.slug,
        'note', COALESCE(bca.note, 'Available to Ghanaian clients; verify current onboarding eligibility.')
      )
      ORDER BY bca.priority DESC, b.rating DESC NULLS LAST, b.name
    )
    FROM public.broker_country_availability bca
    JOIN public.brokers b ON b.id = bca.broker_id
    WHERE bca.country_id = ghana_id
      AND bca.status = 'available'
  ), '[]'::jsonb)
  WHERE c.id = ghana_id;

  -- Seed four Ghana Best-For pages. They become indexable only when at least
  -- two verified Ghana brokers match the intent.
  INSERT INTO public.country_best_for (
    country_id, intent_id, slug, label, title, meta_title, meta_description,
    intro, icon, criteria, sections, faqs, indexable, sort_order
  )
  SELECT
    ghana_id,
    i.id,
    x.slug,
    x.label,
    x.title,
    x.meta_title,
    x.meta_description,
    x.intro::jsonb,
    x.icon,
    x.criteria::jsonb,
    x.sections::jsonb,
    x.faqs::jsonb,
    CASE
      WHEN x.slug = 'beginners' THEN (
        SELECT count(*) >= 2 FROM public.broker_country_availability a
        JOIN public.brokers b ON b.id = a.broker_id
        WHERE a.country_id = ghana_id AND a.status = 'available'
          AND COALESCE(b.best_for, '[]'::jsonb) ? 'beginners'
      )
      WHEN x.slug = 'mt5' THEN (
        SELECT count(*) >= 2 FROM public.broker_country_availability a
        JOIN public.brokers b ON b.id = a.broker_id
        WHERE a.country_id = ghana_id AND a.status = 'available'
          AND EXISTS (
            SELECT 1 FROM jsonb_array_elements_text(COALESCE(b.platforms, '[]'::jsonb)) p
            WHERE lower(p) = 'mt5'
          )
      )
      WHEN x.slug = 'gold' THEN (
        SELECT count(*) >= 2 FROM public.broker_country_availability a
        JOIN public.brokers b ON b.id = a.broker_id
        WHERE a.country_id = ghana_id AND a.status = 'available'
          AND COALESCE((b.assets->>'commodities')::numeric, 0) > 0
      )
      ELSE (
        SELECT count(*) >= 2 FROM public.broker_country_availability a
        WHERE a.country_id = ghana_id AND a.status = 'available'
      )
    END,
    x.sort_order
  FROM public.intents i
  JOIN (
    VALUES
    (
      'beginners','Best for Beginners','Best Forex Brokers in Ghana for Beginners',
      'Best Forex Brokers in Ghana for Beginners 2026 | PipRank',
      'Compare beginner-friendly forex brokers available to traders in Ghana, with country-specific availability, costs, platforms and regulation.',
      'beginners',
      '["For Ghanaian beginners, the best broker is not necessarily the one with the highest leverage or lowest headline deposit. We prioritise suitability, transparent costs, platform access and verified country availability.","PipRank keeps affiliate economics separate from the ranking itself. A broker does not rank higher simply because it pays more commission."]',
      '["Verified Ghana availability","Transparent trading costs","Beginner-friendly account options","Platform and demo access","Regulatory and entity checks"]',
      '[{"heading":"What matters most for Ghanaian beginners","body":["Start with the broker entity and Ghana eligibility, then compare the minimum deposit, spreads, account structure, platform and withdrawal process."]},{"heading":"Why we do not rank on CPA","body":["Affiliate compensation is not a ranking factor. The recommendation should reflect the user’s needs, not the amount PipRank may earn from a referral."]}]',
      '[{"q":"What is the best forex broker for beginners in Ghana?","a":"The best choice depends on the trader’s experience, budget, platform and risk preferences. PipRank ranks only brokers whose Ghana availability has been verified."},{"q":"Is high leverage good for Ghanaian beginners?","a":"No. Leverage increases exposure and should not be the primary reason to select a broker."}]',
      10
    ),
    (
      'low-spread','Best for Low Spreads','Best Low-Spread Forex Brokers in Ghana',
      'Best Low-Spread Forex Brokers in Ghana 2026 | PipRank',
      'Compare low-spread forex brokers available in Ghana using spreads, commissions and overall trading costs.',
      'low-spread',
      '["A low quoted spread does not automatically mean a low trading cost. Ghanaian traders should compare the spread, commission, swaps and any conversion or payment costs together.","PipRank uses the broker data available to it and does not treat a minimum advertised spread as a guarantee of the spread a client will receive."]',
      '["EUR/USD spread","Commission","All-in trading cost","Account type","Ghana availability"]',
      '[{"heading":"Spread versus commission","body":["Raw-spread accounts can combine very low spreads with a separate commission. Standard accounts may include more of the broker’s cost in the spread. Compare the total cost for your trade size."]},{"heading":"Country-specific availability comes first","body":["A broker can offer attractive pricing globally but still have different onboarding terms or entities for Ghanaian clients. Confirm the Ghana account before depositing."]}]',
      '[{"q":"What is a good forex spread in Ghana?","a":"It depends on the pair, account type, market conditions and commission. Compare the all-in cost rather than one advertised minimum spread."},{"q":"Are low-spread brokers always better?","a":"No. Regulation, availability, platform, withdrawals and other costs can matter as much as the spread."}]',
      20
    ),
    (
      'mt5','Best for MT5','Best MT5 Forex Brokers in Ghana',
      'Best MT5 Forex Brokers in Ghana 2026 | PipRank',
      'Compare MT5 forex brokers available to Ghanaian traders by platform access, costs, instruments and account conditions.',
      'mt5',
      '["MT5 can be useful for traders who want a modern multi-asset platform, advanced charting and automated strategies. The broker still matters: check which entity provides MT5 to Ghanaian clients and what account conditions apply.","PipRank does not treat MT5 availability alone as a reason to rank a broker first."]',
      '["MT5 availability","Instrument coverage","Trading costs","Automation support","Ghana availability"]',
      '[{"heading":"What to compare beyond the MT5 logo","body":["Check whether MT5 is available for your Ghana account, which instruments are supported, what spreads and commissions apply, and whether the broker permits the strategies you use."]},{"heading":"MT5 and broker selection","body":["The platform is only one part of the decision. Regulation, country availability, costs and withdrawals remain important."]}]',
      '[{"q":"Is MT5 available in Ghana?","a":"Many international brokers offer MT5, but availability depends on the broker, entity and account. Confirm that the MT5 account is available to Ghanaian residents."},{"q":"Is MT5 better than MT4?","a":"Not for every trader. MT5 has broader functionality, while MT4 remains useful for many forex traders and existing automated strategies."}]',
      30
    ),
    (
      'gold','Best for Gold Trading','Best Gold Trading Forex Brokers in Ghana',
      'Best Gold Trading Forex Brokers in Ghana 2026 | PipRank',
      'Compare forex brokers available in Ghana for gold trading, including XAU/USD costs, platforms and account conditions.',
      'gold',
      '["Gold trading can be materially different from major currency-pair trading because volatility, spreads, contract specifications and overnight financing can vary.","For Ghanaian traders, check the broker’s XAU/USD conditions on the account and entity actually available to you."]',
      '["XAU/USD pricing","Commission","Platform","Contract specifications","Ghana availability"]',
      '[{"heading":"Compare gold costs, not just EUR/USD","body":["A broker with a competitive EUR/USD spread may not be the cheapest for gold. Check the XAU/USD spread, commission, swap and contract specification for the account you intend to use."]},{"heading":"Understand gold risk","body":["Gold can move sharply around economic releases and periods of market stress. Leverage can magnify both gains and losses."]}]',
      '[{"q":"What should I look for in a gold broker in Ghana?","a":"Compare XAU/USD trading costs, platform, contract specifications, swap conditions, Ghana availability and the regulatory entity serving the account."},{"q":"Is gold trading safer than forex?","a":"No. Gold can be highly volatile, and leveraged trading can result in substantial losses."}]',
      40
    )
  ) AS x(slug,label,title,meta_title,meta_description,icon,intro,criteria,sections,faqs,sort_order)
    ON x.slug = CASE WHEN i.slug = 'beginners' THEN 'beginners' ELSE i.slug END
  WHERE i.slug IN ('beginners','low-spread','mt5','gold')
  ON CONFLICT (country_id, slug) DO UPDATE SET
    intent_id = EXCLUDED.intent_id,
    label = EXCLUDED.label,
    title = EXCLUDED.title,
    meta_title = EXCLUDED.meta_title,
    meta_description = EXCLUDED.meta_description,
    intro = EXCLUDED.intro,
    icon = EXCLUDED.icon,
    criteria = EXCLUDED.criteria,
    sections = EXCLUDED.sections,
    faqs = EXCLUDED.faqs,
    indexable = EXCLUDED.indexable,
    sort_order = EXCLUDED.sort_order,
    updated_at = now();

END $$;

COMMIT;
