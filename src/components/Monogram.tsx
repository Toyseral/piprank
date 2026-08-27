interface Props {
  name: string;
  color: string;
  size?: number;
  className?: string;
  /** When the broker has an uploaded logo it replaces the initial letters, on the same brand tile. */
  logoUrl?: string | null;
}

function shade(hex: string): string {
  const c = hex.replace('#', '');
  const n = parseInt(c, 16);
  if (Number.isNaN(n)) return '#0a1224';
  const r = Math.max(0, (n >> 16) - 42);
  const g = Math.max(0, ((n >> 8) & 255) - 42);
  const b = Math.max(0, (n & 255) - 42);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

export default function Monogram({ name, color, size = 48, className = '', logoUrl }: Props) {
  const bg = `linear-gradient(135deg, ${color}, ${shade(color)})`;
  const base = `relative flex shrink-0 items-center justify-center overflow-hidden rounded-xl font-display font-bold text-white ${className}`;

  if (logoUrl) {
    return (
      <div
        className={base}
        style={{ width: size, height: size, background: bg }}
        aria-hidden="true"
      >
        <img
          src={logoUrl}
          alt=""
          className="object-contain"
          style={{ width: Math.round(size * 0.64), height: Math.round(size * 0.64) }}
        />
      </div>
    );
  }

  const initials = name
    .replace(/&/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  return (
    <div
      className={base}
      style={{
        width: size,
        height: size,
        background: bg,
        fontSize: Math.round(size * 0.36),
        letterSpacing: '-0.02em',
      }}
      aria-hidden="true"
    >
      {initials}
    </div>
  );
}
