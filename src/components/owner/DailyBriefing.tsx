import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus, Sparkles, ArrowRight, Eye } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface DailyBriefingProps {
  restaurantName: string;
  totalViews: number;
  viewsByDay: { date: string; count: number }[];
  unansweredReviews: number;
  suggestedDishes: number;
  isVerified: boolean;
  onPrimaryAction: () => void;
  primaryActionLabel: string;
  primaryActionHint: string;
}

export function DailyBriefing({
  restaurantName,
  totalViews,
  viewsByDay,
  unansweredReviews,
  suggestedDishes,
  isVerified,
  onPrimaryAction,
  primaryActionLabel,
  primaryActionHint,
}: DailyBriefingProps) {
  // Compute trend
  const len = viewsByDay.length;
  let trendPct = 0;
  if (len >= 2) {
    const mid = Math.floor(len / 2);
    const a = viewsByDay.slice(0, mid).reduce((s, d) => s + d.count, 0);
    const b = viewsByDay.slice(mid).reduce((s, d) => s + d.count, 0);
    trendPct = a > 0 ? Math.round(((b - a) / a) * 100) : (b > 0 ? 100 : 0);
  }
  const TrendIcon = trendPct > 0 ? TrendingUp : trendPct < 0 ? TrendingDown : Minus;
  const trendColor = trendPct > 0 ? 'text-emerald-100' : trendPct < 0 ? 'text-red-200' : 'text-white/70';

  // Sparkline points
  const max = Math.max(1, ...viewsByDay.map(d => d.count));
  const w = 120;
  const h = 36;
  const points = viewsByDay.length > 0
    ? viewsByDay.map((d, i) => {
        const x = (i / Math.max(1, viewsByDay.length - 1)) * w;
        const y = h - (d.count / max) * h;
        return `${x},${y}`;
      }).join(' ')
    : '';

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 6) return 'Goedenacht';
    if (h < 12) return 'Goedemorgen';
    if (h < 18) return 'Goedemiddag';
    return 'Goedenavond';
  })();

  const headline = (() => {
    if (!isVerified) return 'Verifieer je restaurant om alle inzichten te ontgrendelen';
    if (totalViews === 0) return 'Je dashboard is klaar — eerste weergaven komen binnenkort';
    if (unansweredReviews > 0) return `${unansweredReviews} gast${unansweredReviews > 1 ? 'en wachten' : ' wacht'} op een reactie`;
    if (suggestedDishes > 0) return `Bevestig ${suggestedDishes} gerecht${suggestedDishes > 1 ? 'en' : ''} om beter vindbaar te worden`;
    if (trendPct > 10) return `Sterke groei: +${trendPct}% weergaven deze periode`;
    if (trendPct < -10) return `Weergaven dalen — tijd om je profiel te updaten`;
    return 'Alles loopt soepel. Tijd om je profiel verder te optimaliseren';
  })();

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="mb-6"
    >
      <Card className="overflow-hidden border-0 shadow-lg relative">
        <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary to-primary/80" />
        <div className="absolute -top-20 -right-20 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-32 -left-10 h-72 w-72 rounded-full bg-accent/20 blur-3xl" />
        <CardContent className="relative p-5 md:p-7 text-primary-foreground">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-5">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="h-3.5 w-3.5 text-primary-foreground/80" />
                <span className="text-[11px] font-medium uppercase tracking-widest text-primary-foreground/80">
                  Daily Briefing
                </span>
              </div>
              <p className="text-sm text-primary-foreground/85 mb-1">
                {greeting}, {restaurantName.split(' ')[0]}
              </p>
              <h2 className="text-xl md:text-2xl font-bold leading-tight mb-4 max-w-xl">
                {headline}
              </h2>
              <div className="flex flex-wrap items-center gap-4 text-sm">
                <div className="flex items-center gap-1.5">
                  <Eye className="h-4 w-4 opacity-80" />
                  <span className="font-semibold">{totalViews}</span>
                  <span className="text-primary-foreground/75">weergaven (30d)</span>
                </div>
                {len >= 2 && (
                  <div className={`flex items-center gap-1 ${trendColor}`}>
                    <TrendIcon className="h-4 w-4" />
                    <span className="font-semibold">
                      {trendPct > 0 ? '+' : ''}{trendPct}%
                    </span>
                  </div>
                )}
                {unansweredReviews > 0 && (
                  <Badge variant="secondary" className="bg-white/15 text-primary-foreground border-0 hover:bg-white/20">
                    {unansweredReviews} review{unansweredReviews > 1 ? 's' : ''} open
                  </Badge>
                )}
              </div>
            </div>

            <div className="flex flex-col items-stretch md:items-end gap-3 md:min-w-[200px]">
              {viewsByDay.length > 0 && (
                <div className="hidden md:block">
                  <svg width={w} height={h} className="overflow-visible">
                    <defs>
                      <linearGradient id="briefingArea" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="white" stopOpacity="0.4" />
                        <stop offset="100%" stopColor="white" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <polygon
                      points={`0,${h} ${points} ${w},${h}`}
                      fill="url(#briefingArea)"
                    />
                    <polyline
                      points={points}
                      fill="none"
                      stroke="white"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <p className="text-[10px] text-primary-foreground/70 mt-1 text-right">Laatste 30 dagen</p>
                </div>
              )}
              <Button
                onClick={onPrimaryAction}
                size="sm"
                variant="secondary"
                className="bg-white text-primary hover:bg-white/90 font-semibold shadow-md"
              >
                {primaryActionLabel}
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
              <p className="text-[11px] text-primary-foreground/70 md:text-right">
                {primaryActionHint}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}