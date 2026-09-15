import { useEffect } from 'react';
import { absoluteUrl, DEFAULT_OG_IMAGE, SITE_NAME, type SeoInput } from '../lib/seo';

export function useSEO(input: SeoInput | null, jsonLd?: object | object[]) {
  useEffect(() => {
    if (!input) return;
    const canonicalUrl = absoluteUrl(input.path);
    const ogImage = input.ogImage ?? DEFAULT_OG_IMAGE;
    const fullOgImage = ogImage.startsWith('http') ? ogImage : absoluteUrl(ogImage);
    const hostname = window.location.hostname.toLowerCase();
    const productionHost = hostname === 'piprank.com' || hostname === 'www.piprank.com';
    const deployEnv = import.meta.env.VITE_DEPLOY_ENV;
    const deploymentNoindex = deployEnv ? deployEnv !== 'production' : !productionHost;

    document.title = input.title;
    document.documentElement.lang = input.lang ? input.lang.split('-')[0] : 'en';
    setMeta('name', 'description', input.description);
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
    if (jsonLd) { const items = Array.isArray(jsonLd) ? jsonLd : [jsonLd]; items.forEach((item) => addJsonLd(item)); }
  }, [input, jsonLd]);
}

function setMeta(attr: 'name' | 'property', key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"][data-seo-managed]`);
  if (!el) { el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`); if (el) el.setAttribute('data-seo-managed', 'true'); else { el = document.createElement('meta'); el.setAttribute(attr, key); el.setAttribute('data-seo-managed', 'true'); document.head.appendChild(el); } }
  el.setAttribute('content', content);
}
function setCanonical(url: string) { let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]'); if (!link) { link = document.createElement('link'); link.setAttribute('rel', 'canonical'); document.head.appendChild(link); } link.setAttribute('href', url); }
function clearManagedJsonLd() { document.head.querySelectorAll('script[data-seo-jsonld]').forEach((el) => el.remove()); }
function addJsonLd(data: object) { const script = document.createElement('script'); script.type = 'application/ld+json'; script.setAttribute('data-seo-jsonld', 'true'); script.textContent = JSON.stringify(data); document.head.appendChild(script); }
function setAlternates(alternates: { hreflang: string; path: string }[]) { document.head.querySelectorAll<HTMLLinkElement>('link[data-seo-hreflang]').forEach((el) => el.remove()); for (const alternate of alternates) { if (!alternate?.hreflang || !alternate?.path) continue; const link = document.createElement('link'); link.rel = 'alternate'; link.hreflang = alternate.hreflang; link.href = absoluteUrl(alternate.path); link.setAttribute('data-seo-hreflang', 'true'); document.head.appendChild(link); } }
