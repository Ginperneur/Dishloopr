import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { 
  Star, 
  MapPin, 
  Phone, 
  Globe, 
  Clock, 
  Heart, 
  Share2, 
  Navigation,
  Sparkles,
  Trophy,
  ChevronLeft
} from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ReviewForm } from '@/components/reviews/ReviewForm';
import { ReviewList } from '@/components/reviews/ReviewList';
import { useFavorites } from '@/hooks/useFavorites';
import { useReviews } from '@/hooks/useReviews';
import { 
  getRestaurantBySlug, 
  dishes,
  cities 
} from '@/data/mockData';

const priceLabels: { [key: number]: string } = {
  1: '€ · Budget',
  2: '€€ · Moderate',
  3: '€€€ · Upscale',
  4: '€€€€ · Luxury',
};

const ambienceTagStyles: { [key: string]: string } = {
  'romantic': 'tag-romantic',
  'family-friendly': 'tag-family',
  'high-end': 'tag-highend',
  'cozy': 'tag-cozy',
  'business': 'tag-business',
  'trendy': 'tag-cozy',
  'casual': 'tag-family',
  'lively': 'tag-romantic',
};

export default function RestaurantPage() {
  const { slug } = useParams<{ slug: string }>();
  const { t } = useTranslation();
  
  const restaurant = getRestaurantBySlug(slug || '');
  const { reviews, loading: reviewsLoading, submitting, submitReview } = useReviews(restaurant?.id);
  const { isFavorite, toggleFavorite } = useFavorites();

  if (!restaurant) {
    return (
      <Layout>
        <div className="container py-16 text-center">
          <h1 className="text-2xl font-bold mb-4">Restaurant not found</h1>
          <Button asChild>
            <Link to="/search">Back to search</Link>
          </Button>
        </div>
      </Layout>
    );
  }

  const city = cities.find(c => c.id === restaurant.cityId);
  const restaurantDishes = restaurant.dishes
    .map(rd => dishes.find(d => d.id === rd.dishId))
    .filter(Boolean);

  const isOpen = () => {
    const now = new Date();
    const day = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][now.getDay()];
    const hours = restaurant.openingHours[day];
    if (!hours || hours === 'closed') return false;
    // Simplified check - in production would parse actual times
    return true;
  };

  return (
    <Layout>
      {/* Hero Image */}
      <div className="relative h-64 md:h-96 overflow-hidden">
        <img
          src={restaurant.images[0]}
          alt={restaurant.name}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent" />
        
        {/* Back Button */}
        <Link
          to="/search"
          className="absolute top-4 left-4 p-2 rounded-full bg-background/80 backdrop-blur hover:bg-background transition-colors"
        >
          <ChevronLeft className="h-5 w-5" />
        </Link>

        {/* Badges */}
        <div className="absolute top-4 right-4 flex gap-2">
          {restaurant.isTopListing && (
            <Badge className="featured-badge border-0 gap-1">
              <Trophy className="h-3 w-3" />
              {t('restaurant.topListing')}
            </Badge>
          )}
          {restaurant.isFeatured && !restaurant.isTopListing && (
            <Badge className="featured-badge border-0 gap-1">
              <Sparkles className="h-3 w-3" />
              {t('restaurant.featured')}
            </Badge>
          )}
        </div>
      </div>

      <div className="container py-8">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Header */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <h1 className="text-3xl md:text-4xl font-bold mb-2">
                    {restaurant.name}
                  </h1>
                  <div className="flex items-center gap-4 text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Star className="h-5 w-5 fill-rating text-rating" />
                      <span className="font-semibold text-foreground">{restaurant.rating.toFixed(1)}</span>
                      <span>({restaurant.reviewCount} {t('restaurant.reviews')})</span>
                    </div>
                    <span>{priceLabels[restaurant.priceLevel]}</span>
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="icon"
                    onClick={() => toggleFavorite(restaurant.id)}
                    className={isFavorite(restaurant.id) ? 'text-red-500' : ''}
                  >
                    <Heart className={`h-4 w-4 ${isFavorite(restaurant.id) ? 'fill-current' : ''}`} />
                  </Button>
                  <Button variant="outline" size="icon">
                    <Share2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Location */}
              <div className="flex items-center gap-2 text-muted-foreground mb-4">
                <MapPin className="h-4 w-4" />
                <span>{restaurant.address}, {restaurant.postalCode} {city?.name}</span>
              </div>

              {/* Open Status */}
              <div className="flex items-center gap-2 mb-4">
                <Clock className="h-4 w-4 text-muted-foreground" />
                {isOpen() ? (
                  <Badge variant="secondary" className="bg-tag-family/10 text-tag-family">
                    {t('restaurant.openNow')}
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="bg-destructive/10 text-destructive">
                    {t('restaurant.closed')}
                  </Badge>
                )}
              </div>

              {/* Tags */}
              <div className="flex flex-wrap gap-2">
                {restaurant.ambienceTags.map((tag) => (
                  <span
                    key={tag}
                    className={`px-3 py-1 text-sm font-medium rounded-full ${
                      ambienceTagStyles[tag] || 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {t(`filters.${tag.replace('-', '')}`) || tag}
                  </span>
                ))}
                {restaurant.cuisines.map((cuisine) => (
                  <Badge key={cuisine} variant="outline" className="capitalize">
                    {cuisine}
                  </Badge>
                ))}
              </div>
            </motion.div>

            <Separator />

            {/* Known For */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <h2 className="text-xl font-bold mb-4">{t('restaurant.knownFor')}</h2>
              <div className="flex flex-wrap gap-3">
                {restaurantDishes.map((dish) => (
                  <Link
                    key={dish!.id}
                    to={`/search?dish=${encodeURIComponent(dish!.name)}`}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-accent hover:bg-accent/80 transition-colors"
                  >
                    <span className="font-medium">{dish!.name}</span>
                  </Link>
                ))}
              </div>
            </motion.div>

            <Separator />

            {/* Reviews */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <h2 className="text-xl font-bold mb-6">{t('reviews.title')}</h2>
              
              <div className="space-y-6">
                <ReviewForm onSubmit={submitReview} submitting={submitting} />
                <ReviewList reviews={reviews} loading={reviewsLoading} />
              </div>
            </motion.div>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="sticky top-24 space-y-4"
            >
              {/* CTA Card */}
              <div className="p-6 rounded-2xl border border-border bg-card">
                <div className="space-y-3">
                  {restaurant.reservationUrl && (
                    <Button className="w-full" size="lg" asChild>
                      <a href={restaurant.reservationUrl} target="_blank" rel="noopener noreferrer">
                        {t('restaurant.reserve')}
                      </a>
                    </Button>
                  )}
                  
                  <Button variant="outline" className="w-full" size="lg" asChild>
                    <a href={restaurant.websiteUrl} target="_blank" rel="noopener noreferrer">
                      <Globe className="h-4 w-4 mr-2" />
                      {t('restaurant.website')}
                    </a>
                  </Button>

                  <div className="grid grid-cols-2 gap-3">
                    <Button variant="outline" asChild>
                      <a href={`tel:${restaurant.phone}`}>
                        <Phone className="h-4 w-4 mr-2" />
                        {t('restaurant.call')}
                      </a>
                    </Button>
                    <Button variant="outline" asChild>
                      <a 
                        href={`https://www.google.com/maps/dir/?api=1&destination=${restaurant.geoLat},${restaurant.geoLng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Navigation className="h-4 w-4 mr-2" />
                        {t('restaurant.directions')}
                      </a>
                    </Button>
                  </div>
                </div>
              </div>

              {/* Opening Hours */}
              <div className="p-6 rounded-2xl border border-border bg-card">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Opening Hours
                </h3>
                <div className="space-y-2 text-sm">
                  {Object.entries(restaurant.openingHours).map(([day, hours]) => (
                    <div key={day} className="flex justify-between">
                      <span className="capitalize text-muted-foreground">{day}</span>
                      <span className={hours === 'closed' ? 'text-muted-foreground' : ''}>
                        {hours === 'closed' ? 'Closed' : hours}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
