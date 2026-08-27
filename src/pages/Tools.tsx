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
  'EUR/GBP': { pip: 0.0001, price: 1.2721, kind: 'gbp', priceLabel: 'GBP/USD rate' },
  'XAU/USD': { pip: 0.1, price: 2385.5, kind: 'metal', priceLabel: 'Gold price (USD/oz)' },
};

function pipUsdPerLot(spec: PairSpec, price: number): number {
  if (spec.kind === 'direct' || spec.kind === 'metal') return 10;
  if (spec.kind === 'gbp') return 10 * price;
  return spec.pip === 0.01 ? 1000 / price : 10 / price;
}

function notionalUsd(spec: PairSpec, price: number, lots: number): number {
  if (spec.kind === 'direct' || spec.kind === 'gbp') return 100000 * lots * price;
  if (spec.kind === 'metal') return 100 * lots * price;
  return 100000 * lots;
}

const num = (s: string, fallback: number) => {
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : fallback;
};

const fmtUsd = (n: number) =>
  '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function Field({
  label,
  value,
  onChange,
  suffix,
  step = 'any',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  suffix?: string;
  step?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-bold uppercase tracking-wide text-slate-400">{label}</span>
      <div className="mt-1.5 flex items-center rounded-xl border border-line bg-paper px-3.5 transition focus-within:border-emerald-500">
        <input
          type="number"
          value={value}
          step={step}
          onChange={(e) => onChange(e.target.value)}
          className="tnum h-11 w-full bg-transparent text-sm font-semibold text-ink-900 outline-none"
        />
        {suffix && <span className="shrink-0 text-xs font-bold text-slate-400">{suffix}</span>}
      </div>
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
  price: string;
  setPrice: (v: string) => void;
}) {
  const spec = PAIRS[pair];
  return (
    <div className="grid grid-cols-2 gap-3">
      <label className="block">
        <span className="text-xs font-bold uppercase tracking-wide text-slate-400">Instrument</span>
        <select
          value={pair}
          onChange={(e) => {
            setPair(e.target.value);
            setPrice(String(PAIRS[e.target.value].price));
          }}
          className="mt-1.5 h-11 w-full rounded-xl border border-line bg-paper px-3 text-sm font-semibold text-ink-900 outline-none"
        >
          {Object.keys(PAIRS).map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
      </label>
      <Field label={spec.priceLabel} value={price} onChange={setPrice} />
    </div>
  );
}

function Result({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div
      className={`rounded-2xl border p-4 ${
        accent ? 'border-emerald-300 bg-emerald-50' : 'border-line bg-paper'
      }`}
    >
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
      <p className={`tnum mt-1 font-display text-2xl font-bold ${accent ? 'text-emerald-700' : 'text-ink-900'}`}>
        {value}
      </p>
      {sub && <p className="mt-0.5 text-xs text-slate-500">{sub}</p>}
    </div>
  );
}

/* ================= POSITION SIZE ================= */
function PositionSize() {
  const [balance, setBalance] = useState('10000');
  const [risk, setRisk] = useState('1');
  const [stop, setStop] = useState('25');
  const [pair, setPair] = useState('EUR/USD');
  const [price, setPrice] = useState(String(PAIRS['EUR/USD'].price));

  const out = useMemo(() => {
    const spec = PAIRS[pair];
    const pv = pipUsdPerLot(spec, num(price, spec.price));
    const riskUsd = num(balance, 0) * (num(risk, 0) / 100);
    const sl = num(stop, 0);
    const lots = sl > 0 ? riskUsd / (sl * pv) : 0;
    return { pv, riskUsd, lots };
  }, [balance, risk, stop, pair, price]);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Account balance" value={balance} onChange={setBalance} suffix="USD" />
          <Field label="Risk per trade" value={risk} onChange={setRisk} suffix="%" />
        </div>
        <Field label="Stop loss distance" value={stop} onChange={setStop} suffix="pips" />
        <PairFields pair={pair} setPair={setPair} price={price} setPrice={setPrice} />
        <p className="text-xs leading-relaxed text-slate-400">
          Formula: (balance × risk%) ÷ (stop-loss pips × pip value per lot)
        </p>
      </div>
      <div className="space-y-3">
        <Result accent label="Position size" value={`${out.lots.toFixed(2)} lots`} sub={`${Math.round(out.lots * 100000).toLocaleString()} units`} />
        <Result label="Capital at risk" value={fmtUsd(out.riskUsd)} sub={`${risk}% of ${fmtUsd(num(balance, 0))}`} />
        <Result label="Pip value (per standard lot)" value={fmtUsd(out.pv)} />
      </div>
    </div>
  );
}

