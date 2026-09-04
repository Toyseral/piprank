import { useEffect, useMemo, useState, type ComponentType } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ArrowRight,
  Calculator,
  Percent,
  ShieldAlert,
  Target,
  type LucideIcon,
} from 'lucide-react';
import { ButtonLink } from '../components/Button';
import { useSEO } from '../hooks/useSEO';

const TABS = [
  { id: 'position', label: 'Position size', icon: Target },
  { id: 'pip', label: 'Pip value', icon: Calculator },
  { id: 'margin', label: 'Margin', icon: Percent },
  { id: 'risk', label: 'Risk / reward', icon: ShieldAlert },
] as const;

type TabId = (typeof TABS)[number]['id'];

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-bold uppercase tracking-widest text-slate-400">{label}</span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

const inputCls =
  'w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm font-semibold text-ink-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100';

export default function Tools() {
  const [params, setParams] = useSearchParams();
  const active = (params.get('t') as TabId) || 'position';
  const setTab = (id: TabId) => setParams(id === 'position' ? {} : { t: id }, { replace: true });

  useSEO({
    title: 'Forex Calculators: Position Size, Pip Value, Margin & Risk | PipRank',
    description: 'Free forex calculators for position sizing, pip value, required margin and risk-reward. Built for traders who want clear numbers before they place an order.',
    path: '/tools',
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <div className="max-w-2xl">
        <p className="text-xs font-bold uppercase tracking-widest text-emerald-600">Trading tools</p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-ink-950 sm:text-4xl">
          Forex calculators
        </h1>
        <p className="mt-3 text-sm leading-7 text-slate-600">
          Size your trades, estimate margin and check risk before you click buy or sell. Numbers only — no account required.
        </p>
      </div>

      <div className="mt-8 flex flex-wrap gap-2">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const on = active === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setTab(tab.id)}
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${
                on ? 'bg-ink-950 text-white' : 'border border-line bg-white text-slate-600 hover:border-emerald-400'
              }`}
            >
              <Icon size={15} />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="mt-6 rounded-3xl border border-line bg-white p-6 sm:p-8">
        {active === 'position' && <PositionSize />}
        {active === 'pip' && <PipValue />}
        {active === 'margin' && <MarginCalc />}
        {active === 'risk' && <RiskReward />}
      </div>

      <div className="mt-8 flex flex-col items-start justify-between gap-4 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-6 sm:flex-row sm:items-center">
        <p className="text-sm font-medium text-emerald-900">
          Every result above moves with your broker's spread. See who charges the least to trade.
        </p>
        <ButtonLink variant="dark" size="md" icon={ArrowRight} iconRight to="/low-spread-forex-brokers" className="shrink-0">
          Lowest-spread brokers
        </ButtonLink>
      </div>
    </div>
  );
}

function PositionSize() {
  const [balance, setBalance] = useState(10000);
  const [riskPct, setRiskPct] = useState(1);
  const [stopPips, setStopPips] = useState(20);
  const [pipValue, setPipValue] = useState(10);

  const riskAmount = balance * (riskPct / 100);
  const lots = stopPips > 0 ? riskAmount / (stopPips * pipValue) : 0;

  return (
    <div>
      <h2 className="font-display text-xl font-bold text-ink-950">Position size calculator</h2>
      <p className="mt-1 text-sm text-slate-500">How many lots to trade given your risk limit and stop distance.</p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Field label="Account balance (USD)">
          <input className={inputCls} type="number" value={balance} onChange={(e) => setBalance(Number(e.target.value))} />
        </Field>
        <Field label="Risk per trade (%)">
          <input className={inputCls} type="number" step="0.1" value={riskPct} onChange={(e) => setRiskPct(Number(e.target.value))} />
        </Field>
        <Field label="Stop loss (pips)">
          <input className={inputCls} type="number" value={stopPips} onChange={(e) => setStopPips(Number(e.target.value))} />
        </Field>
        <Field label="Pip value per lot (USD)">
          <input className={inputCls} type="number" value={pipValue} onChange={(e) => setPipValue(Number(e.target.value))} />
        </Field>
      </div>
      <div className="mt-6 rounded-2xl bg-ink-950 p-5 text-white">
        <p className="text-xs font-bold uppercase tracking-widest text-emerald-300">Suggested size</p>
        <p className="mt-2 font-display text-3xl font-bold">{lots.toFixed(2)} lots</p>
        <p className="mt-1 text-sm text-slate-400">Risking ${riskAmount.toFixed(2)} ({riskPct}% of balance)</p>
      </div>
    </div>
  );
}

function PipValue() {
  const [lots, setLots] = useState(1);
  const [pair, setPair] = useState('EURUSD');
  const out = useMemo(() => {
    // Simplified: standard lot pip value ≈ $10 for USD-quoted pairs
    const base = 10 * lots;
    return { pip: base, point: base / 10 };
  }, [lots]);

  return (
    <div>
      <h2 className="font-display text-xl font-bold text-ink-950">Pip value calculator</h2>
      <p className="mt-1 text-sm text-slate-500">Approximate USD value of one pip for a given position size.</p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Field label="Lot size">
          <input className={inputCls} type="number" step="0.01" value={lots} onChange={(e) => setLots(Number(e.target.value))} />
        </Field>
        <Field label="Pair">
          <select className={inputCls} value={pair} onChange={(e) => setPair(e.target.value)}>
            {['EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD', 'USDCAD', 'USDCHF'].map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </Field>
      </div>
      <div className="mt-6 rounded-2xl bg-ink-950 p-5 text-white">
        <p className="text-xs font-bold uppercase tracking-widest text-emerald-300">Pip value</p>
        <p className="mt-2 font-display text-3xl font-bold">${out.pip.toFixed(2)}</p>
        <p className="mt-1 text-sm text-slate-400">per pip on {pair} at {lots} lot(s)</p>
      </div>
      <p className="mt-4 text-xs leading-relaxed text-slate-400">
        One pip on {pair} = {out.pip}. Pip value is expressed in USD — for USD-quote pairs it is always $10
        per standard lot.
      </p>
    </div>
  );
}

function MarginCalc() {
  const [lots, setLots] = useState(1);
  const [leverage, setLeverage] = useState(100);
  const [price, setPrice] = useState(1.1);
  const notional = lots * 100000 * price;
  const margin = leverage > 0 ? notional / leverage : 0;

  return (
    <div>
      <h2 className="font-display text-xl font-bold text-ink-950">Margin calculator</h2>
      <p className="mt-1 text-sm text-slate-500">Required margin for a position at a given leverage.</p>
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Field label="Lots">
          <input className={inputCls} type="number" step="0.01" value={lots} onChange={(e) => setLots(Number(e.target.value))} />
        </Field>
        <Field label="Leverage (1:x)">
          <input className={inputCls} type="number" value={leverage} onChange={(e) => setLeverage(Number(e.target.value))} />
        </Field>
        <Field label="Price">
          <input className={inputCls} type="number" step="0.0001" value={price} onChange={(e) => setPrice(Number(e.target.value))} />
        </Field>
      </div>
      <div className="mt-6 rounded-2xl bg-ink-950 p-5 text-white">
        <p className="text-xs font-bold uppercase tracking-widest text-emerald-300">Required margin</p>
        <p className="mt-2 font-display text-3xl font-bold">${margin.toFixed(2)}</p>
        <p className="mt-1 text-sm text-slate-400">Notional ≈ ${notional.toFixed(0)} at 1:{leverage}</p>
      </div>
    </div>
  );
}

function RiskReward() {
  const [entry, setEntry] = useState(1.1);
  const [stop, setStop] = useState(1.095);
  const [target, setTarget] = useState(1.12);
  const risk = Math.abs(entry - stop);
  const reward = Math.abs(target - entry);
  const rr = risk > 0 ? reward / risk : 0;

  return (
    <div>
      <h2 className="font-display text-xl font-bold text-ink-950">Risk / reward calculator</h2>
      <p className="mt-1 text-sm text-slate-500">Check whether a setup offers a favourable risk-reward ratio.</p>
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Field label="Entry">
          <input className={inputCls} type="number" step="0.0001" value={entry} onChange={(e) => setEntry(Number(e.target.value))} />
        </Field>
        <Field label="Stop loss">
          <input className={inputCls} type="number" step="0.0001" value={stop} onChange={(e) => setStop(Number(e.target.value))} />
        </Field>
        <Field label="Take profit">
          <input className={inputCls} type="number" step="0.0001" value={target} onChange={(e) => setTarget(Number(e.target.value))} />
        </Field>
      </div>
      <div className="mt-6 rounded-2xl bg-ink-950 p-5 text-white">
        <p className="text-xs font-bold uppercase tracking-widest text-emerald-300">Risk : reward</p>
        <p className="mt-2 font-display text-3xl font-bold">1 : {rr.toFixed(2)}</p>
        <p className="mt-1 text-sm text-slate-400">Risk {risk.toFixed(4)} · Reward {reward.toFixed(4)}</p>
      </div>
    </div>
  );
}
