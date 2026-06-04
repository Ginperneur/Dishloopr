import { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

type Freq = 'daily' | 'weekly';
type Sev = 'critical' | 'critical_and_warning';

export function AnomalyAlertToggle() {
  const { user } = useAuth();
  const [enabled, setEnabled] = useState(true);
  const [frequency, setFrequency] = useState<Freq>('daily');
  const [severity, setSeverity] = useState<Sev>('critical');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from('owner_email_preferences' as any)
        .select('anomaly_alerts, anomaly_alert_frequency, anomaly_alert_severity')
        .eq('user_id', user.id)
        .maybeSingle();
      const d = data as any;
      setEnabled(d?.anomaly_alerts ?? true);
      setFrequency((d?.anomaly_alert_frequency as Freq) ?? 'daily');
      setSeverity((d?.anomaly_alert_severity as Sev) ?? 'critical');
      setLoading(false);
    })();
  }, [user?.id]);

  const persist = async (patch: Record<string, unknown>, successMsg: string, rollback: () => void) => {
    if (!user) return;
    const { error } = await supabase
      .from('owner_email_preferences' as any)
      .upsert({ user_id: user.id, ...patch }, { onConflict: 'user_id' });
    if (error) {
      toast.error('Kon voorkeur niet opslaan');
      rollback();
    } else {
      toast.success(successMsg);
    }
  };

  const toggle = (next: boolean) => {
    const prev = enabled;
    setEnabled(next);
    persist(
      { anomaly_alerts: next },
      next ? 'Funnel-alerts ingeschakeld' : 'Funnel-alerts uitgeschakeld',
      () => setEnabled(prev),
    );
  };

  const changeFrequency = (next: Freq) => {
    const prev = frequency;
    setFrequency(next);
    persist(
      { anomaly_alert_frequency: next },
      next === 'daily' ? 'Dagelijkse alerts' : 'Wekelijkse alerts (maandag)',
      () => setFrequency(prev),
    );
  };

  const changeSeverity = (next: Sev) => {
    const prev = severity;
    setSeverity(next);
    persist(
      { anomaly_alert_severity: next },
      next === 'critical' ? 'Alleen kritieke alerts' : 'Kritiek + waarschuwingen',
      () => setSeverity(prev),
    );
  };

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Bell className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="font-medium text-sm">Funnel-alert e-mails</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Krijg een mail wanneer kerncijfers (views, clicks, conversies, reviews) duidelijk dalen.
              </p>
            </div>
          </div>
          <Switch checked={enabled} onCheckedChange={toggle} disabled={loading} />
        </div>

        {enabled && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pl-12">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Frequentie</Label>
              <Select
                value={frequency}
                onValueChange={(v) => changeFrequency(v as Freq)}
                disabled={loading}
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Dagelijks</SelectItem>
                  <SelectItem value="weekly">Wekelijks (maandag)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Ernst</Label>
              <Select
                value={severity}
                onValueChange={(v) => changeSeverity(v as Sev)}
                disabled={loading}
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="critical">Alleen kritiek (-40% of meer)</SelectItem>
                  <SelectItem value="critical_and_warning">Kritiek + waarschuwing (-20%)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}