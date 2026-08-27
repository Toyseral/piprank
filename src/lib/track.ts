/** Anonymous product-analytics tracking. Fire-and-forget; never blocks UI. */

const SID_KEY = 'piprank_sid';

export function getSessionId(): string {
  try {
    let sid = sessionStorage.getItem(SID_KEY);
    if (!sid) {
      sid = (crypto as { randomUUID?: () => string }).randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36);
      sessionStorage.setItem(SID_KEY, sid);
    }
    return sid;
  } catch {
    return 'nosession';
  }
}

export function track(type: string, meta: Record<string, unknown> = {}): void {
  try {
    void fetch('/api/track?resource=events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, meta, session: getSessionId() }),
      keepalive: true,
    });
  } catch {
    /* analytics must never break the app */
  }
}
