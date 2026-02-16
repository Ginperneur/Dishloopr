import { TrendingUp, TrendingDown, Lock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ElementType;
  trend?: {
    value: number; // percentage change
    label: string;
  };
  locked?: boolean;
}

export function StatCard({ title, value, icon: Icon, trend, locked }: StatCardProps) {
  const isPositive = trend && trend.value >= 0;
  const isNeutral = trend && trend.value === 0;

  return (
    <Card className={locked ? 'opacity-60' : ''}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground truncate">{title}</p>
            <p className="text-3xl font-bold mt-1">{locked ? '—' : value}</p>
            {trend && !locked && (
              <div className={`flex items-center gap-1 mt-1.5 text-sm font-medium ${
                isNeutral 
                  ? 'text-muted-foreground' 
                  : isPositive 
                    ? 'text-green-600 dark:text-green-400' 
                    : 'text-red-600 dark:text-red-400'
              }`}>
                {isNeutral ? null : isPositive ? (
                  <TrendingUp className="h-3.5 w-3.5" />
                ) : (
                  <TrendingDown className="h-3.5 w-3.5" />
                )}
                <span>
                  {isNeutral ? '0%' : `${isPositive ? '+' : ''}${trend.value}%`}
                </span>
                <span className="text-muted-foreground font-normal text-xs ml-1">
                  {trend.label}
                </span>
              </div>
            )}
          </div>
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            {locked ? (
              <Lock className="h-6 w-6 text-muted-foreground" />
            ) : (
              <Icon className="h-6 w-6 text-primary" />
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
