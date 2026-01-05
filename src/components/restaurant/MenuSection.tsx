import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Leaf, Wheat, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useMenuItems } from '@/hooks/useMenuItems';
import { Skeleton } from '@/components/ui/skeleton';

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
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium">{item.name}</span>
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
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
