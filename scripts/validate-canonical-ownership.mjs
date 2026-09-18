import { canonicalKeyForDocument, canonicalPathForDocument, isCanonicalContentType, isRetiredContentType, retiredKeyMatches, localeOf } from '../src/lib/canonical-route-registry.mjs';


  const errors = [];
  const seenKeys = new Map();
  const seenPaths = new Map();

  for (const doc of rows) {
    const type = String(doc.content_type || '');
    const keyValue = String(doc.content_key || '');

    if (type === 'country-topic' || keyValue.startsWith('country-topic:')) {
      errors.push(`Retired country-topic document still exists: ${keyValue || doc.id}`);
      continue;
    }
    if (type === 'localized-seo' || keyValue.startsWith('localized-seo:')) {
      errors.push(`Retired localized-seo document still exists: ${keyValue || doc.id}`);
      continue;
    }
    if (!isCanonicalContentType(type)) continue;

    const expectedKey = canonicalKeyForDocument(doc);
    if (!expectedKey) errors.push(`${type} document has insufficient canonical identity: ${doc.id}`);
    else if (keyValue !== expectedKey) errors.push(`${type} has non-canonical content_key: ${keyValue} (expected ${expectedKey})`);

    const path = canonicalPathForDocument(doc);
    if (!path && expectedKey) errors.push(`${type} document cannot resolve a canonical URL: ${doc.id}`);
    if (path) {
      if (seenPaths.has(path)) errors.push(`Duplicate canonical URL ownership: ${path} (${seenPaths.get(path)} and ${doc.id})`);
      seenPaths.set(path, doc.id);
    }

    if (expectedKey) {
      if (seenKeys.has(expectedKey)) errors.push(`Duplicate canonical ownership key: ${expectedKey} (${seenKeys.get(expectedKey)} and ${doc.id})`);
      seenKeys.set(expectedKey, doc.id);
    }

    if (type.startsWith('localized-') && !localeOf(doc)) errors.push(`Localized document is missing locale: ${doc.id}`);
    if (type.startsWith('localized-') && !doc.country_slug) errors.push(`Localized document is missing country_slug: ${doc.id}`);
    if ((type === 'guide' || type === 'global-best-for') && doc.country_slug) errors.push(`${type} must not have country_slug: ${doc.id}`);
  }

  if (errors.length) {
    console.error('[validate-canonical-ownership] FAILED');
    errors.forEach((error) => console.error(` - ${error}`));
    process.exit(1);
  }
  console.log(`[validate-canonical-ownership] OK — checked ${rows.length} content documents and ${seenPaths.size} canonical URLs.`);
}
main().catch((error) => { console.error('[validate-canonical-ownership] ERROR:', error); process.exit(1); });
