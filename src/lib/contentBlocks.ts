import type { PageBlock } from '../components/PageBuilder';
import type { BrokerContent, FAQ, GuideSection } from './types';

/**
 * A generic "legacy section" shape that every content type's own structured
 * fields (broker overview/verdict/etc, guide sections, best-for sections)
 * can be normalized into before converting to PageBuilder blocks. This is
 * the one shared intermediate format the rest of the admin editors convert
 * through, so there's a single conversion function instead of one per
 * content type.
 */
export interface LegacySection {
  heading?: string;
  paragraphs: string[];
  bullets?: string[];
}

let blockIdCounter = 0;
function newBlockId(): string {
  blockIdCounter += 1;
  return `seed-${Date.now()}-${blockIdCounter}`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function paragraphsToHtml(paragraphs: string[], bullets?: string[]): string {
  const parts: string[] = [];
  for (const p of paragraphs) {
    if (p && p.trim()) parts.push(`<p>${escapeHtml(p)}</p>`);
  }
  if (bullets && bullets.length) {
    const items = bullets.filter((b) => b && b.trim());
    if (items.length) parts.push(`<ul>${items.map((b) => `<li>${escapeHtml(b)}</li>`).join('')}</ul>`);
  }
  return parts.join('\n');
}

/**
 * Converts an ordered list of legacy sections (heading + paragraphs +
 * optional bullets) into PageBuilder blocks: a heading block followed by a
 * richtext block per section. Empty sections are skipped so seeding never
 * produces junk blank blocks.
 */
export function legacySectionsToBlocks(sections: LegacySection[]): PageBlock[] {
  const blocks: PageBlock[] = [];
  for (const section of sections) {
    const html = paragraphsToHtml(section.paragraphs, section.bullets);
    if (!html && !section.heading) continue;
    if (section.heading) {
      blocks.push({ id: newBlockId(), type: 'heading', title: section.heading });
    }
    if (html) {
      blocks.push({ id: newBlockId(), type: 'richtext', html });
    }
  }
  return blocks;
}

/**
 * Converts a FAQ list into a heading block plus one richtext Q&A block per
 * entry, for content types that want FAQs folded into the same builder
 * session rather than kept in a separate structured FAQ tab.
 */
export function faqsToBlocks(faqs: FAQ[], headingTitle = 'Frequently asked questions'): PageBlock[] {
  const real = faqs.filter((f) => f.q?.trim() || f.a?.trim());
  if (!real.length) return [];
  const blocks: PageBlock[] = [{ id: newBlockId(), type: 'heading', title: headingTitle }];
  for (const f of real) {
    blocks.push({
      id: newBlockId(),
      type: 'richtext',
      html: `<p><strong>${escapeHtml(f.q)}</strong></p><p>${escapeHtml(f.a)}</p>`,
    });
  }
  return blocks;
}

/**
 * True if a set of blocks looks meaningfully non-empty — used to decide
 * whether an existing content_documents record already has real edits
 * (leave it alone) vs. is still an empty shell that should be seeded from
 * legacy fields.
 */
export function blocksHaveContent(blocks: unknown[] | undefined | null): boolean {
  if (!Array.isArray(blocks) || blocks.length === 0) return false;
  return blocks.some((raw) => {
    const block = raw as Partial<PageBlock>;
    if (block.type === 'richtext') return Boolean(block.html && block.html.replace(/<[^>]+>/g, '').trim());
    if (block.type === 'heading') return Boolean(block.title && block.title.trim());
    return true; // image / table / callout / links / divider blocks count once added
  });
}

/* ============================ PER-TYPE ADAPTERS ============================ */
// Each adapter maps one content type's own structured fields into the
// shared LegacySection[] shape above. Adding a new content type to the
// seed-on-first-open system only requires one small adapter like these.

const BROKER_FIELD_HEADINGS: [keyof BrokerContent, string][] = [
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

export function brokerContentToLegacySections(content: BrokerContent | null | undefined): LegacySection[] {
  if (!content) return [];
  const sections: LegacySection[] = [];
  for (const [field, heading] of BROKER_FIELD_HEADINGS) {
    const paragraphs = (content[field] as string[] | undefined) ?? [];
    if (paragraphs.some((p) => p && p.trim())) sections.push({ heading, paragraphs });
  }
  return sections;
}

export function guideSectionsToLegacySections(sections: GuideSection[] | undefined | null): LegacySection[] {
  if (!Array.isArray(sections)) return [];
  return sections.map((s) => ({ heading: s.heading, paragraphs: s.body ?? [], bullets: s.bullets }));
}

export function introCriteriaToLegacySections(
  intro: string[] | undefined,
  criteria: string[] | undefined,
  sections: { heading: string; body: string[]; bullets?: string[] }[] | undefined
): LegacySection[] {
  const out: LegacySection[] = [];
  if (intro?.some((p) => p && p.trim())) out.push({ paragraphs: intro });
  if (criteria?.some((p) => p && p.trim())) out.push({ heading: 'What to look for', paragraphs: [], bullets: criteria });
  for (const s of sections ?? []) {
    out.push({ heading: s.heading, paragraphs: s.body ?? [], bullets: s.bullets });
  }
  return out;
}
