export const fmtMoney = (n: number): string => '$' + n.toLocaleString('en-US');

export const fmtPips = (n: number): string => `${Math.round(n * 100) / 100} pips`;

export const fmtHours = (n: number): string => {
  if (n < 1) return `${Math.round(n * 60)} min`;
  if (Number.isInteger(n)) return `${n}h`;
  return `${n.toFixed(1)}h`;
};

export function timeAgo(input: string): string {
  const diff = Date.now() - new Date(input).getTime();
  const m = Math.floor(diff / 60000);
  if (Number.isNaN(m)) return '';
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.floor(mo / 12)}y ago`;
}

export function ratingWord(r: number): string {
  if (r >= 4.8) return 'Exceptional';
  if (r >= 4.5) return 'Excellent';
  if (r >= 4.2) return 'Very good';
  if (r >= 3.8) return 'Good';
  return 'Mixed';
}

export function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
