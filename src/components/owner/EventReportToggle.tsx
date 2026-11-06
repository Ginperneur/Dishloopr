import { useEffect, useState } from 'react';
import { PartyPopper } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

/** Opt-out for the monthly event report mail (send-monthly-event-report). */
export function EventReportToggle() {
  const { user } = useAuth();
  const userId = user?.id;
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      const { data } = await supabase
        .from('owner_email_preferences')
        .select('event_report')
        .eq('user_id', userId)
        .maybeSingle();
      setEnabled(data?.event_report ?? true);
      setLoading(false);
    })();
  }, [userId]);

  const toggle = async (next: boolean) => {
    if (!user) return;
    setEnabled(next);
    const { error } = await supabase
      .from('owner_email_preferences')
      .upsert({ user_id: user.id, event_report: next }, { onConflict: 'user_id' });
    if (error) {
      toast.error('Kon voorkeur niet opslaan');
      setEnabled(!next);
    } else {
      toast.success(next ? 'Maandrapport evenementen ingeschakeld' : 'Maandrapport evenementen uitgeschakeld');
    }
  };

  return (
    <Card id="evenementen-rapport">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <PartyPopper className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium">Maandrapport evenementen</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Op de 1e van de maand: hoe vaak je evenementen in beeld waren en hoe vaak ze zijn bekeken.
              </p>
            </div>
          </div>
          <Switch checked={enabled} onCheckedChange={toggle} disabled={loading} aria-label="Maandrapport evenementen" />
        </div>
      </CardContent>
    </Card>
  );
}
