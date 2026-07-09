import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { ProBillingInterval } from '@/lib/proPricing';
import { CHECKOUT_ENABLED, COMING_SOON_TOAST } from '@/lib/checkoutFlags';

export function useOwnerProCheckout() {
  const [loading, setLoading] = useState<ProBillingInterval | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const queryClient = useQueryClient();

  const startCheckout = async (interval: ProBillingInterval = 'monthly') => {
    if (!CHECKOUT_ENABLED.pro) {
      toast.info(COMING_SOON_TOAST);
      return;
    }
    try {
      setLoading(interval);
      const { data, error } = await supabase.functions.invoke('create-owner-pro-checkout', {
        body: { interval },
      });
      if (error) throw error;
      if (!data?.url) throw new Error('Geen checkout URL ontvangen');
      window.open(data.url, '_blank');
    } catch (e: any) {
      toast.error('Kon checkout niet starten', { description: e?.message });
    } finally {
      setLoading(null);
    }
  };

  const openPortal = async () => {
    try {
      setPortalLoading(true);
      const { data, error } = await supabase.functions.invoke('owner-pro-portal');
      if (error) throw error;
      if (!data?.url) throw new Error('Geen portal URL ontvangen');
      window.open(data.url, '_blank');
    } catch (e: any) {
      toast.error('Kon abonnementsbeheer niet openen', { description: e?.message });
    } finally {
      setPortalLoading(false);
    }
  };

  const refreshStatus = async () => {
    try {
      await supabase.functions.invoke('check-owner-pro-status');
    } catch (e) {
      // silent
    } finally {
      queryClient.invalidateQueries({ queryKey: ['owner-tier'] });
    }
  };

  return { startCheckout, openPortal, refreshStatus, loading, portalLoading };
}