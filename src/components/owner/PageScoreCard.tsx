import { CheckCircle2, ChevronRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { pageScore, type PageTask } from '@/lib/pageScore';

interface Props {
  tasks: PageTask[];
  onOpen: (task: PageTask) => void;
}

/** One score for the restaurant page with one to-do list; each task opens the section that fixes it. */
export function PageScoreCard({ tasks, onOpen }: Props) {
  const pct = pageScore(tasks);
  const open = tasks.filter(t => !t.done);
  const done = tasks.filter(t => t.done);
  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-xl font-bold">
            {pct === 100 ? 'Je pagina is helemaal compleet' : `Je pagina is ${pct}% compleet`}
          </h2>
          <span className="text-sm text-muted-foreground">{done.length} van {tasks.length} klaar</span>
        </div>
        <Progress value={pct} className="h-2.5 bg-muted" aria-label={`Pagina ${pct}% compleet`} />
        {open.length > 0 ? (
          <ul className="divide-y">
            {open.slice(0, 5).map(t => (
              <li key={t.id}>
                <button type="button" onClick={() => onOpen(t)}
                  className="flex w-full min-h-11 items-center gap-3 py-3 text-left hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md">
                  <span className="h-5 w-5 shrink-0 rounded-full border-2 border-muted-foreground/30" aria-hidden />
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-medium">{t.label}</span>
                    <span className="block text-xs text-muted-foreground">{t.hint}</span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </button>
              </li>
            ))}
            {open.length > 5 && <li className="pt-3 text-xs text-muted-foreground">En nog {open.length - 5} andere taken</li>}
          </ul>
        ) : (
          <p className="flex items-center gap-2 text-sm text-muted-foreground"><CheckCircle2 className="h-4 w-4 text-primary" />Alles staat erop. Houd je menu en openingstijden actueel.</p>
        )}
      </CardContent>
    </Card>
  );
}
