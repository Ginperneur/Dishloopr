import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Crown } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';

interface Props {
  restaurantId: string;
  onUpdate?: () => void;
}

export function OwnerProAccess({ restaurantId, onUpdate }: Props) {
  const queryClient = useQueryClient();
  const [access, setAccess] = useState<{ override: boolean; tier: string } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setAccess(null);
    supabase.from('restaurants').select('owner_pro_override, owner_tier')
      .eq('id', restaurantId).single().then(({ data, error }) => {
        if (cancelled) return;
        if (error) toast.error('Pro-toegang ophalen mislukt');
        else setAccess({ override: data.owner_pro_override, tier: data.owner_tier });
      });
    return () => { cancelled = true; };
  }, [restaurantId]);

  const changeAccess = async (enabled: boolean) => {
    setSaving(true);
    try {
      const { data, error } = await supabase.rpc('admin_set_restaurant_owner_pro', {
        p_restaurant_id: restaurantId, p_enabled: enabled,
      });
      if (error) throw error;
      setAccess({ override: enabled, tier: data });
      await queryClient.invalidateQueries({ queryKey: ['owner-tier', restaurantId] });
      toast.success(enabled ? 'Gratis Owner Pro toegekend' : 'Gratis Owner Pro ingetrokken');
      onUpdate?.();
    } catch {
      toast.error('Pro-toegang wijzigen mislukt');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="flex flex-wrap items-center justify-between gap-4 border-b py-4">
      <div className="flex items-center gap-2">
        <Crown className="h-5 w-5 text-primary" />
        <h3 className="font-semibold">Owner Pro</h3>
        <Badge variant={access?.tier === 'pro' ? 'default' : 'secondary'}>
          {access ? (access.tier === 'pro' ? 'Pro' : 'Basic') : 'Laden…'}
        </Badge>
        {access?.tier === 'pro' && !access.override && <Badge variant="outline">Abonnement</Badge>}
      </div>
      <div className="flex min-h-11 items-center gap-3">
        <Label htmlFor={`pro-access-${restaurantId}`} className="cursor-pointer">Gratis Pro-toegang</Label>
        <Switch id={`pro-access-${restaurantId}`} checked={access?.override ?? false}
          disabled={!access || saving} onCheckedChange={changeAccess} />
      </div>
    </section>
  );
}