import { createClient } from '@supabase/supabase-js';
import { sanitizeHtml } from '../api/_lib/content-sanitizer.js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');

const supabase = createClient(url, key);
const COPY_IDS = {
  __bestfor_ranking_description: 'bestfor-copy:ranking',
  __bestfor_comparison_description: 'bestfor-copy:comparison',
  __bestfor_broker_analysis_description: 'bestfor-copy:brokerAnalysis',
};

function text(value) { return String(value ?? '').trim(); }

function migrateBlocks(doc) {
  const blocks = Array.isArray(doc.blocks) ? [...doc.blocks] : [];
  const settings = doc.settings && typeof doc.settings === 'object' && !Array.isArray(doc.settings) ? doc.settings : {};
  const sections = Array.isArray(settings.sections) ? settings.sections : [];
  const existing = new Set(blocks.map((block) => String(block?.id || '')));
  let changed = false;

  for (const [legacyTitle, id] of Object.entries(COPY_IDS)) {
    const section = sections.find((item) => item && item.title === legacyTitle);
    if (!section?.html || existing.has(id)) continue;
    blocks.push({ id, type: 'richtext', html: sanitizeHtml(section.html), editorialSection: 'introduction' });
    existing.add(id);
    changed = true;
  }

  sections.forEach((section, index) => {
    if (!section || typeof section !== 'object') return;
    const title = text(section.title);
    const html = text(section.html);
    if (!title && !html) return;
    if (title && COPY_IDS[title]) return;

    const baseId = `bestfor-legacy-section:${index}`;
    if (title && !existing.has(`${baseId}:heading`)) {
      blocks.push({ id: `${baseId}:heading`, type: 'heading', title, editorialSection: 'additional' });
      existing.add(`${baseId}:heading`);
      changed = true;
    }
    if (html && !existing.has(`${baseId}:body`)) {
      blocks.push({ id: `${baseId}:body`, type: 'richtext', html: sanitizeHtml(html), editorialSection: 'additional' });
      existing.add(`${baseId}:body`);
      changed = true;
    }
  });

  const { sections: _legacySections, ...cleanSettings } = settings;
  return { blocks, settings: cleanSettings, changed: changed || Object.prototype.hasOwnProperty.call(settings, 'sections') };
}

async function main() {
  const { data, error } = await supabase
    .from('content_documents')
    .select('id,content_key,content_type,blocks,settings')
    .in('content_type', ['global-best-for', 'country-best-for', 'localized-best-for']);

  if (error) throw error;

  let updated = 0;
  let skipped = 0;

  for (const doc of data || []) {
    const result = migrateBlocks(doc);
    if (!result.changed) { skipped++; continue; }

    const { error: updateError } = await supabase
      .from('content_documents')
      .update({ blocks: result.blocks, settings: result.settings })
      .eq('id', doc.id);

    if (updateError) throw new Error(`${doc.content_key}: ${updateError.message}`);
    updated++;
    console.log(`Migrated ${doc.content_key}`);
  }

  console.log(`Best-For section migration complete: ${updated} updated, ${skipped} already clean.`);
}

main().catch((error) => {
  console.error('[migrate-bestfor-sections] FAILED:', error);
  process.exit(1);
});
