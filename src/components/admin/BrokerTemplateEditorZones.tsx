import { LockKeyhole, Plus } from 'lucide-react';
import type { PageBlock } from '../PageBuilder';
import PageBuilder from '../PageBuilder';

type Zone = {
  id: string;
  title: string;
  system: boolean;
  description: string;
};

export const BROKER_TEMPLATE_ZONES: Zone[] = [
  { id: 'hero', title: 'HERO', system: true, description: 'Fixed broker identity, rating, trust and primary visit CTA.' },
  { id: 'overview', title: 'OVERVIEW', system: true, description: 'Structured broker data. Edit the source broker record.' },
  { id: 'editorial', title: 'CONTENT', system: false, description: 'Editable PageBuilder content.' },
  { id: 'pricing', title: 'PRICING', system: true, description: 'Structured pricing and trading-cost data.' },
  { id: 'pricing-content', title: 'PRICING CONTENT', system: false, description: 'Editable PageBuilder content around pricing.' },
  { id: 'platforms', title: 'PLATFORMS', system: true, description: 'Structured platform data.' },
  { id: 'platform-content', title: 'PLATFORM CONTENT', system: false, description: 'Editable PageBuilder content around platforms.' },
  { id: 'trust', title: 'TRUST & REGULATION', system: true, description: 'Structured regulation and trust data.' },
  { id: 'trust-content', title: 'TRUST CONTENT', system: false, description: 'Editable PageBuilder content around trust.' },
  { id: 'editorial-after-trust', title: 'CONTENT', system: false, description: 'Additional editable PageBuilder content.' },
  { id: 'faq', title: 'FAQ', system: true, description: 'Structured FAQ data.' },
  { id: 'final-cta', title: 'FINAL CTA', system: true, description: 'Fixed broker visit CTA.' },
];

type Props = {
  blocks: PageBlock[];
  onChange: (blocks: PageBlock[]) => void;
  onEditBroker?: () => void;
  onUploadImage?: (file: File) => Promise<string>;
};

function ZoneHeader({ zone, onEditBroker }: { zone: Zone; onEditBroker?: () => void }) {
  return <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-paper px-4 py-3"><div className="flex items-center gap-2"><span className={`text-xs font-extrabold tracking-widest ${zone.system ? 'text-slate-500' : 'text-emerald-700'}`}>{zone.title}</span>{zone.system && <LockKeyhole size={13} className="text-slate-400" />}</div>{zone.id === 'overview' && onEditBroker ? <button type="button" onClick={onEditBroker} className="rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-bold text-ink-900 hover:border-emerald-300">Edit Broker Data</button> : !zone.system ? <span className="text-[11px] font-medium text-slate-500">{zone.description}</span> : null}</div>;
}

export default function BrokerTemplateEditorZones({ blocks, onChange, onEditBroker, onUploadImage }: Props) {
  return <div className="space-y-4">
    {BROKER_TEMPLATE_ZONES.map((zone) => {
      const zoneBlocks = blocks.filter((block: any) => block.zone === zone.id);
      return <section key={zone.id} className="overflow-hidden rounded-2xl border border-line bg-white shadow-sm">
        <ZoneHeader zone={zone} onEditBroker={onEditBroker} />
        {zone.system ? <div className="px-4 py-4 text-sm text-slate-500">{zone.description}</div> : <div className="p-4"><PageBuilder value={zoneBlocks} onChange={(next) => { const rest = blocks.filter((block: any) => block.zone !== zone.id); onChange([...rest, ...next.map((block) => ({ ...block, zone: zone.id }))]); }} onUploadImage={onUploadImage} /><button type="button" className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700"><Plus size={14} />Add Block</button></div>}
      </section>;
    })}
  </div>;
}
