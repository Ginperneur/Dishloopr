import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'recentSearches';
const MAX_SEARCHES = 10;

export function useSearchHistory() {
  const [searches, setSearches] = useState<string[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setSearches(JSON.parse(stored));
      } catch {
        setSearches([]);
      }
    }
  }, []);

  const addSearch = useCallback((query: string) => {
    if (!query.trim()) return;
    
    setSearches((prev) => {
      // Remove duplicates and add new search at the beginning
      const filtered = prev.filter((s) => s.toLowerCase() !== query.toLowerCase());
      const updated = [query, ...filtered].slice(0, MAX_SEARCHES);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const clearHistory = useCallback(() => {
    setSearches([]);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return {
    searches,
    addSearch,
    clearHistory,
  };
}
