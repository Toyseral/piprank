import type { ReactNode } from 'react';

export interface BrokerAnchorItem {
  id: string;
  label: string;
}

interface Props {
  items: BrokerAnchorItem[];
  activeId: string;
  className?: string;
  renderItem?: (item: BrokerAnchorItem, active: boolean) => ReactNode;
}

export const BROKER_ANCHOR_ITEMS: BrokerAnchorItem[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'fees', label: 'Fees' },
  { id: 'platforms', label: 'Platforms' },
  { id: 'regulation', label: 'Trust & regulation' },
  { id: 'accounts', label: 'Accounts' },
  { id: 'funding', label: 'Deposits & withdrawals' },
  { id: 'faq', label: 'FAQ' },
];

export default function BrokerAnchorNavRedesign({ items, activeId, className = '', renderItem }: Props) {
  return (
    <nav
      aria-label="Broker review sections"
      className={`flex gap-1 overflow-x-auto border-b border-line bg-white px-4 py-2 scrollbar-none sm:px-6 ${className}`}
    >
      {items.map((item) => {
        const active = activeId === item.id;
        if (renderItem) return <span key={item.id}>{renderItem(item, active)}</span>;
        return (
          <a
            key={item.id}
            href={`#${item.id}`}
            aria-current={active ? 'true' : undefined}
            className={`whitespace-nowrap rounded-lg px-3.5 py-2 text-sm font-semibold transition ${active ? 'bg-emerald-50 text-emerald-800' : 'text-slate-500 hover:bg-emerald-50 hover:text-emerald-800'}`}
          >
            {item.label}
          </a>
        );
      })}
    </nav>
  );
}
