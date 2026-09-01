/**
 * src/lib/content/migrate.ts
 *
 * Unified Visual Content Builder — Phase 1 migration foundation.
 *
 * This module provides reusable, additive, idempotent helpers for the future
 * staged migration of legacy content_documents `html` into `blocks`. It does
 * NOT perform any live migration and must never modify production data itself.
 *
 * The future migration is:
 *   - additive   (never deletes `html` — it stays as the derived cache)
 *   - idempotent (safe to rerun; blocks are only seeded when empty)
 *   - reversible (html is never destroyed, so a rollback is trivially possible)
 *   - keyed by `content_key` (callers record per-document provenance)
 *   - marked in `settings.migratedFrom` (no schema migration required)
 *
 * It also implements the has-content invariant guard that protects legacy
 * documents from the existing `blocks=[] → html=""` data-loss bug.
 */

import { blocksToHtml, blocksProduceHtml } from './blocksToHtml.ts';
import { htmlToBlocks } from './htmlToBlocks.ts';
import { sanitizeBlocks, sanitizeHtml } from './sanitize.ts';
import { shouldPreserveLegacyContent } from './types.ts';
import type { PageBlock, PageDocument, PageDocumentSettings } from './types.ts';

export interface SaveDerivation {
  blocks: unknown[];
  html: string;
  /** True when legacy html was preserved instead of being overwritten by empty blocks. */
  preservedLegacy: boolean;
  /** True when blocks were seeded from legacy html to become the source of truth. */
  seededFromLegacy: boolean;
}

export interface DeriveSaveOptions {
  /** Only set true when the administrator deliberately cleared all content. */
  explicitEmpty?: boolean;
}

/**
 * Core has-content invariant guard. Given the existing stored document and the
 * incoming (client-supplied) blocks, produces the blocks/html to actually write.
 *
 * Rule:
 *   - If the existing document is an untouched legacy document (html present,
 *     blocks empty) and the incoming blocks are empty and the save was NOT an
 *     explicit empty, the legacy `html` is preserved (never clobbered to ""),
 *     and blocks are seeded from it so the document becomes block-first.
 *   - Otherwise the html cache is derived from blocks (sanitized), which is the
 *     future editorial source of truth. An intentional full clear (explicitEmpty)
 *     is respected and results in genuine empty content.
 */
export function deriveHtmlForSave(
  existing: Pick<PageDocument, 'blocks' | 'html'> | null | undefined,
  incomingBlocks: unknown[] | null | undefined,
  opts: DeriveSaveOptions = {}
): SaveDerivation {
  const sanitized = sanitizeBlocks(Array.isArray(incomingBlocks) ? incomingBlocks : []);
  const incomingEmpty = !Array.isArray(sanitized) || sanitized.length === 0 || !blocksProduceHtml(sanitized);

  if (existing && shouldPreserveLegacyContent(existing, sanitized, Boolean(opts.explicitEmpty))) {
    // Untouched legacy content: never overwrite. Seed blocks so this document
    // transitions to the block model on its next real edit.
    return {
      blocks: htmlToBlocks(existing.html).blocks,
      html: existing.html,
      preservedLegacy: true,
      seededFromLegacy: true,
    };
  }

  if (incomingEmpty) {
    // An intentionally emptied document (explicitEmpty or a brand-new empty one).
    return { blocks: [], html: '', preservedLegacy: false, seededFromLegacy: false };
  }

  return {
    blocks: sanitized,
    html: blocksToHtml(sanitized),
    preservedLegacy: false,
    seededFromLegacy: false,
  };
}

/**
 * Same as {deriveHtmlForSave} but works on the flat `settings` object a client
 * submits, letting legacy html flow through the normal (id-less) save path.
 */
export function deriveHtmlForSaveFromFlat(
  existing: Pick<PageDocument, 'blocks' | 'html'> | null | undefined,
  incoming: { blocks?: unknown[]; html?: string },
  opts: DeriveSaveOptions = {}
): { blocks: unknown[]; html: string } {
  const { blocks, html } = deriveHtmlForSave(existing, incoming.blocks, opts);
  return { blocks, html };
}

/* ========================= migration marker helpers ========================= */

