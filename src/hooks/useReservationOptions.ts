import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { PublicReservationOption } from '@/lib/reservationIntegration';

const rpc = supabase.rpc as unknown as (fn: string, args: unknown) => PromiseLike<{ data: unknown; error: { message: string } | null }>;

/** Native booking is switched on per deployment once provider API access is validated. */
export const NATIVE_RESERVATIONS_ENABLED = import.meta.env.VITE_ENABLE_NATIVE_RESERVATIONS === 'true';

export function useReservationOptions(restaurantId: string | undefined) {
  return useQuery({
    queryKey: ['reservation-options', restaurantId],
    enabled: !!restaurantId,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<PublicReservationOption | null> => {
      const { data, error } = await rpc('public_reservation_options', { p_restaurant_id: restaurantId });
      // A failing lookup must never break the restaurant page: fall back to legacy fields.
      if (error) return null;
      return (Array.isArray(data) ? (data[0] as PublicReservationOption | undefined) : null) ?? null;
    },
  });
}
