import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/** True when at least one active restaurant is featured or top-listed. */
export function useHasFeatured(): boolean {
  const { data } = useQuery({
    queryKey: ['has-featured-restaurants'],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { count, error } = await supabase
        .from('restaurants')
        .select('id', { count: 'exact', head: true })
        .eq('is_active', true)
        .or('is_featured.eq.true,is_top_listing.eq.true');
      if (error) return false;
      return (count ?? 0) > 0;
    },
  });
  return data === true;
}
