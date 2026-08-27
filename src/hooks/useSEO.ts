import { useEffect } from 'react';
import { absoluteUrl, DEFAULT_OG_IMAGE, SITE_NAME, type SeoInput } from '../lib/seo';

// Applies page-specific <title>, meta description, canonical, Open Graph,
// Twitter Card and (optionally) JSON-LD tags for the current route.
//
// Why this exists: the site is a client-rendered SPA, so without this hook
// every route would keep whatever metadata was baked into index.html at
// build time — meaning every broker, country, guide and compare page would
// show identical homepage title/description/OG tags to anything that reads
// the DOM after JS runs (most modern crawlers, and all social share tools
// that execute JS). The build-time prerender script (scripts/prerender.mjs)
// handles the *initial* HTML response using the same seo.ts builders; this
// hook keeps things correct for in-app client-side navigation afterwards.
//
// Tags are created/updated by a stable `data-seo-managed` marker so repeat
// calls (e.g. navigating between two broker pages) replace rather than
// duplicate tags.
export function useSEO(input: SeoInput | null, jsonLd?: object | object[]) {
  useEffect(() => {
    if (!input) return;

    const canonicalUrl = absoluteUrl(input.path);
    const ogImage = input.ogImage ?? DEFAULT_OG_IMAGE;
    const fullOgImage = ogImage.startsWith('http') ? ogImage : absoluteUrl(ogImage);

    document.title = input.title;
    document.documentElement.lang = input.lang ? input.lang.split('-')[0] : 'en';

    setMeta('name', 'description', input.description);
    const deployEnv = import.meta.env.VITE_DEPLOY_ENV;
    const deploymentNoindex = deployEnv !== 'production';
    setMeta('name', 'robots', input.noindex || deploymentNoindex ? 'noindex, nofollow, noarchive' : 'index, follow, max-image-preview:large');

    setMeta('property', 'og:title', input.title);
    setMeta('property', 'og:description', input.description);
    setMeta('property', 'og:type', input.type === 'article' ? 'article' : 'website');
    setMeta('property', 'og:url', canonicalUrl);
    setMeta('property', 'og:image', fullOgImage);
    setMeta('property', 'og:site_name', SITE_NAME);

    setMeta('name', 'twitter:card', 'summary_large_image');
    setMeta('name', 'twitter:title', input.title);
    setMeta('name', 'twitter:description', input.description);
    setMeta('name', 'twitter:image', fullOgImage);

    setCanonical(canonicalUrl);
    setAlternates(input.alternates ?? []);

    clearManagedJsonLd();
    if (jsonLd) {
      const items = Array.isArray(jsonLd) ? jsonLd : [jsonLd];
      items.forEach((item) => addJsonLd(item));
    }

    // No cleanup: the next route's useSEO call overwrites these same tags.
    // Leaving stale tags between the unmount of one page and the mount of
    // the next is harmless since React Router renders synchronously.
  }, [input, jsonLd]);
}

function setMeta(attr: 'name' | 'property', key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"][data-seo-managed]`);
  if (!el) {
    // Reuse a pre-existing static tag from index.html on first run if present,
    // so we don't end up with duplicate description/OG tags on first paint.
    el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
    if (el) {
      el.setAttribute('data-seo-managed', 'true');
    } else {
      el = document.createElement('meta');
      el.setAttribute(attr, key);
      el.setAttribute('data-seo-managed', 'true');
      document.head.appendChild(el);
    }
  }
  el.setAttribute('content', content);
}

function setCanonical(url: string) {
  let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!link) {
    link = document.createElement('link');
    link.setAttribute('rel', 'canonical');
    document.head.appendChild(link);
  }
  link.setAttribute('href', url);
}

function clearManagedJsonLd() {
  document.head.querySelectorAll('script[data-seo-jsonld]').forEach((el) => el.remove());
}

function addJsonLd(data: object) {
  const script = document.createElement('script');
  script.type = 'application/ld+json';
  script.setAttribute('data-seo-jsonld', 'true');
  script.textContent = JSON.stringify(data);
  document.head.appendChild(script);
}


function setAlternates(alternates: { hreflang: string; path: string }[]) {
  document.head.querySelectorAll<HTMLLinkElement>('link[data-seo-hreflang]').forEach((el) => el.remove());
  for (const alternate of alternates) {
    if (!alternate?.hreflang || !alternate?.path) continue;
    const link = document.createElement('link');
    link.rel = 'alternate';
    link.hreflang = alternate.hreflang;
    link.href = absoluteUrl(alternate.path);
    link.setAttribute('data-seo-hreflang', 'true');
    document.head.appendChild(link);
  }
}
