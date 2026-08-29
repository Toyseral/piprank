import { existsSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { createClient } from '@supabase/supabase-js';

const outDir = 'dist';
if (!existsSync(outDir)) process.exit(0);

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_ANON_KEY;
if (!url || !key) {
  if (process.env.VERCEL_ENV === 'production') throw new Error('Supabase environment is required to enforce country prerender visibility.');
  console.warn('[country-prerender] Supabase env missing; skipping cleanup for non-production build.');
  process.exit(0);
}

const supabase = createClient(url, key);
const { data, error } = await supabase.from('countries').select('slug,status');
if (error) throw error;

const removed = [];
for (const country of data ?? []) {
  if (country.status === 'published' || country.status == null) continue;
  const path = join(outDir, country.slug);
  if (existsSync(path)) {
    rmSync(path, { recursive: true, force: true });
    removed.push(country.slug);
  }
}

if (removed.length) console.log(`[country-prerender] Removed ${removed.length} non-public country trees: ${removed.join(', ')}`);
