import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Circle, ArrowRight, Trophy } from 'lucide-react';

export interface VisibilityStep {
  id: string;
  label: string;
  hint: string;
  done: boolean;
  scrollTo?: string;
  onClick?: () => void;
}

interface Props {
  steps: VisibilityStep[];
}

/**
 * Toont welke zichtbaarheid-stappen de owner al heeft afgevinkt
 * en daagt hem uit om de ontbrekende stappen te activeren.
 */
export function VisibilityProgress({ steps }: Props) {
  const done = steps.filter((s) => s.done).length;
  const pct = Math.round((done / steps.length) * 100);
  const next = steps.find((s) => !s.done);

  const handleClick = (s: VisibilityStep) => {
    if (s.onClick) return s.onClick();
    if (s.scrollTo) {
      document.getElementById(s.scrollTo)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-background">
      <CardContent className="p-5 space-y-4">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary text-primary-foreground inline-flex items-center justify-center shrink-0">
            <Trophy className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-base">Jouw zichtbaarheid-score</h3>
              <Badge className="bg-primary text-primary-foreground">{pct}%</Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {done} van {steps.length} stappen geactiveerd — elke stap brengt extra gasten naar je profiel.
            </p>
          </div>
        </div>

        <Progress value={pct} className="h-2" />

        <div className="grid sm:grid-cols-2 gap-2">
          {steps.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => handleClick(s)}
              className={`group flex items-start gap-2 p-3 rounded-lg border text-left transition-all ${
                s.done
                  ? 'border-primary/30 bg-primary/5'
                  : 'border-border hover:border-primary/40 hover:bg-primary/5'
              }`}
            >
              {s.done ? (
                <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              ) : (
                <Circle className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className={`text-xs font-semibold ${s.done ? 'line-through opacity-60' : ''}`}>
                  {s.label}
                </p>
                <p className="text-[11px] text-muted-foreground">{s.hint}</p>
              </div>
              {!s.done && (
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary mt-1 shrink-0" />
              )}
            </button>
          ))}
        </div>

        {next && (
          <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-primary/10 border border-primary/20">
            <div className="text-xs">
              <span className="font-semibold text-primary">Volgende stap:</span>{' '}
              <span className="text-foreground">{next.label}</span>
            </div>
            <Button size="sm" onClick={() => handleClick(next)} className="shrink-0">
              Activeer
              <ArrowRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}