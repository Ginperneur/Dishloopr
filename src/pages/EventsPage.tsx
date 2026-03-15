import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';
import { Calendar, Users, ChefHat, Wine, Utensils, Euro, ArrowRight, PartyPopper, Tag } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Layout } from '@/components/layout/Layout';
import { SEOHead, createBreadcrumbSchema } from '@/components/seo/SEOHead';
import { useRestaurantEvents } from '@/hooks/useRestaurantEvents';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface EventWithRestaurant {
  id: string;
  restaurant_id: string;
  title: string;
  description: string | null;
  event_type: string;
  event_date: string;
  end_date: string | null;
  price: number | null;
  max_participants: number | null;
  current_participants: number;
  image_url: string | null;
  restaurant?: {
    name: string;
    slug: string;
    images: string[] | null;
    city: { name: string } | null;
  };
}

const eventTypeIcons: Record<string, React.ElementType> = {
  tasting: Wine,
  chefs_table: ChefHat,
  special_menu: Utensils,
  workshop: ChefHat,
  ladies_night: PartyPopper,
  discount: Tag,
};

const eventTypeLabels: Record<string, string> = {
  tasting: 'Proeverij',
  chefs_table: "Chef's Table",
  special_menu: 'Speciaal menu',
  workshop: 'Workshop',
  ladies_night: 'Ladies Night',
  discount: 'Korting',
};

export default function EventsPage() {
  const { t } = useTranslation();
  const [events, setEvents] = useState<EventWithRestaurant[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEvents = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('restaurant_events')
        .select(`
          *,
          restaurant:restaurant_id (
            name,
            slug,
            images,
            city:city_id (name)
          )
        `)
        .eq('is_active', true)
        .gte('event_date', new Date().toISOString())
        .order('event_date')
        .limit(30);

      if (!error && data) {
        setEvents(data.map((e: any) => ({
          ...e,
          price: e.price ? Number(e.price) : null,
        })));
      }
      setLoading(false);
    };
    fetchEvents();
  }, []);

  const breadcrumbData = createBreadcrumbSchema([
    { name: 'Home', url: 'https://dishloopr.com' },
    { name: 'Events & Acties', url: 'https://dishloopr.com/events' },
  ]);

  const formatEventDate = (dateString: string) => {
    const date = new Date(dateString);
    return format(date, "EEEE d MMMM 'om' HH:mm", { locale: nl });
  };

  const formatShortDate = (dateString: string) => {
    const date = new Date(dateString);
    return format(date, 'd MMM', { locale: nl });
  };

  return (
    <Layout>
      <SEOHead
        title={t('events.seoTitle', 'Restaurant Events & Acties | Dishloopr')}
        description={t('events.seoDescription', 'Ontdek speciale acties, evenementen en kortingen bij restaurants. Van proeverijen tot seizoensgebonden menu\'s.')}
        keywords={['restaurant events', 'acties', 'kortingen', 'proeverij', 'speciaal menu', 'evenementen', 'Nederland']}
        structuredData={{
          '@context': 'https://schema.org',
          '@graph': [
            breadcrumbData,
            ...(events.length > 0 ? [{
              '@context': 'https://schema.org',
              '@type': 'ItemList',
              itemListElement: events.slice(0, 10).map((event, i) => ({
                '@type': 'ListItem',
                position: i + 1,
                name: event.title,
                url: `https://dishloopr.com/restaurant/${event.restaurant?.slug || ''}`,
              })),
            }] : []),
          ],
        }}
        canonical="https://dishloopr.com/events"
      />

      <div className="container py-8 md:py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-3xl md:text-4xl font-bold mb-3 flex items-center gap-3">
            <PartyPopper className="h-8 w-8 text-primary" />
            Events & Acties
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl">
            Speciale acties, evenementen en kortingen bij restaurants in de buurt. 
            Van ladies nights tot seizoensgebonden menu's — mis geen enkele actie.
          </p>
        </motion.div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <Card key={i} className="overflow-hidden">
                <Skeleton className="h-40" />
                <CardContent className="p-4 space-y-2">
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-4 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-16">
            <Calendar className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">Nog geen evenementen</h2>
            <p className="text-muted-foreground">
              Er zijn momenteel geen aankomende events of acties. Kom snel terug!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {events.map((event, index) => {
              const Icon = eventTypeIcons[event.event_type] || Calendar;
              const spotsLeft = event.max_participants
                ? event.max_participants - event.current_participants
                : null;
              const restaurantImage = event.image_url || event.restaurant?.images?.[0];

              return (
                <motion.div
                  key={event.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Link to={`/restaurant/${event.restaurant?.slug}`}>
                    <Card className="group overflow-hidden hover:shadow-lg transition-all duration-300 h-full">
                      {/* Image */}
                      <div className="relative h-40 overflow-hidden bg-muted">
                        {restaurantImage ? (
                          <img
                            src={restaurantImage}
                            alt={event.title}
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Icon className="h-12 w-12 text-muted-foreground/40" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

                        {/* Date badge */}
                        <div className="absolute top-3 right-3">
                          <Badge className="bg-primary text-primary-foreground font-semibold">
                            {formatShortDate(event.event_date)}
                          </Badge>
                        </div>

                        {/* Type badge */}
                        <div className="absolute top-3 left-3">
                          <Badge variant="secondary" className="bg-white/90 text-foreground gap-1">
                            <Icon className="h-3 w-3" />
                            {eventTypeLabels[event.event_type] || event.event_type}
                          </Badge>
                        </div>

                        {/* Price */}
                        {event.price != null && (
                          <div className="absolute bottom-3 right-3">
                            <Badge variant="secondary" className="bg-white/90 text-foreground font-semibold">
                              <Euro className="h-3 w-3 mr-0.5" />
                              {event.price === 0 ? 'Gratis' : event.price}
                            </Badge>
                          </div>
                        )}
                      </div>

                      <CardContent className="p-4">
                        <h3 className="font-bold text-base group-hover:text-primary transition-colors line-clamp-1">
                          {event.title}
                        </h3>

                        {event.restaurant && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {event.restaurant.name}
                            {event.restaurant.city?.name && ` · ${event.restaurant.city.name}`}
                          </p>
                        )}

                        {event.description && (
                          <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                            {event.description}
                          </p>
                        )}

                        <div className="flex items-center justify-between mt-3">
                          <span className="text-xs text-muted-foreground">
                            {formatEventDate(event.event_date)}
                          </span>
                          {spotsLeft !== null && (
                            <Badge
                              variant={spotsLeft <= 3 ? 'destructive' : 'secondary'}
                              className="text-xs"
                            >
                              <Users className="h-3 w-3 mr-1" />
                              {spotsLeft > 0 ? `${spotsLeft} plekken` : 'Vol'}
                            </Badge>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}
