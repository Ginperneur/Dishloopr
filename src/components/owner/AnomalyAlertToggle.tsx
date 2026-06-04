import { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export function AnomalyAlertToggle() {
  const { user } = useAuth();
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from('owner_email_preferences' as any)
        .select('anomaly_alerts')
        .eq('user_id', user.id)
        .maybeSingle();
      setEnabled((data as any)?.anomaly_alerts ?? true);
      setLoading(false);
    })();
  }, [user?.id]);

  const toggle = async (next: boolean) => {
    if (!user) return;
    setEnabled(next);
    const { error } = await supabase
      .from('owner_email_preferences' as any)
      .upsert({ user_id: user.id, anomaly_alerts: next }, { onConflict: 'user_id' });
    if (error) {
      toast.error('Kon voorkeur niet opslaan');
      setEnabled(!next);
    } else {
      toast.success(next ? 'Funnel-alerts ingeschakeld' : 'Funnel-alerts uitgeschakeld');
    }
  };

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Bell className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="font-medium text-sm">Funnel-alert e-mails</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Direct een mail bij een kritieke daling (-40% of meer) in views, clicks, conversies of reviews.
              </p>
            </div>
          </div>
          <Switch checked={enabled} onCheckedChange={toggle} disabled={loading} />
        </div>
      </CardContent>
    </Card>
  );
}