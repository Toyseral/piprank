import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { detectGeo, getGeo, setGeoPreference, GEO_OPTIONS, type GeoGuess } from './geo';
import { fetchGeo } from './api';

interface GeoContextValue {
  country: GeoGuess | null;
  source: 'manual' | 'auto' | null;
  ready: boolean;
  setCountry: (slug: string | null) => void;
}

const GeoContext = createContext<GeoContextValue | null>(null);

export function GeoProvider({ children }: { children: ReactNode }) {
  const [country, setCountryState] = useState<GeoGuess | null>(() => getGeo());
  const [source, setSource] = useState<'manual' | 'auto' | null>(() => {
    try {
      const saved = localStorage.getItem('piprank_geo_source');
      return saved === 'manual' || saved === 'auto' ? saved : null;
    } catch { return null; }
  });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const saved = getGeo();
    if (saved) {
      setReady(true);
      // Still ask the server for an IP signal only when there is no explicit manual choice.
      if (source === 'manual') return () => { cancelled = true; };
    }

    fetchGeo()
      .then((remote) => {
        if (cancelled) return;
        const match = remote?.slug ? GEO_OPTIONS.find((g) => g.slug === remote.slug) : null;
        if (match && source !== 'manual') {
          setCountryState(match);
          setGeoPreference(match.slug, 'auto');
          setSource('auto');
        } else if (!saved) {
          const passive = detectGeo();
          if (passive) {
            setCountryState(passive);
            setGeoPreference(passive.slug, 'auto');
            setSource('auto');
          }
        }
      })
      .catch(() => {
        if (!saved) {
          const passive = detectGeo();
          if (passive) {
            setCountryState(passive);
            setGeoPreference(passive.slug, 'auto');
            setSource('auto');
          }
        }
      })
      .finally(() => { if (!cancelled) setReady(true); });

    return () => { cancelled = true; };
  }, []);

  const setCountry = useCallback((slug: string | null) => {
    const match = slug ? GEO_OPTIONS.find((g) => g.slug === slug) ?? null : null;
    setCountryState(match);
    setSource(match ? 'manual' : null);
    setGeoPreference(slug, 'manual');
  }, []);

  const value = useMemo(() => ({ country, source, ready, setCountry }), [country, source, ready, setCountry]);
  return <GeoContext.Provider value={value}>{children}</GeoContext.Provider>;
}

export function useGeo() {
  const value = useContext(GeoContext);
  if (!value) throw new Error('useGeo must be used inside GeoProvider');
  return value;
}
