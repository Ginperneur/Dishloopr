import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Leaf, Wheat, AlertCircle, X, ZoomIn, ZoomOut, Star } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useMenuItems } from '@/hooks/useMenuItems';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';

interface MenuSectionProps {
  restaurantId: string;
}

const allergenLabels: Record<string, string> = {
  gluten: 'Gluten',
  dairy: 'Zuivel',
  eggs: 'Eieren',
  nuts: 'Noten',
  peanuts: 'Pinda\'s',
  soy: 'Soja',
  fish: 'Vis',
  shellfish: 'Schaaldieren',
  sesame: 'Sesam',
  celery: 'Selderij',
  mustard: 'Mosterd',
  sulphites: 'Sulfieten',
};

export function MenuSection({ restaurantId }: MenuSectionProps) {
  const { t } = useTranslation();
  const { menuItems, categories, loading, error } = useMenuItems(restaurantId);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [showAllergens, setShowAllergens] = useState<string | null>(null);
  const [lightboxImage, setLightboxImage] = useState<{ url: string; name: string } | null>(null);
  const [isZoomed, setIsZoomed] = useState(false);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (error || menuItems.length === 0) {
    return null;
  }

  const toggleCategory = (category: string) => {
    setExpandedCategory(prev => prev === category ? null : category);
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('nl-NL', {
      style: 'currency',
      currency: 'EUR',
    }).format(price);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
    >
      <h2 className="text-lg md:text-xl font-bold mb-4">{t('restaurant.menu', 'Menukaart')}</h2>
      
      <div className="space-y-2">
        {categories.map((category) => {
          const categoryItems = menuItems.filter(item => item.category === category);
          const isExpanded = expandedCategory === category;

          return (
            <div
              key={category}
              className="rounded-xl border border-border bg-card overflow-hidden"
            >
              <button
                onClick={() => toggleCategory(category)}
                className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
              >
                <span className="font-semibold capitalize">{category}</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    {categoryItems.length} items
                  </span>
                  <ChevronDown 
                    className={`h-5 w-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} 
                  />
                </div>
              </button>

              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Separator />
                    <div className="p-4 space-y-4">
                      {categoryItems.map((item) => (
                        <div key={item.id} className="space-y-2">
                          <div className="flex items-start gap-3">
                            {/* Dish Image with Lightbox */}
                            {item.image_url && (
                              <button
                                onClick={() => setLightboxImage({ url: item.image_url!, name: item.name })}
                                className="relative shrink-0 group cursor-zoom-in"
                              >
                                <img
                                  src={item.image_url}
                                  alt={item.name}
                                  loading="lazy"
                                  className="w-16 h-16 md:w-20 md:h-20 object-cover rounded-lg transition-transform group-hover:scale-105"
                                />
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 rounded-lg transition-colors flex items-center justify-center">
                                  <ZoomIn className="h-5 w-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                </div>
                              </button>
                            )}
                            
                            <div className="flex-1 min-w-0 flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-medium">{item.name}</span>
                                  {item.is_signature && (
                                    <Badge variant="secondary" className="bg-primary/10 text-primary dark:bg-primary/20 gap-1">
                                      <Star className="h-3 w-3 fill-current" />
                                      {t('menu.signature', 'Bekend om')}
                                    </Badge>
                                  )}
                                  {item.is_vegetarian && (
                                    <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 gap-1">
                                      <Leaf className="h-3 w-3" />
                                      V
                                    </Badge>
                                  )}
                                  {item.is_vegan && (
                                    <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 gap-1">
                                      <Leaf className="h-3 w-3" />
                                      VG
                                    </Badge>
                                  )}
                                  {item.is_gluten_free && (
                                    <Badge variant="secondary" className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 gap-1">
                                      <Wheat className="h-3 w-3" />
                                      GV
                                    </Badge>
                                  )}
                                </div>
                                {item.description && (
                                  <p className="text-sm text-muted-foreground mt-1">
                                    {item.description}
                                  </p>
                                )}
                                {item.allergens.length > 0 && (
                                  <button
                                    onClick={() => setShowAllergens(
                                      showAllergens === item.id ? null : item.id
                                    )}
                                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mt-1"
                                  >
                                    <AlertCircle className="h-3 w-3" />
                                    {t('menu.allergens', 'Allergenen')}
                                  </button>
                                )}
                                <AnimatePresence>
                                  {showAllergens === item.id && (
                                    <motion.div
                                      initial={{ height: 0, opacity: 0 }}
                                      animate={{ height: 'auto', opacity: 1 }}
                                      exit={{ height: 0, opacity: 0 }}
                                      className="flex flex-wrap gap-1 mt-2"
                                    >
                                      {item.allergens.map((allergen) => (
                                        <Badge
                                          key={allergen}
                                          variant="outline"
                                          className="text-xs bg-destructive/10 text-destructive border-destructive/20"
                                        >
                                          {allergenLabels[allergen] || allergen}
                                        </Badge>
                                      ))}
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </div>
                              <span className="font-semibold text-primary shrink-0">
                                {formatPrice(item.price)}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      {/* Image Lightbox */}
      <Dialog open={!!lightboxImage} onOpenChange={() => { setLightboxImage(null); setIsZoomed(false); }}>
        <DialogContent className="max-w-4xl w-[95vw] p-0 bg-black/95 border-0">
          <div className="relative flex items-center justify-center min-h-[50vh] max-h-[90vh]">
            {/* Close button */}
            <button
              onClick={() => { setLightboxImage(null); setIsZoomed(false); }}
              className="absolute top-4 right-4 z-10 p-2 rounded-full bg-black/50 hover:bg-black/70 text-white transition-colors"
            >
              <X className="h-6 w-6" />
            </button>

            {/* Zoom controls */}
            <div className="absolute bottom-4 right-4 z-10 flex gap-2">
              <button
                onClick={() => setIsZoomed(!isZoomed)}
                className="p-2 rounded-full bg-black/50 hover:bg-black/70 text-white transition-colors"
                title={isZoomed ? 'Zoom uit' : 'Zoom in'}
              >
                {isZoomed ? <ZoomOut className="h-5 w-5" /> : <ZoomIn className="h-5 w-5" />}
              </button>
            </div>

            {/* Image */}
            {lightboxImage && (
              <motion.div
                className={`overflow-auto ${isZoomed ? 'cursor-move' : 'cursor-zoom-in'}`}
                onClick={() => !isZoomed && setIsZoomed(true)}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
              >
                <img
                  src={lightboxImage.url}
                  alt={lightboxImage.name}
                  className={`transition-transform duration-300 ${
                    isZoomed ? 'max-w-none w-[150%]' : 'max-w-full max-h-[80vh] object-contain'
                  }`}
                />
              </motion.div>
            )}

            {/* Image title */}
            <div className="absolute bottom-4 left-4 z-10">
              <p className="text-white font-medium bg-black/50 px-3 py-1.5 rounded-lg">
                {lightboxImage?.name}
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
