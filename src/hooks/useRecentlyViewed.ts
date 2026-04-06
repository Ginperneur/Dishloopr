import { useState, useEffect, useCallback } from 'react';

interface RecentlyViewedItem {
  slug: string;
  name: string;
  image?: string;
  timestamp: number;
}

const STORAGE_KEY = 'dishloopr_recently_viewed';
const MAX_ITEMS = 20;

export function useRecentlyViewed() {
  const [items, setItems] = useState<RecentlyViewedItem[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setItems(JSON.parse(stored));
    } catch {}
  }, []);

  const addItem = useCallback((item: Omit<RecentlyViewedItem, 'timestamp'>) => {
    setItems(prev => {
      const filtered = prev.filter(i => i.slug !== item.slug);
      const updated = [{ ...item, timestamp: Date.now() }, ...filtered].slice(0, MAX_ITEMS);
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(updated)); } catch {}
      return updated;
    });
  }, []);

  const isRecentlyViewed = useCallback((slug: string) => {
    return items.some(i => i.slug === slug);
  }, [items]);

  return { recentlyViewed: items, addItem, isRecentlyViewed };
}
