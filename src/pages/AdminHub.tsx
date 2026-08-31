import type { Session } from '@supabase/supabase-js';
import AdminCountryWorkspace from './AdminCountryWorkspace';
import AdminHubNew from './AdminHubNew';

export default function AdminHub(props: { session: Session; role: string }) {
  const legacy = new URLSearchParams(window.location.search).get('legacy') === '1';
  return legacy ? <AdminHubNew {...props} /> : <AdminCountryWorkspace {...props} />;
}
