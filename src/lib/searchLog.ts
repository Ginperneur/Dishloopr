import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type SearchSource = 'search' | 'dish_page' | 'city_page';
const SESSION_KEY = 'dl_search_session';
const LAST_KEY = 'dl_last_search_log';
export const LOG_DEBOUNCE_MS = 1500;

let memoryId: string | null = null;
export function getSessionId(): string {
  try {
    let id = localStorage.getItem(SESSION_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    if (!memoryId) memoryId = Math.random().toString(36).slice(2) + Date.now().toString(36);
    return memoryId;
  }
}

/** Drops empty values and sorts keys/arrays so equal filters give the same payload. */
export function buildFilterPayload(filters: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(filters).sort()) {
    const v = filters[k];
    if (v == null || v === false || v === '') continue;
    if (Array.isArray(v)) {
      if (v.length === 0) continue;
      out[k] = [...v].map(String).sort();
    } else out[k] = v;
  }
  return out;
}

export function searchKey(source: string, query: string, city: string | null, filters: Record<string, unknown>) {
  return JSON.stringify([source, query.trim().toLowerCase(), city || '', buildFilterPayload(filters)]);
}

function readLast(): { id: number; key: string } | null {
  try { return JSON.parse(sessionStorage.getItem(LAST_KEY) || 'null'); } catch { return null; }
}

export function csvEscape(value: unknown): string {
  let s = value == null ? '' : String(value);
  if (/^[=+\-@]/.test(s)) s = `'${s}`;
  return /[",\n;]/.test(s) || s.startsWith("'") ? `"${s.replace(/"/g, '""')}"` : s;
}

interface LoggerArgs {
  source: SearchSource;
  query: string;
  city: string | null;
  filters: Record<string, unknown>;
  resultsCount: number;
  ready: boolean;
  /** When given, a key is only logged after loading went true at least once for it. */
  loading?: boolean;
  /** Part of the search that triggers a reload (default: whole key). Filter-only changes skip the loading check. */
  loadKey?: string;
}

/** Logs a search once per new term/city/filter combo, 1.5s after results are loaded. Never throws. */
export function useSearchLogger({ source, query, city, filters, resultsCount, ready, loading, loadKey }: LoggerArgs) {
  const key = searchKey(source, query, city, filters);
  const loggedKey = useRef<string | null>(readLast()?.key ?? null);
  const countRef = useRef(resultsCount);
  countRef.current = resultsCount;
  const lk = loadKey ?? key;
  const seen = useRef<{ key: string; loaded: boolean }>({ key: lk, loaded: false });
  if (seen.current.key !== lk) seen.current = { key: lk, loaded: false };
  if (loading) seen.current.loaded = true;
  const settled = loading === undefined || (seen.current.loaded && !loading);

  useEffect(() => {
    if (!ready || !settled || key === loggedKey.current) return;
    const t = setTimeout(() => {
      loggedKey.current = key;
      try {
        Promise.resolve(
          supabase.rpc('log_search' as any, {
            p_query: query.trim(),
            p_city: city || null,
            p_filters: buildFilterPayload(filters),
            p_results_count: countRef.current,
            p_source: source,
            p_session_id: getSessionId(),
          }),
        ).then(({ data }: any) => {
          if (typeof data === 'number' || typeof data === 'string') {
            try { sessionStorage.setItem(LAST_KEY, JSON.stringify({ id: Number(data), key })); } catch { /* ignore */ }
          }
        }).catch(() => {});
      } catch { /* ignore */ }
    }, LOG_DEBOUNCE_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, ready, settled]);
}

/** Fire-and-forget click attribution to the last logged search. */
export function logSearchClick(restaurantId: string) {
  try {
    const last = readLast();
    if (!last?.id) return;
    Promise.resolve(
      supabase.rpc('log_search_click' as any, {
        p_log_id: last.id, p_restaurant_id: restaurantId, p_session_id: getSessionId(),
      }),
    ).catch(() => {});
  } catch { /* ignore */ }
}
