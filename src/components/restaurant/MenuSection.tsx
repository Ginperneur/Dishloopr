import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Leaf, Wheat, AlertCircle, Star, Filter } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useMenuItems, type CourseType } from '@/hooks/useMenuItems';
import { Skeleton } from '@/components/ui/skeleton';
import { Toggle } from '@/components/ui/toggle';
import { formatDishName } from '@/lib/utils';
import { tTaxonomy } from '@/lib/i18n/taxonomy';

const COURSE_EMOJI_KEY: Record<CourseType, string> = {
  menu: 'taxonomy.course.menuEmoji',
  voorgerecht: 'taxonomy.course.starterEmoji',
  hoofdgerecht: 'taxonomy.course.mainEmoji',
  bijgerecht: 'taxonomy.course.sideEmoji',
  dessert: 'taxonomy.course.dessertEmoji',
  drank: 'taxonomy.course.drinkEmoji',
};

interface MenuSectionProps {
  restaurantId: string;
}

type FilterType = 'signature' | 'vegetarian' | 'glutenFree' | 'halal';

export function MenuSection({ restaurantId }: MenuSectionProps) {
  const { t } = useTranslation();
  const { menuItems, courseTypes, loading, error } = useMenuItems(restaurantId);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
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
      if (activeFilters.has('halal') && !item.is_halal) return false;
      return true;
    });
  }, [menuItems, activeFilters]);

  const filteredCourseTypes = useMemo(() => {
    return courseTypes.filter(ct =>
      filteredMenuItems.some(item => item.course_type === ct)
    );
  }, [courseTypes, filteredMenuItems]);

  const filterCounts = useMemo(() => ({
    signature: menuItems.filter(item => item.is_signature).length,
    vegetarian: menuItems.filter(item => item.is_vegetarian || item.is_vegan).length,
    glutenFree: menuItems.filter(item => item.is_gluten_free).length,
    halal: menuItems.filter(item => item.is_halal).length,
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

  if (error || menuItems.length === 0) {
    return null;
  }

  const toggleCategory = (category: string) => {
    setExpandedCategory(prev => prev === category ? null : category);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <h2 className="text-lg md:text-xl font-bold">{t('restaurant.dishes', 'Gerechten')}</h2>
        
        {/* Filter toggles */}
        <div className="flex flex-wrap gap-2">
          <Toggle
            pressed={activeFilters.has('signature')}
            onPressedChange={() => toggleFilter('signature')}
            size="sm"
            className="gap-1.5 text-xs data-[state=on]:bg-primary/10 data-[state=on]:text-primary"
            disabled={filterCounts.signature === 0}
          >
            <Star className="h-3.5 w-3.5" />
            {t('menu.filter.signature', 'Bekend om')}
            {filterCounts.signature > 0 && (
              <span className="text-muted-foreground">({filterCounts.signature})</span>
            )}
          </Toggle>
          
          <Toggle
            pressed={activeFilters.has('vegetarian')}
            onPressedChange={() => toggleFilter('vegetarian')}
            size="sm"
            className="gap-1.5 text-xs data-[state=on]:bg-green-100 data-[state=on]:text-green-700 dark:data-[state=on]:bg-green-900/30 dark:data-[state=on]:text-green-400"
            disabled={filterCounts.vegetarian === 0}
          >
            <Leaf className="h-3.5 w-3.5" />
            {t('menu.filter.vegetarian', 'Vegetarisch')}
            {filterCounts.vegetarian > 0 && (
              <span className="text-muted-foreground">({filterCounts.vegetarian})</span>
            )}
          </Toggle>
          
          <Toggle
            pressed={activeFilters.has('glutenFree')}
            onPressedChange={() => toggleFilter('glutenFree')}
            size="sm"
            className="gap-1.5 text-xs data-[state=on]:bg-amber-100 data-[state=on]:text-amber-700 dark:data-[state=on]:bg-amber-900/30 dark:data-[state=on]:text-amber-400"
            disabled={filterCounts.glutenFree === 0}
          >
            <Wheat className="h-3.5 w-3.5" />
            {t('menu.filter.glutenFree', 'Glutenvrij')}
            {filterCounts.glutenFree > 0 && (
              <span className="text-muted-foreground">({filterCounts.glutenFree})</span>
            )}
          </Toggle>

          <Toggle
            pressed={activeFilters.has('halal')}
            onPressedChange={() => toggleFilter('halal')}
            size="sm"
            className="gap-1.5 text-xs data-[state=on]:bg-emerald-100 data-[state=on]:text-emerald-700 dark:data-[state=on]:bg-emerald-900/30 dark:data-[state=on]:text-emerald-400"
            disabled={filterCounts.halal === 0}
          >
            {t('menu.filter.halal', 'Halal')}
            {filterCounts.halal > 0 && (
              <span className="text-muted-foreground">({filterCounts.halal})</span>
            )}
          </Toggle>
        </div>
      </div>

      {/* Active filters indicator */}
      {activeFilters.size > 0 && (
        <div className="flex items-center gap-2 mb-4 text-sm text-muted-foreground">
          <Filter className="h-4 w-4" />
          <span>
            {t('menu.found', { count: filteredMenuItems.length, defaultValue: '{{count}} gerechten gevonden' })}
          </span>
          <button
            onClick={() => setActiveFilters(new Set())}
            className="ml-auto text-xs text-primary hover:underline"
          >
            {t('menu.clearFilters', 'Filters wissen')}
          </button>
        </div>
      )}
      
      <div className="space-y-2">
        {filteredCourseTypes.map((courseType) => {
          const courseItems = filteredMenuItems.filter(item => item.course_type === courseType);
          const isExpanded = expandedCategory === courseType;

          return (
            <div
              key={courseType}
              className="rounded-xl border border-border bg-card overflow-hidden"
            >
              <button
                onClick={() => toggleCategory(courseType)}
                className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
              >
                <span className="font-semibold text-sm md:text-base">
                  {t(COURSE_EMOJI_KEY[courseType as CourseType], '')} {tTaxonomy(t, 'course', courseType)}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {courseItems.length} {t(courseItems.length === 1 ? 'menu.dish' : 'menu.dishes', courseItems.length === 1 ? 'gerecht' : 'gerechten')}
                  </span>
                  <ChevronDown 
                    className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} 
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
                    <div className="p-4 space-y-3">
                      {courseItems.map((item) => (
                        <div key={item.id} className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-medium">{formatDishName(item.name)}</span>
                              {item.is_signature && (
                                <Badge variant="secondary" className="bg-primary/10 text-primary dark:bg-primary/20 gap-1 text-[10px] px-1.5 py-0">
                                  <Star className="h-2.5 w-2.5 fill-current" />
                                  {t('menu.signature', 'Bekend om')}
                                </Badge>
                              )}
                            </div>
                            {/* Dietary badges */}
                            <div className="flex flex-wrap gap-1 mt-1">
                              {item.is_vegetarian && (
                                <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 gap-0.5 text-[10px] px-1.5 py-0">
                                  <Leaf className="h-2.5 w-2.5" />
                                  {tTaxonomy(t, 'dietary', 'vegetarian')}
                                </Badge>
                              )}
                              {item.is_vegan && (
                                <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 gap-0.5 text-[10px] px-1.5 py-0">
                                  <Leaf className="h-2.5 w-2.5" />
                                  {tTaxonomy(t, 'dietary', 'vegan')}
                                </Badge>
                              )}
                              {item.is_gluten_free && (
                                <Badge variant="secondary" className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 gap-0.5 text-[10px] px-1.5 py-0">
                                  <Wheat className="h-2.5 w-2.5" />
                                  {tTaxonomy(t, 'dietary', 'glutenFree')}
                                </Badge>
                              )}
                              {item.is_halal && (
                                <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 gap-0.5 text-[10px] px-1.5 py-0">
                                  {tTaxonomy(t, 'dietary', 'halal')}
                                </Badge>
                              )}
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
    </motion.div>
  );
}
