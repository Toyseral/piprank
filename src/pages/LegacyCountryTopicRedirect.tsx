import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

/**
 * Country-topic pages no longer own content. Old URLs are retained only as a
 * migration surface and are redirected to the country hub instead of rendering
 * legacy ranking/topic content.
 */
export default function LegacyCountryTopicRedirect() {
  const navigate = useNavigate();
  const { countrySlug } = useParams<{ countrySlug: string; topicSlug: string }>();

  useEffect(() => {
    navigate(countrySlug ? `/${countrySlug}` : '/', { replace: true });
  }, [countrySlug, navigate]);

  return <div className="mx-auto max-w-3xl px-4 py-16 text-center text-sm text-slate-500">Redirecting…</div>;
}
