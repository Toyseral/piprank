import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { resolveCanonicalPath } from '../lib/canonicalHub/resolver';
import CanonicalHub from './CanonicalHub';

/**
 * Two-segment country URLs are shared by the canonical country Best-For pages
 * and retired country-topic URLs. Resolve canonical ownership first; only
 * redirect to the country hub when no canonical document exists.
 */
export default function LegacyCountryTopicRedirect() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { countrySlug } = useParams<{ countrySlug: string; topicSlug: string }>();
  const [canonical, setCanonical] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    resolveCanonicalPath(pathname).then((route) => {
      if (!active) return;
      setCanonical(Boolean(route?.type === 'country-best-for'));
    }).catch(() => {
      if (active) setCanonical(false);
    });
    return () => { active = false; };
  }, [pathname]);

  useEffect(() => {
    if (canonical === false) navigate(countrySlug ? `/${countrySlug}` : '/', { replace: true });
  }, [canonical, countrySlug, navigate]);

  if (canonical === true) return <CanonicalHub />;
  return <div className="mx-auto max-w-3xl px-4 py-16 text-center text-sm text-slate-500">Redirecting…</div>;
}
