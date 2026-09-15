insert into public.intents (slug, label, title, icon, intro, criteria, faqs, sort_order, indexable, blocks)
values (
  'islamic',
  'Islamic brokers',
  'Best Islamic Forex Brokers (2026)',
  'Sparkles',
  '[]'::jsonb,
  '[]'::jsonb,
  '[]'::jsonb,
  0,
  true,
  '[]'::jsonb
)
on conflict (slug) do update set
  label = excluded.label,
  title = excluded.title,
  icon = excluded.icon,
  indexable = excluded.indexable;
