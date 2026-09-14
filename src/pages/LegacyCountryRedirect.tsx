import { Navigate, useParams } from 'react-router-dom';

/** Compatibility redirect for the retired /countries/:slug country namespace. */
export default function LegacyCountryRedirect() {
  const { slug } = useParams<{ slug: string }>();
  if (!slug) return <Navigate to="/countries" replace />;
  return <Navigate to={`/${encodeURIComponent(slug)}`} replace />;
}
