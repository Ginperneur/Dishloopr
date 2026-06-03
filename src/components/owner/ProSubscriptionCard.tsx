import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Crown, ExternalLink, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ProStatus {
  active: boolean;
  status?: string;
  current_period_end?: string | null;
  cancel_at_period_end?: boolean;
}

export function ProSubscriptionCard() {
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState(false);
  const [status, setStatus] = useState<ProStatus | null>(null);

  useEffect(() => {
    void load();
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('check-owner-pro-status', { body: {} });
      if (error) throw error;
      setStatus(data as ProStatus);
    } catch (e) {
      console.error('Pro status error', e);
    } finally {
      setLoading(false);
    }
  };

  const openPortal = async () => {
    setOpening(true);
    try {
      const { data, error } = await supabase.functions.invoke('owner-pro-portal', { body: {} });
      if (error) throw error;
      const url = (data as any)?.url;
      if (url) {
        window.open(url, '_blank', 'noopener,noreferrer');
      } else {
        toast.error('Kon abonnement-portaal niet openen');
      }
    } catch (e: any) {
      toast.error('Portaal niet beschikbaar: ' + (e.message || 'onbekende fout'));
    } finally {
      setOpening(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Abonnement laden…
        </CardContent>
      </Card>
    );
  }

  if (!status?.active) return null;

  const renewDate = status.current_period_end
    ? new Date(status.current_period_end).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })
    : null;

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardContent className="py-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-primary/15 flex items-center justify-center">
            <Crown className="h-4 w-4 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold">Owner Pro actief</span>
              <Badge variant="secondary" className="text-xs">{status.status ?? 'active'}</Badge>
            </div>
            {renewDate && (
              <p className="text-xs text-muted-foreground">
                {status.cancel_at_period_end ? 'Verloopt' : 'Verlengt'} op {renewDate}
              </p>
            )}
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={openPortal} disabled={opening}>
          {opening ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ExternalLink className="h-4 w-4 mr-2" />}
          Beheer abonnement
        </Button>
      </CardContent>
    </Card>
  );
}
