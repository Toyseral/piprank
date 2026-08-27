import { useState, type FormEvent } from 'react';
import { CheckCircle2, Loader2, Send } from 'lucide-react';
import { subscribeNewsletter } from '../lib/api';
import { btnCls } from './Button';
import { track } from '../lib/track';

export default function NewsletterForm({ dark = false }: { dark?: boolean }) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [msg, setMsg] = useState('');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const clean = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) {
      setStatus('error');
      setMsg('Please enter a valid email address.');
      return;
    }
    setStatus('loading');
    try {
      const res = await subscribeNewsletter(clean);
      track('signup', { page: window.location.pathname, duplicate: !!res.duplicate });
      setStatus('success');
      setMsg(res.duplicate ? "You're already on the list — see you Friday." : "You're in. First brief lands Friday.");
    } catch (err) {
      setStatus('error');
      setMsg(err instanceof Error ? err.message : 'Something went wrong. Try again.');
    }
  };

  if (status === 'success') {
    return (
      <div
        className={`flex items-center gap-2.5 rounded-xl border px-4 py-3 text-sm font-medium ${
          dark
            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
            : 'border-emerald-200 bg-emerald-50 text-emerald-700'
        }`}
      >
        <CheckCircle2 size={18} className="shrink-0" />
        {msg}
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className={`h-11 w-full rounded-xl border px-4 text-sm outline-none transition focus:ring-2 ${
            dark
              ? 'border-white/15 bg-white/10 text-white placeholder:text-slate-400 focus:border-emerald-400 focus:ring-emerald-400/20'
              : 'border-line bg-white text-ink-900 placeholder:text-slate-400 focus:border-emerald-500 focus:ring-emerald-500/20'
          }`}
        />
        <button type="submit" disabled={status === 'loading'} className={btnCls('primary', 'md', 'w-full shrink-0 sm:w-auto')}>
          {status === 'loading' ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          Get the brief
        </button>
      </div>
      {status === 'error' && <p className="mt-2 text-sm text-rose-500">{msg}</p>}
    </form>
  );
}
