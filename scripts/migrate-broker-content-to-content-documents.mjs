// One-time migration for broker editorial content.
//
// Converts legacy `broker_content` prose into the canonical
// `content_documents` record `broker:{slug}:main`.
//
// Safety rules:
// - Never overwrites a canonical document that already contains meaningful blocks.
// - Creates a canonical document when one does not exist.
// - Seeds an existing empty canonical shell from legacy broker_content.
// - Migrates editorial prose only. Structured broker facts (platforms,
//   accounts, payments, FAQs, pricing, regulation, etc.) remain owned by
//   the brokers/Broker Editor data model and are rendered separately.
// - Safe to re-run: already-migrated canonical documents are skipped.
//
// Usage:
//   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
//     node scripts/migrate-broker-content-to-content-documents.mjs
//
// Optional dry run:
//   DRY_RUN=true NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
//     node scripts/migrate-broker-content-to-content-documents.mjs

import { createClient } from '@supabase/supabase-js';

const PAGE_SIZE = 500;
const MIGRATION_ACTOR = 'migration:broker-content-to-content-documents';

function uid(prefix, index) {
  return `${prefix}_${Date.now()}_${index}_${Math.random().toString(36).slice(2, 8)}`;
}

function textArray(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item ?? '').trim()).filter(Boolean);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function paragraphsToHtml(paragraphs) {
  return textArray(paragraphs).map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join('');
}

function sectionBlocks(field, heading, paragraphs, index) {
  const values = textArray(paragraphs);
  if (!values.length) return [];

  const sectionMap = {
    overview: 'editorial',
    verdict: 'editorial',
    why_recommend: 'editorial',
    best_for_detail: 'editorial',
    avoid_if: 'editorial',
    regulation_detail: 'trust',
    fees_detail: 'pricing',
    platform_intro: 'platforms',
    accounts_intro: 'accounts',
    funding_intro: 'funding',
  };

  const editorialSection = sectionMap[field] || 'editorial';
  const blocks = [
    {
      id: uid('h', index),
      type: 'heading',
      title: heading,
      editorialSection,
    },
    {
      id: uid('r', index),
      type: 'richtext',
      html: paragraphsToHtml(values),
      editorialSection,
    },
  ];

  return blocks;
}

function legacyToBlocks(content, brokerId) {
  const fields = [
    ['overview', 'Overview'],
    ['verdict', 'Our verdict'],
    ['why_recommend', 'Why we recommend this broker'],
    ['best_for_detail', 'Best for'],
    ['avoid_if', 'Consider avoiding if'],
    ['regulation_detail', 'Regulation'],
    ['fees_detail', 'Fees & costs'],
    ['platform_intro', 'Trading platforms'],
    ['accounts_intro', 'Account types'],
    ['funding_intro', 'Deposits & withdrawals'],
  ];

  const blocks = [
    {
      id: uid('structured', brokerId),
      type: 'structured_broker_data',
      brokerId: Number(brokerId),
      section: 'overview',
    },
  ];

  let index = 0;
  for (const [field, heading] of fields) {
    blocks.push(...sectionBlocks(field, heading, content?.[field], index));
    index += 1;
  }

  return blocks;
}

function hasMeaningfulBlocks(blocks) {
  if (!Array.isArray(blocks) || blocks.length === 0) return false;

  return blocks.some((block) => {
    if (!block || typeof block !== 'object') return false;
    if (block.type === 'richtext') {
      return String(block.html || '').replace(/<[^>]+>/g, '').trim().length > 0;
    }
    if (block.type === 'heading') return String(block.title || '').trim().length > 0;
    return true;
  });
}

function brokerExcerpt(broker, content) {
  const overview = textArray(content?.overview);
  if (overview[0]) return overview[0].slice(0, 600);
  return String(broker?.tagline || '').slice(0, 600);
}

