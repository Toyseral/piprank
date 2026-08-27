import type { ReactNode } from 'react';

interface Props {
  eyebrow?: string;
  title: ReactNode;
  subtitle?: string;
  dark?: boolean;
}

export default function SectionHead({ eyebrow, title, subtitle, dark = false }: Props) {
  return (
    <div className="max-w-2xl">
      {eyebrow && (
        <p
          className={`flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] ${
            dark ? 'text-emerald-300' : 'text-emerald-700'
          }`}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          {eyebrow}
        </p>
      )}
      <h2
        className={`mt-2.5 font-display text-3xl font-bold tracking-tight text-balance sm:text-4xl ${
          dark ? 'text-white' : 'text-ink-900'
        }`}
      >
        {title}
      </h2>
      {subtitle && (
        <p className={`mt-3 text-base leading-relaxed ${dark ? 'text-slate-400' : 'text-slate-500'}`}>
          {subtitle}
        </p>
      )}
    </div>
  );
}
