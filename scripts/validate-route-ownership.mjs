import { STATIC_PATHS, canonicalKeyForDocument, canonicalPathForDocument, cleanSlug, localeOf, retiredKeyMatches, isCanonicalContentType } from '../src/lib/canonical-route-registry.mjs';


  const errors = [];
  const ownedPaths = new Map();
  const ownedKeys = new Map();
  const countrySlugs = new Set((countries || []).filter((c) => c.publishing_state === 'published').map((c) => clean(c.slug)).filter(Boolean));
  const intentSlugs = new Set((intents || []).map((i) => clean(i.slug)).filter(Boolean));

  for (const path of STATIC_PATHS) ownedPaths.set(path, 'static route');

  for (const doc of rows) {
    const type = clean(doc.content_type);
    const keyValue = clean(doc.content_key);

    if (isRetiredContentType(type) || retiredKeyMatches(keyValue)) {
      errors.push(`Retired content document still exists: ${doc.content_key || doc.id}`);
      continue;
    }
    if (!isCanonicalContentType(type)) continue;

    const expectedKey = canonicalKeyForDocument(doc);
    const path = canonicalPathForDocument(doc);

    if (!expectedKey) errors.push(`${type} document has insufficient canonical identity: ${doc.id}`);
    else if (keyValue !== expectedKey) errors.push(`${type} has non-canonical content_key: ${doc.content_key} (expected ${expectedKey})`);

    if (!path) {
      errors.push(`${type} cannot resolve a canonical URL: ${doc.id}`);
      continue;
    }

    const previousPath = ownedPaths.get(path);
    if (previousPath) errors.push(`Duplicate route ownership: ${path} (${previousPath} and ${doc.content_key || doc.id})`);
    else ownedPaths.set(path, doc.content_key || String(doc.id));

    if (expectedKey) {
      const previousKey = ownedKeys.get(expectedKey);
      if (previousKey) errors.push(`Duplicate canonical key: ${expectedKey} (${previousKey} and ${doc.id})`);
      else ownedKeys.set(expectedKey, doc.id);
    }

    if (doc.published && doc.indexable !== false) {
      if (type === 'localized-guide' || type === 'localized-best-for') {
        if (!doc.country_slug || !localeOf(doc)) errors.push(`Published localized document is missing country/locale: ${doc.id}`);
      }
      if ((type === 'guide' || type === 'global-best-for') && doc.country_slug) {
        errors.push(`Global ${type} incorrectly has country_slug: ${doc.id}`);
      }
      if ((type === 'country-guide' || type === 'country-best-for') && !countrySlugs.has(clean(doc.country_slug))) {
        errors.push(`Published ${type} points to a non-published country: ${doc.id} (${doc.country_slug})`);
      }
    }
  }

  for (const slug of countrySlugs) {
    const path = `/${encodeURIComponent(slug)}`;
    if (ownedPaths.has(path) && ownedPaths.get(path) !== 'static route') {
      // A canonical country document and a global Best-For document cannot share this path.
      const owners = rows.filter((doc) => canonicalPathForDocument(doc) === path && doc.published);
      if (owners.length > 1) errors.push(`Country/global collision at ${path}: ${owners.map((d) => d.content_key).join(', ')}`);
    }
  }

  for (const intentSlug of intentSlugs) {
    const canonicalIntent = ({
      beginners: 'forex-brokers-for-beginners',
      'low-spread': 'low-spread-forex-brokers',
      mt4: 'mt4-forex-brokers',
      mt5: 'mt5-forex-brokers',
      gold: 'gold-forex-brokers',
      ecn: 'ecn-forex-brokers',
      'copy-trading': 'copy-trading-forex-brokers',
      scalping: 'forex-brokers-for-scalping',
      'swing-trading': 'forex-brokers-for-swing-trading',
      'high-leverage': 'high-leverage-forex-brokers',
      islamic: 'islamic-forex-brokers',
    })[intentSlug] || intentSlug;
    const keyName = `best-for:${canonicalIntent}`;
    const owner = rows.find((doc) => clean(doc.content_type) === 'global-best-for' && clean(doc.content_key) === keyName);
    if (!owner) errors.push(`Intent has no canonical global Best-For owner: ${intentSlug} -> ${keyName}`);
  }

  fail(errors);
  console.log(`[validate-route-ownership] OK — checked ${rows.length} content documents, ${ownedPaths.size} route owners and ${intentSlugs.size} intents.`);
}

main().catch((error) => {
  console.error('[validate-route-ownership] ERROR:', error);
  process.exit(1);
});
