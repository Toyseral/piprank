import { ArrowLeft, Compass } from 'lucide-react';
import { ButtonLink } from '../components/Button';

export default function NotFound() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-28 text-center sm:px-6">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-ink-950 text-emerald-400">
        <Compass size={30} />
      </div>
      <p className="tnum mt-6 font-display text-6xl font-bold text-ink-900">404</p>
      <h1 className="mt-2 font-display text-2xl font-bold text-ink-900">This page moved — or never existed</h1>
      <p className="mt-3 text-slate-500">
        The chart you're looking for isn't here. Head back to the data.
      </p>
      <div className="mt-7 flex flex-wrap justify-center gap-3">
        <ButtonLink variant="dark" size="lg" icon={ArrowLeft} to="/">
          Back to home
        </ButtonLink>
        <ButtonLink variant="outline" size="lg" to="/brokers">
          Browse brokers
        </ButtonLink>
      </div>
    </div>
  );
}
