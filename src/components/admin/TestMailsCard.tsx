import { useState } from 'react';
import { Loader2, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

/** Sends the automatic mails to the signed-in admin only, with sample data, to check how they look. */
export function TestMailsCard() {
  const [busy, setBusy] = useState<string | null>(null);
  const send = async (fn: 'promo-auctions' | 'admin-daily-digest', body: Record<string, unknown>, ok: string) => {
    setBusy(fn);
    const { data, error } = await supabase.functions.invoke(fn, { body });
    setBusy(null);
    if (error || data?.error) {
      const reason = data?.error ?? await (error as { context?: Response } | null)?.context?.json?.().then((b: { error?: string }) => b?.error).catch(() => null);
      toast.error(reason || 'Versturen mislukt');
      return;
    }
    toast.success(ok);
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base"><Mail className="h-4 w-4" />Testmails naar jezelf</CardTitle>
        <CardDescription>Gaat alleen naar jouw adres, met voorbeeldgegevens. Er verandert verder niets.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        <Button variant="outline" disabled={!!busy} onClick={() => send('promo-auctions', { test_mail: true }, '5 veilingmails verstuurd naar je eigen adres')}>
          {busy === 'promo-auctions' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Veilingmails (herinnering, gewonnen, overboden, nieuwe prijs)
        </Button>
        <Button variant="outline" disabled={!!busy} onClick={() => send('admin-daily-digest', { only_me: true }, 'Dagelijkse adminmail verstuurd naar je eigen adres')}>
          {busy === 'admin-daily-digest' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Dagelijkse adminmail
        </Button>
      </CardContent>
    </Card>
  );
}
