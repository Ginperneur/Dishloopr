import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Mail, Send, Eye, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export function MissingReservationOutreach() {
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [resendAfterDays, setResendAfterDays] = useState(30);
  const [maxPerRun, setMaxPerRun] = useState(200);
  const [lastResult, setLastResult] = useState<{ sent: number; skipped: number } | null>(null);

  const loadPreview = async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke('notify-owners-missing-reservation', {
      body: { preview_only: true, resend_after_days: resendAfterDays },
    });
    setLoading(false);
    if (error) { toast.error('Kon preview niet laden'); return; }
    setPreviewCount(data?.candidates ?? 0);
  };

  useEffect(() => { loadPreview(); }, []);

  const handleSend = async () => {
    if (!confirm(`Mail versturen naar maximaal ${maxPerRun} eigenaren?`)) return;
    setSending(true);
    const { data, error } = await supabase.functions.invoke('notify-owners-missing-reservation', {
      body: { resend_after_days: resendAfterDays, max: maxPerRun },
    });
    setSending(false);
    if (error) { toast.error('Verzenden mislukt'); return; }
    setLastResult({ sent: data?.sent ?? 0, skipped: data?.skipped ?? 0 });
    toast.success(`${data?.sent ?? 0} mails verstuurd`);
    loadPreview();
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            Eigenaren mailen — Ontbrekende reserveringslink
          </CardTitle>
          <CardDescription>
            Stuurt een gerichte mail naar geclaimde restaurants zónder reservation_url, mét website. 
            Dubbele verzending wordt voorkomen via een per-restaurant tijdstempel.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="resend-days">Niet opnieuw mailen binnen (dagen)</Label>
              <Input
                id="resend-days"
                type="number"
                min={1}
                max={365}
                value={resendAfterDays}
                onChange={(e) => setResendAfterDays(Number(e.target.value) || 30)}
              />
            </div>
            <div>
              <Label htmlFor="max-run">Max mails per run</Label>
              <Input
                id="max-run"
                type="number"
                min={1}
                max={1000}
                value={maxPerRun}
                onChange={(e) => setMaxPerRun(Number(e.target.value) || 200)}
              />
            </div>
          </div>

          <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
            <div>
              <p className="text-sm text-muted-foreground">Aantal in te mailen eigenaren</p>
              <p className="text-2xl font-bold">
                {loading ? '...' : previewCount ?? '—'}
              </p>
            </div>
            <Button variant="outline" onClick={loadPreview} disabled={loading} size="sm">
              <Eye className="h-4 w-4 mr-1" />
              Vernieuw preview
            </Button>
          </div>

          {previewCount === 0 && !loading && (
            <div className="flex items-start gap-2 text-sm text-muted-foreground p-3 border rounded-md">
              <AlertCircle className="h-4 w-4 mt-0.5" />
              <span>Iedereen die in aanmerking komt is recent gemaild — wacht tot de cooldown verstrijkt.</span>
            </div>
          )}

          <Button onClick={handleSend} disabled={sending || !previewCount} size="lg">
            <Send className="h-4 w-4 mr-2" />
            {sending ? 'Verzenden...' : `Verstuur (max ${Math.min(maxPerRun, previewCount || 0)} mails)`}
          </Button>

          {lastResult && (
            <div className="text-sm p-3 bg-muted rounded-md">
              Laatste run: <strong>{lastResult.sent}</strong> verzonden, <strong>{lastResult.skipped}</strong> overgeslagen.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}