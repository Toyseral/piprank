import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Eye, KeyRound, Loader2, Plus, Trash2 } from 'lucide-react';

interface TeamRow {
  id: number;
  email: string;
  role: string;
  active: boolean;
}

interface ManageableRole {
  value: string;
  label: string;
  hint: string;
}

interface TeamTabProps {
  token: string;
  myEmail: string;
  roleLabels: Record<string, string>;
  Toggle: React.ComponentType<{ on: boolean; onToggle: () => void }>;
}

function generatePassword(): string {
  const upper = 'ABCDEFGHJKMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnpqrstuvwxyz';
  const nums = '23456789';
  const all = upper + lower + nums + '!@#%';
  let out =
    upper[Math.floor(Math.random() * upper.length)] +
    nums[Math.floor(Math.random() * nums.length)];

  while (out.length < 12) {
    out += all[Math.floor(Math.random() * all.length)];
  }

  return out;
}

const MANAGEABLE: ManageableRole[] = [
  {
    value: 'brokers_admin',
    label: 'Brokers manager',
    hint: 'Brokers data, categories, featured',
  },
  {
    value: 'content_admin',
    label: 'Content editor',
    hint: 'Guides, intent pages, country guides',
  },
  {
    value: 'moderator',
    label: 'Moderator',
    hint: 'Reviews verification, newsletter list',
  },
  {
    value: 'admin',
    label: 'Admin (full ops)',
    hint: 'All tabs except team management',
  },
  {
    value: 'super_admin',
    label: 'Super Admin',
    hint: 'Everything incl. team management',
  },
];

