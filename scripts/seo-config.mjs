// Shared build-time SEO configuration. The final PipRank domain is intentionally
// not hard-coded because it has not been selected yet.

export function getSiteUrl({ required = false } = {}) {
  const raw = (process.env.VITE_SITE_URL || '').trim().replace(/\/+$/, '');
  if (raw) {
    if (!/^https?:\/\//i.test(raw)) {
      throw new Error(`VITE_SITE_URL must start with http:// or https://. Received: ${raw}`);
    }
    return raw;
  }
  if (required) {
    throw new Error('VITE_SITE_URL is required for a production SEO build. Set it to the final PipRank domain before deploying production.');
  }
  return 'http://localhost:5173';
}

export function requireSiteUrlForProduction() {
  const isProduction = process.env.VERCEL_ENV === 'production';
  return getSiteUrl({ required: isProduction });
}
