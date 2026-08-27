import { useEffect, useState } from 'react';
import { scoreColors } from '../lib/score';

interface Props {
  score: number;
  size?: number;
  stroke?: number;
  label?: string;
}

export default function HealthRing({ score, size = 84, stroke = 7, label }: Props) {
  const r = (size - stroke) / 2 - 0.5; // 0.5px inset so rounded caps never kiss the edge
  const c = 2 * Math.PI * r;
  const [offset, setOffset] = useState(c);

  useEffect(() => {
    const t = setTimeout(() => setOffset(c * (1 - score / 100)), 120);
    return () => clearTimeout(t);
  }, [score, c]);

  const hex = scoreColors(score).hex;

  return (
    <div
      className="relative inline-block leading-none"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${label ?? 'Score'}: ${score} out of 100`}
    >
      {/* track + progress are one perfectly centered SVG, rotated as a block */}
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="absolute inset-0 block -rotate-90 origin-center"
        style={{ display: 'block' }}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="#e8e6e1"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={hex}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 1.1s cubic-bezier(0.22, 1, 0.36, 1)' }}
        />
      </svg>
      {/* centered content — grid guarantees optical centering */}
      <div className="absolute inset-0 grid place-items-center">
        <div className="flex flex-col items-center justify-center text-center leading-none">
          <span
            className="tnum font-display font-bold text-ink-900"
            style={{ fontSize: Math.round(size * 0.28), lineHeight: 1 }}
          >
            {score}
          </span>
          {label && (
            <span
              className="mt-1 font-semibold uppercase tracking-wider text-slate-400"
              style={{ fontSize: Math.max(8, Math.round(size * 0.105)), lineHeight: 1 }}
            >
              {label}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
