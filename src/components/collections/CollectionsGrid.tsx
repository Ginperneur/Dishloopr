import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, MapPin, Utensils } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useCollections, Collection } from '@/hooks/useCollections';
import { localizedField } from '@/lib/i18n/localizedField';
import { useTranslation } from 'react-i18next';
import { optimizedImage, imgLoadingProps } from '@/lib/imageUrl';

interface CollectionCardProps {
  collection: Collection;
  index: number;
}

function CollectionCard({ collection, index }: CollectionCardProps) {
  const { i18n } = useTranslation();
  const title = localizedField(collection.title_i18n, collection.title, i18n.language);
  const subtitle = localizedField(collection.subtitle_i18n, collection.subtitle, i18n.language);
  const description = localizedField(collection.description_i18n, collection.description, i18n.language);
  const placeholderImages = [
    'https://images.unsplash.com/photo-1555126634-323283e090fa?w=600&q=80',
    'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=600&q=80',
    'https://images.unsplash.com/photo-1559339352-11d035aa65de?w=600&q=80',
    'https://images.unsplash.com/photo-1544025162-d76694265947?w=600&q=80',
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
    >
      <Link to={`/collection/${collection.slug}`}>
        <Card className="group overflow-hidden hover:shadow-lg transition-all duration-300">
          <div className="relative h-48 overflow-hidden">
            <img
              src={optimizedImage(collection.cover_image || placeholderImages[index % placeholderImages.length], { width: 600 })}
              alt={title}
              width={600}
              height={384}
              {...imgLoadingProps(false)}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
            
            {/* Tags */}
            <div className="absolute top-3 left-3 flex flex-wrap gap-2">
              {collection.city?.name && (
                <Badge variant="secondary" className="bg-white/90 text-foreground">
                  <MapPin className="h-3 w-3 mr-1" />
                  {collection.city.name}
                </Badge>
              )}
              {collection.dish?.name && (
                <Badge variant="secondary" className="bg-white/90 text-foreground">
                  <Utensils className="h-3 w-3 mr-1" />
                  {collection.dish.name}
                </Badge>
              )}
              {collection.cuisine && (
                <Badge variant="secondary" className="bg-white/90 text-foreground capitalize">
                  {collection.cuisine}
                </Badge>
              )}
            </div>

            {/* Title Overlay */}
            <div className="absolute bottom-0 left-0 right-0 p-4">
              <h3 className="text-xl font-bold text-white mb-1">{title}</h3>
              {subtitle && (
                <p className="text-white/80 text-sm">{subtitle}</p>
              )}
            </div>
          </div>
          
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground line-clamp-2">
                {description?.slice(0, 100) || ''}
              </p>
              <ArrowRight className="h-5 w-5 text-primary flex-shrink-0 ml-3 transition-transform group-hover:translate-x-1" />
            </div>
          </CardContent>
        </Card>
      </Link>
    </motion.div>
  );
}

export function CollectionsGrid() {
  const { collections, loading } = useCollections();

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3, 4, 5, 6].map(i => (
          <Card key={i} className="overflow-hidden">
            <Skeleton className="h-48" />
            <CardContent className="p-4">
              <Skeleton className="h-4 w-3/4 mb-2" />
              <Skeleton className="h-4 w-1/2" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (collections.length === 0) {
    return (
      <div className="text-center py-12">
        <Utensils className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <p className="text-muted-foreground">Nog geen collecties beschikbaar</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {collections.map((collection, index) => (
        <CollectionCard key={collection.id} collection={collection} index={index} />
      ))}
    </div>
  );
}

export function FeaturedCollections() {
  const { collections, loading } = useCollections();
  const { i18n } = useTranslation();
  const featured = collections.filter(c => c.is_featured).slice(0, 4);

  if (loading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {[1, 2, 3, 4].map(i => (
          <Skeleton key={i} className="h-32 md:h-40 rounded-xl" />
        ))}
      </div>
    );
  }

  if (featured.length === 0) {
    return null;
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
      {featured.map((collection, index) => (
        // eslint-disable-next-line @typescript-eslint/no-shadow
        // resolve localized strings per card
        <motion.div
          key={collection.id}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: index * 0.1 }}
        >
          <Link to={`/collection/${collection.slug}`}>
            <div className="group relative h-32 md:h-40 rounded-xl overflow-hidden">
              <img
                src={optimizedImage(collection.cover_image || `https://images.unsplash.com/photo-155512663${index}?w=400&q=80`, { width: 400 })}
                alt={localizedField(collection.title_i18n, collection.title, i18n.language)}
                width={400}
                height={256}
                {...imgLoadingProps(false)}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-3 md:p-4">
                <h3 className="font-bold text-white text-sm md:text-lg line-clamp-2">
                  {localizedField(collection.title_i18n, collection.title, i18n.language)}
                </h3>
                {(() => {
                  const sub = localizedField(collection.subtitle_i18n, collection.subtitle, i18n.language);
                  return sub ? (
                    <p className="text-white/70 text-xs md:text-sm line-clamp-1 hidden sm:block">{sub}</p>
                  ) : null;
                })()}
              </div>
            </div>
          </Link>
        </motion.div>
      ))}
    </div>
  );
}
