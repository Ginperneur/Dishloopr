import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

type ClickType = 'reservation' | 'website' | 'phone' | 'directions' | 'instagram' | 'tiktok' | 'google_maps';

export function useClickTracking(restaurantId: string | undefined) {
  const { user } = useAuth();

  const trackClick = useCallback(async (type: ClickType) => {
    if (!restaurantId) return;

    // Track in analytics_events (works for all users)
    const sessionId = sessionStorage.getItem('session_id') || crypto.randomUUID();
    if (!sessionStorage.getItem('session_id')) {
      sessionStorage.setItem('session_id', sessionId);
    }

    // Only insert if user is authenticated (RLS requires auth)
    if (user) {
      await supabase.from('analytics_events').insert({
        restaurant_id: restaurantId,
        event_type: 'click',
        user_id: user.id,
        session_id: sessionId,
        metadata: { type } as any,
      });

      // For reservation clicks, also track intent for follow-up
      if (type === 'reservation') {
        await supabase.from('reservation_intents').insert({
          user_id: user.id,
          restaurant_id: restaurantId,
        }).then(({ error }) => {
          if (error && !error.message.includes('duplicate')) {
            console.error('Failed to track reservation intent:', error);
          }
        });
      }
    }
  }, [restaurantId, user]);

  return { trackClick };
}
