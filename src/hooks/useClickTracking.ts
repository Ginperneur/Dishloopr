import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

type ClickType = 'reservation' | 'website' | 'phone' | 'directions' | 'instagram' | 'tiktok' | 'google_maps';

const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'] as const;

function captureUtm(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  // Persist first-seen UTM for the session so all clicks inherit attribution
  const stored = sessionStorage.getItem('utm_attribution');
  if (stored) {
    try { return JSON.parse(stored); } catch { /* ignore */ }
  }
  const params = new URLSearchParams(window.location.search);
  const utm: Record<string, string> = {};
  for (const k of UTM_KEYS) {
    const v = params.get(k);
    if (v) utm[k] = v.toLowerCase().trim();
  }
  // Fallback referrer-based attribution
  if (!utm.utm_source && document.referrer) {
    try {
      const ref = new URL(document.referrer);
      if (!ref.hostname.includes(window.location.hostname)) {
        utm.utm_source = ref.hostname.replace(/^www\./, '');
        utm.utm_medium = 'referral';
      }
    } catch { /* ignore */ }
  }
  if (Object.keys(utm).length > 0) {
    sessionStorage.setItem('utm_attribution', JSON.stringify(utm));
  }
  return utm;
}

export function useClickTracking(restaurantId: string | undefined) {
  const { user } = useAuth();

  const trackClick = useCallback(async (type: ClickType) => {
    if (!restaurantId) return;

    const sessionId = sessionStorage.getItem('session_id') || crypto.randomUUID();
    if (!sessionStorage.getItem('session_id')) {
      sessionStorage.setItem('session_id', sessionId);
    }

    const utm = captureUtm();

    if (user) {
      // Track click event
      await supabase.from('analytics_events').insert({
        restaurant_id: restaurantId,
        event_type: 'click',
        user_id: user.id,
        session_id: sessionId,
        metadata: { type, ...utm } as any,
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

    const utm = captureUtm();

    if (user) {
      await supabase.from('analytics_events').insert({
        restaurant_id: restaurantId,
        event_type: 'view',
        user_id: user.id,
        session_id: sessionId,
        metadata: Object.keys(utm).length ? (utm as any) : undefined,
      });
    }
  }, [restaurantId, user]);

  return { trackClick, trackPageView };
}