export interface MigrationMarker {
  from: string;
  at: string;
  tool?: string;
}

/** True when a document has already been marked as migrated. */
export function hasMigrationMarker(settings: PageDocumentSettings | undefined | null): boolean {
  if (!settings || typeof settings !== 'object') return false;
  const m = settings.migratedFrom;
  return Boolean(m && typeof m === 'object' && (m as MigrationMarker).from);
}

/** Returns a new settings object with the migration marker recorded. Additive only. */
export function recordMigrationMarker(
  settings: PageDocumentSettings | undefined | null,
  from: string,
  tool = 'unified-content-builder'
): PageDocumentSettings {
  const marker: MigrationMarker = { from, at: new Date().toISOString(), tool };
  return { ...(settings ?? {}), migratedFrom: marker };
}

/** Normalizes a legacy document's settings so a marker can be recorded safely. */
export function ensureSettingsObject(settings: unknown): PageDocumentSettings {
  if (settings && typeof settings === 'object' && !Array.isArray(settings)) return settings as PageDocumentSettings;
  return {};
}

/**
 * True when a document should be migrated: it has legacy html content but no
 * meaningfully populated blocks yet. Idempotent — once blocks carry content this
 * returns false, so rerunning a staged migration is a no-op per document.
 */
export function shouldMigrateLegacy(doc: Pick<PageDocument, 'html' | 'blocks'> | null | undefined): boolean {
  if (!doc) return false;
  const hasHtml = typeof doc.html === 'string' && doc.html.trim().length > 0;
  if (!hasHtml) return false;
  const hasBlocks = Array.isArray(doc.blocks) && doc.blocks.length > 0 && blocksProduceHtml(doc.blocks);
  return !hasBlocks;
}

/**
 * Additive migration op for a single legacy document. Returns a new document
 * with blocks seeded from html when appropriate. Never mutates the input, never
 * removes html, and records the marker in settings when a migration occurred.
 */
export function migrateDocument(
  doc: Pick<PageDocument, 'html' | 'blocks' | 'settings' | 'content_key'>
): { document: Pick<PageDocument, 'html' | 'blocks' | 'settings'>; migrated: boolean } {
  if (!shouldMigrateLegacy(doc)) {
    return { document: { html: doc.html, blocks: doc.blocks, settings: doc.settings }, migrated: false };
  }
  const seeded = htmlToBlocks(doc.html).blocks;
  const settings = recordMigrationMarker(ensureSettingsObject(doc.settings), 'legacy-html');
  return {
    document: { html: doc.html, blocks: seeded, settings },
    migrated: true,
  };
}

/**
 * Batch-safe helper for staged migrations: maps over documents, migrates those
 * that need it, and reports how many changed so callers can record a marker per
 * content_key. The caller (a future migration script) decides where to write.
 */
export function stageDocuments(
  documents: Array<Pick<PageDocument, 'html' | 'blocks' | 'settings' | 'content_key'>>
): { toWrite: Array<{ content_key: string; html: string; blocks: unknown[]; settings: PageDocumentSettings }>; migratedCount: number } {
  const toWrite: Array<{ content_key: string; html: string; blocks: unknown[]; settings: PageDocumentSettings }> = [];
  let migratedCount = 0;
  for (const doc of documents) {
    const res = migrateDocument(doc);
    if (!res.migrated) continue;
    migratedCount += 1;
    const settings = res.document.settings ?? {};
    toWrite.push({
      content_key: doc.content_key,
      html: res.document.html,
      blocks: res.document.blocks,
      settings: ensureSettingsObject(settings),
    });
  }
  return { toWrite, migratedCount };
}

/**
 * Sanitizes a document's blocks+html before writing (the server-side complement
 * to api/_lib/block-validate.js). Kept here so migration tooling and the API can
 * share one cleaning policy.
 */
export function cleanDocumentForWrite(doc: { html?: unknown; blocks?: unknown[] }): { html: string; blocks: unknown[] } {
  return {
    html: sanitizeHtml(String(doc.html ?? '')),
    blocks: sanitizeBlocks(Array.isArray(doc.blocks) ? doc.blocks : []),
  };
}

export type { PageBlock };