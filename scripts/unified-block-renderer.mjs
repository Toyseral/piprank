const esc = (value = '') => String(value).replace(/[&<>\"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;', "'": '&#039;' }[c]));

const sectionLabel = (section) => ({
  overview: 'Overview',
  pricing: 'Pricing & trading costs',
  trust: 'Trust & regulation',
  platforms: 'Trading platforms',
  features: 'Features & payments',
  editorial: 'Editorial highlights',
}[section] || 'Overview');

const fieldLabel = (field) => ({
  rating: 'Rating',
  trust_score: 'Trust score',
  min_deposit: 'Min. deposit',
  spread_eurusd: 'EUR/USD spread',
  commission: 'Commission',
  max_leverage: 'Max leverage',
  platforms: 'Platforms',
  payments: 'Payment methods',
  regulations: 'Regulation',
}[field] || field);

const brokerField = (broker, field) => {
  if (field === 'rating') return `${broker.rating ?? ''}/5`;
  if (field === 'trust_score') return String(broker.trust_score ?? '');
  if (field === 'min_deposit') return String(broker.min_deposit ?? '');
  if (field === 'spread_eurusd') return String(broker.spread_eurusd ?? '');
  if (field === 'commission') return String(broker.commission ?? '');
  if (field === 'max_leverage') return String(broker.max_leverage ?? '');
  if (field === 'platforms') return (broker.platforms || []).join(', ') || 'Not listed';
  if (field === 'payments') return (broker.payments || []).join(', ') || 'Not listed';
  return (broker.regulations || []).map((r) => r.body || r.country).filter(Boolean).join(', ') || 'Not listed';
};

const brokerHref = (broker) => broker.affiliate_url || `/brokers/${broker.slug}`;

function structuredBrokerHtml(block, brokers) {
  const broker = brokers.find((x) => x.id === Number(block.brokerId));
  if (!broker) return '';
  const section = block.section || 'overview';
  const rows = section === 'overview'
    ? [['Broker', broker.name], ['Rating', `${broker.rating ?? ''}/5`], ['Trust score', String(broker.trust_score ?? '')], ['Founded', String(broker.founded || '')], ['Headquarters', broker.headquarters || '']]
    : section === 'pricing'
      ? [['Minimum deposit', String(broker.min_deposit ?? '')], ['EUR/USD spread', String(broker.spread_eurusd ?? '')], ['Commission', broker.commission || ''], ['Maximum leverage', broker.max_leverage || '']]
      : section === 'trust'
        ? [['Trust score', String(broker.trust_score ?? '')], ['Regulation', (broker.regulations || []).map((r) => r.body || r.country).filter(Boolean).join(', ') || 'Not listed'], ['Segregated funds', broker.segregated ? 'Yes' : 'No'], ['Negative balance protection', broker.nbp ? 'Yes' : 'No'], ['Risk warning', broker.risk_warning || '']]
        : section === 'platforms'
          ? [['Platforms', (broker.platforms || []).join(', ') || 'Not listed']]
          : section === 'features'
            ? [['Demo account', broker.demo_account ? 'Yes' : 'No'], ['Islamic account', broker.islamic_account ? 'Yes' : 'No'], ['Copy trading', broker.copy_trading ? 'Yes' : 'No'], ['Scalping', broker.scalping ? 'Yes' : 'No'], ['Hedging', broker.hedging ? 'Yes' : 'No'], ['Payment methods', (broker.payments || []).join(', ') || 'Not listed']]
            : [['Best for', (broker.best_for || []).join(', ') || ''], ['Pros', (broker.pros || []).join(' • ') || ''], ['Cons', (broker.cons || []).join(' • ') || '']];
  return `<section class="piprank-structured-broker-data" data-broker-id="${Number(broker.id)}" data-section="${esc(section)}"><h3>${esc(broker.name)} — ${esc(sectionLabel(section))}</h3><div class="overflow-x-auto"><table><tbody>${rows.filter(([, value]) => value !== '' && value != null).map(([key, value]) => `<tr><th>${esc(key)}</th><td>${esc(value)}</td></tr>`).join('')}</tbody></table></div></section>`;
}

function brokerCardHtml(broker, variant = 'default') {
  const href = brokerHref(broker);
  return `<article class="piprank-broker-card piprank-broker-card-${esc(variant)}" data-broker-id="${Number(broker.id)}"><div><h3>${esc(broker.name)}</h3><p>Rating: ${esc(`${broker.rating ?? ''}/5`)} · Trust score: ${esc(String(broker.trust_score ?? ''))}</p><p>Min. deposit: ${esc(String(broker.min_deposit ?? ''))} · EUR/USD: ${esc(String(broker.spread_eurusd ?? ''))}</p></div><a href="${esc(href)}">View ${esc(broker.name)}</a></article>`;
}

function comparisonHtml(block, brokers) {
  const selected = (block.brokerIds || []).map((id) => brokers.find((broker) => broker.id === Number(id))).filter(Boolean);
  if (!selected.length) return '';
  const fields = block.fields?.length ? block.fields : ['rating', 'trust_score', 'min_deposit', 'spread_eurusd'];
  const rows = fields.map((field) => `<tr><th>${esc(fieldLabel(field))}</th>${selected.map((broker) => `<td>${esc(brokerField(broker, field))}</td>`).join('')}</tr>`).join('');
  const cta = block.ctaLabel && block.ctaHref
    ? `<tr><th>Action</th>${selected.map((broker) => `<td><a href="${esc(block.ctaHref.replace(/\{broker\}/g, broker.slug))}">${esc(block.ctaLabel)}</a></td>`).join('')}</tr>`
    : '';
  return `<section class="piprank-comparison-table"><h3>${esc(block.title || 'Broker comparison')}</h3><div class="overflow-x-auto"><table><thead><tr><th>Broker</th>${selected.map((broker) => `<th>${esc(broker.name)}</th>`).join('')}</tr></thead><tbody>${rows}${cta}</tbody></table></div></section>`;
}

function ctaHtml(block, brokers) {
  const broker = brokers.find((x) => x.id === Number(block.brokerId));
  if (!broker) return '';
  const href = block.ctaHref || brokerHref(broker);
  const headline = block.headline ?? block.title ?? `Trade with ${broker.name}`;
  const buttonLabel = block.buttonLabel ?? block.ctaLabel ?? `View ${broker.name}`;
  return `<aside class="piprank-broker-cta piprank-broker-cta-${esc(block.variant || 'primary')}"><strong>${esc(headline)}</strong><a href="${esc(href)}">${esc(buttonLabel)}</a></aside>`;
}

export function blocksToHtmlServer(blocks, brokers = []) {
  const seen = new Map();
  const slug = (value) => {
    const base = String(value || 'section-heading').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'section';
    const count = (seen.get(base) || 0) + 1;
    seen.set(base, count);
    return count > 1 ? `${base}-${count}` : base;
  };

  return (blocks || []).map((block) => {
    if (block.type === 'structured_broker_data') return structuredBrokerHtml(block, brokers);
    if (block.type === 'broker_card') {
      const broker = brokers.find((x) => x.id === Number(block.brokerId));
      return broker ? brokerCardHtml(broker, block.variant || 'default') : '';
    }
    if (block.type === 'broker_grid') {
      return (block.brokerIds || []).map((id) => brokers.find((broker) => broker.id === Number(id))).filter(Boolean).map((broker) => brokerCardHtml(broker, block.variant || 'compact')).join('\n');
    }
    if (block.type === 'comparison_table') return comparisonHtml(block, brokers);
    if (block.type === 'broker_cta') return ctaHtml(block, brokers);
    if (block.type === 'heading') return `<h2 id="${slug(block.title || 'section-heading')}">${esc(block.title || 'Section heading')}</h2>`;
    if (block.type === 'image') return `<figure><img src="${esc(block.src || '')}" alt="${esc(block.alt || '')}" loading="lazy" /><figcaption>${esc(block.alt || '')}</figcaption></figure>`;
    if (block.type === 'table') {
      const rows = block.rows || [['Feature', 'Details'], ['', '']];
      return `<div class="overflow-x-auto"><table><thead><tr>${rows[0].map((cell) => `<th>${esc(cell)}</th>`).join('')}</tr></thead><tbody>${rows.slice(1).map((row) => `<tr>${row.map((cell) => `<td>${esc(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
    }
    if (block.type === 'callout') return `<aside class="piprank-callout piprank-callout-${block.tone || 'neutral'}">${block.html || ''}</aside>`;
    if (block.type === 'links') return `<nav class="piprank-internal-links"><ul>${(block.links || []).map((link) => `<li><a href="${esc(link.href)}">${esc(link.label)}</a></li>`).join('')}</ul></nav>`;
    if (block.type === 'divider') return '<hr />';
    return block.html || '';
  }).join('\n');
}
