import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import type { Broker } from '../../lib/types';

interface AffiliateLink {
  id: number;
  broker_id: number;
  country_code: string | null;
  affiliate_url: string;
  direct_url: string | null;
  tracking_params: Record<string, string>;
  network: string | null;
  active: boolean;
  cpa_notes: string | null;
}

interface AffiliateLinksTabProps {
  token: string;
  brokers: Broker[];
  notify: (msg: string) => void;
  DrawerShell: React.ComponentType<{
    title: string;
    onClose: () => void;
    children: React.ReactNode;
  }>;
}

export default function AffiliateLinksTab({
  token,
  brokers,
  notify,
  DrawerShell,
}: AffiliateLinksTabProps) {
  const [brokerId, setBrokerId] = useState<number | null>(brokers[0]?.id ?? null);
  const [links, setLinks] = useState<AffiliateLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<AffiliateLink | 'new' | null>(null);

  const headers = useMemo(
    () => ({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    }),
    [token]
  );

  const load = useCallback(async () => {
    if (!brokerId) return;

    setLoading(true);

    try {
      const res = await fetch(
        `/api/affiliate-links?resource=links&broker_id=${brokerId}`,
        { headers }
      );
      const data = await res.json().catch(() => []);

      if (Array.isArray(data)) setLinks(data);
    } finally {
      setLoading(false);
    }
  }, [brokerId, headers]);

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, [load]);

  const api = async (method: string, body: unknown) => {
    const res = await fetch('/api/affiliate-links?resource=links', {
      method,
      headers,
      body: JSON.stringify(body),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(
        (data as { error?: string }).error || 'Action failed'
      );
    }
  };

  const globalRow = links.find((l) => l.country_code === null);
  const countryRows = links.filter((l) => l.country_code !== null);
  const selectedBroker = brokers.find((b) => b.id === brokerId);

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-line bg-white p-5 shadow-soft">
        <p className="font-display text-base font-bold text-ink-900">
          Affiliate link management
        </p>

        <p className="mt-1 text-xs text-slate-500">
          Every outbound CTA on the site routes through{' '}
          <code className="rounded bg-paper px-1 py-0.5">
            /go/&#123;slug&#125;
          </code>
          , which resolves to the country-specific URL below if one exists
          for the visitor, otherwise the global URL. CPA notes are private —
          never exposed on any public page or API response.
        </p>

        <select
          value={brokerId ?? ''}
          onChange={(e) => setBrokerId(Number(e.target.value) || null)}
          className="mt-4 h-10 w-full max-w-sm rounded-xl border border-line bg-white px-3 text-sm font-semibold text-ink-900 outline-none focus:border-emerald-500 sm:w-auto"
        >
          {brokers.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="h-40 animate-pulse rounded-2xl border border-line bg-white" />
      ) : (
        <div className="rounded-2xl border border-line bg-white shadow-soft">
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <p className="font-display text-sm font-bold text-ink-900">
              {selectedBroker?.name} — routing
            </p>

            <button
              onClick={() => setEditing('new')}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white transition hover:bg-emerald-700"
            >
              <Plus size={14} />
              Add country override
            </button>
          </div>

          <div className="divide-y divide-line">
            <div className="flex flex-wrap items-center gap-3 px-5 py-3.5">
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                Global
              </span>

              <div className="min-w-0 flex-1">
                {globalRow ? (
                  <>
                    <p className="truncate text-xs font-mono text-slate-600">
                      {globalRow.affiliate_url}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      {globalRow.network || 'No network set'} ·{' '}
                      {globalRow.active ? 'Active' : 'Inactive'}
                    </p>
                  </>
                ) : (
                  <p className="text-xs text-rose-500">
                    No global URL configured — /go/ falls back to the legacy
                    broker.affiliate_url or website field.
                  </p>
                )}
              </div>

              <button
                onClick={() =>
                  setEditing(
                    globalRow ?? {
                      id: 0,
                      broker_id: brokerId!,
                      country_code: null,
                      affiliate_url: '',
                      direct_url: null,
                      tracking_params: {},
                      network: null,
                      active: true,
                      cpa_notes: null,
                    }
                  )
                }
                className="rounded-lg p-2 text-slate-400 transition hover:bg-paper hover:text-ink-900"
              >
                <Pencil size={14} />
              </button>
            </div>

            {countryRows.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-slate-400">
                No country-specific overrides yet.
              </p>
            ) : (
              countryRows.map((l) => (
                <div
                  key={l.id}
                  className="flex flex-wrap items-center gap-3 px-5 py-3.5"
                >
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-700">
                    {l.country_code}
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-mono text-slate-600">
                      {l.affiliate_url}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      {l.network || 'No network set'} ·{' '}
                      {l.active ? 'Active' : 'Inactive'}
                    </p>
                  </div>

                  <button
                    onClick={() => setEditing(l)}
                    className="rounded-lg p-2 text-slate-400 transition hover:bg-paper hover:text-ink-900"
                  >
                    <Pencil size={14} />
                  </button>

                  <button
                    onClick={async () => {
                      if (
                        !window.confirm(
                          `Remove the ${l.country_code} override for ${selectedBroker?.name}?`
                        )
                      ) {
                        return;
                      }

                      await api('DELETE', { id: l.id });
                      notify('Country override removed');
                      await load();
                    }}
                    className="rounded-lg p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {editing && brokerId && (
        <AffiliateLinkEditor
          link={editing}
          brokerId={brokerId}
          onClose={() => setEditing(null)}
          onSave={async (payload) => {
            try {
              if (
                editing === 'new' ||
                !('id' in editing) ||
                !editing.id
              ) {
                await api('POST', payload);
                notify('Affiliate link created');
              } else {
                await api('PUT', { id: editing.id, ...payload });
                notify('Affiliate link updated');
              }

              setEditing(null);
              await load();
            } catch (e) {
              alert(e instanceof Error ? e.message : 'Save failed');
            }
          }}
          DrawerShell={DrawerShell}
        />
      )}
    </div>
  );
}

function AffiliateLinkEditor({
  link,
  brokerId,
  onClose,
  onSave,
  DrawerShell,
}: {
  link: AffiliateLink | 'new';
  brokerId: number;
  onClose: () => void;
  onSave: (payload: Record<string, unknown>) => void;
  DrawerShell: React.ComponentType<{
    title: string;
    onClose: () => void;
    children: React.ReactNode;
  }>;
}) {
  const initial = link === 'new' ? null : link;

  const [countryCode, setCountryCode] = useState(
    initial?.country_code ?? ''
  );
  const [affiliateUrl, setAffiliateUrl] = useState(
    initial?.affiliate_url ?? ''
  );
  const [directUrl, setDirectUrl] = useState(initial?.direct_url ?? '');
  const [network, setNetwork] = useState(initial?.network ?? '');
  const [active, setActive] = useState(initial?.active ?? true);
  const [trackingParamsRaw, setTrackingParamsRaw] = useState(
    initial?.tracking_params
      ? JSON.stringify(initial.tracking_params, null, 2)
      : '{}'
  );
  const [cpaNotes, setCpaNotes] = useState(initial?.cpa_notes ?? '');
  const [paramsError, setParamsError] = useState('');

  const submit = () => {
    let trackingParams: Record<string, string> = {};

    try {
      trackingParams = trackingParamsRaw.trim()
        ? JSON.parse(trackingParamsRaw)
        : {};
      setParamsError('');
    } catch {
      setParamsError(
        'Tracking params must be valid JSON, e.g. {"subid": "piprank"}'
      );
      return;
    }

    if (
      !affiliateUrl.trim() ||
      !/^https?:\/\//i.test(affiliateUrl.trim())
    ) {
      alert(
        'A valid affiliate URL (starting with http:// or https://) is required.'
      );
      return;
    }

    onSave({
      broker_id: brokerId,
      country_code: countryCode.trim()
        ? countryCode.trim().toUpperCase()
        : null,
      affiliate_url: affiliateUrl.trim(),
      direct_url: directUrl.trim() || null,
      network: network.trim() || null,
      active,
      tracking_params: trackingParams,
      cpa_notes: cpaNotes.trim() || null,
    });
  };

  return (
    <DrawerShell
      title={
        initial?.country_code
          ? `Edit ${initial.country_code} override`
          : initial
            ? 'Edit global URL'
            : 'New country override'
      }
      onClose={onClose}
    >
      <div className="space-y-4">
        <div>
          <label className="text-xs font-bold text-slate-600">
            Country code (ISO 3166-1 alpha-2, e.g. ZA) — leave blank for the
            global/default URL
          </label>

          <input
            value={countryCode}
            onChange={(e) => setCountryCode(e.target.value)}
            placeholder="e.g. NG, GB, ZA — blank = global"
            maxLength={2}
            className="mt-1 h-10 w-full rounded-xl border border-line bg-white px-3 text-sm font-mono uppercase outline-none focus:border-emerald-500"
          />
        </div>

        <div>
          <label className="text-xs font-bold text-slate-600">
            Affiliate URL (tracked link, used by /go/)
          </label>

          <input
            value={affiliateUrl}
            onChange={(e) => setAffiliateUrl(e.target.value)}
            placeholder="https://affiliate.example.com/click?id=..."
            className="mt-1 h-10 w-full rounded-xl border border-line bg-white px-3 text-sm font-mono outline-none focus:border-emerald-500"
          />
        </div>

        <div>
          <label className="text-xs font-bold text-slate-600">
            Direct account-opening URL (optional, not currently used by /go/ —
            for reference)
          </label>

          <input
            value={directUrl}
            onChange={(e) => setDirectUrl(e.target.value)}
            placeholder="https://broker.example.com/open-account"
            className="mt-1 h-10 w-full rounded-xl border border-line bg-white px-3 text-sm font-mono outline-none focus:border-emerald-500"
          />
        </div>

        <div>
          <label className="text-xs font-bold text-slate-600">
            Affiliate network / program
          </label>

          <input
            value={network}
            onChange={(e) => setNetwork(e.target.value)}
            placeholder="e.g. In-house CPA, CellXpert, Everflow"
            className="mt-1 h-10 w-full rounded-xl border border-line bg-white px-3 text-sm outline-none focus:border-emerald-500"
          />
        </div>

        <div>
          <label className="text-xs font-bold text-slate-600">
            Tracking params (JSON — values may include the literal token{' '}
            <code>&#123;click_id&#125;</code>)
          </label>

          <textarea
            value={trackingParamsRaw}
            onChange={(e) => setTrackingParamsRaw(e.target.value)}
            rows={3}
            placeholder={'{ "subid": "piprank", "clickref": "{click_id}" }'}
            className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-2 text-xs font-mono outline-none focus:border-emerald-500"
          />

          {paramsError && (
            <p className="mt-1 text-xs text-rose-500">{paramsError}</p>
          )}
        </div>

        <div>
          <label className="flex items-center gap-2 text-xs font-bold text-slate-600">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              className="h-4 w-4 rounded"
            />
            Active — inactive rows are skipped by the /go/ resolver
          </label>
        </div>

        <div>
          <label className="text-xs font-bold text-slate-600">
            CPA notes — private, never shown publicly
          </label>

          <textarea
            value={cpaNotes}
            onChange={(e) => setCpaNotes(e.target.value)}
            rows={3}
            placeholder="Commission structure, payout terms, contact at the network, etc."
            className="mt-1 w-full rounded-xl border border-amber-200 bg-amber-50/40 px-3 py-2 text-xs outline-none focus:border-amber-400"
          />
        </div>

        <button
          onClick={submit}
          className="w-full rounded-xl bg-emerald-600 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-700"
        >
          Save
        </button>
      </div>
    </DrawerShell>
  );
}
