import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getGeo, geoShortName, setGeoPreference, GEO_OPTIONS, type GeoGuess } from '../lib/geo';

const STORE_KEY = 'piprank_geo_dismissed';

export default function GeoBanner() {
  const [guess, setGuess] = useState<GeoGuess | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    try {
      if (localStorage.getItem(STORE_KEY)) return;
      setGuess(getGeo());
    } catch {
      /* stay silent */
    }
  }, []);

  if (!guess) return null;

  const dismiss = () => {
    localStorage.setItem(STORE_KEY, '1');
    setGuess(null);
  };

  return (
    <div className="mx-auto max-w-7xl px-4 pt-6 sm:px-6">
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50 via-white to-white px-4 py-3 shadow-soft">
        <span className="text-2xl">{guess.flag}</span>
        <p className="flex min-w-0 flex-1 items-center gap-1.5 text-sm font-semibold text-ink-900">
          <MapPin size={15} className="shrink-0 text-emerald-600" />
          <span className="line-clamp-2 sm:line-clamp-none">
            Looks like you're trading from {geoShortName(guess)} — see brokers that actually onboard there.
          </span>
        </p>
        <Link
          to={`/countries/${guess.slug}`}
          onClick={() => {
            setGeoPreference(guess.slug);
            dismiss();
          }}
          className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-ink-950 px-3.5 py-2 text-xs font-bold text-white transition hover:bg-ink-800 sm:ml-auto"
        >
          {guess.name} picks →
        </Link>
        <select
          value=""
          onChange={(e) => {
            const v = e.target.value;
            if (!v) return;
            setGeoPreference(v);
            dismiss();
            navigate(`/countries/${v}`);
          }}
          className="h-8 rounded-lg border border-line bg-white px-2 text-xs font-semibold text-slate-500 outline-none transition hover:border-ink-900 focus:border-emerald-500"
          aria-label="Wrong region? Pick yours"
          title="Wrong region? Pick yours"
        >
          <option value="">Wrong region? Change ▾</option>
          {GEO_OPTIONS.filter((g) => g.slug !== guess.slug).map((g) => (
            <option key={g.slug} value={g.slug}>
              {g.flag} {g.name}
            </option>
          ))}
        </select>
        <button
          onClick={dismiss}
          className="rounded-lg p-1.5 text-slate-400 transition hover:bg-paper hover:text-ink-900"
          aria-label="Dismiss"
        >
          <X size={15} />
        </button>
      </div>
    </div>
  );
}