function rowFor(broker, legacy) {
  const blocks = legacyToBlocks(legacy, broker.id);
  return {
    content_key: `broker:${broker.slug}:main`,
    content_type: 'broker',
    country_slug: null,
    topic_slug: null,
    slug: broker.slug,
    title: `${broker.name} review`,
    excerpt: brokerExcerpt(broker, legacy),
    html: '',
    blocks,
    seo_title: `${broker.name} Review | PipRank`,
    seo_description: brokerExcerpt(broker, legacy),
    indexable: true,
    published: true,
    settings: {
      migrationSource: 'broker_content',
      migrationVersion: 1,
      brokerId: Number(broker.id),
    },
    updated_by: MIGRATION_ACTOR,
  };
}

async function fetchAll(supabase, table, select) {
  const rows = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from(table)
      .select(select)
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < PAGE_SIZE) break;
  }
  return rows;
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
  }

  const dryRun = String(process.env.DRY_RUN || '').toLowerCase() === 'true';
  const supabase = createClient(url, key);

  const [brokers, legacyRows, canonicalRows] = await Promise.all([
    fetchAll(supabase, 'brokers', 'id,name,slug,tagline'),
    fetchAll(supabase, 'broker_content', '*'),
    fetchAll(supabase, 'content_documents', 'id,content_key,content_type,slug,blocks,title'),
  ]);

  const brokersById = new Map(brokers.map((broker) => [Number(broker.id), broker]));
  const canonicalByKey = new Map(canonicalRows.map((row) => [row.content_key, row]));

  let created = 0;
  let seeded = 0;
  let skipped = 0;
  let missingBroker = 0;

  console.log(`Found ${legacyRows.length} legacy broker_content rows and ${canonicalRows.length} canonical documents.`);
  if (dryRun) console.log('DRY_RUN=true — no database writes will be performed.');

  for (const legacy of legacyRows) {
    const broker = brokersById.get(Number(legacy.broker_id));
    if (!broker) {
      missingBroker += 1;
      console.warn(`Skipping broker_content row ${legacy.id ?? '(no id)'}: broker ${legacy.broker_id} not found.`);
      continue;
    }

    const keyName = `broker:${broker.slug}:main`;
    const existing = canonicalByKey.get(keyName);

    if (existing && hasMeaningfulBlocks(existing.blocks)) {
      skipped += 1;
      console.log(`SKIP ${keyName} — canonical document already has meaningful blocks.`);
      continue;
    }

    const row = rowFor(broker, legacy);

    if (dryRun) {
      if (existing) console.log(`WOULD SEED ${keyName} — existing canonical shell is empty.`);
      else console.log(`WOULD CREATE ${keyName} — no canonical document exists.`);
      continue;
    }

    if (existing) {
      const { error } = await supabase
        .from('content_documents')
        .update({
          title: row.title,
          excerpt: row.excerpt,
          html: row.html,
          blocks: row.blocks,
          settings: row.settings,
          seo_title: row.seo_title,
          seo_description: row.seo_description,
          indexable: row.indexable,
          published: row.published,
          updated_by: MIGRATION_ACTOR,
        })
        .eq('id', existing.id);

      if (error) throw new Error(`Failed to seed ${keyName}: ${error.message}`);
      seeded += 1;
      canonicalByKey.set(keyName, { ...existing, ...row });
      console.log(`SEEDED ${keyName}`);
    } else {
      const { error } = await supabase.from('content_documents').insert(row);
      if (error) throw new Error(`Failed to create ${keyName}: ${error.message}`);
      created += 1;
      canonicalByKey.set(keyName, row);
      console.log(`CREATED ${keyName}`);
    }
  }

  console.log('\nMigration summary');
  console.log(`  Created: ${created}`);
  console.log(`  Seeded empty shells: ${seeded}`);
  console.log(`  Skipped existing canonical content: ${skipped}`);
  console.log(`  Missing brokers: ${missingBroker}`);

  if (dryRun) {
    console.log('\nDry run complete. Re-run without DRY_RUN=true to apply the migration.');
  }
}

main().catch((error) => {
  console.error('\nBroker content migration failed:', error.message || error);
  process.exit(1);
});
