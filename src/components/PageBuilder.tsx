import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Copy, Database, Eye, GripVertical, Image as ImageIcon, Link2, Plus, Quote, Save, Table2, Trash2, Type } from 'lucide-react';
import RichTextEditor from './RichTextEditor';
import BrokerCard from './BrokerCard';
import type { Broker } from '../lib/types';
import { fetchBrokers } from '../lib/api';
import { fmtMoney } from '../lib/format';
import { INTENT_LABELS, pipRankScore, scoreColors } from '../lib/score';

export type StructuredBrokerSection = 'overview' | 'pricing' | 'trust' | 'platforms' | 'features' | 'editorial';
export type BrokerCardVariant = 'default' | 'compact' | 'featured';
export type BrokerCtaVariant = 'primary' | 'dark' | 'soft';
export type ComparisonField = 'rating' | 'trust_score' | 'min_deposit' | 'spread_eurusd' | 'commission' | 'max_leverage' | 'platforms' | 'payments' | 'regulations';
export type BrokerEditorialSection = 'editorial' | 'pricing' | 'platforms' | 'trust' | 'accounts' | 'funding';
export type BestForEditorialSection = 'introduction' | 'why_these_brokers' | 'who_its_for' | 'who_its_not_for' | 'detailed_analysis' | 'methodology';
export type PageBuilderContext = 'default' | 'guide' | 'best-for' | 'broker-editorial';
export type PageEditorialSection = BrokerEditorialSection | BestForEditorialSection;

export type PageBlock = {
  id: string;
  type: 'richtext' | 'heading' | 'image' | 'table' | 'callout' | 'divider' | 'links' | 'structured_broker_data' | 'broker_card' | 'broker_grid' | 'comparison_table' | 'broker_cta' | 'piprank_verdict';
  title?: string;
  html?: string;
  src?: string;
  alt?: string;
  rows?: string[][];
  tone?: 'neutral' | 'success' | 'warning' | 'dark';
  links?: { label: string; href: string }[];
  brokerId?: number;
  brokerIds?: number[];
  section?: StructuredBrokerSection;
  editorialSection?: PageEditorialSection;
  variant?: BrokerCardVariant | BrokerCtaVariant;
  fields?: ComparisonField[];
  ctaLabel?: string;
  ctaHref?: string;
  headline?: string;
  buttonLabel?: string;
  showCta?: boolean;
};

type Props = {
  value?: unknown[];
  onChange: (blocks: PageBlock[]) => void;
  onUploadImage?: (file: File) => Promise<string>;
  context?: PageBuilderContext;
  editorialSection?: BrokerEditorialSection;
};

const uid = () => `b_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const esc = (v: unknown) => String(v ?? '').replace(/[&<>\"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;', "'": '&#039;' }[c] as string));

const legacyHtmlToBlocks = (html: string): PageBlock[] => {
  if (!html?.trim() || typeof DOMParser === 'undefined') return [];
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return Array.from(doc.body.childNodes).filter(n => n.nodeType === 1 || !!n.textContent?.trim()).map((node: any): PageBlock => {
    const tag = String(node.tagName || '').toLowerCase();
    if (/^h[1-6]$/.test(tag)) return { id: uid(), type: 'heading', title: node.textContent?.trim() || 'Section heading' };
    return { id: uid(), type: 'richtext', html: node.outerHTML || node.textContent || '' };
  });
};

const norm = (value?: unknown[]): PageBlock[] => {
  if (!Array.isArray(value)) return [];
  if (value.length === 1 && (value[0] as any)?.type === 'richtext' && typeof (value[0] as any)?.html === 'string') {
    const legacy = legacyHtmlToBlocks((value[0] as any).html);
    if (legacy.length > 1) return legacy;
  }
  return value.map((b: any) => ({ id: b.id || uid(), type: b.type || 'richtext', ...b }));
};

const sectionLabel = (s: StructuredBrokerSection) => ({ overview: 'Overview', pricing: 'Pricing & trading costs', trust: 'Trust & regulation', platforms: 'Trading platforms', features: 'Features & payments', editorial: 'Editorial highlights' }[s]);
const fieldLabel = (f: ComparisonField) => ({ rating: 'Rating', trust_score: 'Trust score', min_deposit: 'Min. deposit', spread_eurusd: 'EUR/USD spread', commission: 'Commission', max_leverage: 'Max leverage', platforms: 'Platforms', payments: 'Payment methods', regulations: 'Regulation' }[f]);

const brokerField = (b: Broker, f: ComparisonField): string => {
  if (f === 'rating') return `${b.rating ?? ''}/5`;
  if (f === 'trust_score') return String(b.trust_score ?? '');
  if (f === 'min_deposit') return fmtMoney(b.min_deposit);
  if (f === 'spread_eurusd') return `${b.spread_eurusd ?? ''} pips`;
  if (f === 'commission') return String(b.commission ?? '');
  if (f === 'max_leverage') return String(b.max_leverage ?? '');
  if (f === 'platforms') return (b.platforms || []).join(', ') || 'Not listed';
  if (f === 'payments') return (b.payments || []).join(', ') || 'Not listed';
  return (b.regulations || []).map(r => r.body || r.country).filter(Boolean).join(', ') || 'Not listed';
};

function visitHref(b: Broker) {
  return `/go/${encodeURIComponent(b.slug)}?src=${encodeURIComponent(typeof window !== 'undefined' ? window.location.pathname : '')}&page_type=other`;
}

function structuredBrokerHtml(block: PageBlock, brokers: Broker[]) {
  const b = brokers.find(x => x.id === Number(block.brokerId));