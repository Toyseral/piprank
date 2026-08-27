// One-time migration for the guide-page generalization: converts the
// existing hardcoded Malaysia/Ghana guide topics into content_documents
// rows (content_type: 'country-guide'), so they're served by the new
// generic /:countrySlug/guides/:slug route (GuideTopic.tsx) instead of the
// retired MalaysiaTopic.tsx/GhanaTopic.tsx components.
//
// Imports the existing data files directly rather than re-transcribing
// their content, so there's no risk of introducing a typo or dropped
// paragraph during the move.
//
// Run once, against production, BEFORE deploying the redirects in
// vercel.json — the new /malaysia/guides/:slug and /ghana/guides/:slug
// URLs will 404 until these rows exist. Safe to re-run: upserts on the
// content_documents_content_key_uidx unique index, so running it twice
// just re-syncs the same 11 rows rather than duplicating them.
//
// Usage:
//   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
//     node scripts/migrate-guides-to-content-documents.mjs

import { createClient } from '@supabase/supabase-js';
import { malaysiaTopics } from '../src/data/malaysiaTopics.js';
import { ghanaTopics } from '../src/data/ghanaTopics.js';

function uid(prefix, i) {
  return `${prefix}_${i}_${Math.random().toString(36).slice(2, 8)}`;
}

function sectionsToBlocks(sections) {
  const blocks = [];
  for (const [i, section] of (sections ?? []).entries()) {
    if (section.heading) blocks.push({ id: uid('h', i), type: 'heading', title: section.heading });
    const bodyHtml = (section.body ?? []).map((p) => `<p>${p}</p>`).join('');
    const bulletsHtml = section.bullets?.length ? `<ul>${section.bullets.map((b) => `<li>${b}</li>`).join('')}</ul>` : '';
    const linksHtml = section.links?.length ? `<p>${section.links.map((l) => `<a href="${l.href}">${l.label}</a>`).join(' · ')}</p>` : '';
    const html = [bodyHtml, bulletsHtml, linksHtml].filter(Boolean).join('');
    if (html) blocks.push({ id: uid('r', i), type: 'richtext', html });
  }
  return blocks;
}

function topicToRow(topic, countrySlug) {
  return {
    content_key: `country-guide:${countrySlug}:${topic.slug}`,
    content_type: 'country-guide',
    country_slug: countrySlug,
    topic_slug: null,
    slug: topic.slug,
    title: topic.title,
    excerpt: topic.description,
    html: '',
    blocks: sectionsToBlocks(topic.sections),
    seo_title: `${topic.title} | PipRank`,
    seo_description: topic.description,
    indexable: true,
    published: true,
    settings: {
      faqs: topic.faqs ?? [],
      internalLinks: [],
    },
    updated_by: 'migration:guides-to-content-documents',
  };
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');

  const supabase = createClient(url, key);

  const rows = [
    ...malaysiaTopics.map((t) => topicToRow(t, 'malaysia')),
    ...ghanaTopics.map((t) => topicToRow(t, 'ghana')),
  ];

  console.log(`Migrating ${rows.length} guide topics (${malaysiaTopics.length} Malaysia, ${ghanaTopics.length} Ghana)...`);

  const { data, error } = await supabase
    .from('content_documents')
    .upsert(rows, { onConflict: 'content_key' })
    .select('content_key');

  if (error) {
    console.error('Migration failed:', error.message);
    process.exit(1);
  }

  console.log(`Done. Upserted ${data.length} rows:`);
  for (const r of data) console.log(`  - ${r.content_key}`);
  console.log('\nVerify a couple of these render correctly at /malaysia/guides/:slug and /ghana/guides/:slug');
  console.log('before deploying the vercel.json redirects that point the old URLs here.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
