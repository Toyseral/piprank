import { useMemo, useState, useEffect } from 'react';
import { Check, ChevronRight, RotateCcw, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import type { Broker, CountryBrokerRanking } from '../lib/types';
import { fetchBrokers, fetchCountryBrokerRankings } from '../lib/api';
import { BROKER_MATCH_QUESTIONS, scoreBroker, type BrokerMatchAnswers, type BrokerMatchQuestion } from '../lib/brokerMatcher';
import VisitButton from './VisitButton';
import Monogram from './Monogram';

type Props = { countrySlug: string; countryName: string; countryFlag?: string };

export default function CountryBrokerMatcher({ countrySlug, countryName, countryFlag = '' }: Props) {
  const questions = useMemo<BrokerMatchQuestion[]>(() => BROKER_MATCH_QUESTIONS.filter((q) => q.key !== 'country').slice(0, 5), []);
  const [brokers, setBrokers] = useState<Broker[]>([]);
  const [rankings, setRankings] = useState<CountryBrokerRanking[]>([]);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Partial<BrokerMatchAnswers>>({ country: countrySlug, prefs: [] });
  const [loading, setLoading] = useState(true);
  const [done, setDone] = useState(false);
  useEffect(() => {
    let active = true;
    Promise.all([fetchBrokers(), fetchCountryBrokerRankings(countrySlug)]).then(([b, r]) => { if (active) { setBrokers(b); setRankings(r); } }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [countrySlug]);
  const results = useMemo(() => {
    if (!done) return [];
    const order = new Map(rankings.map((r, i) => [r.broker?.slug ?? '', r.final_rank ?? i + 1]));
    const allowed = new Set(rankings.filter((r) => r.availability_status !== 'unavailable' && r.availability_status !== 'restricted').map((r) => r.broker?.slug).filter((s): s is string => Boolean(s)));
    return brokers.filter((b) => allowed.has(b.slug)).map((broker) => {
      const scored = scoreBroker(broker, answers as BrokerMatchAnswers);
      const rank = order.get(broker.slug) ?? 99;
      const score = scored.score + Math.max(6, 14 - rank * 2);
      return { broker, pct: Math.max(41, Math.min(99, Math.round(score))), reasons: scored.reasons };
    }).sort((a, b) => b.pct - a.pct).slice(0, 3);
  }, [done, rankings, brokers, answers]);
  const q = questions[step];
  const choose = (value: string) => {
    if (!q) return;
    if (q.multi) { const current = answers.prefs ?? []; setAnswers((prev) => ({ ...prev, prefs: current.includes(value) ? current.filter((v) => v !== value) : [...current, value] })); return; }
    const next = { ...answers, [q.key]: value } as Partial<BrokerMatchAnswers>; setAnswers(next);
    if (step === questions.length - 1) setDone(true); else setStep((s) => s + 1);
  };
  const reset = () => { setAnswers({ country: countrySlug, prefs: [] }); setStep(0); setDone(false); };
  if (loading) return <div className="rounded-2xl border border-line bg-white p-6 animate-pulse"><div className="h-5 w-40 rounded bg-slate-100" /><div className="mt-4 h-20 rounded-xl bg-slate-100" /></div>;
  if (done) return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-700">Your matches</p><h3 className="mt-1 font-display text-2xl font-bold text-ink-950">Top brokers for {countryName}</h3></div><button onClick={reset} className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-emerald-700"><RotateCcw size={13}/> Retake</button></div>
      <div className="mt-5 space-y-3">
        {results.map((r, i) => <div key={r.broker.slug} className="rounded-2xl border border-line bg-paper p-4"><div className="flex items-center gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink-950 text-xs font-bold text-white">#{i + 1}</span><Monogram name={r.broker.name} logoUrl={r.broker.logo_url} color={r.broker.brand_color} size={42} className="rounded-xl"/><div className="min-w-0 flex-1"><p className="font-display font-bold text-ink-950">{r.broker.name}</p><p className="text-[11px] text-slate-500">{r.pct}% match{r.reasons[0] ? ' · ' + r.reasons[0] : ''}</p></div><VisitButton broker={r.broker} compact context="country" /></div></div>)}
        {!results.length && <p className="rounded-xl border border-dashed border-line p-5 text-center text-sm text-slate-500">No matching brokers are currently available in {countryName}.</p>}
      </div>
    </div>
  );
  if (!q) return null;
  return (
    <div>
      <div className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-700">Step {step + 1} of {questions.length}</p><h3 className="mt-1 font-display text-xl font-bold text-ink-950">{q.title}</h3></div><span className="text-xs font-semibold text-slate-400">{countryFlag} {countryName}</span></div>
      <p className="mt-2 text-xs leading-5 text-slate-500">{q.subtitle}</p>
      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: ((step + 1) / questions.length * 100) + '%' }} /></div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {q.options.map((opt) => { const isSelected = q.multi ? (answers.prefs ?? []).includes(opt.value) : answers[q.key] === opt.value; return <motion.button key={opt.value} whileTap={{ scale: .98 }} onClick={() => choose(opt.value)} className={'flex items-start gap-3 rounded-xl border p-3 text-left transition ' + (isSelected ? 'border-emerald-500 bg-emerald-50' : 'border-line bg-white hover:border-emerald-300')}><span className={'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ' + (isSelected ? 'bg-emerald-500 text-white' : 'bg-ink-950 text-emerald-300')}><opt.icon size={15}/></span><span><span className="block text-sm font-bold text-ink-950">{opt.label}</span><span className="mt-0.5 block text-[11px] text-slate-500">{opt.hint}</span></span>{isSelected && <Check size={15} className="ml-auto mt-1 text-emerald-600" />}</motion.button>; })}
      </div>
      {q.multi && <button onClick={() => setDone(true)} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-ink-950 px-4 py-2.5 text-sm font-bold text-white">See my matches <ChevronRight size={15}/></button>}
      <div className="mt-4 flex items-start gap-2 rounded-xl bg-paper p-3 text-[11px] leading-5 text-slate-500"><Sparkles size={13} className="mt-0.5 shrink-0 text-emerald-600"/><span><b className="text-ink-900">Why this matters:</b> {q.why}</span></div>
    </div>
  );
}