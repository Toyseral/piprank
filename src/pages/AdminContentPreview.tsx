import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { ContentDocument } from '../lib/types';
import type { CanonicalRoute } from '../lib/canonicalHub/types';
import ContentRenderer from '../components/ContentRenderer';
import supabase from '../lib/supabase';
import { Loader2, LockKeyhole, ArrowLeft } from 'lucide-react';

type PreviewState = 'loading' | 'ready' | 'error';

export default function AdminContentPreview() {
  const { id } = useParams<{ id: string }>();
  const [state, setState] = useState<PreviewState>('loading');
  const [message, setMessage] = useState('');
  const [route, setRoute] = useState<CanonicalRoute | null>(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!active) return;

      const currentSession = sessionData.session;
      if (!currentSession) {
        setState('error');
        setMessage('Your admin session has expired. Sign in again to preview this draft.');
        return;
      }

      const documentId = Number(id);
      if (!Number.isInteger(documentId) || documentId <= 0) {
        setState('error');
        setMessage('This preview link is invalid.');
        return;
      }

      const res = await fetch(`/api/content-documents?id=${documentId}&admin=true`, {
        headers: { Authorization: `Bearer ${currentSession.access_token}` },
      });
      const data = await res.json().catch(() => null);

      if (!res.ok || !data) {
        setState('error');
        setMessage(data?.error || 'The draft could not be loaded.');
        return;
      }

      if (data.content_type !== 'country-best-for' || !data.country_slug || !data.slug) {
        setState('error');
        setMessage('Only canonical country Best-For documents can be previewed here.');
        return;
      }

      const previewDocument: ContentDocument = {
        ...data,
        // ContentRenderer intentionally hides unpublished documents. The route
        // itself is protected by the authenticated admin API above, so this
        // temporary flag only enables the normal public renderer for preview.
        published: true,
        indexable: false,
      };

      const previewPath = `/${previewDocument.country_slug}/${previewDocument.slug}`;
      const previewRoute: CanonicalRoute = {
        type: 'country-best-for',
        path: previewPath,
        canonicalPath: previewPath,
        contentKey: previewDocument.content_key,
        countrySlug: previewDocument.country_slug,
        topicSlug: previewDocument.topic_slug || undefined,
        slug: previewDocument.slug,
        indexable: false,
        published: true,
        document: previewDocument,
      };

      if (!active) return;
      setRoute(previewRoute);
      setState('ready');
    };

    load().catch((error) => {
      if (!active) return;
      setState('error');
      setMessage(error instanceof Error ? error.message : 'The draft could not be loaded.');
    });

    return () => {
      active = false;
    };
  }, [id]);

  if (state === 'loading') {
    return <div className="flex min-h-screen items-center justify-center bg-paper"><Loader2 className="animate-spin text-emerald-600" size={28} /></div>;
  }

  if (state === 'error' || !route) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper px-4">
        <div className="w-full max-w-md rounded-3xl border border-line bg-white p-7 text-center shadow-soft-lg">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-500"><LockKeyhole size={22} /></div>
          <h1 className="mt-4 font-display text-xl font-bold text-ink-900">Draft preview unavailable</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">{message}</p>
          <Link to="/archypage" className="mt-5 inline-flex items-center gap-2 rounded-xl bg-ink-950 px-4 py-2.5 text-sm font-bold text-white"><ArrowLeft size={15} /> Back to Console</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen">
      <div className="fixed left-0 right-0 top-0 z-[120] flex items-center justify-between gap-3 border-b border-amber-200 bg-amber-50/95 px-4 py-2 text-xs shadow-sm backdrop-blur">
        <div className="min-w-0">
          <span className="font-bold text-amber-900">Draft preview</span>
          <span className="ml-2 hidden text-amber-700 sm:inline">Only visible to authenticated admin users.</span>
        </div>
        <Link to="/archypage" className="shrink-0 rounded-lg bg-white px-3 py-1.5 font-bold text-ink-900 ring-1 ring-amber-200 hover:bg-amber-100">Back to Console</Link>
      </div>
      <div className="pt-9">
        <ContentRenderer route={route} />
      </div>
    </div>
  );
}
