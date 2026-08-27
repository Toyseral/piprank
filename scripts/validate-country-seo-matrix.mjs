import { countrySeoTopics } from './country-seo-topics.mjs';

const errors = [];
const slugs = new Set();
const keys = new Set();

for (const topic of countrySeoTopics) {
  if (!topic.slug) errors.push('Topic is missing slug');
  if (!topic.key) errors.push(`Topic ${topic.slug || '<unknown>'} is missing key`);
  if (slugs.has(topic.slug)) errors.push(`Duplicate topic slug: ${topic.slug}`);
  if (keys.has(topic.key)) errors.push(`Duplicate topic key: ${topic.key}`);
  slugs.add(topic.slug);
  keys.add(topic.key);
  if (!Array.isArray(topic.dimensions) || topic.dimensions.length === 0) errors.push(`Topic ${topic.slug} has no dimensions`);
  if (topic.requirements && topic.requirements.length < 2) errors.push(`Combination topic ${topic.slug} must have at least two requirements`);
  if (!Number.isInteger(topic.minBrokers) || topic.minBrokers < 1) errors.push(`Topic ${topic.slug} has invalid minBrokers`);
}

if (errors.length) {
  console.error('[validate-country-seo-matrix] FAILED');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

const base = countrySeoTopics.filter((t) => !t.requirements).length;
const combinations = countrySeoTopics.filter((t) => t.requirements?.length).length;
console.log(`[validate-country-seo-matrix] OK — ${countrySeoTopics.length} topics (${base} base + ${combinations} combinations).`);
