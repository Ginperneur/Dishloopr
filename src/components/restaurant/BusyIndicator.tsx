import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Users, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface BusyIndicatorProps {
  busyLevel: string | null | undefined;
  className?: string;
}

const busyLevelConfig: Record<string, { label: string; color: string; bars: number }> = {
  quiet: { 
    label: 'Rustig', 
    color: 'bg-green-500', 
    bars: 1 
  },
  moderate: { 
    label: 'Gemiddeld druk', 
    color: 'bg-amber-500', 
    bars: 2 
  },
  busy: { 
    label: 'Druk', 
    color: 'bg-orange-500', 
    bars: 3 
  },
  very_busy: { 
    label: 'Zeer druk', 
    color: 'bg-red-500', 
    bars: 4 
  },
};

export function BusyIndicator({ busyLevel, className = '' }: BusyIndicatorProps) {
  const { t } = useTranslation();

  if (!busyLevel || !busyLevelConfig[busyLevel]) {
    return null;
  }

  const config = busyLevelConfig[busyLevel];

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Users className="h-4 w-4 text-muted-foreground" />
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4].map((bar) => (
          <motion.div
            key={bar}
            initial={{ scaleY: 0 }}
            animate={{ scaleY: 1 }}
            transition={{ delay: bar * 0.1 }}
            className={`w-1.5 rounded-full ${
              bar <= config.bars ? config.color : 'bg-muted'
            }`}
            style={{ height: 8 + bar * 3 }}
          />
        ))}
      </div>
      <span className="text-sm font-medium">
        {t(`busyLevel.${busyLevel}`, config.label)}
      </span>
    </div>
  );
}

interface WaitTimeIndicatorProps {
  waitMinutes?: number;
}

export function WaitTimeIndicator({ waitMinutes }: WaitTimeIndicatorProps) {
  const { t } = useTranslation();

  if (!waitMinutes) return null;

  const getWaitColor = () => {
    if (waitMinutes <= 10) return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
    if (waitMinutes <= 20) return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
    return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
  };

  return (
    <Badge variant="secondary" className={`gap-1 ${getWaitColor()}`}>
      <Clock className="h-3 w-3" />
      ~{waitMinutes} {t('common.minutes', 'min')} {t('busyLevel.waitTime', 'wachttijd')}
    </Badge>
  );
}
