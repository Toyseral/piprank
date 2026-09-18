import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');

const supabase = createClient(url, key);

const CANONICAL = {
  beginners: 'forex-brokers-for-beginners',
  'low-spread': 'low-spread-forex-brokers',
  mt4: 'mt4-forex-brokers',
  mt5: 'mt5-forex-brokers',
  gold: 'gold-forex-brokers',
  ecn: 'ecn-forex-brokers',
  'copy-trading': 'copy-trading-forex-brokers',
  scalping: 'forex-brokers-for-scalping',
  'swing-trading': 'forex-brokers-for-swing-trading',
  'high-leverage': 'high-leverage-forex-brokers',
  islamic: 'islamic-forex-brokers',
};

function esc(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function cleanText(value) {
  return String(value ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}
function rich(id, html) {
  return { id, type: 'richtext', html };
}
function heading(id, title) {
  return { id, type: 'heading', title };
}
function legacyBlocks(intent) {
  const blocks = [];
  const intro = Array.isArray(intent.intro) ? intent.intro.filter(Boolean).map(String) : [];
  const criteria = Array.isArray(intent.criteria) ? intent.criteria.filter(Boolean).map(String) : [];
  const sections = Array.isArray(intent.sections) ? intent.sections : [];
  const faqs = Array.isArray(intent.faqs) ? intent.faqs : [];

  for (let i = 0; i < intro.length; i++) blocks.push(rich(`intent-migration:intro-${i}`, `<p>${esc(intro[i])}</p>`));
  if (criteria.length) {
    blocks.push(heading('intent-migration:criteria-heading', 'How we ranked these brokers'));
    blocks.push(rich('intent-migration:criteria', `<ul>${criteria.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`));
  }
  for (let i = 0; i < sections.length; i++) {
    const section = sections[i] ?? {};
    const title = cleanText(section.heading);
    const body = Array.isArray(section.body) ? section.body.filter(Boolean).map(String) : [];
    const bullets = Array.isArray(section.bullets) ? section.bullets.filter(Boolean).map(String) : [];
    if (title) blocks.push(heading(`intent-migration:section-heading-${i}`, title));
    if (body.length) blocks.push(rich(`intent-migration:section-body-${i}`, body.map((x) => `<p>${esc(x)}</p>`).join('')));
    if (bullets.length) blocks.push(rich(`intent-migration:section-bullets-${i}`, `<ul>${bullets.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`));
  }
  if (faqs.length) {
    blocks.push(heading('intent-migration:faq-heading', 'Frequently Asked Questions'));
    for (let i = 0; i < faqs.length; i++) {
      const faq = faqs[i] ?? {};
      const q = cleanText(faq.q);
      const a = cleanText(faq.a);
      if (q && a) blocks.push(rich(`intent-migration:faq-${i}`, `<h3>${esc(q)}</h3><p>${esc(a)}</p>`));
    }
  }
  return blocks;
}

const { data: intents, error: intentError } = await supabase
  .from('intents')
  .select('id,slug,label,title,meta_title,meta_description,intro,criteria,sections,faqs,indexable,blocks')
  .order('id');
if (intentError) throw intentError;

const slugs = (intents ?? []).map((intent) => CANONICAL[intent.slug] || intent.slug);
const { data: docs, error: docError } = await supabase
  .from('content_documents')
  .select('id,content_key,slug,title,blocks,seo_title,seo_description,indexable,published')
  .eq('content_type', 'global-best-for')
  .in('slug', slugs);
if (docError) throw docError;

const bySlug = new Map((docs ?? []).map((doc) => [doc.slug, doc]));
let created = 0;
let enriched = 0;
let skipped = 0;

for (const intent of intents ?? []) {
  const slug = CANONICAL[intent.slug] || intent.slug;
  const existing = bySlug.get(slug);
  const migratedBlocks = legacyBlocks(intent);

  if (!existing) {
    const payload = {
      content_key: `best-for:${slug}`,
      content_type: 'global-best-for',
      country_slug: null,
      topic_slug: slug,
      slug,
      title: intent.title || `Best Forex Brokers for ${intent.label}`,
      excerpt: Array.isArray(intent.intro) && intent.intro[0] ? String(intent.intro[0]).slice(0, 600) : '',
      html: '',
      blocks: migratedBlocks,
      settings: { rankingMode: 'auto', pinnedBrokerSlugs: [], excludedBrokerSlugs: [] },
      seo_title: intent.meta_title || null,
      seo_description: intent.meta_description || null,
      indexable: intent.indexable !== false,
      published: true,
    };
    const { error } = await supabase.from('content_documents').insert(payload);
    if (error) throw error;
    created++;
    continue;
  }

  const existingBlocks = Array.isArray(existing.blocks) ? existing.blocks : [];
  if (existingBlocks.length === 0 && migratedBlocks.length > 0) {
    const { error } = await supabase.from('content_documents').update({
      blocks: migratedBlocks,
      excerpt: Array.isArray(intent.intro) && intent.intro[0] ? String(intent.intro[0]).slice(0, 600) : existing.title,
      seo_title: existing.seo_title || intent.meta_title || null,
      seo_description: existing.seo_description || intent.meta_description || null,
      indexable: existing.indexable ?? intent.indexable !== false,
    }).eq('id', existing.id);
    if (error) throw error;
    enriched++;
  } else {
    skipped++;
  }
}

console.log(JSON.stringify({ intents: intents?.length ?? 0, created, enriched, skipped }, null, 2));
