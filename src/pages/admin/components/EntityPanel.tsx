import { ShieldCheck } from 'lucide-react';

export default function EntityPanel({
  title,
  items,
}: {
  title: string;
  items: string[];
}) {
  return (
    <div className="rounded-2xl border border-line bg-white p-5">
      <h3 className="font-display text-lg font-bold text-ink-900">{title}</h3>

      <ul className="mt-3 space-y-2">
        {items.map((item) => (
          <li
            key={item}
            className="flex items-start gap-2 text-sm text-slate-600"
          >
            <ShieldCheck size={14} className="mt-0.5 text-emerald-500" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
