import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const sourcePath = join(here, 'prerender.mjs');
const runtimePath = join(here, '.prerender-runtime.mjs');
const source = readFileSync(sourcePath, 'utf8');

const start = source.indexOf('  const blocksToHtmlServer = (blocks) => (blocks || []).map((b) => {');
const endMarker = "  log(`Fetched ${brokers.length} brokers";
const end = source.indexOf(endMarker, start);
if (start < 0 || end < 0) throw new Error('Could not locate blocksToHtmlServer in scripts/prerender.mjs');

const replacement = String.raw`  const shortList = (values, max = 3) => {
    if (!values?.length) return 'Not listed';
    const shown = values.slice(0, max);
    return values.length > max ? `${shown.join(' · ')} +${values.length - max}` : shown.join(' · ');
  };
  const money = (value) => value === null || value === undefined || value === '' ? '—' : Number(value) === 0 ? '$0' : Number.isFinite(Number(value)) ? `$${Number(value).toLocaleString()}` : String(value);
  const brokerScore = (b) => Math.max(0, Math.min(100, Math.round(Number(b.trust_score ?? b.rating * 20 ?? 0))));
  const brokerCardHtmlServer = (b, variant = 'default') => {
    const href = b.affiliate_url || `/brokers/${b.slug}`;
    const score = brokerScore(b);
    const featured = variant === 'featured';
    const initials = String(b.name || '').split(/\\s+/).map((x) => x[0]).join('').slice(0, 2).toUpperCase();
    const logo = b.logo_url
      ? `<img src="${esc(b.logo_url)}" alt="${esc(b.name)} logo" class="h-11 w-11 rounded-xl object-contain" loading="lazy" />`
      : `<span class="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-sm font-bold text-ink-900">${esc(initials)}</span>`;
    const regulations = shortList((b.regulations || []).map((r) => r?.body).filter(Boolean));
    const tags = (b.best_for || []).slice(0, 2).map((slug) => `<span class="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">${esc(slug)}</span>`).join('');
    return `<article class="group relative flex h-full flex-col rounded-2xl border bg-white p-4 shadow-soft transition duration-300 hover:-translate-y-1 hover:shadow-soft-lg sm:p-5 ${featured ? 'border-emerald-300 ring-2 ring-emerald-500/25 hover:border-emerald-400' : 'border-line hover:border-emerald-300'}" data-broker-id="${Number(b.id)}">
      <div class="flex items-start gap-3">${logo}<div class="min-w-0 flex-1"><h3 class="truncate font-display text-base font-bold text-ink-900">${esc(b.name)}</h3><p class="truncate text-xs text-slate-500">${esc(b.tagline || '')}</p><div class="mt-1.5 flex items-center gap-1.5"><span class="text-amber-500" aria-label="Rating ${esc(b.rating)} out of 5">★★★★★</span><span class="tnum text-xs font-bold text-ink-900">${Number(b.rating || 0).toFixed(1)}</span></div></div></div>
      <div class="mt-3 flex items-center justify-between rounded-xl border border-emerald-100 bg-emerald-50/40 px-3 py-2.5"><div><p class="text-[10px] font-bold uppercase tracking-wider text-emerald-700">PipRank Score</p><p class="mt-0.5 text-xs font-medium text-slate-500">Overall decision fit</p></div><p class="tnum font-display text-xl font-bold text-emerald-700">${score}<span class="text-xs font-semibold text-slate-400">/100</span></p></div>
      <div class="mt-4 grid gap-2 min-[380px]:grid-cols-2">
        <div class="min-w-0 rounded-xl bg-paper px-3 py-2"><p class="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Min deposit</p><p class="tnum mt-0.5 truncate font-bold leading-tight text-ink-900 text-[12px] sm:text-sm">${esc(money(b.min_deposit))}</p></div>
        <div class="min-w-0 rounded-xl bg-paper px-3 py-2"><p class="text-[10px] font-semibold uppercase tracking-wide text-slate-400">EUR/USD spread</p><p class="tnum mt-0.5 truncate font-bold leading-tight text-ink-900 text-[12px] sm:text-sm">${esc(`${b.spread_eurusd ?? '—'} pips`)}</p></div>
        <div class="min-w-0 rounded-xl bg-paper px-3 py-2"><p class="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Regulation</p><p class="tnum mt-0.5 truncate font-bold leading-tight text-ink-900 text-[12px] sm:text-sm">${esc(regulations)}</p></div>
        <div class="min-w-0 rounded-xl bg-paper px-3 py-2"><p class="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Max leverage</p><p class="tnum mt-0.5 truncate font-bold leading-tight text-ink-900 text-[12px] sm:text-sm">${esc(b.max_leverage ?? '—')}</p></div>
      </div>
      <div class="mt-3 flex flex-wrap gap-1.5"><span class="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700">✓ Trust ${esc(b.trust_score ?? '—')}</span>${tags}</div>
      <div class="mt-auto pt-4"><a href="${esc(href)}" class="inline-flex w-full items-center justify-center rounded-xl bg-ink-950 px-4 py-3 text-sm font-bold text-white">View ${esc(b.name)}</a><a href="/brokers/${esc(b.slug)}" class="mt-3 inline-flex w-full items-center justify-center gap-1 text-xs font-bold text-slate-500 transition hover:text-emerald-700">Read full review →</a></div>
    </article>`;
  };
  const fieldValue = (b, field) => ({
    rating: `${Number(b.rating || 0).toFixed(1)}/5`,
    trust_score: `${b.trust_score ?? '—'}/100`,
    min_deposit: money(b.min_deposit),
    spread_eurusd: `${b.spread_eurusd ?? '—'} pips`,
    commission: b.commission || '—',
    max_leverage: b.max_leverage || '—',
    platforms: (b.platforms || []).join(', ') || '—',
    payments: (b.payments || []).join(', ') || '—',
    regulations: shortList((b.regulations || []).map((r) => r?.body).filter(Boolean)),
  }[field] ?? '—');
  const fieldLabel = (field) => String(field).replaceAll('_', ' ').replace(/\\b\\w/g, (m) => m.toUpperCase());
  const blocksToHtmlServer = (blocks) => (blocks || []).map((b) => {
    if (b.type === 'structured_broker_data') {
      const broker = brokers.find((x) => Number(x.id) === Number(b.brokerId));
      if (!broker) return '';
      const section = b.section || 'overview';
      const rows = section === 'pricing'
        ? [['Minimum deposit', money(broker.min_deposit)], ['EUR/USD spread', `${broker.spread_eurusd ?? '—'} pips`], ['Commission', broker.commission || '—'], ['Max leverage', broker.max_leverage || '—']]
        : section === 'platforms'
          ? [['Platforms', (broker.platforms || []).join(', ') || '—'], ['Account types', (broker.account_types || []).join(', ') || '—']]
          : [['Rating', `${Number(broker.rating || 0).toFixed(1)}/5`], ['Trust score', `${broker.trust_score ?? '—'}/100`], ['Regulation', shortList((broker.regulations || []).map((r) => r?.body).filter(Boolean))], ['Founded', String(broker.founded ?? '—')]];
      return `<section class="piprank-structured-broker-data" data-broker-id="${Number(broker.id)}" data-section="${esc(section)}"><h3>${esc(broker.name)} — ${esc(section)}</h3><div class="overflow-x-auto"><table><tbody>${rows.map(([k,v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join('')}</tbody></table></div></section>`;
    }
    if (b.type === 'broker_card') {
      const broker = brokers.find((x) => Number(x.id) === Number(b.brokerId));
      return broker ? brokerCardHtmlServer(broker, b.variant || 'default') : '';
    }
    if (b.type === 'broker_grid') {
      const selected = (b.brokerIds || []).map((id) => brokers.find((x) => Number(x.id) === Number(id))).filter(Boolean);
      return selected.length ? `<div class="grid gap-5 md:grid-cols-2 xl:grid-cols-3">${selected.map((x) => brokerCardHtmlServer(x, b.variant || 'compact')).join('')}</div>` : '';
    }
    if (b.type === 'comparison_table') {
      const selected = (b.brokerIds || []).map((id) => brokers.find((x) => Number(x.id) === Number(id))).filter(Boolean);
      if (!selected.length) return '';
      const fields = b.fields?.length ? b.fields : ['rating', 'trust_score', 'min_deposit', 'spread_eurusd'];
      return `<section class="piprank-comparison-table"><h3>${esc(b.title || 'Broker comparison')}</h3><div class="overflow-x-auto"><table><thead><tr><th>Broker</th>${selected.map((x) => `<th>${esc(x.name)}</th>`).join('')}</tr></thead><tbody>${fields.map((f) => `<tr><th>${esc(fieldLabel(f))}</th>${selected.map((x) => `<td>${esc(fieldValue(x, f))}</td>`).join('')}</tr>`).join('')}</tbody></table></div></section>`;
    }
    if (b.type === 'broker_cta') {
      const broker = brokers.find((x) => Number(x.id) === Number(b.brokerId));
      if (!broker) return '';
      const href = broker.affiliate_url || `/brokers/${broker.slug}`;
      return `<section class="my-6 rounded-2xl bg-ink-950 p-6 text-white"><p class="text-xs font-bold uppercase tracking-widest text-emerald-300">Broker recommendation</p><h3 class="mt-1 text-xl font-bold">${esc(b.title || `Consider ${broker.name}`)}</h3><p class="mt-2 text-sm text-slate-400">${esc(b.text || broker.tagline || '')}</p><a href="${esc(href)}" class="mt-4 inline-flex rounded-xl bg-emerald-400 px-4 py-2.5 text-sm font-bold text-ink-950">View ${esc(broker.name)}</a></section>`;
    }
    if (b.type === 'heading') return `<h2 id="${esc(b.title || 'section-heading')}">${esc(b.title || 'Section heading')}</h2>`;
    if (b.type === 'image') return `<figure><img src="${esc(b.src || '')}" alt="${esc(b.alt || '')}" loading="lazy" /><figcaption>${esc(b.alt || '')}</figcaption></figure>`;
    if (b.type === 'table') {
      const r = b.rows || [['Feature', 'Details'], ['', '']];
      return `<div class="overflow-x-auto"><table><thead><tr>${r[0].map((c) => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${r.slice(1).map((x) => `<tr>${x.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
    }
    if (b.type === 'callout') return `<aside class="piprank-callout piprank-callout-${b.tone || 'neutral'}">${b.html || ''}</aside>`;
    if (b.type === 'links') return `<nav class="piprank-internal-links"><ul>${(b.links || []).map((x) => `<li><a href="${esc(x.href)}">${esc(x.label)}</a></li>`).join('')}</ul></nav>`;
    if (b.type === 'divider') return '<hr />';
    return b.html || '';
  }).join('\\n');

`;

const patched = source.slice(0, start) + replacement + source.slice(end);
writeFileSync(runtimePath, patched, 'utf8');
try {
  await import(pathToFileURL(runtimePath).href + `?t=${Date.now()}`);
} finally {
  try { unlinkSync(runtimePath); } catch {}
}
