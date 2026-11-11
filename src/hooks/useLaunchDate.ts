import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const FALLBACK = '2026-12-01';

/** Public launch date from app_settings.launch_date, formatted as "10 december 2026". */
export function useLaunchDate() {
  const { data } = useQuery({
    queryKey: ['public-launch-date'],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)('public_launch_date');
      if (error) throw error;
      return (data as string | null) ?? FALLBACK;
    },
    staleTime: 60 * 60_000,
  });
  const iso = data ?? FALLBACK;
  return { iso, label: new Date(`${iso}T12:00:00`).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' }) };
}
