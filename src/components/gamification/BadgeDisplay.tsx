import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { 
  Globe, 
  MapPin, 
  Star, 
  Camera, 
  Flame,
  Award,
  Trophy,
  Sparkles,
  Lock
} from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface Badge {
  badge_type: string;
  progress: number;
  target: number;
  earned_at: string | null;
  badge_level: number;
}

interface BadgeDisplayProps {
  badges: Badge[];
  compact?: boolean;
}

const badgeConfig: Record<string, { 
  icon: React.ElementType; 
  label: { nl: string; en: string }; 
  description: { nl: string; en: string };
  color: string;
}> = {
  cuisine_explorer: {
    icon: Globe,
    label: { nl: 'Keuken Ontdekker', en: 'Cuisine Explorer' },
    description: { nl: 'Ontdek 10 verschillende keukens', en: 'Discover 10 different cuisines' },
    color: 'from-blue-500 to-cyan-500'
  },
  city_hopper: {
    icon: MapPin,
    label: { nl: 'Steden Hopper', en: 'City Hopper' },
    description: { nl: 'Bezoek restaurants in 5 steden', en: 'Visit restaurants in 5 cities' },
    color: 'from-purple-500 to-pink-500'
  },
  review_master: {
    icon: Star,
    label: { nl: 'Review Meester', en: 'Review Master' },
    description: { nl: 'Schrijf 25 reviews', en: 'Write 25 reviews' },
    color: 'from-amber-500 to-orange-500'
  },
  photo_pro: {
    icon: Camera,
    label: { nl: 'Foto Pro', en: 'Photo Pro' },
    description: { nl: 'Upload 50 foto\'s', en: 'Upload 50 photos' },
    color: 'from-green-500 to-emerald-500'
  },
  streak_champion: {
    icon: Flame,
    label: { nl: 'Streak Kampioen', en: 'Streak Champion' },
    description: { nl: '7 dagen op rij actief', en: '7 days active streak' },
    color: 'from-red-500 to-orange-500'
  },
  early_adopter: {
    icon: Sparkles,
    label: { nl: 'Early Adopter', en: 'Early Adopter' },
    description: { nl: 'Lid sinds de lancering', en: 'Member since launch' },
    color: 'from-indigo-500 to-violet-500'
  },
};

export function BadgeDisplay({ badges, compact = false }: BadgeDisplayProps) {
  const { i18n } = useTranslation();
  const lang = i18n.language as 'nl' | 'en';

  // Ensure all badge types are shown (even unstarted ones)
  const allBadgeTypes = Object.keys(badgeConfig);
  const badgeMap = new Map(badges.map(b => [b.badge_type, b]));

  const displayBadges = allBadgeTypes.map(type => {
    const badge = badgeMap.get(type);
    return {
      badge_type: type,
      progress: badge?.progress || 0,
      target: badge?.target || badgeConfig[type] ? 10 : 10,
      earned_at: badge?.earned_at || null,
      badge_level: badge?.badge_level || 1,
    };
  });

  if (compact) {
    const earnedCount = displayBadges.filter(b => b.earned_at).length;
    return (
      <div className="flex items-center gap-2">
        <Award className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium">{earnedCount} badges</span>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {displayBadges.map((badge, index) => {
          const config = badgeConfig[badge.badge_type];
          if (!config) return null;

          const Icon = config.icon;
          const isEarned = !!badge.earned_at;
          const progress = (badge.progress / badge.target) * 100;

          return (
            <Tooltip key={badge.badge_type}>
              <TooltipTrigger asChild>
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.1 }}
                  className={`relative p-4 rounded-xl border ${
                    isEarned 
                      ? 'border-primary/50 bg-primary/5' 
                      : 'border-border bg-card opacity-75'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`p-2.5 rounded-xl ${
                      isEarned 
                        ? `bg-gradient-to-br ${config.color} text-white` 
                        : 'bg-muted text-muted-foreground'
                    }`}>
                      {isEarned ? (
                        <Icon className="h-5 w-5" />
                      ) : (
                        <Lock className="h-5 w-5" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-sm truncate">
                        {config.label[lang] || config.label.nl}
                      </h4>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {badge.progress}/{badge.target}
                      </p>
                    </div>
                    {isEarned && (
                      <Trophy className="h-4 w-4 text-amber-500 shrink-0" />
                    )}
                  </div>

                  {!isEarned && (
                    <div className="mt-3">
                      <Progress value={progress} className="h-1.5" />
                    </div>
                  )}
                </motion.div>
              </TooltipTrigger>
              <TooltipContent>
                <p>{config.description[lang] || config.description.nl}</p>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
}
