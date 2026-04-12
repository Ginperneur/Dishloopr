import { useState } from 'react';
import { Brain, Loader2, Play, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface BatchResult {
  updated: number;
  remaining: number;
  batch_size: number;
  errors?: string[];
}

export function AIMetadataEnrichment() {
  const [running, setRunning] = useState(false);
  const [totalUpdated, setTotalUpdated] = useState(0);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [batchesDone, setBatchesDone] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);

  const runBatch = async () => {
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke('classify-restaurants', {
        body: { batch_size: 25 },
      });

      if (error) throw error;

      if (data.message && data.updated === 0) {
        toast.success('Alle restaurants zijn geclassificeerd!');
        setRemaining(0);
        setRunning(false);
        return;
      }

      const result = data as BatchResult;
      setTotalUpdated(prev => prev + result.updated);
      setRemaining(result.remaining);
      setBatchesDone(prev => prev + 1);
      if (result.errors) setErrors(prev => [...prev, ...result.errors!]);

      toast.success(`${result.updated} restaurants geclassificeerd, ${result.remaining} resterend`);
    } catch (e: any) {
      console.error('Classification error:', e);
      toast.error(e.message || 'Classificatie mislukt');
    } finally {
      setRunning(false);
    }
  };

  const runAll = async () => {
    setRunning(true);
    setTotalUpdated(0);
    setBatchesDone(0);
    setErrors([]);

    let keepGoing = true;
    while (keepGoing) {
      try {
        const { data, error } = await supabase.functions.invoke('classify-restaurants', {
          body: { batch_size: 25 },
        });

        if (error) throw error;

        if (data.message && data.updated === 0) {
          keepGoing = false;
          setRemaining(0);
          toast.success('Alle restaurants zijn geclassificeerd!');
          break;
        }

        const result = data as BatchResult;
        setTotalUpdated(prev => prev + result.updated);
        setRemaining(result.remaining);
        setBatchesDone(prev => prev + 1);
        if (result.errors) setErrors(prev => [...prev, ...result.errors!]);

        if (result.remaining === 0) {
          keepGoing = false;
          toast.success('Alle restaurants zijn geclassificeerd!');
        }

        // Small delay between batches to respect rate limits
        await new Promise(r => setTimeout(r, 2000));
      } catch (e: any) {
        console.error('Batch error:', e);
        if (e.message?.includes('429') || e.message?.includes('Rate limit')) {
          toast.warning('Rate limit bereikt, wacht 30s...');
          await new Promise(r => setTimeout(r, 30000));
        } else {
          toast.error(e.message || 'Batch mislukt');
          keepGoing = false;
        }
      }
    }
    setRunning(false);
  };

  const progress = remaining !== null && remaining + totalUpdated > 0
    ? Math.round((totalUpdated / (totalUpdated + remaining)) * 100)
    : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-primary" />
          AI Metadata Verrijking
        </CardTitle>
        <CardDescription>
          Classificeer restaurants automatisch met 1 gratis keuken, sfeer, concept en beleving via AI.
          Extra tags kunnen eigenaren zelf toevoegen via een betaald abonnement (€5/tag/mnd of Owner Pro).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3">
          <Button onClick={runBatch} disabled={running} size="sm">
            {running ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
            1 Batch (25)
          </Button>
          <Button onClick={runAll} disabled={running} variant="default" size="sm">
            {running ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Brain className="h-4 w-4 mr-2" />}
            Alles classificeren
          </Button>
        </div>

        {(totalUpdated > 0 || remaining !== null) && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Voortgang</span>
              <span className="font-medium">{totalUpdated} bijgewerkt • {remaining ?? '?'} resterend</span>
            </div>
            <Progress value={progress} className="h-2" />
            <div className="flex gap-2">
              <Badge variant="outline">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                {batchesDone} batches
              </Badge>
              {errors.length > 0 && (
                <Badge variant="destructive">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  {errors.length} fouten
                </Badge>
              )}
            </div>
          </div>
        )}

        {errors.length > 0 && (
          <div className="text-xs text-destructive max-h-24 overflow-y-auto space-y-1">
            {errors.slice(-5).map((e, i) => (
              <p key={i}>{e}</p>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
