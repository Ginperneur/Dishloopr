import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface UserList {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  emoji: string | null;
  color: string | null;
  is_public: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
  item_count?: number;
  restaurant_ids?: string[];
}

export function useUserLists() {
  const { user } = useAuth();
  const [lists, setLists] = useState<UserList[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchLists = useCallback(async () => {
    if (!user) {
      setLists([]);
      return;
    }
    setLoading(true);
    const { data: listData, error } = await supabase
      .from('user_lists')
      .select('*')
      .eq('user_id', user.id)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching lists', error);
      setLoading(false);
      return;
    }

    const ids = (listData || []).map((l) => l.id);
    let items: { list_id: string; restaurant_id: string }[] = [];
    if (ids.length) {
      const { data: itemData } = await supabase
        .from('user_list_items')
        .select('list_id, restaurant_id')
        .in('list_id', ids);
      items = itemData || [];
    }

    const byList = new Map<string, string[]>();
    items.forEach((it) => {
      const arr = byList.get(it.list_id) || [];
      arr.push(it.restaurant_id);
      byList.set(it.list_id, arr);
    });

    setLists(
      (listData || []).map((l) => ({
        ...l,
        restaurant_ids: byList.get(l.id) || [],
        item_count: (byList.get(l.id) || []).length,
      })) as UserList[]
    );
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchLists();
  }, [fetchLists]);

  const createList = useCallback(
    async (input: { name: string; emoji?: string; description?: string; is_public?: boolean }) => {
      if (!user) {
        toast.error('Log in om een lijst te maken');
        return null;
      }
      const { data, error } = await supabase
        .from('user_lists')
        .insert({
          user_id: user.id,
          name: input.name.trim(),
          emoji: input.emoji || null,
          description: input.description?.trim() || null,
          is_public: !!input.is_public,
        })
        .select('*')
        .single();
      if (error || !data) {
        toast.error('Kon lijst niet maken');
        return null;
      }
      toast.success('Lijst aangemaakt');
      await fetchLists();
      return data as UserList;
    },
    [user, fetchLists]
  );

  const updateList = useCallback(
    async (id: string, patch: Partial<Pick<UserList, 'name' | 'emoji' | 'description' | 'is_public'>>) => {
      const { error } = await supabase.from('user_lists').update(patch).eq('id', id);
      if (error) {
        toast.error('Kon lijst niet bijwerken');
        return false;
      }
      await fetchLists();
      return true;
    },
    [fetchLists]
  );

  const deleteList = useCallback(
    async (id: string) => {
      const { error } = await supabase.from('user_lists').delete().eq('id', id);
      if (error) {
        toast.error('Kon lijst niet verwijderen');
        return false;
      }
      toast.success('Lijst verwijderd');
      await fetchLists();
      return true;
    },
    [fetchLists]
  );

  const addToList = useCallback(
    async (listId: string, restaurantId: string) => {
      const { error } = await supabase
        .from('user_list_items')
        .insert({ list_id: listId, restaurant_id: restaurantId });
      if (error && error.code !== '23505') {
        toast.error('Kon niet toevoegen');
        return false;
      }
      await fetchLists();
      return true;
    },
    [fetchLists]
  );

  const removeFromList = useCallback(
    async (listId: string, restaurantId: string) => {
      const { error } = await supabase
        .from('user_list_items')
        .delete()
        .eq('list_id', listId)
        .eq('restaurant_id', restaurantId);
      if (error) {
        toast.error('Kon niet verwijderen');
        return false;
      }
      await fetchLists();
      return true;
    },
    [fetchLists]
  );

  const listsContaining = useCallback(
    (restaurantId: string) => lists.filter((l) => (l.restaurant_ids || []).includes(restaurantId)),
    [lists]
  );

  return {
    lists,
    loading,
    refetch: fetchLists,
    createList,
    updateList,
    deleteList,
    addToList,
    removeFromList,
    listsContaining,
  };
}