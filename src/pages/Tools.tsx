import { useEffect, useMemo, useState, type ComponentType } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ButtonLink } from '../components/Button';
import {
  ArrowRight,
  Landmark,
  Layers,
  Percent,
  Target,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react';

type Kind = 'direct' | 'inverse' | 'gbp' | 'metal';

interface PairSpec {
  pip: number;
  price: number;
  kind: Kind;
  priceLabel: string;
}

const PAIRS: Record<string, PairSpec> = {
  'EUR/USD': { pip: 0.0001, price: 1.0862, kind: 'direct', priceLabel: 'EUR/USD price' },
  'GBP/USD': { pip: 0.0001, price: 1.2721, kind: 'direct', priceLabel: 'GBP/USD price' },
  'AUD/USD': { pip: 0.0001, price: 0.6523, kind: 'direct', priceLabel: 'AUD/USD price' },
  'NZD/USD': { pip: 0.0001, price: 0.5985, kind: 'direct', priceLabel: 'NZD/USD price' },
  'USD/JPY': { pip: 0.01, price: 149.42, kind: 'inverse', priceLabel: 'USD/JPY price' },
  'USD/CAD': { pip: 0.0001, price: 1.3585, kind: 'inverse', priceLabel: 'USD/CAD price' },
  'USD/CHF': { pip: 0.0001, price: 0.8812, kind: 'inverse', priceLabel: 'USD/CHF price' },
  'EUR/GBP': { pip: 0.0001, price: 0.854, kind: 'gbp', priceLabel: 'EUR/GBP price' },
  'XAU/USD': { pip: 0.01, price: 2330, kind: 'metal', priceLabel: 'Gold price (USD)' },
};

function pipUsdPerLot(spec: PairSpec, price: number): number {
  if (spec.kind === 'direct' || spec.kind === 'metal') return spec.pip * 100000;
  if (spec.kind === 'inverse') return (spec.pip / price) * 100000;
  return (spec.pip * price) * 100000; // gbp
}

function notionalUsd(spec: PairSpec, price: number, lots: number): number {
  if (spec.kind === 'metal') return price * 100 * lots;
  if (spec.kind === 'inverse') return (100000 * lots) / price;
  return 100000 * lots * (spec.kind === 'gbp' ? price : 1);
}

const inputCls =
  'w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm font-semibold text-ink-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100';

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-xs font-bold uppercase tracking-widest text-slate-400">{label}</span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

function PairFields({
  pair,
  setPair,
  price,
  setPrice,
}: {
  pair: string;
  setPair: (v: string) => void;
  price: number;
  setPrice: (v: number) => void;
}) {
  const spec = PAIRS[pair];
  return (
    <>
      <Field label="Pair">
        <select
          className={inputCls}
          value={pair}
          onChange={(e) => {
            const next = e.target.value;
            setPair(next);
            setPrice(PAIRS[next].price);
          }}
        >
          {Object.keys(PAIRS).map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </Field>
      <Field label={spec.priceLabel}>
        <input
          className={inputCls}
          type="number"
          step="any"
          value={price}
          onChange={(e) => setPrice(Number(e.target.value))}
        />
      </Field>
    </>
  );
}

function Result({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className={`rounded-2xl p-5 ${accent ? 'bg-ink-950 text-white' : 'border border-line bg-paper'}`}>
      <p className={`text-xs font-bold uppercase tracking-widest ${accent ? 'text-emerald-300' : 'text-slate-400'}`}>{label}</p>
      <p className={`mt-2 font-display text-3xl font-bold ${accent ? 'text-white' : 'text-ink-950'}`}>{value}</p>
      {sub && <p className={`mt-1 text-sm ${accent ? 'text-slate-400' : 'text-slate-500'}`}>{sub}</p>}
    </div>
  );
}

function PositionSize() {
  const [pair, setPair] = useState('EUR/USD');
  const [price, setPrice] = useState(PAIRS['EUR/USD'].price);
  const [balance, setBalance] = useState(10000);
  const [riskPct, setRiskPct] = useState(1);
  const [stopPips, setStopPips] = useState(20);
  const spec = PAIRS[pair];
  const pipValue = pipUsdPerLot(spec, price);
  const riskAmount = balance * (riskPct / 100);
  const lots = stopPips > 0 && pipValue > 0 ? riskAmount / (stopPips * pipValue) : 0;

  return (
    <div>
      <h2 className="font-display text-xl font-bold text-ink-950">Position size</h2>
      <p className="mt-1 text-sm text-slate-500">How many lots to trade for a chosen risk and stop distance.</p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <PairFields pair={pair} setPair={setPair} price={price} setPrice={setPrice} />
        <Field label="Account balance (USD)">
          <input className={inputCls} type="number" value={balance} onChange={(e) => setBalance(Number(e.target.value))} />
        </Field>
        <Field label="Risk per trade (%)">
          <input className={inputCls} type="number" step="0.1" value={riskPct} onChange={(e) => setRiskPct(Number(e.target.value))} />
        </Field>
        <Field label="Stop loss (pips)">
          <input className={inputCls} type="number" value={stopPips} onChange={(e) => setStopPips(Number(e.target.value))} />
        </Field>
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Result label="Suggested size" value={`${lots.toFixed(2)} lots`} sub={`Risking $${riskAmount.toFixed(2)}`} accent />
        <Result label="Pip value / lot" value={`$${pipValue.toFixed(2)}`} sub={pair} />
      </div>
    </div>
  );
}

function PipValue() {
  const [pair, setPair] = useState('EUR/USD');
  const [price, setPrice] = useState(PAIRS['EUR/USD'].price);
  const [lots, setLots] = useState(1);
  const spec = PAIRS[pair];
  const perLot = pipUsdPerLot(spec, price);
  const total = perLot * lots;

  return (
    <div>
      <h2 className="font-display text-xl font-bold text-ink-950">Pip value</h2>
      <p className="mt-1 text-sm text-slate-500">USD value of one pip for a given position size.</p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <PairFields pair={pair} setPair={setPair} price={price} setPrice={setPrice} />
        <Field label="Lot size">
          <input className={inputCls} type="number" step="0.01" value={lots} onChange={(e) => setLots(Number(e.target.value))} />
        </Field>
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Result label="Pip value" value={`$${total.toFixed(2)}`} sub={`${lots} lot(s) on ${pair}`} accent />
        <Result label="Per standard lot" value={`$${perLot.toFixed(2)}`} />
      </div>
    </div>
  );
}

function Margin() {
  const [pair, setPair] = useState('EUR/USD');
  const [price, setPrice] = useState(PAIRS['EUR/USD'].price);
  const [lots, setLots] = useState(1);
  const [leverage, setLeverage] = useState(100);
  const spec = PAIRS[pair];
  const notional = notionalUsd(spec, price, lots);
  const margin = leverage > 0 ? notional / leverage : 0;

  return (
    <div>
      <h2 className="font-display text-xl font-bold text-ink-950">Margin</h2>
      <p className="mt-1 text-sm text-slate-500">Required margin for a position at a given leverage.</p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <PairFields pair={pair} setPair={setPair} price={price} setPrice={setPrice} />
        <Field label="Lots">
          <input className={inputCls} type="number" step="0.01" value={lots} onChange={(e) => setLots(Number(e.target.value))} />
        </Field>
        <Field label="Leverage (1:x)">
          <input className={inputCls} type="number" value={leverage} onChange={(e) => setLeverage(Number(e.target.value))} />
        </Field>
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Result label="Required margin" value={`$${margin.toFixed(2)}`} sub={`1:${leverage} leverage`} accent />
        <Result label="Notional" value={`$${notional.toFixed(0)}`} />
      </div>
    </div>
  );
}

function Profit() {
  const [pair, setPair] = useState('EUR/USD');
  const [price, setPrice] = useState(PAIRS['EUR/USD'].price);
  const [lots, setLots] = useState(1);
  const [pips, setPips] = useState(20);
  const spec = PAIRS[pair];
  const perLot = pipUsdPerLot(spec, price);
  const profit = perLot * lots * pips;

  return (
    <div>
      <h2 className="font-display text-xl font-bold text-ink-950">Profit / loss</h2>
      <p className="mt-1 text-sm text-slate-500">Estimate P&L for a move of a given number of pips.</p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <PairFields pair={pair} setPair={setPair} price={price} setPrice={setPrice} />
        <Field label="Lots">
          <input className={inputCls} type="number" step="0.01" value={lots} onChange={(e) => setLots(Number(e.target.value))} />
        </Field>
        <Field label="Pips">
          <input className={inputCls} type="number" value={pips} onChange={(e) => setPips(Number(e.target.value))} />
        </Field>
      </div>
      <div className="mt-6">
        <Result label="Estimated P&L" value={`${profit >= 0 ? '+' : ''}$${profit.toFixed(2)}`} sub={`${pips} pips × ${lots} lot(s)`} accent />
      </div>
    </div>
  );
}

function Compounding() {
  const [start, setStart] = useState(1000);
  const [monthly, setMonthly] = useState(5);
  const [months, setMonths] = useState(12);
  const end = useMemo(() => {
    let bal = start;
    for (let i = 0; i < months; i++) bal *= 1 + monthly / 100;
    return bal;
  }, [start, monthly, months]);

  return (
    <div>
      <h2 className="font-display text-xl font-bold text-ink-950">Compounding</h2>
      <p className="mt-1 text-sm text-slate-500">Illustrative growth if a monthly return is reinvested. Not a forecast.</p>
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Field label="Starting balance (USD)">
          <input className={inputCls} type="number" value={start} onChange={(e) => setStart(Number(e.target.value))} />
        </Field>
        <Field label="Monthly return (%)">
          <input className={inputCls} type="number" step="0.1" value={monthly} onChange={(e) => setMonthly(Number(e.target.value))} />
        </Field>
        <Field label="Months">
          <input className={inputCls} type="number" value={months} onChange={(e) => setMonths(Number(e.target.value))} />
        </Field>
      </div>
      <div className="mt-6">
        <Result label="Ending balance" value={`$${end.toFixed(2)}`} sub={`${months} months at ${monthly}% / month`} accent />
      </div>
    </div>
  );
}

const TABS: { id: string; label: string; icon: LucideIcon; view: ComponentType }[] = [
  { id: 'position', label: 'Position size', icon: Target, view: PositionSize },
  { id: 'pip', label: 'Pip value', icon: Layers, view: PipValue },
  { id: 'margin', label: 'Margin', icon: Percent, view: Margin },
  { id: 'profit', label: 'Profit / loss', icon: TrendingUp, view: Profit },
  { id: 'compound', label: 'Compounding', icon: Landmark, view: Compounding },
];

export default function Tools() {
  const [params, setParams] = useSearchParams();
  const active = params.get('t') || 'position';
  const setTab = (id: string) => setParams(id === 'position' ? {} : { t: id }, { replace: true });
  const current = TABS.find((t) => t.id === active) ?? TABS[0];
  const View = current.view;

  useEffect(() => {
    document.title = 'Forex Calculators | PipRank';
  }, []);

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <div className="max-w-2xl">
        <p className="text-xs font-bold uppercase tracking-widest text-emerald-600">Trading tools</p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-ink-950 sm:text-4xl">Forex calculators</h1>
        <p className="mt-3 text-sm leading-7 text-slate-600">
          Size your trades, estimate margin and check risk before you click buy or sell. Numbers only — no account required.
        </p>
      </div>

      <div className="mt-8 flex flex-wrap gap-2">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const on = current.id === tab.id;
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
        <View />
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
