import type { Broker } from '../lib/types';

export type StructuredBrokerSection = 'overview' | 'pricing' | 'trust' | 'platforms' | 'features' | 'editorial' | 'faq_lab';

const labels: Record<StructuredBrokerSection, string> = {
  overview: 'Broker overview',
  pricing: 'Pricing & trading costs',
  trust: 'Trust, regulation & safety',
  platforms: 'Trading platforms',
  features: 'Features & account options',
  editorial: 'Editorial verdict & best-for data',
  faq_lab: 'FAQ & testing data',
};

function esc(value: unknown) {
  return String(value ?? '').replace(/[&<>\"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;', "'": '&#039;' }[c] as string));
}

export function structuredBrokerDataHtml(broker: Broker, section: StructuredBrokerSection): string {
  const rows: Array<[string, string]> = [];
  if (section === 'overview') {
    rows.push(['Rating', `${Number(broker.rating || 0).toFixed(1)}/5`], ['Trust score', `${Number(broker.trust_score || 0)}/100`], ['Founded', String(broker.founded || '—')], ['Headquarters', broker.headquarters || '—'], ['Demo account', broker.demo_account ? 'Yes' : 'No']);
  }
  if (section === 'pricing') {
    rows.push(['Minimum deposit', `$${broker.min_deposit ?? '—'}`], ['EUR/USD spread', `${broker.spread_eurusd ?? '—'} pips`], ['Commission', broker.commission || '—'], ['Maximum leverage', broker.max_leverage || '—'], ['Withdrawal fee', `$${broker.withdrawal_fee ?? 0}`]);
  }
  if (section === 'trust') {
    rows.push(['Trust score', `${Number(broker.trust_score || 0)}/100`], ['Regulation', (broker.regulations || []).map((r) => r.body || r.country).filter(Boolean).join(', ') || '—'], ['Segregated funds', broker.segregated ? 'Yes' : 'No'], ['Negative balance protection', broker.nbp ? 'Yes' : 'No']);
  }
  if (section === 'platforms') rows.push(['Platforms', (broker.platforms || []).join(', ') || '—'], ['Account types', (broker.account_types || []).join(', ') || '—'], ['Copy trading', broker.copy_trading ? 'Available' : 'Not listed']);
  if (section === 'features') rows.push(['Best for', (broker.best_for || []).join(', ') || '—'], ['Islamic account', broker.islamic_account ? 'Available' : 'Not listed'], ['Scalping', broker.scalping ? 'Allowed' : 'Not listed'], ['Hedging', broker.hedging ? 'Allowed' : 'Not listed'], ['Payment methods', (broker.payments || []).join(', ') || '—']);
  if (section === 'editorial') rows.push(['Tagline', broker.tagline || '—'], ['Best for', (broker.best_for || []).join(', ') || '—'], ['Pros', (broker.pros || []).join(' • ') || '—'], ['Cons', (broker.cons || []).join(' • ') || '—']);
  if (section === 'faq_lab') rows.push(['FAQs', String((broker.faqs || []).length)], ['Testing records', String((broker.testing || []).length)], ['Withdrawal time', `${broker.withdrawal_hours ?? '—'} hours`], ['Support score', `${broker.support_score ?? '—'}/100`]);
  return `<section class="piprank-structured-broker-data" data-broker-id="${esc(broker.id)}" data-section="${esc(section)}"><div class="piprank-structured-broker-data-head"><span>Structured broker data</span><strong>${esc(labels[section])}</strong></div><div class="overflow-x-auto"><table><tbody>${rows.map(([label, value]) => `<tr><th>${esc(label)}</th><td>${esc(value)}</td></tr>`).join('')}</tbody></table></div></section>`;
}

export default function StructuredBrokerDataBlock({ broker, section }: { broker: Broker; section: StructuredBrokerSection }) {
  return <div className="piprank-rich-content" dangerouslySetInnerHTML={{ __html: structuredBrokerDataHtml(broker, section) }} />;
}
