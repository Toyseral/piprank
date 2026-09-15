import { ExternalLink, LogOut, SlidersHorizontal } from 'lucide-react';
import { Link, NavLink } from 'react-router-dom';
import type { Session } from '@supabase/supabase-js';

type Tab = {
  key: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
};

type AdminSidebarProps = {
  session: Session;
  role: string;
  tabs: Tab[];
  activeTab: string;
  counts: Record<string, number | null>;
  roleLabels: Record<string, string>;
  onTabChange: (tab: string) => void;
  onSignOut: () => void;
};

export default function AdminSidebar({ session, role, tabs, activeTab, counts, roleLabels, onTabChange, onSignOut }: AdminSidebarProps) {
  const canManageRankings = ['super_admin', 'admin', 'content_admin'].includes(role);

  return (
    <>
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-line bg-white lg:flex">
        <div className="flex items-center gap-2.5 border-b border-line px-5 py-5">
          <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden="true">
            <rect width="32" height="32" rx="7" fill="#0d1b12" />
            <line x1="9" y1="6" x2="9" y2="18" stroke="#57b98b" strokeWidth="1.6" strokeLinecap="round" />
            <rect x="6.8" y="9.5" width="4.4" height="6.5" rx="1" fill="#57b98b" />
            <line x1="16" y1="12" x2="16" y2="25" stroke="#ff6b6b" strokeWidth="1.6" strokeLinecap="round" />
            <rect x="13.8" y="15" width="4.4" height="6" rx="1" fill="#ff6b6b" />
            <line x1="23" y1="4.5" x2="23" y2="15.5" stroke="#57b98b" strokeWidth="1.6" strokeLinecap="round" />
            <rect x="20.8" y="7.5" width="4.4" height="6.5" rx="1" fill="#57b98b" />
          </svg>
          <div>
            <p className="font-display text-[15px] font-bold leading-none text-ink-900">PipRank <span className="text-emerald-600">Admin</span></p>
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-widest text-slate-400">Console</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {tabs.map((t) => (
            <button key={t.key} onClick={() => onTabChange(t.key)} className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition ${activeTab === t.key ? 'bg-ink-950 text-white shadow-sm' : 'text-slate-500 hover:bg-paper hover:text-ink-900'}`}>
              <t.icon size={16} className={activeTab === t.key ? 'text-emerald-400' : 'text-slate-400'} />
              {t.label}
              {counts[t.key] !== null && <span className={`tnum ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold ${activeTab === t.key ? 'bg-white/15 text-emerald-300' : 'bg-paper text-slate-500'}`}>{counts[t.key]}</span>}
            </button>
          ))}

          {canManageRankings && (
            <NavLink to="/archypage/rankings" className={({ isActive }) => `flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition ${isActive ? 'bg-ink-950 text-white shadow-sm' : 'text-slate-500 hover:bg-paper hover:text-ink-900'}`}>
              {({ isActive }) => <><SlidersHorizontal size={16} className={isActive ? 'text-emerald-400' : 'text-slate-400'} />Manual Ranking</>}
            </NavLink>
          )}
        </nav>

        <div className="border-t border-line p-3">
          <Link to="/" className="flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-slate-500 transition hover:bg-paper hover:text-ink-900">
            <ExternalLink size={16} className="text-slate-400" />
            View site
          </Link>
          <div className="mt-2 flex items-center gap-2.5 rounded-xl bg-paper px-3.5 py-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink-950 text-xs font-bold text-emerald-400">{(session.user.email ?? 'A')[0].toUpperCase()}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-bold text-ink-900">{session.user.email}</p>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700">{roleLabels[role] ?? role}</p>
            </div>
            <button onClick={onSignOut} className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white hover:text-rose-600" title="Sign out"><LogOut size={15} /></button>
          </div>
        </div>
      </aside>

      {canManageRankings && (
        <div className="border-b border-line bg-white px-4 py-2 lg:hidden">
          <NavLink to="/archypage/rankings" className={({ isActive }) => `flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-bold ${isActive ? 'bg-ink-950 text-white' : 'border border-line bg-white text-slate-600'}`}>
            <SlidersHorizontal size={16} />
            Manual Ranking
          </NavLink>
        </div>
      )}
    </>
  );
}