/* ================= PIP VALUE ================= */
function PipValue() {
  const [pair, setPair] = useState('USD/JPY');
  const [price, setPrice] = useState(String(PAIRS['USD/JPY'].price));
  const [lots, setLots] = useState('1');

  const out = useMemo(() => {
    const spec = PAIRS[pair];
    const pv = pipUsdPerLot(spec, num(price, spec.price));
    return { perLot: pv, total: pv * num(lots, 0), pip: spec.pip };
  }, [pair, price, lots]);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
      <div className="space-y-4">
        <PairFields pair={pair} setPair={setPair} price={price} setPrice={setPrice} />
        <Field label="Position size" value={lots} onChange={setLots} suffix="lots" step="0.01" />
        <p className="text-xs leading-relaxed text-slate-400">
          One pip on {pair} = {out.pip}. Pip value is expressed in USD — for USD-quote pairs it is always $10
          per standard lot.
        </p>
      </div>
      <div className="space-y-3">
        <Result accent label="Pip value for your size" value={fmtUsd(out.total)} sub={`for ${lots} lot(s)`} />
        <Result label="Per standard lot" value={fmtUsd(out.perLot)} sub="100,000 units" />
        <Result label="Per mini lot" value={fmtUsd(out.perLot / 10)} sub="10,000 units" />
      </div>
    </div>
  );
}

/* ================= MARGIN ================= */
function Margin() {
  const [pair, setPair] = useState('EUR/USD');
  const [price, setPrice] = useState(String(PAIRS['EUR/USD'].price));
  const [lots, setLots] = useState('0.5');
  const [leverage, setLeverage] = useState('100');

  const out = useMemo(() => {
    const spec = PAIRS[pair];
    const notional = notionalUsd(spec, num(price, spec.price), num(lots, 0));
    const lev = Math.max(1, num(leverage, 100));
    return { notional, margin: notional / lev };
  }, [pair, price, lots, leverage]);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
      <div className="space-y-4">
        <PairFields pair={pair} setPair={setPair} price={price} setPrice={setPrice} />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Position size" value={lots} onChange={setLots} suffix="lots" step="0.01" />
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-wide text-slate-400">Leverage</span>
            <select
              value={leverage}
              onChange={(e) => setLeverage(e.target.value)}
              className="mt-1.5 h-11 w-full rounded-xl border border-line bg-paper px-3 text-sm font-semibold text-ink-900 outline-none"
            >
              {[20, 30, 50, 100, 200, 400, 500, 1000].map((l) => (
                <option key={l} value={l}>
                  1:{l}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="text-xs leading-relaxed text-slate-400">
          Formula: notional value ÷ leverage. Retail caps in tier-1 regions typically limit major pairs to
          1:30.
        </p>
      </div>
      <div className="space-y-3">
        <Result accent label="Required margin" value={fmtUsd(out.margin)} />
        <Result label="Position notional" value={fmtUsd(out.notional)} sub="total exposure controlled" />
      </div>
    </div>
  );
}

/* ================= PROFIT ================= */
function Profit() {
  const [pair, setPair] = useState('EUR/USD');
  const [price, setPrice] = useState(String(PAIRS['EUR/USD'].price));
  const [dir, setDir] = useState<'long' | 'short'>('long');
  const [entry, setEntry] = useState('1.0860');
  const [exit, setExit] = useState('1.0960');
  const [lots, setLots] = useState('1');

  const out = useMemo(() => {
    const spec = PAIRS[pair];
    const sign = dir === 'long' ? 1 : -1;
    const pips = ((num(exit, 0) - num(entry, 0)) / spec.pip) * sign;
    const pv = pipUsdPerLot(spec, num(price, spec.price)) * num(lots, 0);
    return { pips, usd: pips * pv };
  }, [pair, price, dir, entry, exit, lots]);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setDir('long')}
            className={`h-11 rounded-xl text-sm font-bold transition ${
              dir === 'long' ? 'bg-emerald-500 text-white' : 'border border-line bg-paper text-slate-500'
            }`}
          >
            Buy / Long
          </button>
          <button
            onClick={() => setDir('short')}
            className={`h-11 rounded-xl text-sm font-bold transition ${
              dir === 'short' ? 'bg-rose-500 text-white' : 'border border-line bg-paper text-slate-500'
            }`}
          >
            Sell / Short
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Entry price" value={entry} onChange={setEntry} />
          <Field label="Exit price" value={exit} onChange={setExit} />
        </div>
        <PairFields pair={pair} setPair={setPair} price={price} setPrice={setPrice} />
        <Field label="Position size" value={lots} onChange={setLots} suffix="lots" step="0.01" />
        <p className="text-xs text-slate-400">
          “Conversion price” = current {pair} rate used to convert pips into USD.
        </p>
      </div>
      <div className="space-y-3">
        <Result
          accent
          label={out.usd >= 0 ? 'Projected profit' : 'Projected loss'}
          value={`${out.usd >= 0 ? '+' : ''}${fmtUsd(out.usd)}`}
          sub={`${dir} ${lots} lot(s) on ${pair}`}
        />
        <Result label="Move in pips" value={`${out.pips >= 0 ? '+' : ''}${out.pips.toFixed(1)} pips`} />
      </div>
    </div>
  );
}

