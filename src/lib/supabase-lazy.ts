import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Lazy accessor for pages that only need Supabase for a minor/optional feature
 * (e.g. the reviewer sign-in / verified-badge flow on broker pages), as opposed
 * to admin tooling that genuinely needs it on every load.
 *
 * Unlike `./supabase.ts` (which eagerly creates a client at module-load time),
 * this file has no top-level static import of `@supabase/supabase-js` — the
 * library (~46KB gzip) is only fetched on the network the first time
 * `getSupabase()` is actually called, keeping it out of the critical-path
 * bundle for public pages that only need it conditionally.
 */
let clientPromise: Promise<SupabaseClient> | null = null;

export function getSupabase(): Promise<SupabaseClient> {
  if (!clientPromise) {
    clientPromise = import('@supabase/supabase-js').then(({ createClient }) =>
      createClient(import.meta.env.VITE_SUPABASE_URL as string, import.meta.env.VITE_SUPABASE_ANON_KEY as string),
    );
  }
  return clientPromise;
}
