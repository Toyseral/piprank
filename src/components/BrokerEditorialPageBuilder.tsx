import { useEffect, useMemo, useState } from 'react';
import PageBuilder, { type PageBlock } from './PageBuilder';
import type { Broker } from '../lib/types';
import { fetchBrokers } from '../lib/api';

type Props = {
  value?: unknown[];
  onChange: (blocks: PageBlock[]) => void;
  onUploadImage?: (file: File) => Promise<string>;
};

const STRUCTURED_SECTIONS: { label: string; managedBy: string }[] = [
  { label: 'Fees & Commissions', managedBy: 'Broker Editor → Pricing' },
  { label: 'Trading Platforms', managedBy: 'Broker Editor → Pricing' },
  { label: 'Trust & Regulation', managedBy: 'Broker Editor → Trust' },
  { label: 'Account Types', managedBy: 'Broker Editor → Basics' },
  { label: 'Deposits & Withdrawals', managedBy: 'Broker Editor → Pricing' },
];

function findBrokerId(value?: unknown[]) {
  if (!Array.isArray(value)) return null;
  const block = value.find(
    (item) =>
      item &&
      typeof item === 'object' &&
      (item as any).type === 'structured_broker_data' &&
      (item as any).brokerId != null
  ) as any;
  return block?.brokerId != null ? Number(block.brokerId) : null;
}

export default function BrokerEditorialPageBuilder({
  value,
  onChange,
  onUploadImage,
}: Props) {
  const brokerId = useMemo(() => findBrokerId(value), [value]);
  const [brokerName, setBrokerName] = useState('Broker');

  useEffect(() => {
    let active = true;

    fetchBrokers()
      .then((brokers: Broker[]) => {
        if (!active || brokerId == null) return;
        const broker = brokers.find((item) => Number(item.id) === brokerId);
        if (broker) setBrokerName(broker.name);
      })
      .catch(() => {
        // The editor remains usable even when broker lookup fails.
      });

    return () => {
      active = false;
    };
  }, [brokerId]);

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-2xl border border-emerald-200 bg-white shadow-sm">
        <div className="border-b border-emerald-100 bg-emerald-50/70 px-4 py-3.5 sm:px-5">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-emerald-700">
            Broker page structure
          </p>
          <h3 className="mt-1 font-display text-lg font-bold text-ink-950 sm:text-xl">
            {brokerName} — In-depth analysis
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">
            You are editing the editorial content that appears in this section of the public broker review.
            The structured sections below are managed from the Broker Editor and are shown here for context only.
          </p>
        </div>

        <div className="grid gap-2 p-3 sm:grid-cols-2 sm:p-4">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 px-3.5 py-3 sm:col-span-2">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-emerald-700">
              Currently editing
            </p>
            <p className="mt-1 text-sm font-bold text-ink-900">In-depth {brokerName} analysis</p>
            <p className="mt-0.5 text-xs text-slate-500">Your PageBuilder content is rendered here on the live broker page.</p>
          </div>

          {STRUCTURED_SECTIONS.map((section) => (
            <div key={section.label} className="rounded-xl border border-line bg-paper px-3.5 py-3">
              <p className="text-sm font-bold text-ink-900">{section.label}</p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">
                Structured data · {section.managedBy}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-line bg-white p-3 sm:p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-bold text-ink-900">Editorial content</p>
            <p className="text-xs text-slate-500">
              Add and reorder text, headings, broker cards, comparisons, CTAs, verdicts, images and other editorial blocks.
            </p>
          </div>
          <span className="rounded-full border border-slate-200 bg-paper px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">
            In-depth {brokerName} analysis
          </span>
        </div>

        <PageBuilder
          value={value}
          onChange={onChange}
          onUploadImage={onUploadImage}
          context="broker-editorial"
        />
      </div>
    </div>
  );
}
