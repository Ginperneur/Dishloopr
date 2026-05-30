import { TrendingUp, TrendingDown, Lock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { AreaChart, Area, LineChart, Line, ResponsiveContainer } from 'recharts';
import { cn } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ElementType;
  trend?: {
    value: number; // percentage change
    label: string;
  };
  locked?: boolean;
  sparkline?: number[];
  variant?: 'default' | 'primary';
}

export function StatCard({ title, value, icon: Icon, trend, locked, sparkline, variant = 'default' }: StatCardProps) {
  const isPositive = trend && trend.value >= 0;
  const isNeutral = trend && trend.value === 0;
  const showSpark = !locked && sparkline && sparkline.length > 1;
  const sparkData = showSpark ? sparkline!.map((v, i) => ({ i, v })) : [];
  const isDown = trend && trend.value < 0;
  const sparkColor = isDown ? 'hsl(var(--destructive))' : 'hsl(var(--primary))';
  const isPrimary = variant === 'primary';
  const gradientId = `spark-grad-${title.replace(/\s+/g, '-')}`;

  return (
    <Card
      className={cn(
        'relative overflow-hidden transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md hover:border-primary/30',
        locked && 'opacity-60',
        isPrimary && 'border-primary/30 bg-gradient-to-br from-primary/10 via-primary/[0.04] to-transparent'
      )}
    >
      <CardContent className={cn(isPrimary ? 'p-6 md:p-7' : 'p-5')}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className={cn(
              'text-muted-foreground truncate',
              isPrimary ? 'text-xs uppercase tracking-wider font-medium' : 'text-sm'
            )}>
              {title}
            </p>
            <p className={cn(
              'font-bold mt-1 tabular-nums tracking-tight',
              isPrimary ? 'text-4xl md:text-5xl' : 'text-2xl md:text-3xl'
            )}>
              {locked ? '—' : value}
            </p>
            {trend && !locked && (
              <div className={cn(
                'flex items-center gap-1 mt-2 font-medium',
                isPrimary ? 'text-sm' : 'text-xs',
                isNeutral
                  ? 'text-muted-foreground'
                  : isPositive
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-red-600 dark:text-red-400'
              )}>
                {isNeutral ? null : isPositive ? (
                  <TrendingUp className="h-3.5 w-3.5" />
                ) : (
                  <TrendingDown className="h-3.5 w-3.5" />
                )}
                <span>{isNeutral ? '0%' : `${isPositive ? '+' : ''}${trend.value}%`}</span>
                <span className="text-muted-foreground font-normal ml-1">{trend.label}</span>
              </div>
            )}
          </div>
          <div className={cn(
            'rounded-xl flex items-center justify-center flex-shrink-0',
            isPrimary
              ? 'h-12 w-12 bg-primary/15 ring-1 ring-primary/20'
              : 'h-10 w-10 bg-primary/10'
          )}>
            {locked ? (
              <Lock className={cn(isPrimary ? 'h-5 w-5' : 'h-5 w-5', 'text-muted-foreground')} />
            ) : (
              <Icon className={cn(isPrimary ? 'h-6 w-6' : 'h-5 w-5', 'text-primary')} />
            )}
          </div>
        </div>
        {showSpark && (
          <div className={cn('mt-4 -mx-1', isPrimary ? 'h-16 md:h-20' : 'h-10')}>
            <ResponsiveContainer width="100%" height="100%">
              {isPrimary ? (
                <AreaChart data={sparkData} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={sparkColor} stopOpacity={0.35} />
                      <stop offset="100%" stopColor={sparkColor} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area
                    type="monotone"
                    dataKey="v"
                    stroke={sparkColor}
                    strokeWidth={2.25}
                    fill={`url(#${gradientId})`}
                    isAnimationActive={false}
                  />
                </AreaChart>
              ) : (
                <LineChart data={sparkData} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
                  <Line
                    type="monotone"
                    dataKey="v"
                    stroke={sparkColor}
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                  />
                </LineChart>
              )}
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
