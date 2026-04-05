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
  Instagram,
  Calendar
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
import { FeaturedRestaurantsCarousel } from '@/components/restaurant/FeaturedRestaurantsCarousel';
import { RelatedLinks } from '@/components/restaurant/RelatedLinks';
import { SEOHead, createRestaurantSchema, createBreadcrumbSchema } from '@/components/seo/SEOHead';
import { useFavorites } from '@/hooks/useFavorites';
import { useReviews } from '@/hooks/useReviews';
import { useRestaurant } from '@/hooks/useRestaurant';
import { useAIRecommendations } from '@/hooks/useAIRecommendations';
import { useAlternativeRestaurants, type RoutingReason } from '@/hooks/useAlternativeRestaurants';
import { useAuth } from '@/contexts/AuthContext';
import { useGeolocation } from '@/hooks/useGeolocation';
import { PRICE_LABELS_FULL, AMBIENCE_TAG_STYLES, AMBIENCE_TAG_I18N_KEYS, WEEK_DAYS } from '@/lib/constants';
import { TikTokIcon } from '@/components/icons/TikTokIcon';

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

  // Determine if restaurant is currently open
  const isCurrentlyOpen = useMemo((): boolean => {
    if (!restaurant) return false;
    
    const openingHours = (restaurant.opening_hours || {}) as { [key: string]: string };
    const now = new Date();
    const day = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][now.getDay()];
    const hours = openingHours[day];
    
    if (!hours || hours === 'closed') return false;
    
    // Try to parse hours like "12:00 - 22:00" or "12:00-22:00"
    const match = hours.match(/(\d{1,2}):?(\d{2})?\s*[-–]\s*(\d{1,2}):?(\d{2})?/);
    if (!match) return true; // If can't parse, assume open
    
    const openHour = parseInt(match[1]);
    const openMin = parseInt(match[2] || '0');
    const closeHour = parseInt(match[3]);
    const closeMin = parseInt(match[4] || '0');
    
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const openMinutes = openHour * 60 + openMin;
    const closeMinutes = closeHour * 60 + closeMin;
    
    return currentMinutes >= openMinutes && currentMinutes < closeMinutes;
  }, [restaurant]);

  // Determine if restaurant is unavailable (for alternatives)
  const getUnavailabilityReason = useMemo((): RoutingReason | null => {
    if (!restaurant) return null;
    if (!isCurrentlyOpen) return 'closed';
    if (restaurant.current_busy_level === 'very_busy') return 'busy';
    return null;
  }, [restaurant, isCurrentlyOpen]);

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
    } : undefined,
    openingHours: openingHours,
    slug: restaurant.slug,
  });

  const breadcrumbSchema = createBreadcrumbSchema([
    { name: 'Home', url: 'https://dishloopr.com' },
    { name: 'Zoeken', url: 'https://dishloopr.com/search' },
    { name: restaurant.name, url: `https://dishloopr.com/restaurant/${restaurant.slug}` }
  ]);

  const hasReservation = !!(restaurant.reservation_url || restaurant.zenchef_id);
  const reservationHref = restaurant.reservation_url || `https://widget.zenchef.com/reservation/${restaurant.zenchef_id}`;

  return (
    <Layout>
      <SEOHead
        title={`${restaurant.name} - ${restaurant.cuisines?.slice(0, 2).join(' & ') || 'Restaurant'} | Dishloopr`}
        description={`Bekijk ${restaurant.name} in ${restaurant.city?.name || 'Nederland'}. ${restaurant.cuisines?.join(', ') || 'Heerlijk eten'} met ${restaurant.review_count} reviews en een ${Number(restaurant.rating).toFixed(1)} rating.`}
        canonical={`https://dishloopr.com/restaurant/${restaurant.slug}`}
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

      <div className={`container px-4 md:px-6 py-6 md:py-8 overflow-hidden ${hasReservation ? 'pb-28 lg:pb-8' : 'pb-16 lg:pb-8'}`}>
        <div className="grid lg:grid-cols-3 gap-6 md:gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6 md:space-y-8 min-w-0">
            {/* Header - Two column layout with info and opening hours */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="flex flex-col md:flex-row gap-4 md:gap-6">
                {/* Left: Restaurant Info */}
                <div className="flex-1 min-w-0">
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

                  <div className="flex flex-wrap items-center gap-2 md:gap-4 text-sm md:text-base text-muted-foreground mb-3">
                    <div className="flex items-center gap-1">
                      <Star className="h-4 w-4 md:h-5 md:w-5 fill-rating text-rating" />
                      <span className="font-semibold text-foreground">{Number(restaurant.rating).toFixed(1)}</span>
                      <span>({restaurant.review_count} {t('restaurant.reviews')})</span>
                    </div>
                    <span className="hidden md:inline">{PRICE_LABELS_FULL[restaurant.price_level]}</span>
                    <span className="md:hidden">{'€'.repeat(restaurant.price_level)}</span>
                  </div>

                  {/* Location */}
                  <div className="flex items-center gap-2 text-sm md:text-base text-muted-foreground mb-3 min-w-0">
                    <MapPin className="h-4 w-4 shrink-0" />
                    <span className="truncate block min-w-0">{restaurant.address}, {restaurant.postal_code} {restaurant.city?.name}</span>
                  </div>

                  {/* Open Status & Busy Level */}
                  <div className="flex flex-wrap items-center gap-3 mb-3">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      {isCurrentlyOpen ? (
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
                  <div className="flex flex-wrap gap-1.5 md:gap-2 mb-4">
                    {restaurant.ambience_tags?.map((tag) => (
                      <span
                        key={tag}
                        className={`px-2 md:px-3 py-0.5 md:py-1 text-xs md:text-sm font-medium rounded-full ${
                          AMBIENCE_TAG_STYLES[tag] || 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {AMBIENCE_TAG_I18N_KEYS[tag] ? t(AMBIENCE_TAG_I18N_KEYS[tag]) : tag}
                      </span>
                    ))}
                    {restaurant.cuisines?.map((cuisine) => (
                      <Badge key={cuisine} variant="outline" className="capitalize text-xs md:text-sm">
                        {cuisine}
                      </Badge>
                    ))}
                  </div>

                  {/* Action buttons: Favorites, Share, Socials, Website */}
                  <div className="flex flex-wrap items-center gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => toggleFavorite(restaurant.id)}
                      aria-label={isFavorite(restaurant.id) ? t('favorites.remove', 'Verwijder uit favorieten') : t('favorites.add', 'Toevoegen aan favorieten')}
                      className={`gap-2 ${isFavorite(restaurant.id) ? 'text-destructive border-destructive/30' : ''}`}
                    >
                      <Heart className={`h-4 w-4 ${isFavorite(restaurant.id) ? 'fill-current' : ''}`} />
                      <span className="hidden sm:inline">{isFavorite(restaurant.id) ? 'Opgeslagen' : 'Opslaan'}</span>
                    </Button>
                    <SocialShare 
                      title={restaurant.name} 
                      description={`Bekijk ${restaurant.name} op Dishloopr`}
                      hashtags={['dishloopr', ...(restaurant.cuisines || [])]}
                      variant="icon"
                      className="h-8 w-8"
                    />
                    {restaurant.website_url && (
                      <Button variant="outline" size="sm" asChild>
                        <a href={restaurant.website_url} target="_blank" rel="noopener noreferrer" className="gap-2">
                          <Globe className="h-4 w-4" />
                          <span className="hidden sm:inline">Website</span>
                        </a>
                      </Button>
                    )}
                    {restaurant.instagram_url && (
                      <Button variant="outline" size="icon" className="h-8 w-8" asChild>
                        <a href={restaurant.instagram_url} target="_blank" rel="noopener noreferrer" title="Instagram">
                          <Instagram className="h-4 w-4" />
                        </a>
                      </Button>
                    )}
                    {restaurant.tiktok_url && (
                      <Button variant="outline" size="icon" className="h-8 w-8" asChild>
                        <a href={restaurant.tiktok_url} target="_blank" rel="noopener noreferrer" aria-label="TikTok">
                          <TikTokIcon />
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Mobile-only: Contact, Opening Hours & Reservation */}
            <div className="lg:hidden space-y-3">
              {/* CTA Buttons */}
              <div className="grid grid-cols-2 gap-2">
                {hasReservation && (
                  <Button className="col-span-2 bg-primary text-primary-foreground font-semibold text-base h-12" size="lg" asChild>
                    <a href={reservationHref} target="_blank" rel="noopener noreferrer" className="gap-2">
                      <Calendar className="h-5 w-5" />
                      {t('restaurant.reserve')}
                    </a>
                  </Button>
                )}
                {restaurant.phone && (
                  <Button variant="outline" size="default" asChild>
                    <a href={`tel:${restaurant.phone}`}>
                      <Phone className="h-4 w-4 mr-1.5" />
                      {t('openingHours.callNow')}
                    </a>
                  </Button>
                )}
                {restaurant.geo_lat && restaurant.geo_lng && (
                  <Button variant="outline" size="default" asChild>
                    <a 
                      href={`https://www.google.com/maps/dir/?api=1&destination=${restaurant.geo_lat},${restaurant.geo_lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Navigation className="h-4 w-4 mr-1.5" />
                      {t('restaurant.directions')}
                    </a>
                  </Button>
                )}
              </div>

              {/* Opening Hours Compact */}
              <OpeningHoursDisplay 
                openingHours={openingHours}
                className="w-full"
              />
            </div>

            <Separator />

            {/* Gerechten - unified section with filters */}
            <MenuSection restaurantId={restaurant.id} />

            <Separator />

            {/* Alternative Restaurants - shown when restaurant is closed/busy */}
            {!isCurrentlyOpen && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="space-y-6"
              >
                <AlternativeRestaurants
                  alternatives={alternatives}
                  loading={alternativesLoading}
                  reason={getUnavailabilityReason || 'closed'}
                  sourceRestaurantName={restaurant.name}
                  onAlternativeClick={handleAlternativeClick}
                />
                
                <Separator />
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

            {/* Featured Restaurants Carousel */}
            <FeaturedRestaurantsCarousel 
              currentRestaurantId={restaurant.id}
              cityId={restaurant.city_id}
            />

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

            {/* Related Internal Links for SEO */}
            <RelatedLinks
              restaurantName={restaurant.name}
              cityName={restaurant.city?.name}
              cityId={restaurant.city_id}
              cuisines={restaurant.cuisines || []}
              dishes={restaurant.dishes || []}
            />
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
                          <a href={restaurant.tiktok_url} target="_blank" rel="noopener noreferrer" aria-label="TikTok">
                            <TikTokIcon />
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

      {/* Sticky mobile reservation bar */}
      {hasReservation && (
        <div className="fixed bottom-14 left-0 right-0 z-40 lg:hidden bg-background/95 backdrop-blur border-t border-border p-3 safe-area-bottom">
          <Button className="w-full bg-primary text-primary-foreground font-semibold text-base h-12" size="lg" asChild>
            <a href={reservationHref} target="_blank" rel="noopener noreferrer" className="gap-2">
              <Calendar className="h-5 w-5" />
              {t('restaurant.reserve')}
            </a>
          </Button>
        </div>
      )}
    </Layout>
  );
}
