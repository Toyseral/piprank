// Server-level canonicalization for comparison pairs.
// React Router <Navigate> remains as a client-side fallback, but this function
// guarantees reversed pairs receive a real HTTP 301 before the SPA executes.
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

function canonicalPair(pair) {
  const raw = String(pair ?? '').replace(/^\/+|\/+$/g, '');
  const parts = raw.split('-vs-');
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  const [a, b] = parts;
  const [x, y] = [a, b].sort((m, n) => m.localeCompare(n));
  return { raw, a, b, canonical: `${x}-vs-${y}` };
}

export default async function handler(req, res) {
  const pair = req.query?.pair;
  const info = canonicalPair(pair);
  if (!info) return res.status(404).send('Comparison not found');

  if (info.raw !== info.canonical) {
    const host = req.headers.host;
    const proto = req.headers['x-forwarded-proto'] || 'https';
    const target = `${proto}://${host}/compare/${info.canonical}`;
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400');
    return res.redirect(301, target);
  }

  // Serve the already-prerendered canonical comparison HTML. This keeps the
  // canonical URL server-rendered while allowing the redirect logic above to
  // run before React. Vercel includes dist/compare/** for this function.
  try {
    const htmlPath = join(process.cwd(), 'dist', 'compare', info.canonical, 'index.html');
    const html = await readFile(htmlPath, 'utf8');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400');
    return res.status(200).send(html);
  } catch (error) {
    console.error('compare-pair canonical HTML error:', error);
    return res.status(404).send('Comparison not found');
  }
}
