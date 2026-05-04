import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'dl_saved_searches';
const MAX_SAVED = 8;

export interface SavedSearch {
  id: string; // unique key (dish + city + cuisine)
  label: string; // human readable
  dish?: string;
  city?: string;
  cityName?: string;
  cuisine?: string;
  url: string; // /search?dish=...&city=...
  createdAt: number;
}

function buildId(s: Omit<SavedSearch, 'id' | 'createdAt' | 'url' | 'label'>): string {
  return [s.dish || '', s.city || '', s.cuisine || ''].join('|').toLowerCase();
}

export function useSavedSearches() {
  const [saved, setSaved] = useState<SavedSearch[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setSaved(JSON.parse(raw));
    } catch {
      setSaved([]);
    }
  }, []);

  const persist = (next: SavedSearch[]) => {
    setSaved(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore quota errors */
    }
  };

  const isSaved = useCallback(
    (parts: { dish?: string; city?: string; cuisine?: string }) => {
      const id = buildId(parts);
      return saved.some((s) => s.id === id);
    },
    [saved]
  );

  const save = useCallback(
    (parts: Omit<SavedSearch, 'id' | 'createdAt'>) => {
      const id = buildId(parts);
      const entry: SavedSearch = { ...parts, id, createdAt: Date.now() };
      const filtered = saved.filter((s) => s.id !== id);
      const next = [entry, ...filtered].slice(0, MAX_SAVED);
      persist(next);
    },
    [saved]
  );

  const remove = useCallback(
    (id: string) => {
      persist(saved.filter((s) => s.id !== id));
    },
    [saved]
  );

  const toggle = useCallback(
    (parts: Omit<SavedSearch, 'id' | 'createdAt'>) => {
      const id = buildId(parts);
      if (saved.some((s) => s.id === id)) {
        persist(saved.filter((s) => s.id !== id));
        return false;
      }
      save(parts);
      return true;
    },
    [saved, save]
  );

  const clearAll = useCallback(() => persist([]), []);

  return { saved, isSaved, save, remove, toggle, clearAll };
}