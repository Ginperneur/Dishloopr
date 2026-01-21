import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Leaf, Wheat, AlertCircle, X, ZoomIn, ZoomOut, Star, Filter } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useMenuItems } from '@/hooks/useMenuItems';
import { Skeleton } from '@/components/ui/skeleton';
import { Toggle } from '@/components/ui/toggle';
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

type FilterType = 'signature' | 'vegetarian' | 'glutenFree';

export function MenuSection({ restaurantId }: MenuSectionProps) {
  const { t } = useTranslation();
  const { menuItems, categories, loading, error } = useMenuItems(restaurantId);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [showAllergens, setShowAllergens] = useState<string | null>(null);
  const [lightboxImage, setLightboxImage] = useState<{ url: string; name: string } | null>(null);
  const [isZoomed, setIsZoomed] = useState(false);
  const [activeFilters, setActiveFilters] = useState<Set<FilterType>>(new Set());

  const toggleFilter = (filter: FilterType) => {
    setActiveFilters(prev => {
      const newFilters = new Set(prev);
      if (newFilters.has(filter)) {
        newFilters.delete(filter);
      } else {
        newFilters.add(filter);
      }
      return newFilters;
    });
  };

  const filteredMenuItems = useMemo(() => {
    if (activeFilters.size === 0) return menuItems;
    
    return menuItems.filter(item => {
      if (activeFilters.has('signature') && !item.is_signature) return false;
      if (activeFilters.has('vegetarian') && !item.is_vegetarian && !item.is_vegan) return false;
      if (activeFilters.has('glutenFree') && !item.is_gluten_free) return false;
      return true;
    });
  }, [menuItems, activeFilters]);

  const filteredCategories = useMemo(() => {
    return categories.filter(category => 
      filteredMenuItems.some(item => item.category === category)
    );
  }, [categories, filteredMenuItems]);

  // Count items per filter for badges
  const filterCounts = useMemo(() => ({
    signature: menuItems.filter(item => item.is_signature).length,
    vegetarian: menuItems.filter(item => item.is_vegetarian || item.is_vegan).length,
    glutenFree: menuItems.filter(item => item.is_gluten_free).length,
  }), [menuItems]);

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

  if (error) {
    return null;
  }

  if (menuItems.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
      >
        <h2 className="text-lg md:text-xl font-bold mb-4">{t('restaurant.menu', 'Menukaart')}</h2>
        <div className="rounded-xl border border-border bg-card p-6 text-center">
          <p className="text-muted-foreground">{t('menu.noItems', 'Er is nog geen menukaart beschikbaar voor dit restaurant.')}</p>
        </div>
      </motion.div>
    );
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <h2 className="text-lg md:text-xl font-bold">{t('restaurant.menu', 'Menukaart')}</h2>
        
        {/* Filter toggles */}
        <div className="flex flex-wrap gap-2">
          <Toggle
            pressed={activeFilters.has('signature')}
            onPressedChange={() => toggleFilter('signature')}
            size="sm"
            className="gap-1.5 data-[state=on]:bg-primary/10 data-[state=on]:text-primary"
            disabled={filterCounts.signature === 0}
          >
            <Star className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{t('menu.filter.signature', 'Bekend om')}</span>
            <span className="sm:hidden">⭐</span>
            {filterCounts.signature > 0 && (
              <span className="text-xs text-muted-foreground">({filterCounts.signature})</span>
            )}
          </Toggle>
          
          <Toggle
            pressed={activeFilters.has('vegetarian')}
            onPressedChange={() => toggleFilter('vegetarian')}
            size="sm"
            className="gap-1.5 data-[state=on]:bg-green-100 data-[state=on]:text-green-700 dark:data-[state=on]:bg-green-900/30 dark:data-[state=on]:text-green-400"
            disabled={filterCounts.vegetarian === 0}
          >
            <Leaf className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{t('menu.filter.vegetarian', 'Vegetarisch')}</span>
            <span className="sm:hidden">V</span>
            {filterCounts.vegetarian > 0 && (
              <span className="text-xs text-muted-foreground">({filterCounts.vegetarian})</span>
            )}
          </Toggle>
          
          <Toggle
            pressed={activeFilters.has('glutenFree')}
            onPressedChange={() => toggleFilter('glutenFree')}
            size="sm"
            className="gap-1.5 data-[state=on]:bg-amber-100 data-[state=on]:text-amber-700 dark:data-[state=on]:bg-amber-900/30 dark:data-[state=on]:text-amber-400"
            disabled={filterCounts.glutenFree === 0}
          >
            <Wheat className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{t('menu.filter.glutenFree', 'Glutenvrij')}</span>
            <span className="sm:hidden">GV</span>
            {filterCounts.glutenFree > 0 && (
              <span className="text-xs text-muted-foreground">({filterCounts.glutenFree})</span>
            )}
          </Toggle>
        </div>
      </div>

      {/* Active filters indicator */}
      {activeFilters.size > 0 && (
        <div className="flex items-center gap-2 mb-4 text-sm text-muted-foreground">
          <Filter className="h-4 w-4" />
          <span>
            {filteredMenuItems.length} {filteredMenuItems.length === 1 ? 'gerecht' : 'gerechten'} gevonden
          </span>
          <button
            onClick={() => setActiveFilters(new Set())}
            className="ml-auto text-xs text-primary hover:underline"
          >
            Filters wissen
          </button>
        </div>
      )}
      
      <div className="space-y-2">
        {filteredCategories.map((category) => {
          const categoryItems = filteredMenuItems.filter(item => item.category === category);
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
