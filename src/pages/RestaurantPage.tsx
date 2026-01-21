import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { useEffect, useMemo } from 'react';
import { 
  Star, 
  MapPin, 
  Phone, 
  Globe, 
  Clock, 
  Heart, 
  Navigation,
  Sparkles,
  Trophy,
  ChevronLeft,
  Instagram
} from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { ReviewForm } from '@/components/reviews/ReviewForm';
import { ReviewList } from '@/components/reviews/ReviewList';
import { SmartSuggestions } from '@/components/ai/SmartSuggestions';
import { MenuSection } from '@/components/restaurant/MenuSection';
import { BusyIndicator } from '@/components/restaurant/BusyIndicator';
import { SustainabilityScore } from '@/components/restaurant/SustainabilityScore';
import { EventsSection } from '@/components/restaurant/EventsSection';
import { ReservationWidget } from '@/components/restaurant/ReservationWidget';
import { AlternativeRestaurants } from '@/components/routing/AlternativeRestaurants';
import { SocialShare } from '@/components/social/SocialShare';
import { OpeningHoursDisplay } from '@/components/restaurant/OpeningHoursDisplay';
import { ImageGallery } from '@/components/restaurant/ImageGallery';
import { SEOHead, createRestaurantSchema, createBreadcrumbSchema } from '@/components/seo/SEOHead';
import { useFavorites } from '@/hooks/useFavorites';
import { useReviews } from '@/hooks/useReviews';
import { useRestaurant } from '@/hooks/useRestaurant';
import { useAIRecommendations } from '@/hooks/useAIRecommendations';
import { useAlternativeRestaurants, type RoutingReason } from '@/hooks/useAlternativeRestaurants';
import { useAuth } from '@/contexts/AuthContext';
import { useGeolocation } from '@/hooks/useGeolocation';
import { PRICE_LABELS_FULL, AMBIENCE_TAG_STYLES, WEEK_DAYS } from '@/lib/constants';

