import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

type ClickType = 'reservation' | 'website' | 'phone' | 'directions' | 'instagram' | 'tiktok' | 'google_maps';

export function useClickTracking(restaurantId: string | undefined) {
  const { user } = useAuth();

  const trackClick = useCallback(async (type: ClickType) => {
    if (!restaurantId) return;

    const sessionId = sessionStorage.getItem('session_id') || crypto.randomUUID();
    if (!sessionStorage.getItem('session_id')) {
      sessionStorage.setItem('session_id', sessionId);
    }

    if (user) {
      // Track click event
      await supabase.from('analytics_events').insert({
        restaurant_id: restaurantId,
        event_type: 'click',
        user_id: user.id,
        session_id: sessionId,
        metadata: { type } as any,
      });

      // For reservation clicks, also track intent for follow-up review email
      if (type === 'reservation') {
        await supabase.from('reservation_intents' as any).insert({
          user_id: user.id,
          restaurant_id: restaurantId,
        });
      }
    }
  }, [restaurantId, user]);

  const trackPageView = useCallback(async () => {
    if (!restaurantId) return;

    const sessionId = sessionStorage.getItem('session_id') || crypto.randomUUID();
    if (!sessionStorage.getItem('session_id')) {
      sessionStorage.setItem('session_id', sessionId);
    }

    if (user) {
      await supabase.from('analytics_events').insert({
        restaurant_id: restaurantId,
        event_type: 'view',
        user_id: user.id,
        session_id: sessionId,
      });
    }
  }, [restaurantId, user]);

  return { trackClick, trackPageView };
}
