import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import Monogram from '../../components/Monogram';
import type { Broker, Promotion } from '../../lib/types';

const PROMO_BADGES = [
  'Welcome offer',
  'Deposit bonus',
  'Rebates',
  'Cashback',
  'Zero-swap',
  'Prop funding',
  'Giveaway',
];

interface PromoForm {
  broker_id: string;
  title: string;
  description: string;
  badge: string;
  terms: string;
  ends_on: string;
  active: boolean;
}

interface PromosTabProps {
  token: string;
  brokers: Broker[];
  notify: (msg: string) => void;
  Toggle: React.ComponentType<{ on: boolean; onToggle: () => void }>;
  DrawerShell: React.ComponentType<{
    title: string;
    onClose: () => void;
    wide?: boolean;
    children: React.ReactNode;
  }>;
  FieldLabel: React.ComponentType<{
    children: React.ReactNode;
    hint?: string;
  }>;
}

function PromosTab({
  token,
  brokers,
  notify,
  Toggle,
  DrawerShell,
  FieldLabel,
}: PromosTabProps) {
  const [rows, setRows] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Promotion | null | 'new'>(null);

  const headers = useMemo(
    () => ({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    }),
    [token]
  );

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/promotions?all=1', { headers });
      const data = await res.json().catch(() => []);
      if (Array.isArray(data)) setRows(data);
    } finally {
      setLoading(false);
    }
  }, [headers]);

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, [load]);

  const api = async (method: string, body: unknown) => {
    const res = await fetch('/api/promotions', {
      method,
      headers,
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error((data as { error?: string }).error || 'Action failed');
    }
  };

  const brokerById = useMemo(
    () => new Map(brokers.map((b) => [b.id, b])),
    [brokers]
  );

  const daysLeft = (ends_on: string | null) =>
    ends_on == null
      ? null
      : Math.ceil(
          (new Date(ends_on + 'T23:59:59Z').getTime() - Date.now()) /
            86400000
        );

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-line bg-white shadow-soft">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <p className="font-display text-base font-bold text-ink-900">
            Live promotions ({rows.filter((r) => r.active).length} active /{' '}
            {rows.length} total)
          </p>
          <button
            onClick={() => setEditing('new')}
            className="inline-flex items-center gap-1.5 rounded-xl bg-amber-400 px-4 py-1.5 text-xs font-bold text-ink-950 transition hover:bg-amber-300"
          >
            <Plus size={14} /> New promotion
          </button>
        </div>

        {loading ? (
          <div className="h-40 animate-pulse" />
        ) : rows.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-400">
            No promotions yet — create the first one.
          </p>
        ) : (
          <div className="divide-y divide-line">
            {rows.map((p) => {
              const b = brokerById.get(p.broker_id);
              const days = daysLeft(p.ends_on);
              const expired = days !== null && days < 0;

              return (
                <div
                  key={p.id}
                  className="flex flex-wrap items-center gap-3 px-5 py-3.5"
                >
                  {b && (
                    <Monogram
                      name={b.name}
                      logoUrl={b.logo_url}
                      color={b.brand_color}
                      size={34}
                      className="rounded-lg"
                    />
                  )}

                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-bold text-ink-900">
                      {p.title}
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700 ring-1 ring-amber-200">
                        {p.badge}
                      </span>

                      {expired && (
                        <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-600 ring-1 ring-rose-200">
                          expired
                        </span>
                      )}

                      {!expired && days !== null && days <= 14 && (
                        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 ring-1 ring-amber-200">
                          {days}d left
                        </span>
                      )}
                    </p>

                    <p className="text-xs text-slate-400">
                      {b?.name ?? `broker #${p.broker_id}`} ·{' '}
                      {p.description.slice(0, 90)}
                      {p.description.length > 90 ? '…' : ''}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={p.ends_on ?? ''}
                      onChange={async (e) => {
                        await api('PUT', {
                          id: p.id,
                          ends_on: e.target.value || null,
                        });
                        await load();
                        notify('Expiry updated');
                      }}
                      className="h-9 rounded-lg border border-line bg-paper px-2 text-xs font-semibold outline-none"
                    />

                    <Toggle
                      on={p.active}
                      onToggle={async () => {
                        await api('PUT', {
                          id: p.id,
                          active: !p.active,
                        });
                        await load();
                      }}
                    />

                    <button
                      onClick={() => setEditing(p)}
                      className="rounded-lg p-2 text-slate-400 transition hover:bg-emerald-50 hover:text-emerald-700"
                      title="Edit"
                    >
                      <Pencil size={15} />
                    </button>

                    <button
                      onClick={async () => {
                        if (
                          !window.confirm(
                            `Delete the promotion "${p.title}"?`
                          )
                        )
                          return;

                        await api('DELETE', { id: p.id });
                        await load();
                        notify('Promotion deleted');
                      }}
                      className="rounded-lg p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                      title="Delete"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <p className="px-5 py-4 text-xs leading-relaxed text-slate-400">
          Live on the public Promotions page instantly when toggled on. Expired
          promos are hidden automatically.
        </p>
      </div>

      {editing && (
        <PromoEditor
          promo={editing === 'new' ? null : editing}
          brokers={brokers}
          Toggle={Toggle}
          DrawerShell={DrawerShell}
          FieldLabel={FieldLabel}
          onClose={() => setEditing(null)}
          onSave={async (fields) => {
            if (editing === 'new') {
              await api('POST', fields);
              notify('Promotion published');
              setEditing(null);
            } else {
              await api('PUT', { id: editing.id, ...fields });
              notify('Promotion saved');
            }

            await load();
          }}
        />
      )}
    </div>
  );
}

function PromoEditor({
  promo,
  brokers,
  Toggle,
  DrawerShell,
  FieldLabel,
  onClose,
  onSave,
}: {
  promo: Promotion | null;
  brokers: Broker[];
  Toggle: React.ComponentType<{ on: boolean; onToggle: () => void }>;
  DrawerShell: React.ComponentType<{
    title: string;
    onClose: () => void;
    wide?: boolean;
    children: React.ReactNode;
  }>;
  FieldLabel: React.ComponentType<{
    children: React.ReactNode;
    hint?: string;
  }>;
  onClose: () => void;
  onSave: (fields: PromoForm) => Promise<void>;
}) {
  const [form, setForm] = useState<PromoForm>(() =>
    promo
      ? {
          broker_id: String(promo.broker_id),
          title: promo.title,
          description: promo.description,
          badge: promo.badge,
          terms: promo.terms,
          ends_on: promo.ends_on ?? '',
          active: promo.active,
        }
      : {
          broker_id: String(brokers[0]?.id ?? ''),
          title: '',
          description: '',
          badge: 'Welcome offer',
          terms: '',
          ends_on: '',
          active: true,
        }
  );

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const submit = async () => {
    if (!form.broker_id) return setErr('Pick a broker.');
    if (form.title.trim().length < 4) {
      return setErr('Promotion title is required.');
    }

    setBusy(true);
    try {
      await onSave({ ...form, broker_id: String(form.broker_id) });
    } finally {
      setBusy(false);
    }
  };

  const inputCls =
    'h-10 w-full rounded-xl border border-line bg-paper px-3 text-sm font-medium outline-none transition focus:border-emerald-500';

  return (
    <DrawerShell
      title={promo ? 'Edit promotion' : 'New promotion'}
      onClose={onClose}
      wide
    >
      <div className="space-y-4">
        {err && (
          <p className="rounded-xl bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-600">
            {err}
          </p>
        )}

        <div className="grid grid-cols-2 gap-3">
          <label className="col-span-2 block">
            <FieldLabel>Broker</FieldLabel>
            <select
              value={form.broker_id}
              onChange={(e) =>
                setForm({ ...form, broker_id: e.target.value })
              }
              className={inputCls}
            >
              {brokers.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <FieldLabel>Badge</FieldLabel>
            <select
              value={form.badge}
              onChange={(e) => setForm({ ...form, badge: e.target.value })}
              className={inputCls}
            >
              {PROMO_BADGES.map((b) => (
                <option key={b}>{b}</option>
              ))}
            </select>
          </label>

          <label className="block">
            <FieldLabel hint="blank = open-ended">Ends on</FieldLabel>
            <input
              type="date"
              value={form.ends_on}
              onChange={(e) =>
                setForm({ ...form, ends_on: e.target.value })
              }
              className={`tnum ${inputCls}`}
            />
          </label>

          <label className="col-span-2 block">
            <FieldLabel>Title</FieldLabel>
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className={inputCls}
              placeholder="e.g. $30 no-deposit welcome account"
            />
          </label>

          <label className="col-span-2 block">
            <FieldLabel>Description</FieldLabel>
            <textarea
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
              rows={3}
              className="w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-sm outline-none focus:border-emerald-500"
              placeholder="What the visitor receives — concrete numbers, no fluff."
            />
          </label>

          <label className="col-span-2 block">
            <FieldLabel hint="shown verbatim as fine print">Terms</FieldLabel>
            <textarea
              value={form.terms}
              onChange={(e) => setForm({ ...form, terms: e.target.value })}
              rows={2}
              className="w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-sm outline-none focus:border-emerald-500"
              placeholder="Eligibility, volume conditions, entity restrictions…"
            />
          </label>

          <label className="col-span-2 flex cursor-pointer items-center gap-3 rounded-xl border border-line bg-paper px-4 py-3">
            <Toggle
              on={form.active}
              onToggle={() => setForm({ ...form, active: !form.active })}
            />
            <div>
              <p className="text-sm font-semibold text-ink-900">
                Promotion is live
              </p>
              <p className="text-xs text-slate-400">
                Visible on the public site when on (and not expired)
              </p>
            </div>
          </label>
        </div>

        <button
          onClick={submit}
          disabled={busy}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-ink-950 text-sm font-bold text-white transition hover:bg-ink-800 disabled:opacity-60"
        >
          {busy && <Loader2 size={15} className="animate-spin" />}
          {promo ? 'Save promotion' : 'Publish promotion'}
        </button>
      </div>
    </DrawerShell>
  );
}

export default PromosTab;