export default function RestaurantPage() {
  const { slug } = useParams<{ slug: string }>();
  const { t } = useTranslation();
  
  const { restaurant, loading: restaurantLoading, error } = useRestaurant(slug);
  const { reviews, loading: reviewsLoading, submitting, submitReview, refetch } = useReviews(restaurant?.id);
  const { isFavorite, toggleFavorite } = useFavorites();
  const { smartSuggestions, getSmartSuggestions } = useAIRecommendations();
  const { alternatives, loading: alternativesLoading, findAlternatives, trackClick } = useAlternativeRestaurants();
  const { latitude, longitude } = useGeolocation();
  const { user } = useAuth();

  // Determine if restaurant is unavailable
  const getUnavailabilityReason = useMemo((): RoutingReason | null => {
    if (!restaurant) return null;
    
    const openingHours = (restaurant.opening_hours || {}) as { [key: string]: string };
    const now = new Date();
    const day = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][now.getDay()];
    const hours = openingHours[day];
    
    if (!hours || hours === 'closed') return 'closed';
    if (restaurant.current_busy_level === 'very_busy') return 'busy';
    
    return null;
  }, [restaurant]);

  // Get smart suggestions when we have dishes
  useEffect(() => {
    if (restaurant?.dishes && restaurant.dishes.length > 0) {
      const primaryDish = restaurant.dishes[0].name;
      getSmartSuggestions(primaryDish);
    }
  }, [restaurant?.dishes, getSmartSuggestions]);

  // Find alternatives when restaurant is unavailable
  useEffect(() => {
    if (restaurant && getUnavailabilityReason) {
      findAlternatives({
        sourceRestaurantId: restaurant.id,
        reason: getUnavailabilityReason,
        dishIds: restaurant.dishes?.map(d => d.id) || [],
        priceLevel: restaurant.price_level,
        cuisines: restaurant.cuisines || [],
        ambienceTags: restaurant.ambience_tags || [],
        userLat: latitude || undefined,
        userLng: longitude || undefined,
      });
    }
  }, [restaurant, getUnavailabilityReason, latitude, longitude, findAlternatives]);

  const handleAlternativeClick = (targetId: string) => {
    if (restaurant && getUnavailabilityReason) {
      const dishId = restaurant.dishes?.[0]?.id;
      trackClick(restaurant.id, targetId, dishId, getUnavailabilityReason);
    }
  };

  if (restaurantLoading) {
    return (
      <Layout>
        <div className="h-64 md:h-96 bg-muted animate-pulse" />
        <div className="container py-8">
          <div className="grid lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-4">
              <Skeleton className="h-10 w-64" />
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  if (error || !restaurant) {
    return (
      <Layout>
        <div className="container py-16 text-center">
          <h1 className="text-2xl font-bold mb-4">{error || 'Restaurant niet gevonden'}</h1>
          <Button asChild>
            <Link to="/search">Terug naar zoeken</Link>
          </Button>
        </div>
      </Layout>
    );
  }

  const openingHours = (restaurant.opening_hours || {}) as { [key: string]: string };

  const isOpen = () => {
    const now = new Date();
    const day = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][now.getDay()];
    const hours = openingHours[day];
    if (!hours || hours === 'closed') return false;
    return true;
  };

  // Generate SEO structured data
  const restaurantSchema = createRestaurantSchema({
    name: restaurant.name,
    description: `${restaurant.name} - ${restaurant.cuisines?.join(', ') || 'Restaurant'} in ${restaurant.city?.name || 'Nederland'}`,
    image: restaurant.images?.[0],
    address: restaurant.address,
    city: restaurant.city?.name || '',
    postalCode: restaurant.postal_code || '',
    phone: restaurant.phone || undefined,
    website: restaurant.website_url || undefined,
    cuisines: restaurant.cuisines || [],
    priceRange: '€'.repeat(restaurant.price_level),
    rating: Number(restaurant.rating),
    reviewCount: restaurant.review_count,
    geo: restaurant.geo_lat && restaurant.geo_lng ? {
      lat: Number(restaurant.geo_lat),
      lng: Number(restaurant.geo_lng)
    } : undefined
  });

  const breadcrumbSchema = createBreadcrumbSchema([
    { name: 'Home', url: 'https://dishloopr.com' },
    { name: 'Zoeken', url: 'https://dishloopr.com/search' },
    { name: restaurant.name, url: `https://dishloopr.com/restaurant/${restaurant.slug}` }
  ]);

  return (
    <Layout>
      <SEOHead
        title={`${restaurant.name} - ${restaurant.cuisines?.slice(0, 2).join(' & ') || 'Restaurant'} | Dishloopr`}
        description={`Bekijk ${restaurant.name} in ${restaurant.city?.name || 'Nederland'}. ${restaurant.cuisines?.join(', ') || 'Heerlijk eten'} met ${restaurant.review_count} reviews en een ${Number(restaurant.rating).toFixed(1)} rating.`}
        ogType="restaurant"
        ogImage={restaurant.images?.[0]}
        ogImageAlt={`${restaurant.name} restaurant`}
        keywords={[restaurant.name, ...(restaurant.cuisines || []), restaurant.city?.name || '', 'restaurant', 'reviews']}
        structuredData={{
          '@context': 'https://schema.org',
          '@graph': [restaurantSchema, breadcrumbSchema]
        }}
      />
      {/* Hero Image Gallery */}
      <div className="relative">
        <ImageGallery 
          images={restaurant.images || []} 
          restaurantName={restaurant.name} 
        />
        
        {/* Back Button */}
        <Link
          to="/search"
          className="absolute top-4 left-4 z-10 p-2 rounded-full bg-background/80 backdrop-blur hover:bg-background transition-colors"
        >
          <ChevronLeft className="h-5 w-5" />
        </Link>

        {/* Badges */}
        <div className="absolute top-4 right-4 z-10 flex gap-2">
          {restaurant.is_top_listing && (
            <Badge className="featured-badge border-0 gap-1">
              <Trophy className="h-3 w-3" />
              {t('restaurant.topListing')}
            </Badge>
          )}
          {restaurant.is_featured && !restaurant.is_top_listing && (
            <Badge className="featured-badge border-0 gap-1">
              <Sparkles className="h-3 w-3" />
              {t('restaurant.featured')}
            </Badge>
          )}
        </div>
      </div>

      <div className="container px-4 md:px-6 py-6 md:py-8">
        <div className="grid lg:grid-cols-3 gap-6 md:gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6 md:space-y-8">
            {/* Header */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="flex items-start justify-between gap-3 mb-3 md:mb-4">
                <div className="min-w-0">
                  <h1 className="text-2xl md:text-4xl font-bold mb-1 md:mb-2 truncate">
                    {restaurant.name}
                  </h1>

                  {restaurant.chain && (
                    <div className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground mb-1">
                      <span className="font-medium">{restaurant.chain.name}</span>
                      {typeof restaurant.chainLocationsCount === 'number' && (
                        <span>• {restaurant.chainLocationsCount} vestigingen</span>
                      )}
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-2 md:gap-4 text-sm md:text-base text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Star className="h-4 w-4 md:h-5 md:w-5 fill-rating text-rating" />
                      <span className="font-semibold text-foreground">{Number(restaurant.rating).toFixed(1)}</span>
                      <span>({restaurant.review_count} {t('restaurant.reviews')})</span>
                    </div>
                    <span className="hidden md:inline">{PRICE_LABELS_FULL[restaurant.price_level]}</span>
                    <span className="md:hidden">{'€'.repeat(restaurant.price_level)}</span>
                  </div>
                </div>
                
                <div className="flex gap-2 shrink-0">
                  <Button 
                    variant="outline" 
                    size="icon"
                    onClick={() => toggleFavorite(restaurant.id)}
                    className={`h-9 w-9 md:h-10 md:w-10 ${isFavorite(restaurant.id) ? 'text-red-500' : ''}`}
                  >
                    <Heart className={`h-4 w-4 ${isFavorite(restaurant.id) ? 'fill-current' : ''}`} />
                  </Button>
                  <SocialShare 
                    title={restaurant.name} 
                    description={`Bekijk ${restaurant.name} op Dishloopr`}
                    hashtags={['dishloopr', ...(restaurant.cuisines || [])]}
                    variant="icon"
                    className="h-9 w-9 md:h-10 md:w-10"
                  />
                </div>
              </div>

              {/* Location */}
              <div className="flex items-center gap-2 text-sm md:text-base text-muted-foreground mb-3 md:mb-4">
                <MapPin className="h-4 w-4 shrink-0" />
                <span className="truncate">{restaurant.address}, {restaurant.postal_code} {restaurant.city?.name}</span>
              </div>

              {/* Open Status & Busy Level */}
              <div className="flex flex-wrap items-center gap-3 mb-3 md:mb-4">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  {isOpen() ? (
                    <Badge variant="secondary" className="bg-tag-family/10 text-tag-family text-xs">
                      {t('restaurant.openNow')}
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="bg-destructive/10 text-destructive text-xs">
                      {t('restaurant.closed')}
                    </Badge>
                  )}
                </div>
                {restaurant.current_busy_level && (
                  <BusyIndicator busyLevel={restaurant.current_busy_level} />
                )}
                {restaurant.sustainability_score && (
                  <SustainabilityScore score={restaurant.sustainability_score} compact />
                )}
              </div>

              {/* Tags */}
              <div className="flex flex-wrap gap-1.5 md:gap-2">
                {restaurant.ambience_tags?.map((tag) => (
                  <span
                    key={tag}
                    className={`px-2 md:px-3 py-0.5 md:py-1 text-xs md:text-sm font-medium rounded-full ${
                      AMBIENCE_TAG_STYLES[tag] || 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {t(`filters.${tag.replace('-', '')}`) || tag}
                  </span>
                ))}
                {restaurant.cuisines?.map((cuisine) => (
                  <Badge key={cuisine} variant="outline" className="capitalize text-xs md:text-sm">
                    {cuisine}
                  </Badge>
                ))}
              </div>
            </motion.div>

            {/* Mobile CTA Buttons */}
            <div className="lg:hidden flex gap-2">
              <ReservationWidget 
                zenchefId={restaurant.zenchef_id}
                reservationUrl={restaurant.reservation_url}
                restaurantName={restaurant.name}
                variant="button"
              />
              {restaurant.phone && (
                <Button variant="outline" size="icon" asChild className="shrink-0">
                  <a href={`tel:${restaurant.phone}`}>
                    <Phone className="h-4 w-4" />
                  </a>
                </Button>
              )}
              {restaurant.geo_lat && restaurant.geo_lng && (
                <Button variant="outline" size="icon" asChild className="shrink-0">
                  <a 
                    href={`https://www.google.com/maps/dir/?api=1&destination=${restaurant.geo_lat},${restaurant.geo_lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Navigation className="h-4 w-4" />
                  </a>
                </Button>
              )}
            </div>

            <Separator />

            {/* Known For - Signature dishes that boost search ranking */}
            {restaurant.dishes && restaurant.dishes.length > 0 && (
              <>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                >
                  <h2 className="text-lg md:text-xl font-bold mb-3 md:mb-4">{t('restaurant.knownFor')}</h2>
                  <div className="flex flex-wrap gap-2 md:gap-3">
                    {restaurant.dishes.map((dish) => (
                      <Link
                        key={dish.id}
                        to={`/search?dish=${encodeURIComponent(dish.name)}`}
                        className="flex items-center gap-2 px-3 md:px-4 py-1.5 md:py-2 rounded-lg md:rounded-xl bg-primary/10 hover:bg-primary/20 border border-primary/20 transition-colors text-sm md:text-base group"
                      >
                        <span className="font-medium text-primary group-hover:text-primary/80">{dish.name}</span>
                      </Link>
                    ))}
                  </div>
                </motion.div>

                <Separator />
              </>
            )}

            {/* Menu Section */}
            <MenuSection restaurantId={restaurant.id} />

            <Separator />

            {/* Alternative Restaurants - shown when restaurant is closed/busy */}
            {getUnavailabilityReason && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
              >
                <AlternativeRestaurants
                  alternatives={alternatives}
                  loading={alternativesLoading}
                  reason={getUnavailabilityReason}
                  sourceRestaurantName={restaurant.name}
                  onAlternativeClick={handleAlternativeClick}
                />
                <Separator className="mt-6 md:mt-8" />
              </motion.div>
            )}

            {/* Events Section */}
            <EventsSection restaurantId={restaurant.id} />

            {/* Sustainability Score (full version) */}
            {restaurant.sustainability_score && (
              <>
                <Separator />
                <SustainabilityScore score={restaurant.sustainability_score} />
              </>
            )}

            <Separator />

            {/* Reviews */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <h2 className="text-lg md:text-xl font-bold mb-4 md:mb-6">{t('reviews.title')}</h2>
              
              <div className="space-y-6">
                <ReviewForm 
                  onSubmit={submitReview} 
                  submitting={submitting}
                  restaurantId={restaurant.id}
                  ambienceTags={restaurant.ambience_tags || []}
                  cuisines={restaurant.cuisines || []}
                />
                <ReviewList 
                  reviews={reviews} 
                  loading={reviewsLoading} 
                  isOwner={user?.id === restaurant?.claimed_by_owner_id}
                  onRefetch={refetch}
                />
              </div>
            </motion.div>
          </div>

          {/* Sidebar */}
          <div className="hidden lg:block lg:col-span-1">
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="sticky top-24 space-y-4"
            >
              {/* Reservation Widget */}
              <ReservationWidget 
                zenchefId={restaurant.zenchef_id}
                reservationUrl={restaurant.reservation_url}
                restaurantName={restaurant.name}
                variant="full"
              />

              {/* Website & Contact Card */}
              <div className="p-6 rounded-2xl border border-border bg-card">
                <div className="space-y-3">
                  {restaurant.website_url && (
                    <Button variant="outline" className="w-full" size="lg" asChild>
                      <a href={restaurant.website_url} target="_blank" rel="noopener noreferrer">
                        <Globe className="h-4 w-4 mr-2" />
                        {t('restaurant.website')}
                      </a>
                    </Button>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    {restaurant.phone && (
                      <Button variant="outline" asChild>
                        <a href={`tel:${restaurant.phone}`}>
                          <Phone className="h-4 w-4 mr-2" />
                          {t('restaurant.call')}
                        </a>
                      </Button>
                    )}
                    {restaurant.geo_lat && restaurant.geo_lng && (
                      <Button variant="outline" asChild>
                        <a 
                          href={`https://www.google.com/maps/dir/?api=1&destination=${restaurant.geo_lat},${restaurant.geo_lng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Navigation className="h-4 w-4 mr-2" />
                          {t('restaurant.directions')}
                        </a>
                      </Button>
                    )}
                  </div>

                  {/* Social Media Links */}
                  {(restaurant.instagram_url || restaurant.tiktok_url) && (
                    <div className="flex gap-2 pt-2 border-t border-border">
                      {restaurant.instagram_url && (
                        <Button variant="outline" size="icon" asChild className="flex-1">
                          <a href={restaurant.instagram_url} target="_blank" rel="noopener noreferrer" title="Instagram">
                            <Instagram className="h-4 w-4" />
                          </a>
                        </Button>
                      )}
                      {restaurant.tiktok_url && (
                        <Button variant="outline" size="icon" asChild className="flex-1">
                          <a href={restaurant.tiktok_url} target="_blank" rel="noopener noreferrer" title="TikTok">
                            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
                            </svg>
                          </a>
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Opening Hours - Enhanced display with call & directions on mobile */}
              <OpeningHoursDisplay 
                openingHours={openingHours} 
                phone={restaurant.phone}
                geoLat={restaurant.geo_lat ? Number(restaurant.geo_lat) : undefined}
                geoLng={restaurant.geo_lng ? Number(restaurant.geo_lng) : undefined}
                restaurantName={restaurant.name}
              />

              {/* Smart AI Suggestions */}
              {restaurant.dishes && restaurant.dishes.length > 0 && smartSuggestions.length > 0 && (
                <SmartSuggestions 
                  currentDish={restaurant.dishes[0].name} 
                  suggestions={smartSuggestions} 
                />
              )}
            </motion.div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
