import { useState, type ReactNode } from 'react';
import { Loader2, Plus } from 'lucide-react';
import type { ComponentType } from 'react';
import type { Broker, CountryPage, FAQ } from '../../../lib/types';

type CountryForm = {
  name: string;
  flag: string;
  subtitle: string;
  intro: string[];
  facts: { label: string; value: string }[];
  recommended: { slug: string; note: string }[];
  unavailable: string[];
  seo_title: string;
  seo_description: string;
  seo_intro: string[];
  seo_sections: { heading: string; body: string[]; bullets?: string[] }[];
  seo_faqs: FAQ[];
  publishing_state: 'draft' | 'published' | 'closed';
};

const FLAG_PRESETS = [
  '🌍',
  '🇬🇧',
  '🇺🇸',
  '🇦🇺',
  '🇮🇳',
  '🇸🇬',
  '🇦🇪',
  '🇩🇪',
  '🇿🇦',
  '🇳🇬',
  '🇰🇪',
  '🇬🇭',
  '🇨🇦',
  '🇧🇷',
  '🇫🇷',
  '🇪🇸',
  '🇳🇱',
  '🇵🇱',
  '🇿🇲',
  '🇹🇿',
  '🇷🇼',
  '🇺🇬',
];

const EMPTY_COUNTRY: CountryForm = {
  name: '',
  flag: '\u{1F30D}',
  subtitle: '',
  intro: [],
  facts: [],
  recommended: [],
  unavailable: [],
  seo_title: '',
  seo_description: '',
  seo_intro: [],
  seo_sections: [],
  seo_faqs: [],
  publishing_state: 'published',
};

type FieldLabelProps = {
  children: ReactNode;
  hint?: string;
};

type TextInputProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
};

type StringListProps = {
  label: string;
  hint?: string;
  items: string[];
  onChange: (value: string[]) => void;
  textarea?: boolean;
  placeholder?: string;
};

type IconRemoveProps = {
  onClick: () => void;
};

type SeoSectionsEditorProps = {
  label: string;
  hint?: string;
  sections: { heading: string; body: string[]; bullets?: string[] }[];
  onChange: (
    sections: { heading: string; body: string[]; bullets?: string[] }[]
  ) => void;
};

type FaqListEditorProps = {
  label: string;
  hint?: string;
  faqs: FAQ[];
  onChange: (faqs: FAQ[]) => void;
};

type DrawerShellProps = {
  title: string;
  onClose: () => void;
  wide?: boolean;
  children: ReactNode;
};

