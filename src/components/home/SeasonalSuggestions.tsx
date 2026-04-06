import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Leaf, Snowflake, Sun, CloudRain } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';

interface SeasonalDish {
  id: string;
  name: string;
  slug: string;
  seasonal_tags: string[];
}

const SEASON_CONFIG: Record<string, { label: string; icon: any; color: string; emoji: string }> = {
  lente: { label: 'Lente', icon: Leaf, color: 'text-green-500', emoji: '🌱' },
  zomer: { label: 'Zomer', icon: Sun, color: 'text-amber-500', emoji: '☀️' },
  herfst: { label: 'Herfst', icon: CloudRain, color: 'text-orange-500', emoji: '🍂' },
  winter: { label: 'Winter', icon: Snowflake, color: 'text-blue-400', emoji: '❄️' },
};

function getCurrentSeason(): string {
  const month = new Date().getMonth();
  if (month >= 2 && month <= 4) return 'lente';
  if (month >= 5 && month <= 7) return 'zomer';
  if (month >= 8 && month <= 10) return 'herfst';
  return 'winter';
}

export function SeasonalSuggestions() {
  const [dishes, setDishes] = useState<SeasonalDish[]>([]);
  const season = getCurrentSeason();
  const config = SEASON_CONFIG[season];

  useEffect(() => {
    const fetchSeasonal = async () => {
      const { data } = await supabase
        .from('dishes')
        .select('id, name, slug, seasonal_tags')
        .eq('is_active', true)
        .contains('seasonal_tags', [season])
        .limit(8);
      if (data) setDishes(data);
    };
    fetchSeasonal();
  }, [season]);

  if (dishes.length === 0) return null;

  return (
    <section className="py-6 md:py-10">
      <div className="container px-4 md:px-6">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xl">{config.emoji}</span>
          <h2 className="text-lg sm:text-xl font-bold">
            {config.label}seizoen: dit eet je nu
          </h2>
        </div>
        <div className="flex flex-wrap gap-2">
          {dishes.map((dish) => (
            <Link key={dish.id} to={`/eten/gerecht/${dish.slug}`}>
              <Badge
                variant="outline"
                className="px-3 py-2 text-sm hover:bg-primary hover:text-primary-foreground transition-colors cursor-pointer"
              >
                {dish.name}
              </Badge>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
