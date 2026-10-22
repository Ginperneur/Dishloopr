import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

type ClickType = 'reservation' | 'website' | 'phone' | 'directions' | 'instagram' | 'tiktok' | 'google_maps';

export function useClickTracking(restaurantId: string | undefined) {
  const { user } = useAuth();

  const trackClick = useCallback(async (type: ClickType) => {
    if (!restaurantId) return;

    // Preserve the existing signed-in review follow-up, not visitor analytics.
    if (user && type === 'reservation') {
      try {
        await supabase.from('reservation_intents').insert({
          user_id: user.id,
          restaurant_id: restaurantId,
        });
      } catch { /* Follow-up must never interrupt navigation. */ }
    }
  }, [restaurantId, user]);

  // Public counters are recorded by the cookieless metrics layer.
  const trackPageView = useCallback(() => {}, []);

  return { trackClick, trackPageView };
}
