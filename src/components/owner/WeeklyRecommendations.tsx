import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sparkles, RefreshCw, CheckCircle2 } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';

interface Action { title: string; why?: string; how?: string; impact?: 'high' | 'medium' | 'low' }
interface Rec { summary?: string | null; actions: Action[]; week_start: string }

const impactColor = (i?: string) =>
  i === 'high' ? 'bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30'
  : i === 'low' ? 'bg-muted text-muted-foreground'
  : 'bg-primary/15 text-primary border-primary/30';

export function WeeklyRecommendations({ restaurantId }: { restaurantId: string }) {
  const [rec, setRec] = useState<Rec | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const fetchOrGenerate = async (force = false) => {
    if (force) setGenerating(true); else setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('owner-weekly-recommendation', {
        body: { restaurantId, force },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setRec({
        summary: (data as any).summary,
        actions: (data as any).actions || [],
        week_start: (data as any).week_start,
      });
    } catch (e: any) {
      toast({ title: 'Aanbevelingen mislukt', description: e?.message ?? 'Onbekende fout', variant: 'destructive' });
    } finally {
      setLoading(false); setGenerating(false);
    }
  };

  useEffect(() => { fetchOrGenerate(false); /* eslint-disable-next-line */ }, [restaurantId]);

  return (
    <Card className="border-primary/30 bg-gradient-to-br from-primary/[0.06] via-transparent to-transparent">
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-5 w-5 text-primary" />
            Wat te doen deze week
          </CardTitle>
          {rec?.week_start && (
            <p className="text-xs text-muted-foreground mt-1">
              Week van {new Date(rec.week_start).toLocaleDateString('nl-NL', { day: '2-digit', month: 'long' })}
            </p>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={() => fetchOrGenerate(true)} disabled={generating || loading}>
          <RefreshCw className={`h-4 w-4 mr-1.5 ${generating ? 'animate-spin' : ''}`} />
          Verversen
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <p className="text-sm text-muted-foreground py-6 text-center">AI denkt na…</p>
        ) : !rec || rec.actions.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Geen aanbevelingen beschikbaar.</p>
        ) : (
          <>
            {rec.summary && (
              <p className="text-sm text-muted-foreground italic border-l-2 border-primary/40 pl-3">{rec.summary}</p>
            )}
            <ol className="space-y-3">
              {rec.actions.map((a, idx) => (
                <li key={idx} className="rounded-lg border bg-card p-4 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2 min-w-0">
                      <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                      <h4 className="font-semibold text-sm leading-snug">{a.title}</h4>
                    </div>
                    {a.impact && (
                      <Badge variant="outline" className={`text-[10px] uppercase tracking-wider ${impactColor(a.impact)}`}>
                        {a.impact}
                      </Badge>
                    )}
                  </div>
                  {a.why && <p className="text-xs text-muted-foreground"><span className="font-medium text-foreground">Waarom: </span>{a.why}</p>}
                  {a.how && <p className="text-xs text-muted-foreground"><span className="font-medium text-foreground">Hoe: </span>{a.how}</p>}
                </li>
              ))}
            </ol>
          </>
        )}
      </CardContent>
    </Card>
  );
}