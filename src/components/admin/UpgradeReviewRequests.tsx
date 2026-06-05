import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Mail, Eye } from 'lucide-react';

interface Candidate {
  id: string;
  kind: string;
  table: string;
  restaurant_id: string | null;
  user_id: string | null;
  ended_at: string;
}

interface RunResult {
  stats: { found: number; sent: number; skipped: number; errors: number };
  candidates?: Candidate[];
  dryRun?: boolean;
}

export function UpgradeReviewRequests() {
  const { toast } = useToast();
  const [loading, setLoading] = useState<'dry' | 'send' | null>(null);
  const [result, setResult] = useState<RunResult | null>(null);

  const run = async (dryRun: boolean) => {
    setLoading(dryRun ? 'dry' : 'send');
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('send-upgrade-review-request', {
        body: {},
        method: 'POST',
        headers: {},
      } as never);
      // supabase-js doesn't support query params on invoke; fall back to fetch for dry run
      if (dryRun) {
        const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-upgrade-review-request?dry_run=1`;
        const session = (await supabase.auth.getSession()).data.session;
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session?.access_token ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            'Content-Type': 'application/json',
          },
        });
        const json = (await res.json()) as RunResult;
        setResult(json);
        toast({ title: 'Preview opgehaald', description: `${json.stats?.found ?? 0} kandidaten gevonden.` });
        return;
      }
      if (error) throw error;
      setResult(data as RunResult);
      const s = (data as RunResult).stats;
      toast({
        title: 'Review-verzoeken verstuurd',
        description: `${s.sent} verzonden, ${s.skipped} overgeslagen, ${s.errors} fouten.`,
      });
    } catch (e) {
      toast({
        title: 'Fout',
        description: e instanceof Error ? e.message : 'Onbekende fout',
        variant: 'destructive',
      });
    } finally {
      setLoading(null);
    }
  };

  const kindLabel = (k: string) =>
    ({
      featured: 'Featured listing',
      sponsored_dish: 'Sponsored dish',
      newsletter: 'Nieuwsbrief',
      owner_pro: 'Owner Pro',
    } as Record<string, string>)[k] ?? k;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Review-verzoeken na upgrades</CardTitle>
        <CardDescription>
          Verstuurt een mail aan owners zodra hun featured listing, sponsored dish, nieuwsbrief­plaatsing of Owner
          Pro abonnement is afgelopen, met een Trustpilot-link en interne feedback-link.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Button variant="outline" disabled={!!loading} onClick={() => run(true)}>
            {loading === 'dry' ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Eye className="h-4 w-4 mr-2" />}
            Preview kandidaten
          </Button>
          <Button disabled={!!loading} onClick={() => run(false)}>
            {loading === 'send' ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Mail className="h-4 w-4 mr-2" />}
            Verstuur nu
          </Button>
        </div>

        {result && (
          <div className="space-y-3 text-sm">
            <div className="flex gap-2 flex-wrap">
              <Badge variant="secondary">Gevonden: {result.stats.found}</Badge>
              <Badge>Verzonden: {result.stats.sent}</Badge>
              <Badge variant="outline">Overgeslagen: {result.stats.skipped}</Badge>
              {result.stats.errors > 0 && <Badge variant="destructive">Fouten: {result.stats.errors}</Badge>}
            </div>
            {result.candidates && result.candidates.length > 0 && (
              <div className="border rounded-lg divide-y max-h-96 overflow-y-auto">
                {result.candidates.slice(0, 100).map((c) => (
                  <div key={`${c.table}-${c.id}`} className="p-3 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{kindLabel(c.kind)}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        Restaurant {c.restaurant_id ?? '—'} · einde {new Date(c.ended_at).toLocaleDateString('nl-NL')}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}