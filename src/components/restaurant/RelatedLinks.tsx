import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight } from 'lucide-react';
import { formatDishName } from '@/lib/utils';

interface RelatedLinksProps {
  restaurantName: string;
  cityName?: string;
  cityId?: string;
  cuisines?: string[];
  dishes?: { id: string; name: string }[];
}

export function RelatedLinks({ 
  restaurantName, 
  cityName, 
  cityId,
  cuisines = [], 
  dishes = [],
}: RelatedLinksProps) {
  const { t } = useTranslation();

  return (
    <section className="space-y-6 py-6 border-t border-border">
      <h3 className="text-lg font-bold">
        {t('restaurant.discoverMore', 'Ontdek meer')}
      </h3>

      {/* Dish links */}
      {dishes.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-muted-foreground mb-2">
            {t('restaurant.moreOfThisDish', 'Meer van dit gerecht')}
          </h4>
          <div className="flex flex-wrap gap-2">
            {dishes.slice(0, 5).map((dish) => (
              <Link
                key={dish.id}
                to={`/search?dish=${encodeURIComponent(dish.name)}`}
                className="inline-flex items-center gap-1 px-3 py-1 text-sm rounded-full border border-border hover:bg-primary/10 transition-colors"
              >
                {dish.name} {cityName ? `in ${cityName}` : ''}
                <ArrowRight className="h-3 w-3" />
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Cuisine links */}
      {cuisines.length > 0 && cityName && (
        <div>
          <h4 className="text-sm font-medium text-muted-foreground mb-2">
            {t('restaurant.similarCuisines', 'Vergelijkbare keukens')}
          </h4>
          <div className="flex flex-wrap gap-2">
            {cuisines.slice(0, 4).map((cuisine) => (
              <Link
                key={cuisine}
                to={`/search?dish=${encodeURIComponent(cuisine)}&city=${cityId || ''}`}
                className="inline-flex items-center gap-1 px-3 py-1 text-sm rounded-full border border-border hover:bg-primary/10 transition-colors capitalize"
              >
                {cuisine} in {cityName}
                <ArrowRight className="h-3 w-3" />
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* City & collections links */}
      {cityName && cityId && (
        <div>
          <h4 className="text-sm font-medium text-muted-foreground mb-2">
            {t('restaurant.moreInCity', 'Meer in deze stad')}
          </h4>
          <div className="flex flex-wrap gap-2">
            <Link
              to={`/search?city=${cityId}`}
              className="inline-flex items-center gap-1 px-3 py-1 text-sm rounded-full border border-border hover:bg-primary/10 transition-colors"
            >
              Alle restaurants in {cityName}
              <ArrowRight className="h-3 w-3" />
            </Link>
            <Link
              to="/collections"
              className="inline-flex items-center gap-1 px-3 py-1 text-sm rounded-full border border-border hover:bg-primary/10 transition-colors"
            >
              Bekijk collecties
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      )}
    </section>
  );
}
