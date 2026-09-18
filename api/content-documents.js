import supabase from './_lib/db-client.js';
import { requireRole } from './_lib/admin-guard.js';
import { sanitizeBlocks, sanitizeHtml, sanitizePublicSettings } from './_lib/content-sanitizer.js';

const CONTENT_WRITE = ['super_admin', 'admin', 'content_admin'];
const RETIRED_CONTENT_TYPES = new Set(['country-topic', 'localized-seo']);
const CANONICAL_CONTENT_TYPES = new Set(['guide', 'global-best-for', 'country-guide', 'country-best-for', 'localized-guide', 'localized-best-for', 'broker', 'country', 'author']);
const PUBLIC_FIELDS = 'id,content_key,content_type,country_slug,topic_slug,slug,title,excerpt,html,blocks,settings,seo_title,seo_description,indexable,published,updated_at';

function slugify(value) {
  return String(value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function canonicalKey({ contentType, countrySlug, slug, locale }) {
  if (!slug) return null;
  if (contentType === 'guide') return `guide:${slug}`;
  if (contentType === 'global-best-for') return `best-for:${slug}`;
  if (contentType === 'country-guide') return countrySlug ? `country-guide:${countrySlug}:${slug}` : null;
  if (contentType === 'country-best-for') return countrySlug ? `country-best-for:${countrySlug}:${slug}` : null;
  if (contentType === 'localized-guide') return countrySlug && locale ? `localized-guide:${countrySlug}:${locale}:${slug}` : null;
  if (contentType === 'localized-best-for') return countrySlug && locale ? `localized-best-for:${countrySlug}:${locale}:${slug}` : null;
  if (contentType === 'broker') return `broker:${slug}:main`;
  if (contentType === 'country') return `country:${slug}:hub`;
  if (contentType === 'author') return `author:${slug}`;
  return null;
}

function sanitizeDocumentInput(body, existing = null) {
  const contentType = existing?.content_type || String(body.content_type || '').trim();
  const countrySlug = existing?.country_slug ?? (body.country_slug ? slugify(body.country_slug) : null);
  const topicSlug = existing?.topic_slug ?? (body.topic_slug ? slugify(body.topic_slug) : null);
  const slug = existing?.slug ?? (body.slug ? slugify(body.slug) : (topicSlug || slugify(body.title || '') || null));
  const locale = String(existing?.settings?.locale || existing?.settings?.languageCode || body.settings?.locale || body.settings?.languageCode || '').trim().slice(0, 40);
  const contentKey = canonicalKey({ contentType, countrySlug, slug, locale });
  const settings = body.settings && typeof body.settings === 'object' && !Array.isArray(body.settings) ? body.settings : (existing?.settings || {});
  return {
    content_key: contentKey,
    content_type: contentType,
    country_slug: countrySlug,
    topic_slug: topicSlug,
    slug,
    title: String(body.title ?? existing?.title ?? '').slice(0, 180),
    excerpt: String(body.excerpt ?? existing?.excerpt ?? '').slice(0, 600),
    html: sanitizeHtml(body.html ?? existing?.html ?? ''),
    blocks: sanitizeBlocks(body.blocks ?? existing?.blocks ?? []),
    settings,
    seo_title: body.seo_title !== undefined ? (body.seo_title ? String(body.seo_title).slice(0, 180) : null) : (existing?.seo_title ?? null),
    seo_description: body.seo_description !== undefined ? (body.seo_description ? String(body.seo_description).slice(0, 320) : null) : (existing?.seo_description ?? null),
    indexable: body.indexable === undefined ? (existing?.indexable ?? true) : Boolean(body.indexable),
    published: body.published === undefined ? (existing?.published ?? true) : Boolean(body.published),
  };
}

function rejectInvalidType(payload, res) {
  const type = String(payload.content_type || '').trim().toLowerCase();
  if (RETIRED_CONTENT_TYPES.has(type)) {
    res.status(410).json({ error: `${type} is retired. Use the canonical content type.` });
    return true;
  }
  if (!CANONICAL_CONTENT_TYPES.has(type)) {
    res.status(400).json({ error: 'Unsupported content type' });
    return true;
  }
  if (!payload.content_key) {
    res.status(400).json({ error: 'Canonical content identity is required' });
    return true;
  }
  if (String(payload.content_key).startsWith('country-topic:')) {
    res.status(410).json({ error: 'country-topic content keys are retired.' });
    return true;
  }
  return false;
}

function toPublicDocument(document) {
  if (!document) return null;
  return { ...document, html: sanitizeHtml(document.html), blocks: sanitizeBlocks(document.blocks), settings: sanitizePublicSettings(document.settings) };
}

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const wantsAdmin = String(req.query?.admin || '').toLowerCase() === 'true';
      if (wantsAdmin && !(await requireRole(req, res, CONTENT_WRITE))) return;
      const { key, country, topic, type, slug, id } = req.query || {};
      const requestedType = String(type || '').trim().toLowerCase();
      if (RETIRED_CONTENT_TYPES.has(requestedType) || String(key || '').startsWith('country-topic:')) return res.status(410).json({ error: 'Retired content type.' });
      if (requestedType && !CANONICAL_CONTENT_TYPES.has(requestedType)) return res.status(400).json({ error: 'Unsupported content type' });

      let query = supabase.from('content_documents').select(wantsAdmin ? '*' : PUBLIC_FIELDS).in('content_type', [...CANONICAL_CONTENT_TYPES]).order('updated_at', { ascending: false });
      if (!wantsAdmin) query = query.eq('published', true);
      if (id) query = query.eq('id', Number(id));
      if (key) query = query.eq('content_key', String(key));
      if (country) query = query.eq('country_slug', String(country));
      if (topic) query = query.eq('topic_slug', String(topic));
      if (type) query = query.eq('content_type', requestedType);
      if (slug) query = query.eq('slug', String(slug));

      if (key || id) {
        const { data, error } = await query.maybeSingle();
        if (error) throw error;
        return res.status(200).json(wantsAdmin ? (data || null) : toPublicDocument(data || null));
      }
      const { data, error } = await query;
      if (error) throw error;
      return res.status(200).json(wantsAdmin ? (data || []) : (data || []).map(toPublicDocument));
    }

    const actor = await requireRole(req, res, CONTENT_WRITE);
    if (!actor) return;

    if (req.method === 'POST') {
      const payload = sanitizeDocumentInput(req.body || {});
      if (rejectInvalidType(payload, res)) return;
      if (payload.content_type === 'localized-best-for') {
      const intentSlug = String(payload.settings?.intent_slug || payload.topic_slug || '').trim();
      if (!intentSlug) return res.status(400).json({ error: 'A canonical intent is required for localized Best-For content' });
      const { data: owner, error: ownerError } = await supabase
        .from('content_documents')
        .select('id,slug')
        .eq('content_type', 'global-best-for')
        .eq('slug', intentSlug)
        .maybeSingle();
      if (ownerError) throw ownerError;
      if (!owner) return res.status(400).json({ error: 'Localized Best-For must reference an existing global Best-For owner' });
      const { data: intent, error: intentError } = await supabase
        .from('intents')
        .select('id,slug')
        .eq('slug', intentSlug)
        .maybeSingle();
      if (intentError) throw intentError;
      if (!intent) return res.status(400).json({ error: 'The canonical Best-For owner does not have a ranking intent yet' });
      payload.topic_slug = intentSlug;
      payload.settings = { ...payload.settings, intent_slug: intentSlug, canonicalIntentSlug: intentSlug, source_best_for_id: owner.id };
    }

    const { data, error } = await supabase.from('content_documents').insert({ ...payload, updated_by: actor.email }).select().single();
      if (error) throw error;

      // Global Best-For pages are the source of truth for ranking intents.
      // Creating a canonical owner automatically creates its intent when one
      // does not already exist, so admins never need a separate intent-creation step.
      if (payload.content_type === 'global-best-for' && payload.slug) {
        const intentLabel = String(payload.title || payload.slug)
          .replace(/^best\\s+/i, '')
          .replace(/\\s*\\(\\d{4}\\)\\s*$/, '')
          .trim();

        const { data: existingIntent, error: intentLookupError } = await supabase
          .from('intents')
          .select('id')
          .eq('slug', payload.slug)
          .maybeSingle();
        if (intentLookupError) {
          await supabase.from('content_documents').delete().eq('id', data.id);
          throw intentLookupError;
        }

        if (!existingIntent) {
          const { error: intentError } = await supabase.from('intents').insert({
            slug: payload.slug,
            label: intentLabel.slice(0, 120) || payload.slug,
            icon: 'beginners',
            sort_order: 0,
          });
          if (intentError) {
            await supabase.from('content_documents').delete().eq('id', data.id);
            throw intentError;
          }
        }
      }

      return res.status(201).json(data);
    }

    if (req.method === 'PUT') {
      const { id, ...rest } = req.body || {};
      const documentId = Number(id);
      if (!Number.isInteger(documentId) || documentId <= 0) return res.status(400).json({ error: 'A valid id is required' });
      const { data: existing, error: lookupError } = await supabase.from('content_documents').select('id,content_key,content_type,country_slug,topic_slug,slug,title,excerpt,html,blocks,settings,seo_title,seo_description,indexable,published').eq('id', documentId).maybeSingle();
      if (lookupError) throw lookupError;
      if (!existing) return res.status(404).json({ error: 'Content document not found' });
      const payload = sanitizeDocumentInput(rest, existing);
      if (rejectInvalidType(payload, res)) return;
      if (existing.content_type === 'localized-best-for') {
        const canonicalIntent = String(existing.settings?.intent_slug || existing.topic_slug || '').trim();
        if (!canonicalIntent) return res.status(409).json({ error: 'Localized Best-For is missing its canonical intent' });
        payload.topic_slug = existing.topic_slug;
        payload.settings = {
          ...existing.settings,
          ...payload.settings,
          intent_slug: canonicalIntent,
          canonicalIntentSlug: canonicalIntent,
          source_best_for_id: existing.settings?.source_best_for_id ?? null,
        };
      }
      delete payload.content_key;
      const { data, error } = await supabase.from('content_documents').update({ ...payload, updated_by: actor.email }).eq('id', documentId).select().single();
      if (error) throw error;
      return res.status(200).json(data);
    }

    if (req.method === 'DELETE') {
      const documentId = Number(req.body?.id);
      if (!Number.isInteger(documentId) || documentId <= 0) return res.status(400).json({ error: 'A valid id is required' });
      const { data: deleting, error: deletingError } = await supabase
        .from('content_documents')
        .select('id,content_type,slug')
        .eq('id', documentId)
        .maybeSingle();
      if (deletingError) throw deletingError;
      if (!deleting) return res.status(404).json({ error: 'Content document not found' });

      const { error } = await supabase.from('content_documents').delete().eq('id', documentId);
      if (error) throw error;

      if (deleting.content_type === 'global-best-for' && deleting.slug) {
        const { error: intentError } = await supabase.from('intents').delete().eq('slug', deleting.slug);
        if (intentError) throw intentError;
      }
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('content-documents API error:', error);
    return res.status(500).json({ error: error.message || 'Unable to process content document' });
  }
}