export default function TeamTab({
  token,
  myEmail,
  roleLabels,
  Toggle,
}: TeamTabProps) {
  const [rows, setRows] = useState<TeamRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [newRole, setNewRole] = useState('brokers_admin');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const headers = useMemo(
    () => ({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    }),
    [token]
  );

  const load = useCallback(async () => {
    const res = await fetch('/api/admin-users', { headers });
    const data = await res.json().catch(() => []);

    if (Array.isArray(data)) {
      setRows(data);
    }

    setLoading(false);
  }, [headers]);

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, [load]);

  const api = async (
    method: string,
    body: Record<string, unknown>
  ) => {
    const res = await fetch('/api/admin-users', {
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

  const submit = async (e: FormEvent) => {
    e.preventDefault();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return setErr('Enter a valid email address.');
    }

    if (password.length < 8) {
      return setErr(
        'Set an initial password of at least 8 characters.'
      );
    }

    setBusy(true);
    setErr('');

    try {
      await api('POST', {
        email,
        role: newRole,
        password,
      });

      setEmail('');
      setPassword('');
      await load();
    } catch (e1) {
      setErr(e1 instanceof Error ? e1.message : 'Failed');
    } finally {
      setBusy(false);
    }
  };

  const updateRole = async (row: TeamRow, role: string) => {
    await api('PUT', {
      id: row.id,
      role,
    });

    await load();
  };

  const toggleActive = async (row: TeamRow) => {
    if (row.email === myEmail && row.active) {
      return window.alert("You can't suspend your own account.");
    }

    await api('PUT', {
      id: row.id,
      active: !row.active,
    });

    await load();
  };

  const remove = async (row: TeamRow) => {
    if (row.email === myEmail) {
      return window.alert("You can't remove your own access.");
    }

    if (
      !window.confirm(
        `Remove ${row.email} from the admin team? Their login is deleted and all access ends instantly.`
      )
    ) {
      return;
    }

    await api('DELETE', {
      id: row.id,
    });

    await load();
  };

  const resetPassword = async (row: TeamRow) => {
    const pwd = window.prompt(
      `New password for ${row.email} (min 8 chars):`,
      generatePassword()
    );

    if (!pwd) {
      return;
    }

    try {
      await api('PUT', {
        id: row.id,
        password: pwd,
      });

      window.alert(`Password updated for ${row.email}`);
    } catch (e1) {
      window.alert(
        e1 instanceof Error ? e1.message : 'Failed'
      );
    }
  };

  return (
    <div className="space-y-5">
      <form
        onSubmit={submit}
        className="rounded-2xl border border-line bg-white p-5 shadow-soft"
      >
        <p className="font-display text-base font-bold text-ink-900">
          Invite an admin
        </p>

        <p className="mt-0.5 text-xs text-slate-500">
          One step: creates their login (email + initial password) and
          grants the role — they can sign in immediately.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_190px]">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="colleague@company.com"
            className="h-11 rounded-xl border border-line bg-paper px-4 text-sm outline-none focus:border-emerald-500"
          />

          <select
            value={newRole}
            onChange={(e) => setNewRole(e.target.value)}
            className="h-11 rounded-xl border border-line bg-paper px-3 text-sm font-semibold outline-none"
          >
            {MANAGEABLE.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-4">
          <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-400">
            Initial password{' '}
            <span className="font-medium normal-case tracking-normal text-slate-400/70">
              they sign in with this — share it with them
            </span>
          </span>

          <div className="mt-1 flex gap-2">
            <div className="relative flex-1">
              <input
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setErr('');
                }}
                placeholder="e.g. Welcome@2026 — min 8 characters"
                className={`h-11 w-full rounded-xl border bg-paper px-4 pr-10 text-sm outline-none transition focus:border-emerald-500 ${
                  err && password.length < 8
                    ? 'border-rose-400 ring-2 ring-rose-500/20'
                    : 'border-line'
                }`}
              />

              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-ink-900"
                aria-label={
                  showPw ? 'Hide password' : 'Show password'
                }
              >
                <Eye size={16} />
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                setPassword(generatePassword());
                setShowPw(true);
              }}
              className="h-11 shrink-0 rounded-xl border border-line px-3.5 text-xs font-bold text-ink-900 transition hover:border-ink-900"
            >
              Generate
            </button>

            <button
              type="submit"
              disabled={busy}
              className="flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-ink-950 px-5 text-sm font-bold text-white transition hover:bg-ink-800 disabled:opacity-60"
            >
              {busy ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <Plus size={15} />
              )}
              Add member
            </button>
          </div>
        </div>

        {err && (
          <p className="mt-2 text-sm font-medium text-rose-600">
            {err}
          </p>
        )}

        <div className="mt-3 grid gap-1.5 sm:grid-cols-2 lg:grid-cols-4">
          {MANAGEABLE.map((r) => (
            <div
              key={r.value}
              className="rounded-xl bg-paper px-3 py-2"
            >
              <p className="text-xs font-bold text-ink-900">
                {r.label}
              </p>
              <p className="text-[11px] text-slate-400">
                {r.hint}
              </p>
            </div>
          ))}
        </div>
      </form>

      <div className="rounded-2xl border border-line bg-white shadow-soft">
        <p className="border-b border-line px-5 py-4 font-display text-base font-bold text-ink-900">
          Admin team ({rows.length})
        </p>

        {loading ? (
          <div className="h-40 animate-pulse" />
        ) : (
          <div className="divide-y divide-line">
            {rows.map((r) => (
              <div
                key={r.id}
                className="flex flex-wrap items-center gap-3 px-5 py-3.5"
              >
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    r.role === 'super_admin'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-ink-950 text-emerald-400'
                  }`}
                >
                  {r.email[0].toUpperCase()}
                </span>

                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 text-sm font-bold text-ink-900">
                    {r.email}

                    {r.email === myEmail && (
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 ring-1 ring-emerald-200">
                        you
                      </span>
                    )}

                    {!r.active && (
                      <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-600 ring-1 ring-rose-200">
                        suspended
                      </span>
                    )}
                  </p>

                  <p className="text-xs text-slate-400">
                    {roleLabels[r.role] ?? r.role}
                  </p>
                </div>

                <select
                  value={r.role}
                  disabled={r.email === myEmail}
                  onChange={(e) =>
                    updateRole(r, e.target.value)
                  }
                  className="h-9 rounded-xl border border-line bg-paper px-2.5 text-xs font-bold outline-none disabled:opacity-50"
                >
                  {MANAGEABLE.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>

                <Toggle
                  on={r.active}
                  onToggle={() => toggleActive(r)}
                />

                <button
                  onClick={() => resetPassword(r)}
                  className="rounded-lg p-2 text-slate-400 transition hover:bg-sky-50 hover:text-sky-700"
                  title="Reset their password"
                >
                  <KeyRound size={15} />
                </button>

                <button
                  onClick={() => remove(r)}
                  disabled={r.email === myEmail}
                  className="rounded-lg p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-30"
                  title={
                    r.email === myEmail
                      ? 'Cannot remove yourself'
                      : 'Remove admin access'
                  }
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        )}

        <p className="px-5 py-4 text-xs leading-relaxed text-slate-400">
          Role changes and suspensions apply on the next API call.
          Removing a member deletes both the role and their login
          account. Admins provisioned here can sign in at /archypage
          immediately.
        </p>
      </div>
    </div>
  );
}
