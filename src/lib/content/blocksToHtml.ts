/**
 * src/lib/content/blocksToHtml.ts
 *
 * Shared block → HTML serializer (TYPE WRAPPER).
 *
 * The canonical, runtime-neutral serializer implementation lives in
 * blocksToHtml.js so it can be imported by the browser (Vite), Node build
 * scripts AND Vercel's serverless Node functions (which do not type-strip).
 * This file is a thin typed re-export of that implementation for TypeScript
 * consumers; it adds no logic of its own.
 *
 * Do NOT add logic here. Exactly one implementation exists (blocksToHtml.js).
 */

export { blocksToHtml, serializeBlocksWithErrors, blocksProduceHtml } from './blocksToHtml.runtime.js';
export type { PageBlock } from './types.ts';
