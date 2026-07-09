import { Star, Heart, Award, MapPin } from 'lucide-react';

interface StatsGridProps {
  reviewCount: number;
  favoritesCount: number;
  badgesCount: number;
  citiesCount: number;
}

export function StatsGrid({ reviewCount, favoritesCount, badgesCount, citiesCount }: StatsGridProps) {
  const stats = [
    { icon: Star, label: 'Reviews', value: reviewCount, color: 'text-amber-500', bg: 'bg-amber-500/10' },
    { icon: Heart, label: 'Favorieten', value: favoritesCount, color: 'text-rose-500', bg: 'bg-rose-500/10' },
    { icon: Award, label: 'Badges', value: badgesCount, color: 'text-purple-500', bg: 'bg-purple-500/10' },
    { icon: MapPin, label: 'Steden', value: citiesCount, color: 'text-blue-500', bg: 'bg-blue-500/10' },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="flex flex-col items-center gap-1 p-3 sm:p-4 rounded-xl border border-border bg-card text-center"
        >
          <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-lg ${stat.bg} flex items-center justify-center`}>
            <stat.icon className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${stat.color}`} />
          </div>
          <p className="text-lg sm:text-2xl font-bold leading-tight">{stat.value}</p>
          <p className="text-[10px] sm:text-xs text-muted-foreground">{stat.label}</p>
        </div>
      ))}
    </div>
  );
}
