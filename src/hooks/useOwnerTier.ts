import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type OwnerTier = 'basic' | 'pro';

export function useOwnerTier(restaurantId: string | undefined) {
  return useQuery({
    queryKey: ['owner-tier', restaurantId],
    enabled: !!restaurantId,
    queryFn: async (): Promise<OwnerTier> => {
      const { data } = await supabase
        .from('restaurants')
        .select('owner_tier' as any)
        .eq('id', restaurantId!)
        .maybeSingle();
      const tier = (data as any)?.owner_tier as OwnerTier | undefined;
      return tier === 'pro' ? 'pro' : 'basic';
    },
  });
}