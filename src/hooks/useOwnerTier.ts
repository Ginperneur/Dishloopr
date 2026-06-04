import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type OwnerTier = 'basic' | 'pro';

export function useOwnerTier(restaurantId: string | undefined) {
  return useQuery({
    queryKey: ['owner-tier', restaurantId],
    enabled: !!restaurantId,
    queryFn: async (): Promise<OwnerTier> => {
      const { data, error } = await supabase
        .from('restaurants')
        .select('owner_tier')
        .eq('id', restaurantId!)
        .maybeSingle();
      if (error) {
        console.warn('[useOwnerTier] fetch failed', error);
        return 'basic';
      }
      return data?.owner_tier === 'pro' ? 'pro' : 'basic';
    },
  });
}