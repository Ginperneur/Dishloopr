import { lazy, ComponentType } from 'react';

/**
 * Wrap React.lazy with automatic retry + one-time hard reload on chunk load failure.
 * Fixes "Failed to fetch dynamically imported module" after a new deploy when the
 * user has an old tab open and the hashed chunk filenames have changed.
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>
) {
  return lazy(async () => {
    const RELOAD_KEY = 'lazy-chunk-reloaded';
    try {
      return await factory();
    } catch (err: any) {
      const msg = String(err?.message || err);
      const isChunkError =
        /Failed to fetch dynamically imported module/i.test(msg) ||
        /Importing a module script failed/i.test(msg) ||
        /ChunkLoadError/i.test(msg) ||
        /Loading chunk \d+ failed/i.test(msg);

      if (!isChunkError) throw err;

      // Retry once silently
      try {
        return await factory();
      } catch {
        // Hard reload exactly once to pick up new chunk filenames
        if (typeof window !== 'undefined' && !sessionStorage.getItem(RELOAD_KEY)) {
          sessionStorage.setItem(RELOAD_KEY, '1');
          window.location.reload();
          // Return a never-resolving promise so React keeps the suspense fallback
          return new Promise(() => {}) as any;
        }
        throw err;
      }
    }
  });
}