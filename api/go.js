import crypto from 'node:crypto';
import supabase from './_lib/db-client.js';
import { isoToSlug, slugToIso2, parseCookieCountry } from './_lib/geo-map.js';

// Public redirect endpoint. Deliberately minimal surface: no admin auth here,
// this is hit directly by browsers via the /go/:broker rewrite in
// vercel.json. It never returns JSON — every path ends in a redirect.
//
// Resolver chain (matches the product spec):
//   broker slug → affiliate resolver → country-specific URL if available
//   → global URL fallback → (redirect) → affiliate network
const FALLBACK_PATH = '/brokers';

function deviceTypeFromUA(ua) {
  const s = String(ua || '');
  if (/tablet|ipad/i.test(s)) return 'tablet';
  if (/mobi|android|iphone/i.test(s)) return 'mobile';
  return 'desktop';
}

function applyTrackingParams(url, params, clickId) {
  try {
    const u = new URL(url);
    for (const [key, rawValue] of Object.entries(params || {})) {
      if (!key) continue;
      const value = String(rawValue ?? '').replace('{click_id}', clickId);
      u.searchParams.set(key, value);
    }
    return u.toString();
  } catch {
    return url; // malformed stored URL — better to send the raw value than 500
  }
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  const redirectTo = (path) => {
    res.writeHead(302, { Location: path });
    res.end();
  };

  try {
    const brokerSlug = String(req.query?.broker ?? '').trim().toLowerCase();
    if (!brokerSlug) return redirectTo(FALLBACK_PATH);

    const { data: broker, error: brokerErr } = await supabase
      .from('brokers')
      .select('id, slug, website, affiliate_url')
      .eq('slug', brokerSlug)
      .single();
    if (brokerErr || !broker) return redirectTo(FALLBACK_PATH);

    // --- resolve country: explicit on-site pick wins over IP geolocation ---
    const explicitCountry = parseCookieCountry(req.headers.cookie);
    const ipCountryIso = req.headers['x-vercel-ip-country'];
    const ipCountrySlug = isoToSlug(ipCountryIso);
    const ipCountryCode = ipCountryIso ? String(ipCountryIso).trim().toUpperCase() : null;
    const explicitCountryCode = explicitCountry ? slugToIso2(explicitCountry) : null;
    const countryCode = explicitCountryCode || ipCountryCode || null;
    const country = explicitCountry || ipCountrySlug || null;
    const countrySource = explicitCountryCode ? 'explicit' : ipCountryCode ? 'ip_geo' : null;

    // --- resolve affiliate link: country-specific -> global -> legacy fallback ---
    const { data: links } = await supabase
      .from('affiliate_links')
      .select('country_code, affiliate_url, tracking_params, active')
      .eq('broker_id', broker.id)
      .eq('active', true);

    const countryRow = countryCode ? (links || []).find((l) => String(l.country_code || '').toUpperCase() === countryCode) : null;
    const globalRow = (links || []).find((l) => l.country_code === null);

    let targetUrl = null;
    let resolvedType = null;
    let trackingParams = {};

    if (countryRow) {
      targetUrl = countryRow.affiliate_url;
      trackingParams = countryRow.tracking_params || {};
      resolvedType = 'country';
    } else if (globalRow) {
      targetUrl = globalRow.affiliate_url;
      trackingParams = globalRow.tracking_params || {};
      resolvedType = 'global';
    } else if (broker.affiliate_url) {
      targetUrl = broker.affiliate_url;
      resolvedType = 'legacy_fallback';
    } else if (broker.website) {
      targetUrl = broker.website;
      resolvedType = 'website_fallback';
    }

    if (!targetUrl) return redirectTo(FALLBACK_PATH);

    const clickId = crypto.randomUUID();
    const finalUrl = applyTrackingParams(targetUrl, trackingParams, clickId);

    // Best-effort logging — never let a tracking failure block the redirect.
    try {
      await supabase.from('redirect_clicks').insert({
        click_id: clickId,
        broker_id: broker.id,
        broker_slug: broker.slug,
        country,
        country_code: countryCode,
        country_source: countrySource,
        resolved_url_type: resolvedType,
        source_page: String(req.query?.src ?? '').slice(0, 300) || null,
        page_type: String(req.query?.page_type ?? '').slice(0, 60) || null,
        best_for_category: String(req.query?.best_for ?? '').slice(0, 120) || null,
        comparison_pair: String(req.query?.pair ?? '').slice(0, 120) || null,
        referrer: String(req.headers.referer ?? '').slice(0, 500) || null,
        utm_source: String(req.query?.utm_source ?? '').slice(0, 120) || null,
        utm_medium: String(req.query?.utm_medium ?? '').slice(0, 120) || null,
        utm_campaign: String(req.query?.utm_campaign ?? '').slice(0, 120) || null,
        utm_term: String(req.query?.utm_term ?? '').slice(0, 120) || null,
        utm_content: String(req.query?.utm_content ?? '').slice(0, 120) || null,
        device_type: deviceTypeFromUA(req.headers['user-agent']),
        session_id: String(req.query?.sid ?? '').slice(0, 64) || null,
      });
    } catch (logErr) {
      console.error('redirect_clicks insert failed (non-blocking):', logErr);
    }

    return redirectTo(finalUrl);
  } catch (err) {
    console.error('/go redirect error:', err);
    return redirectTo(FALLBACK_PATH);
  }
}
