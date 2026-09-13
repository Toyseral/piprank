import { Navigate, useParams } from 'react-router-dom';

/**
 * Legacy /countries/:slug fallback.
 * The Vercel 301 remains the preferred SEO redirect; this handles client-side
 * navigation when the server redirect is not involved.
 */
export default function LegacyCountryRedirect() {
  const { slug } = useParams<{ slug: string }>();

  if (!slug) {
    return <Navigate to="/countries" replace />;
  }

  return <Navigate to={`/${slug}`} replace />;
}