/* ================= COMPOUNDING ================= */
function Compounding() {
  const [start, setStart] = useState('5000');
  const [monthly, setMonthly] = useState('3');
  const [months, setMonths] = useState('24');
  const [deposit, setDeposit] = useState('250');

  const rows = useMemo(() => {
    const r = num(monthly, 0) / 100;
    const dep = num(deposit, 0);
    const m = Math.min(120, Math.max(1, Math.round(num(months, 24))));
    let bal = num(start, 0);
    const arr: { month: number; balance: number; deposits: number }[] = [];
    let deposited = bal;
    for (let i = 1; i <= m; i++) {
      bal = bal * (1 + r) + dep;
      deposited += dep;
      arr.push({ month: i, balance: bal, deposits: deposited });
    }
    return arr;
  }, [start, monthly, months, deposit]);

  const final = rows[rows.length - 1];
  const gain = final ? final.balance - final.deposits : 0;
  const maxBal = final?.balance ?? 1;

  return (
    <div>
      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Starting balance" value={start} onChange={setStart} suffix="USD" />
            <Field label="Monthly return" value={monthly} onChange={setMonthly} suffix="%" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Duration" value={months} onChange={setMonths} suffix="months" />
            <Field label="Monthly deposit" value={deposit} onChange={setDeposit} suffix="USD" />
          </div>
          <p className="text-xs leading-relaxed text-slate-400">
            Compounding assumes the same percentage return every month — real trading is lumpier than any
            straight-line model.
          </p>
        </div>
        <div className="space-y-3">
          <Result accent label="Final balance" value={fmtUsd(final?.balance ?? 0)} sub={`after ${rows.length} months`} />
          <Result label="Trading gains" value={fmtUsd(gain)} sub="compounded growth only" />
          <Result label="Total deposited" value={fmtUsd(final?.deposits ?? 0)} />
        </div>
      </div>
      {/* bar chart */}
      <div className="mt-8">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Balance trajectory</p>
        <div className="mt-3 flex h-36 items-end gap-[3px]">
          {rows.map((r) => (
            <div
              key={r.month}
              className="group relative flex-1 rounded-t-md bg-gradient-to-t from-emerald-600/50 to-emerald-400 transition hover:from-emerald-500"
              style={{ height: `${Math.max(3, (r.balance / maxBal) * 100)}%` }}
            >
              <div className="pointer-events-none absolute -top-9 left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-ink-950 px-2 py-1 text-[10px] font-bold text-white group-hover:block">
                M{r.month}: {fmtUsd(r.balance)}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-1.5 flex justify-between text-[10px] font-semibold text-slate-400">
          <span>Month 1</span>
          <span>Month {rows.length}</span>
        </div>
      </div>
    </div>
  );
}

const TABS: { key: string; label: string; icon: LucideIcon; el: ComponentType }[] = [
  { key: 'position', label: 'Position Size', icon: Target, el: PositionSize },
  { key: 'pip', label: 'Pip Value', icon: Percent, el: PipValue },
  { key: 'margin', label: 'Margin', icon: Landmark, el: Margin },
  { key: 'profit', label: 'Profit & Loss', icon: TrendingUp, el: Profit },
  { key: 'compound', label: 'Compounding', icon: Layers, el: Compounding },
];

export default function Tools() {
  const [params, setParams] = useSearchParams();
  const active = TABS.find((t) => t.key === params.get('tab')) ?? TABS[0];
  const Active = active.el;

  useEffect(() => {
    document.title = 'Free Forex Calculators — Position Size, Pip Value, Margin | PipRank';
    return () => {
      document.title = 'PipRank — Best Forex Brokers 2026: Reviews, Comparison & Free Trading Tools';
    };
  }, []);

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <div className="max-w-2xl">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-600">Free trading tools</p>
        <h1 className="mt-2 font-display text-4xl font-bold tracking-tight text-ink-900">
          Free forex <em className="serif-accent text-emerald-700">trading calculators</em>
        </h1>
        <p className="mt-3 text-slate-500">
          Position sizing, pip values, margin, P&L and compounding — instant, no signup, all figures in USD.
        </p>
      </div>

      <div className="mt-8 flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setParams({ tab: t.key })}
            className={`flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
              active.key === t.key
                ? 'bg-ink-900 text-white'
                : 'border border-line bg-white text-slate-500 hover:border-ink-900 hover:text-ink-900'
            }`}
          >
            <t.icon size={15} className={active.key === t.key ? 'text-emerald-400' : ''} />
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-6 rounded-3xl border border-line bg-white p-6 shadow-soft sm:p-8">
        <Active />
      </div>

      <div className="mt-6 flex flex-col items-start justify-between gap-4 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-6 sm:flex-row sm:items-center">
        <p className="text-sm font-medium text-emerald-900">
          Every result above moves with your broker's spread. See who charges the least to trade.
        </p>
        <ButtonLink variant="dark" size="md" icon={ArrowRight} iconRight to="/best/low-spread" className="shrink-0">
          Lowest-spread brokers
        </ButtonLink>
      </div>
    </div>
  );
}
