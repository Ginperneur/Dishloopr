import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MapPin, ChefHat } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface SeoLandingLinksProps {
  currentDish?: string;
  currentCity?: string;
  cities?: { id: string; name: string; slug: string }[];
  dishes?: { id: string; name: string; slug: string }[];
}

export function SeoLandingLinks({ currentDish, currentCity, cities = [], dishes = [] }: SeoLandingLinksProps) {
  // Generate slug from dish and city
  const generateSlug = (dish: string, city: string) => {
    return `${dish.toLowerCase().replace(/\s+/g, '-')}-${city.toLowerCase().replace(/\s+/g, '-')}`;
  };

  // If we have a current dish, show links to that dish in different cities
  if (currentDish && cities.length > 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-8 p-4 rounded-xl bg-muted/30 border border-border"
      >
        <div className="flex items-center gap-2 mb-3">
          <MapPin className="h-4 w-4 text-primary" />
          <h3 className="font-semibold text-sm">
            {currentDish} in andere steden
          </h3>
        </div>
        <div className="flex flex-wrap gap-2">
          {cities.slice(0, 6).map(city => (
            <Link
              key={city.id}
              to={`/eten/${generateSlug(currentDish, city.slug)}`}
              className="inline-block"
            >
              <Badge 
                variant="secondary" 
                className="hover:bg-primary hover:text-primary-foreground transition-colors cursor-pointer"
              >
                {currentDish} {city.name}
              </Badge>
            </Link>
          ))}
        </div>
      </motion.div>
    );
  }

  // If we have a current city, show links to popular dishes in that city
  if (currentCity && dishes.length > 0) {
    const cityData = cities.find(c => c.id === currentCity);
    if (!cityData) return null;

    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-8 p-4 rounded-xl bg-muted/30 border border-border"
      >
        <div className="flex items-center gap-2 mb-3">
          <ChefHat className="h-4 w-4 text-primary" />
          <h3 className="font-semibold text-sm">
            Populaire gerechten in {cityData.name}
          </h3>
        </div>
        <div className="flex flex-wrap gap-2">
          {dishes.slice(0, 8).map(dish => (
            <Link
              key={dish.id}
              to={`/eten/${generateSlug(dish.slug, cityData.slug)}`}
              className="inline-block"
            >
              <Badge 
                variant="secondary" 
                className="hover:bg-primary hover:text-primary-foreground transition-colors cursor-pointer"
              >
                {dish.name} {cityData.name}
              </Badge>
            </Link>
          ))}
        </div>
      </motion.div>
    );
  }

  return null;
}
