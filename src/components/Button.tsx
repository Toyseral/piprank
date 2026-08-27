import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';

export type ButtonVariant = 'primary' | 'dark' | 'white' | 'outline' | 'outlineDark' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

const BASE =
  'group/btn inline-flex items-center justify-center gap-2 font-bold transition-all duration-200 select-none ' +
  'active:scale-[0.97] disabled:opacity-60 disabled:pointer-events-none ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70 focus-visible:ring-offset-2';

const VARIANTS: Record<ButtonVariant, string> = {
  /** The money action — soft gradient mint with a glow shadow */
  primary:
    'bg-gradient-to-b from-emerald-400 to-emerald-600 text-ink-950 ring-1 ring-inset ring-white/30 ' +
    'shadow-[0_10px_24px_-10px_rgba(31,138,92,0.55)] hover:shadow-[0_16px_32px_-10px_rgba(31,138,92,0.7)] hover:-translate-y-0.5',
  /** Dark ink — internal next-steps */
  dark: 'bg-ink-950 text-white shadow-soft hover:bg-ink-800 hover:-translate-y-0.5 hover:shadow-soft-lg',
  /** White — primary CTA on dark surfaces */
  white:
    'bg-white text-ink-950 shadow-lg shadow-black/20 hover:bg-emerald-50 hover:-translate-y-0.5',
  /** Border card button on light surfaces */
  outline:
    'border border-line bg-white text-ink-900 hover:border-ink-900 hover:-translate-y-0.5 hover:shadow-soft',
  /** Glass outline for dark surfaces */
  outlineDark:
    'border border-white/25 text-white backdrop-blur-sm hover:border-emerald-300/60 hover:bg-white/10 hover:-translate-y-0.5',
  /** Minimal */
  ghost: 'text-slate-500 hover:text-ink-900 hover:bg-slate-100',
};

const SIZES: Record<ButtonSize, string> = {
  sm: 'h-11 rounded-xl px-3.5 text-xs',
  md: 'h-11 rounded-xl px-5 text-sm',
  lg: 'h-12 rounded-2xl px-6 text-sm sm:text-[15px]',
};

const ICON_SIZES: Record<ButtonSize, number> = { sm: 14, md: 16, lg: 17 };

export function btnCls(variant: ButtonVariant = 'primary', size: ButtonSize = 'md', extra = ''): string {
  return `${BASE} ${VARIANTS[variant]} ${SIZES[size]} ${extra}`.trim();
}

const ICON_SLIDE =
  'shrink-0 transition-transform duration-200 group-hover/btn:translate-x-0.5';

interface CommonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  icon?: LucideIcon;
  /** icon slides right on hover — use for forward actions */
  iconRight?: boolean;
  children: ReactNode;
}

function Content({
  icon: Icon,
  iconRight,
  size,
  children,
}: Pick<CommonProps, 'icon' | 'iconRight' | 'children'> & { size: ButtonSize }) {
  return (
    <>
      {Icon && !iconRight && <Icon size={ICON_SIZES[size]} />}
      {children}
      {Icon && iconRight && <Icon size={ICON_SIZES[size]} className={ICON_SLIDE} />}
    </>
  );
}

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  icon,
  iconRight = false,
  children,
  ...rest
}: CommonProps & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className={btnCls(variant, size, className)} {...rest}>
      <Content icon={icon} iconRight={iconRight} size={size}>
        {children}
      </Content>
    </button>
  );
}

export function ButtonLink({
  variant = 'primary',
  size = 'md',
  className = '',
  icon,
  iconRight = false,
  children,
  to,
  ...rest
}: CommonProps & { to: string } & Omit<React.ComponentProps<typeof Link>, 'to'>) {
  return (
    <Link to={to} className={btnCls(variant, size, className)} {...rest}>
      <Content icon={icon} iconRight={iconRight} size={size}>
        {children}
      </Content>
    </Link>
  );
}
