import { Suspense, useEffect, useState, type ReactNode } from 'react';

/** Renders children only once the browser is idle after the first paint (max ~2s). */
export function AfterIdle({ children, timeout = 2000 }: { children: ReactNode; timeout?: number }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const w = window as any;
    if (typeof w.requestIdleCallback === 'function') {
      const id = w.requestIdleCallback(() => setReady(true), { timeout });
      return () => w.cancelIdleCallback?.(id);
    }
    const t = setTimeout(() => setReady(true), Math.min(timeout, 1200));
    return () => clearTimeout(t);
  }, [timeout]);
  if (!ready) return null;
  return <Suspense fallback={null}>{children}</Suspense>;
}
