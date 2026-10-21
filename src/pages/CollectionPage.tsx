import { Link, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronLeft, Star, MapPin, Sparkles, Trophy } from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { SEOHead, createBreadcrumbSchema, createItemListSchema } from '@/components/seo/SEOHead';
import { useCollection, CollectionRestaurant } from '@/hooks/useCollections';
import { localizedField } from '@/lib/i18n/localizedField';
import { useTranslation } from 'react-i18next';
import { RatingSummary } from '@/components/restaurant/RatingSummary';
import { useOwnReviewStats } from '@/hooks/useOwnReviewStats';

function RestaurantCard({ item, index }: { item: CollectionRestaurant; index: number }) {
  const { restaurant } = item;
  const ownStats = useOwnReviewStats(restaurant.id);
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
    >
      <Link to={`/restaurant/${restaurant.slug}`}>
        <Card className="group overflow-hidden hover:shadow-lg transition-all duration-300">
          <div className="flex flex-col md:flex-row">
            {/* Image */}
            <div className="relative w-full md:w-48 h-48 md:h-auto flex-shrink-0 overflow-hidden">
              <img
                src={restaurant.images?.[0] || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=400&q=80'}
                alt={restaurant.name}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
              />
              
              {/* Badges */}
              <div className="absolute top-2 left-2 flex flex-col gap-1">
                {restaurant.is_top_listing && (
                  <Badge className="bg-gradient-to-r from-purple-500 to-indigo-600 border-0">
                    <Trophy className="h-3 w-3 mr-1" />
                    Top
                  </Badge>
                )}
                {restaurant.is_featured && !restaurant.is_top_listing && (
                  <Badge className="bg-gradient-to-r from-amber-400 to-orange-500 border-0">
                    <Sparkles className="h-3 w-3 mr-1" />
                    Featured
                  </Badge>
                )}
              </div>

              {/* Ranking */}
              <div className="absolute bottom-2 left-2 h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm">
                #{index + 1}
              </div>
            </div>

            {/* Content */}
            <CardContent className="flex-1 p-4 md:p-6">
              <div className="flex items-start justify-between mb-2">
                <h3 className="text-xl font-bold group-hover:text-primary transition-colors">
                  {restaurant.name}
                </h3>
                <RatingSummary
                  googleRating={restaurant.google_rating}
                  googleReviewsCount={restaurant.google_reviews_count}
                  ownReviewCount={ownStats?.count}
                  ownAverage={ownStats?.average}
                />
                
              </div>

              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                <MapPin className="h-4 w-4" />
                <span>{restaurant.address}</span>
                {restaurant.city?.name && (
                  <span>• {restaurant.city.name}</span>
                )}
              </div>

              {/* Featured reason */}
              {item.featured_reason && (
                <p className="text-sm text-muted-foreground mb-3">
                  {item.featured_reason}
                </p>
              )}

              {/* Tags */}
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">
                  {'€'.repeat(restaurant.price_level)}
                </Badge>
                {restaurant.cuisines?.slice(0, 3).map(cuisine => (
                  <Badge key={cuisine} variant="outline" className="capitalize">
                    {cuisine}
                  </Badge>
                ))}
                {restaurant.ambience_tags?.slice(0, 2).map(tag => (
                  <Badge key={tag} variant="outline" className="capitalize">
                    {tag}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </div>
        </Card>
      </Link>
    </motion.div>
  );
}

export default function CollectionPage() {
  const { slug } = useParams<{ slug: string }>();
  const { collection, restaurants, loading } = useCollection(slug);
  const { i18n } = useTranslation();

  if (loading) {
    return (
      <Layout>
        <div className="h-64 md:h-80 bg-muted animate-pulse" />
        <div className="container py-8">
          <Skeleton className="h-10 w-64 mb-4" />
          <Skeleton className="h-6 w-96 mb-8" />
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-48" />
            ))}
          </div>
        </div>
      </Layout>
    );
  }

  if (!collection) {
    return (
      <Layout>
        <div className="container py-16 text-center">
          <h1 className="text-2xl font-bold mb-4">Collectie niet gevonden</h1>
          <Button asChild>
            <Link to="/collections">Bekijk alle collecties</Link>
          </Button>
        </div>
      </Layout>
    );
  }

  const title = localizedField(collection.title_i18n, collection.title, i18n.language);
  const subtitle = localizedField(collection.subtitle_i18n, collection.subtitle, i18n.language);
  const description = localizedField(collection.description_i18n, collection.description, i18n.language);

  const breadcrumbSchema = createBreadcrumbSchema([
    { name: 'Home', url: 'https://dishloopr.com' },
    { name: 'Collecties', url: 'https://dishloopr.com/collections' },
    { name: title, url: `https://dishloopr.com/collection/${collection.slug}` }
  ]);

  const itemListSchema = createItemListSchema(
    restaurants.map((item, index) => ({
      name: item.restaurant.name,
      url: `https://dishloopr.com/restaurant/${item.restaurant.slug}`,
      image: item.restaurant.images?.[0],
      position: index + 1,
    }))
  );

  return (
    <Layout>
      <SEOHead
        title={collection.seo_title || `${title} | Dishloopr`}
        description={collection.seo_description || description || `Ontdek de beste restaurants in onze ${title} collectie.`}
        ogType="article"
        ogImage={collection.cover_image || undefined}
        canonical={`https://dishloopr.com/collection/${collection.slug}`}
        keywords={[
          title,
          collection.city?.name || '',
          collection.dish?.name || '',
          collection.cuisine || '',
          'restaurants',
          'eten',
          'Nederland'
        ].filter(Boolean)}
        structuredData={{
          '@context': 'https://schema.org',
          '@graph': [breadcrumbSchema, itemListSchema]
        }}
      />

      {/* Hero */}
      <div className="relative h-64 md:h-80 overflow-hidden">
        <img
          src={collection.cover_image || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1200&q=80'}
          alt={title}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
        
        {/* Back Button */}
        <Link
          to="/collections"
          className="absolute top-4 left-4 p-2 rounded-full bg-background/80 backdrop-blur hover:bg-background transition-colors"
        >
          <ChevronLeft className="h-5 w-5" />
        </Link>

        {/* Title */}
        <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8">
          <div className="container">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              {collection.city?.name && (
                <Badge className="mb-3" variant="secondary">
                  <MapPin className="h-3 w-3 mr-1" />
                  {collection.city.name}
                </Badge>
              )}
              <h1 className="text-3xl md:text-5xl font-bold mb-2">{title}</h1>
              {subtitle && (
                <p className="text-lg md:text-xl text-muted-foreground">{subtitle}</p>
              )}
            </motion.div>
          </div>
        </div>
      </div>

      <div className="container py-8">
        {/* Description */}
        {description && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-lg text-muted-foreground max-w-3xl mb-8"
          >
            {description}
          </motion.p>
        )}

        {/* Restaurant List */}
        <div className="space-y-4">
          {restaurants.length > 0 ? (
            restaurants.map((item, index) => (
              <RestaurantCard key={item.id} item={item} index={index} />
            ))
          ) : (
            <div className="text-center py-12">
              <p className="text-muted-foreground">
                Nog geen restaurants aan deze collectie toegevoegd.
              </p>
            </div>
          )}
        </div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mt-12 text-center"
        >
          <p className="text-muted-foreground mb-4">
            Ontdek meer collecties of zoek zelf naar restaurants
          </p>
          <div className="flex gap-4 justify-center">
            <Button variant="outline" asChild>
              <Link to="/collections">Alle collecties</Link>
            </Button>
            <Button asChild>
              <Link to="/search">Zoek restaurants</Link>
            </Button>
          </div>
        </motion.div>
      </div>
    </Layout>
  );
}