export default function CountryEditor({
  country,
  brokers,
  onClose,
  onSave,
  DrawerShell,
  FieldLabel,
  TextInput,
  StringList,
  IconRemove,
  SeoSectionsEditor,
  FaqListEditor,
}: {
  country: CountryPage | null;
  brokers: Broker[];
  onClose: () => void;
  onSave: (
    fields: Record<string, unknown>,
    isNew: boolean
  ) => Promise<void>;
  DrawerShell: ComponentType<DrawerShellProps>;
  FieldLabel: ComponentType<FieldLabelProps>;
  TextInput: ComponentType<TextInputProps>;
  StringList: ComponentType<StringListProps>;
  IconRemove: ComponentType<IconRemoveProps>;
  SeoSectionsEditor: ComponentType<SeoSectionsEditorProps>;
  FaqListEditor: ComponentType<FaqListEditorProps>;
}) {
  const [form, setForm] = useState<CountryForm>(() =>
    country
      ? JSON.parse(JSON.stringify({ ...EMPTY_COUNTRY, ...country }))
      : JSON.parse(JSON.stringify(EMPTY_COUNTRY))
  );

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const setRec = (
    i: number,
    patch: Partial<{ slug: string; note: string }>
  ) =>
    setForm((f) => ({
      ...f,
      recommended: f.recommended.map((r, xi) =>
        xi === i ? { ...r, ...patch } : r
      ),
    }));

  const submit = async () => {
    if (form.name.trim().length < 2) {
      return setErr('Country name is required.');
    }

    setBusy(true);

    try {
      const out: Record<string, unknown> = { ...form };

      if (country) {
        out.id = country.id;
      }

      await onSave(out, !country);
    } finally {
      setBusy(false);
    }
  };

  return (
    <DrawerShell
      title={country ? `Edit ${country.name}` : 'New country guide'}
      onClose={onClose}
      wide
    >
      <div className="space-y-4">
        {err && (
          <p className="rounded-xl bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-600">
            {err}
          </p>
        )}

        <div className="grid grid-cols-[72px_1fr] gap-3">
          <label className="block">
            <FieldLabel>Flag</FieldLabel>
            <input
              value={form.flag}
              onChange={(e) =>
                setForm({ ...form, flag: e.target.value })
              }
              className="h-11 w-full rounded-xl border border-line bg-paper text-center text-2xl outline-none focus:border-emerald-500"
            />
          </label>

          <label className="block">
            <FieldLabel>Country name</FieldLabel>
            <TextInput
              value={form.name}
              onChange={(v) => setForm({ ...form, name: v })}
              placeholder="e.g. Nigeria"
            />
          </label>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {FLAG_PRESETS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setForm({ ...form, flag: f })}
              className={`rounded-lg px-2 py-1 text-lg transition ${
                form.flag === f
                  ? 'bg-emerald-100 ring-2 ring-emerald-500/40'
                  : 'bg-paper hover:bg-white'
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        <label className="block">
          <FieldLabel hint="Country-level publishing state">
            Publishing state
          </FieldLabel>

          <select
            value={form.publishing_state}
            onChange={(e) =>
              setForm({
                ...form,
                publishing_state: e.target.value as
                  | 'draft'
                  | 'published'
                  | 'closed',
              })
            }
            className="h-11 w-full rounded-xl border border-line bg-paper px-3 text-sm font-bold outline-none focus:border-emerald-500"
          >
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="closed">Closed</option>
          </select>
        </label>

        <label className="block">
          <FieldLabel hint="bold line under the page title">
            Subtitle
          </FieldLabel>

          <TextInput
            value={form.subtitle}
            onChange={(v) => setForm({ ...form, subtitle: v })}
            placeholder="e.g. Africa's forex capital — proven NGN funding and fast payouts"
          />
        </label>

        <StringList
          label="Intro paragraphs"
          hint="local context: regulation, funding, tax — 1-2 paragraphs"
          items={form.intro}
          onChange={(v) => setForm({ ...form, intro: v })}
          textarea
          placeholder="Write a paragraph about trading from this country…"
        />

        <div className="rounded-xl border border-line bg-paper p-4">
          <FieldLabel hint="the 4 fact cards under the hero">
            Country facts
          </FieldLabel>

          <div className="mt-2 space-y-2">
            {form.facts.map((f, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  value={f.label}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      facts: form.facts.map((x, xi) =>
                        xi === i
                          ? { ...x, label: e.target.value }
                          : x
                      ),
                    })
                  }
                  placeholder="Regulator"
                  className="h-10 w-32 rounded-xl border border-line bg-white px-3 text-sm font-medium outline-none focus:border-emerald-500"
                />

                <input
                  value={f.value}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      facts: form.facts.map((x, xi) =>
                        xi === i
                          ? { ...x, value: e.target.value }
                          : x
                      ),
                    })
                  }
                  placeholder="SEC Nigeria — no local CFD licence"
                  className="h-10 flex-1 rounded-xl border border-line bg-white px-3 text-sm outline-none focus:border-emerald-500"
                />

                <IconRemove
                  onClick={() =>
                    setForm({
                      ...form,
                      facts: form.facts.filter(
                        (_, xi) => xi !== i
                      ),
                    })
                  }
                />
              </div>
            ))}

            <button
              type="button"
              onClick={() =>
                setForm({
                  ...form,
                  facts: [
                    ...form.facts,
                    { label: '', value: '' },
                  ],
                })
              }
              className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-line px-3 py-2 text-xs font-bold text-slate-500 transition hover:border-emerald-500 hover:text-emerald-700"
            >
              <Plus size={13} /> Add fact
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
          <FieldLabel hint="ranked list — top entry shows the crown">
            Recommended brokers for this country
          </FieldLabel>

          <div className="mt-2 space-y-2.5">
            {form.recommended.map((r, i) => (
              <div
                key={i}
                className="space-y-1.5 rounded-xl border border-line bg-white p-3"
              >
                <div className="flex items-center gap-2">
                  <span className="tnum w-5 text-center text-xs font-bold text-slate-400">
                    {i + 1}
                  </span>

                  <select
                    value={r.slug}
                    onChange={(e) =>
                      setRec(i, { slug: e.target.value })
                    }
                    className="h-9 flex-1 rounded-xl border border-line bg-paper px-2.5 text-sm font-semibold outline-none focus:border-emerald-500"
                  >
                    <option value="">Pick a broker…</option>

                    {brokers.map((b) => (
                      <option key={b.slug} value={b.slug}>
                        {b.name}
                      </option>
                    ))}
                  </select>

                  <IconRemove
                    onClick={() =>
                      setForm({
                        ...form,
                        recommended:
                          form.recommended.filter(
                            (_, xi) => xi !== i
                          ),
                      })
                    }
                  />
                </div>

                <input
                  value={r.note}
                  onChange={(e) =>
                    setRec(i, { note: e.target.value })
                  }
                  placeholder="Why it ranks here — e.g. 'FSCA entity with instant NGN withdrawals'"
                  className="h-9 w-full rounded-xl border border-line bg-paper px-3 text-xs outline-none focus:border-emerald-500"
                />
              </div>
            ))}

            <button
              type="button"
              onClick={() =>
                setForm({
                  ...form,
                  recommended: [
                    ...form.recommended,
                    { slug: '', note: '' },
                  ],
                })
              }
              className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-emerald-300 px-3 py-2 text-xs font-bold text-emerald-700 transition hover:border-emerald-500"
            >
              <Plus size={13} /> Add recommended broker
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-line bg-paper p-4">
          <FieldLabel hint="shown stricken — they can't onboard residents">
            Does NOT onboard this country
          </FieldLabel>

          <div className="mt-2 flex flex-wrap gap-2">
            {brokers.map((b) => {
              const on = form.unavailable.includes(b.slug);

              return (
                <button
                  type="button"
                  key={b.slug}
                  onClick={() =>
                    setForm({
                      ...form,
                      unavailable: on
                        ? form.unavailable.filter(
                            (s) => s !== b.slug
                          )
                        : [...form.unavailable, b.slug],
                    })
                  }
                  className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                    on
                      ? 'border-rose-300 bg-rose-50 text-rose-600'
                      : 'border-line bg-white text-slate-500 hover:border-rose-300'
                  }`}
                >
                  {b.name}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-6 border-t border-line pt-5">
          <p className="text-sm font-bold text-ink-900">
            Country-specific SEO content
          </p>

          <p className="mt-1 text-xs leading-relaxed text-slate-500">
            Write genuinely local copy here. Do not simply replace the
            country name in a global template. This content is used in the
            country page title/meta and prerendered HTML.
          </p>
        </div>

        <label>
          <FieldLabel hint="Optional unique title, e.g. Best Forex Brokers in Malaysia 2026 | PipRank">
            SEO title
          </FieldLabel>

          <input
            value={form.seo_title}
            onChange={(e) =>
              setForm({ ...form, seo_title: e.target.value })
            }
            className="w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-sm outline-none focus:border-emerald-500"
          />
        </label>

        <label>
          <FieldLabel hint="Unique 140–160 character description written specifically for this country">
            SEO meta description
          </FieldLabel>

          <textarea
            value={form.seo_description}
            onChange={(e) =>
              setForm({
                ...form,
                seo_description: e.target.value,
              })
            }
            rows={3}
            className="w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-sm outline-none focus:border-emerald-500"
          />
        </label>

        <StringList
          label="Unique SEO introduction"
          hint="Country-specific search-intent context, market considerations and broker-selection guidance."
          items={form.seo_intro}
          onChange={(v) =>
            setForm({ ...form, seo_intro: v })
          }
          textarea
        />

        <SeoSectionsEditor
          label="Unique SEO sections"
          hint="Add, edit and reorder structured country sections without JSON."
          sections={form.seo_sections}
          onChange={(seo_sections) =>
            setForm({ ...form, seo_sections })
          }
        />

        <FaqListEditor
          label="Unique country FAQs"
          hint="Answers must be specific to this country."
          faqs={form.seo_faqs}
          onChange={(seo_faqs) =>
            setForm({ ...form, seo_faqs })
          }
        />

        <button
          onClick={submit}
          disabled={busy}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-ink-950 text-sm font-bold text-white transition hover:bg-ink-800 disabled:opacity-60"
        >
          {busy && (
            <Loader2 size={15} className="animate-spin" />
          )}

          {country
            ? 'Save country'
            : 'Publish country guide'}
        </button>
      </div>
    </DrawerShell>
  );
}
