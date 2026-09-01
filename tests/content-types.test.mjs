// tests/content-types.test.mjs
// Phase 1 — shared content model (types.ts): PageTypeKey, PageDocument,
// has-content invariants, legacy detection, settings tolerance.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PAGE_TYPE_KEYS,
  hasContent,
  isLegacyHtmlDocument,
  shouldPreserveLegacyContent,
} from '../src/lib/content/types.ts';