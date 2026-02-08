import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, MapPin, ChevronDown, UtensilsCrossed, Store, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { VoiceSearch } from '@/components/search/VoiceSearch';
import { supabase } from '@/integrations/supabase/client';
import { useSearchHistory } from '@/hooks/useSearchHistory';
import type { Database } from '@/integrations/supabase/types';

type Dish = Database['public']['Tables']['dishes']['Row'];
type City = Database['public']['Tables']['cities']['Row'];
type Restaurant = Database['public']['Tables']['restaurants']['Row'];

interface SearchBarProps {
  onSearch?: (query: string, cityId: string) => void;
  variant?: 'hero' | 'compact';
  initialQuery?: string;
  initialCity?: string;
}

export function SearchBar({ 
  onSearch, 
  variant = 'hero',
  initialQuery = '',
  initialCity = 'all'
}: SearchBarProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { addSearch } = useSearchHistory();
  const [query, setQuery] = useState(initialQuery);
  const [cityId, setCityId] = useState(initialCity);
  const [suggestions, setSuggestions] = useState<Dish[]>([]);
  const [restaurantSuggestions, setRestaurantSuggestions] = useState<Restaurant[]>([]);
  const [cuisineSuggestions, setCuisineSuggestions] = useState<string[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [allDishes, setAllDishes] = useState<Dish[]>([]);
  const [allRestaurants, setAllRestaurants] = useState<Restaurant[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showCityDropdown, setShowCityDropdown] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Fetch cities, dishes and restaurants on mount
  useEffect(() => {
    const fetchData = async () => {
      const [citiesRes, dishesRes, restaurantsRes] = await Promise.all([
        supabase.from('cities').select('*').eq('is_active', true).order('name'),
        supabase.from('dishes').select('*').eq('is_active', true).order('search_count', { ascending: false }),
        supabase.from('restaurants').select('*').eq('is_active', true).order('rating', { ascending: false })
      ]);
      setCities(citiesRes.data || []);
      setAllDishes(dishesRes.data || []);
      setAllRestaurants(restaurantsRes.data || []);
    };
    fetchData();
  }, []);

  // Get unique cuisines from dishes
  const allCuisines = [...new Set(allDishes.flatMap(d => d.cuisine_tags || []))];

  useEffect(() => {
    if (query.length >= 2) {
      const queryLower = query.toLowerCase();

      // Filter dishes by name or synonyms
      const filteredDishes = allDishes.filter(
        d =>
          d.name.toLowerCase().includes(queryLower) ||
          d.synonyms?.some(s => s.toLowerCase().includes(queryLower))
      );
      setSuggestions(filteredDishes.slice(0, 5));

      // Filter restaurants by name
      const filteredRestaurants = allRestaurants.filter(
        r => r.name.toLowerCase().includes(queryLower)
      );
      setRestaurantSuggestions(filteredRestaurants.slice(0, 3));

      // Filter cuisines
      const filteredCuisines = allCuisines.filter(c =>
        c.toLowerCase().includes(queryLower)
      );
      setCuisineSuggestions(filteredCuisines.slice(0, 3));

      setShowSuggestions(filteredDishes.length > 0 || filteredCuisines.length > 0 || filteredRestaurants.length > 0);
    } else {
      setSuggestions([]);
      setRestaurantSuggestions([]);
      setCuisineSuggestions([]);
      setShowSuggestions(false);
    }
  }, [query, allDishes, allRestaurants]);

  // Close dropdowns on escape
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowSuggestions(false);
        setShowCityDropdown(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSearch = () => {
    if (query.trim()) {
      addSearch(query.trim());
    }
    if (onSearch) {
      onSearch(query, cityId);
    } else {
      const params = new URLSearchParams();
      if (query) params.set('dish', query);
      if (cityId && cityId !== 'all') params.set('city', cityId);
      navigate(`/search?${params.toString()}`);
    }
    setShowSuggestions(false);
    setShowCityDropdown(false);
  };

  const handleSuggestionClick = (value: string) => {
    setQuery(value);
    addSearch(value);
    setShowSuggestions(false);
    setShowCityDropdown(false);
    if (onSearch) {
      onSearch(value, cityId);
    } else {
      const params = new URLSearchParams();
      params.set('dish', value);
      if (cityId && cityId !== 'all') params.set('city', cityId);
      navigate(`/search?${params.toString()}`);
    }
  };

  const handleRestaurantClick = (slug: string) => {
    setShowSuggestions(false);
    setShowCityDropdown(false);
    navigate(`/restaurant/${slug}`);
  };

  const handleCitySelect = (id: string) => {
    setCityId(id);
    setShowCityDropdown(false);
  };

  const selectedCity = cities.find(c => c.id === cityId);
  const cityLabel = cityId === 'all' ? t('cities.all') : selectedCity?.name || t('cities.all');

  const isHero = variant === 'hero';
  const hasSuggestions = suggestions.length > 0 || cuisineSuggestions.length > 0 || restaurantSuggestions.length > 0;

  // Calculate position for desktop dropdown with viewport-aware max-height
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0, maxHeight: 400 });
  const searchBarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (showSuggestions && searchBarRef.current) {
      const rect = searchBarRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const spaceBelow = viewportHeight - rect.bottom - 24; // 24px padding from bottom
      const calculatedMaxHeight = Math.min(Math.max(spaceBelow, 200), 500); // Min 200px, max 500px
      
      setDropdownPosition({
        top: rect.bottom + 8,
        left: rect.left,
        width: rect.width,
        maxHeight: calculatedMaxHeight
      });
    }
  }, [showSuggestions]);

  return (
    <div ref={searchBarRef} className={`relative w-full ${isHero ? 'max-w-3xl mx-auto' : ''}`}>
      {/* Main search bar */}
      <motion.div
        initial={isHero ? { y: 20, opacity: 0 } : false}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.5 }}
        className={`flex items-center gap-2 search-card rounded-2xl ${
          isHero ? 'p-2 md:p-3' : 'p-1.5'
        }`}
      >
        {/* Search Input */}
        <div className="flex-1 relative">
          <Search className={`absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground ${isHero ? 'h-5 w-5' : 'h-4 w-4'}`} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            onFocus={() => {
              if (query.length >= 2 && hasSuggestions) {
                setShowSuggestions(true);
              }
            }}
            placeholder={t('hero.searchPlaceholder')}
            className={`w-full bg-transparent border-0 outline-none placeholder:text-muted-foreground ${
              isHero 
                ? 'pl-12 pr-4 py-3 text-base md:text-lg' 
                : 'pl-10 pr-3 py-2.5 text-sm'
            }`}
          />
        </div>

        {/* Divider - only on desktop */}
        <div className={`h-8 w-px bg-border hidden md:block`} />

        {/* City Selector - Desktop only (inside search bar) */}
        <div className="relative hidden md:block" data-city-dropdown>
          <button
            onClick={() => setShowCityDropdown(!showCityDropdown)}
            className={`flex items-center gap-2 hover:bg-muted rounded-xl transition-colors ${
              isHero ? 'px-4 py-3' : 'px-3 py-2'
            }`}
          >
            <MapPin className={`text-muted-foreground ${isHero ? 'h-5 w-5' : 'h-4 w-4'}`} />
            <span className={`font-medium whitespace-nowrap ${isHero ? '' : 'text-sm'}`}>{cityLabel}</span>
            <ChevronDown className={`text-muted-foreground transition-transform ${showCityDropdown ? 'rotate-180' : ''} ${isHero ? 'h-4 w-4' : 'h-3 w-3'}`} />
          </button>

          {/* Desktop City Dropdown */}
          <AnimatePresence>
            {showCityDropdown && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                transition={{ duration: 0.15 }}
                className="absolute top-full right-0 mt-2 min-w-[200px] rounded-xl overflow-hidden"
                style={{ 
                  backgroundColor: 'hsl(var(--background))',
                  boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                  border: '2px solid hsl(var(--border))',
                  zIndex: 9999
                }}
              >
                <div className="max-h-[50vh] overflow-y-auto">
                  <button
                    onClick={() => handleCitySelect('all')}
                    className={`w-full px-4 py-3.5 text-left hover:bg-muted active:bg-muted/80 transition-colors ${
                      cityId === 'all' ? 'bg-primary/10 text-primary font-semibold' : ''
                    }`}
                  >
                    {t('cities.all')}
                  </button>
                  {cities.map((city) => (
                    <button
                      key={city.id}
                      onClick={() => handleCitySelect(city.id)}
                      className={`w-full px-4 py-3.5 text-left hover:bg-muted active:bg-muted/80 transition-colors ${
                        cityId === city.id ? 'bg-primary/10 text-primary font-semibold' : ''
                      }`}
                    >
                      {city.name}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Voice Search */}
        {isHero && (
          <VoiceSearch 
            onResult={setQuery}
            onSearch={(text) => {
              setQuery(text);
              handleSuggestionClick(text);
            }}
          />
        )}

        {/* Search Button */}
        <Button
          onClick={handleSearch}
          size={isHero ? 'lg' : 'default'}
          className={`rounded-xl font-semibold ${
            isHero ? 'px-6 md:px-8' : 'px-4'
          }`}
        >
          <span className={isHero ? 'hidden md:inline' : 'hidden'}>
            {t('hero.searchButton')}
          </span>
          <Search className={`${isHero ? 'md:hidden' : ''} h-4 w-4`} />
        </Button>
      </motion.div>

      {/* City Selector - Mobile (below search bar) */}
      <motion.div
        initial={isHero ? { y: 20, opacity: 0 } : false}
        animate={{ y: 0, opacity: 1 }}
        transition={isHero ? { delay: 0.4, duration: 0.5 } : { duration: 0.2 }}
        className={`md:hidden ${isHero ? 'mt-3' : 'mt-2'}`}
      >
        <button
          onClick={() => setShowCityDropdown(!showCityDropdown)}
          className={`w-full flex items-center justify-center gap-2 rounded-xl border transition-colors ${
            showCityDropdown 
              ? 'bg-primary text-primary-foreground border-primary' 
              : 'bg-card hover:bg-muted border-border'
          } ${isHero ? 'px-4 py-3' : 'px-3 py-2'}`}
        >
          <MapPin className={`${showCityDropdown ? '' : 'text-muted-foreground'} ${isHero ? 'h-5 w-5' : 'h-4 w-4'}`} />
          <span className={`font-medium ${isHero ? '' : 'text-sm'}`}>{cityLabel}</span>
          <ChevronDown className={`${showCityDropdown ? '' : 'text-muted-foreground'} transition-transform ${showCityDropdown ? 'rotate-180' : ''} ${isHero ? 'h-4 w-4' : 'h-3.5 w-3.5'}`} />
        </button>
      </motion.div>

      {/* MOBILE OVERLAYS - Fixed position fullscreen */}
      
      {/* Mobile Suggestions Overlay */}
      <AnimatePresence>
        {showSuggestions && hasSuggestions && (
          <>
            {/* Backdrop - both mobile and desktop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-0 z-[9998] md:bg-transparent bg-black/40"
              onClick={() => setShowSuggestions(false)}
            />
            
            {/* Mobile Suggestions Panel */}
            <motion.div
              ref={suggestionsRef}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.2 }}
              className="fixed left-4 right-4 top-[140px] z-[9999] md:hidden rounded-2xl overflow-hidden"
              style={{ 
                backgroundColor: 'hsl(var(--background))',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)',
                border: '2px solid hsl(var(--border))',
                maxHeight: 'calc(100vh - 200px)'
              }}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 bg-muted/50 border-b border-border">
                <span className="font-semibold text-sm">Suggesties</span>
                <button 
                  onClick={() => setShowSuggestions(false)}
                  className="p-1 hover:bg-muted rounded-lg transition-colors"
                >
                  <X className="h-5 w-5 text-muted-foreground" />
                </button>
              </div>
              
              {/* Content */}
              <div 
                className="overflow-y-auto overscroll-contain"
                style={{ 
                  maxHeight: 'calc(100vh - 280px)',
                  WebkitOverflowScrolling: 'touch'
                }}
              >
                {/* Dish suggestions */}
                {suggestions.length > 0 && (
                  <>
                    <div className="px-4 py-2.5 text-xs font-bold text-muted-foreground bg-muted/30 border-b border-border/50">
                      Gerechten
                    </div>
                    {suggestions.map((dish) => (
                      <button
                        key={dish.id}
                        onClick={() => handleSuggestionClick(dish.name)}
                        className="w-full px-4 py-4 text-left hover:bg-muted active:bg-muted transition-colors flex items-center gap-3 border-b border-border/30"
                      >
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <Search className="h-5 w-5 text-primary" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <span className="font-medium text-base block">{dish.name}</span>
                          {dish.synonyms && dish.synonyms.length > 0 && (
                            <span className="text-sm text-muted-foreground">
                              {dish.synonyms.slice(0, 2).join(', ')}
                            </span>
                          )}
                        </div>
                      </button>
                    ))}
                  </>
                )}

                {/* Restaurant suggestions */}
                {restaurantSuggestions.length > 0 && (
                  <>
                    <div className="px-4 py-2.5 text-xs font-bold text-muted-foreground bg-muted/30 border-b border-border/50">
                      Restaurants
                    </div>
                    {restaurantSuggestions.map((restaurant) => (
                      <button
                        key={restaurant.id}
                        onClick={() => handleRestaurantClick(restaurant.slug)}
                        className="w-full px-4 py-4 text-left hover:bg-muted active:bg-muted transition-colors flex items-center gap-3 border-b border-border/30"
                      >
                        <div className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center flex-shrink-0">
                          <Store className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="font-medium text-base block">{restaurant.name}</span>
                          {restaurant.cuisines && restaurant.cuisines.length > 0 && (
                            <span className="text-sm text-muted-foreground">
                              {restaurant.cuisines.slice(0, 2).join(', ')}
                            </span>
                          )}
                        </div>
                      </button>
                    ))}
                  </>
                )}

                {/* Cuisine suggestions */}
                {cuisineSuggestions.length > 0 && (
                  <>
                    <div className="px-4 py-2.5 text-xs font-bold text-muted-foreground bg-muted/30 border-b border-border/50">
                      Keukens
                    </div>
                    {cuisineSuggestions.map((cuisine) => (
                      <button
                        key={cuisine}
                        onClick={() => handleSuggestionClick(cuisine)}
                        className="w-full px-4 py-4 text-left hover:bg-muted active:bg-muted transition-colors flex items-center gap-3 capitalize border-b border-border/30 last:border-b-0"
                      >
                        <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
                          <UtensilsCrossed className="h-5 w-5 text-green-600 dark:text-green-400" />
                        </div>
                        <span className="font-medium text-base">{cuisine}</span>
                      </button>
                    ))}
                  </>
                )}
              </div>
            </motion.div>

            {/* Desktop Suggestions (fixed position to avoid overflow clipping) */}
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.15 }}
              className="hidden md:block fixed rounded-xl overflow-hidden"
              style={{ 
                top: dropdownPosition.top,
                left: dropdownPosition.left,
                width: dropdownPosition.width,
                maxHeight: dropdownPosition.maxHeight,
                backgroundColor: 'hsl(var(--background))',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                border: '2px solid hsl(var(--border))',
                zIndex: 9999
              }}
              onWheel={(e) => e.stopPropagation()}
            >
              <div 
                className="overflow-y-auto overscroll-contain"
                style={{ maxHeight: dropdownPosition.maxHeight - 4 }}
                onWheel={(e) => e.stopPropagation()}
              >
                {/* Dish suggestions */}
                {suggestions.length > 0 && (
                  <>
                    <div className="px-4 py-2 text-xs font-bold text-muted-foreground bg-muted/50">
                      Gerechten
                    </div>
                    {suggestions.map((dish) => (
                      <button
                        key={dish.id}
                        onClick={() => handleSuggestionClick(dish.name)}
                        className="w-full px-4 py-3 text-left hover:bg-muted transition-colors flex items-center gap-3"
                      >
                        <Search className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <span className="font-medium">{dish.name}</span>
                          {dish.synonyms && dish.synonyms.length > 0 && (
                            <span className="text-sm text-muted-foreground ml-2">
                              ({dish.synonyms.slice(0, 2).join(', ')})
                            </span>
                          )}
                        </div>
                      </button>
                    ))}
                  </>
                )}

                {/* Restaurant suggestions */}
                {restaurantSuggestions.length > 0 && (
                  <>
                    <div className="px-4 py-2 text-xs font-bold text-muted-foreground bg-muted/50">
                      Restaurants
                    </div>
                    {restaurantSuggestions.map((restaurant) => (
                      <button
                        key={restaurant.id}
                        onClick={() => handleRestaurantClick(restaurant.slug)}
                        className="w-full px-4 py-3 text-left hover:bg-muted transition-colors flex items-center gap-3"
                      >
                        <Store className="h-4 w-4 text-muted-foreground" />
                        <div className="flex-1 min-w-0">
                          <span className="font-medium">{restaurant.name}</span>
                          {restaurant.cuisines && restaurant.cuisines.length > 0 && (
                            <span className="text-sm text-muted-foreground ml-2">
                              ({restaurant.cuisines.slice(0, 2).join(', ')})
                            </span>
                          )}
                        </div>
                      </button>
                    ))}
                  </>
                )}

                {/* Cuisine suggestions */}
                {cuisineSuggestions.length > 0 && (
                  <>
                    <div className="px-4 py-2 text-xs font-bold text-muted-foreground bg-muted/50">
                      Keukens
                    </div>
                    {cuisineSuggestions.map((cuisine) => (
                      <button
                        key={cuisine}
                        onClick={() => handleSuggestionClick(cuisine)}
                        className="w-full px-4 py-3 text-left hover:bg-muted transition-colors flex items-center gap-3 capitalize"
                      >
                        <UtensilsCrossed className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{cuisine}</span>
                      </button>
                    ))}
                  </>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Mobile City Dropdown Overlay */}
      <AnimatePresence>
        {showCityDropdown && (
          <>
            {/* Backdrop - Mobile only */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-0 bg-black/40 z-[9998] md:hidden"
              onClick={() => setShowCityDropdown(false)}
            />
            
            {/* Mobile City Panel */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.2 }}
              className="fixed left-4 right-4 bottom-4 z-[9999] md:hidden rounded-2xl overflow-hidden"
              style={{ 
                backgroundColor: 'hsl(var(--background))',
                boxShadow: '0 -25px 50px -12px rgba(0, 0, 0, 0.4)',
                border: '2px solid hsl(var(--border))',
                maxHeight: '60vh'
              }}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 bg-muted/50 border-b border-border">
                <span className="font-semibold">Kies een stad</span>
                <button 
                  onClick={() => setShowCityDropdown(false)}
                  className="p-1 hover:bg-muted rounded-lg transition-colors"
                >
                  <X className="h-5 w-5 text-muted-foreground" />
                </button>
              </div>
              
              {/* Cities List */}
              <div 
                className="overflow-y-auto overscroll-contain"
                style={{ 
                  maxHeight: 'calc(60vh - 60px)',
                  WebkitOverflowScrolling: 'touch'
                }}
              >
                <button
                  onClick={() => handleCitySelect('all')}
                  className={`w-full px-4 py-4 text-left flex items-center gap-3 transition-colors border-b border-border/30 ${
                    cityId === 'all' 
                      ? 'bg-primary/10' 
                      : 'hover:bg-muted active:bg-muted'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                    cityId === 'all' ? 'bg-primary text-primary-foreground' : 'bg-muted'
                  }`}>
                    <MapPin className="h-5 w-5" />
                  </div>
                  <span className={`font-medium text-base ${cityId === 'all' ? 'text-primary' : ''}`}>
                    {t('cities.all')}
                  </span>
                </button>
                {cities.map((city) => (
                  <button
                    key={city.id}
                    onClick={() => handleCitySelect(city.id)}
                    className={`w-full px-4 py-4 text-left flex items-center gap-3 transition-colors border-b border-border/30 last:border-b-0 ${
                      cityId === city.id 
                        ? 'bg-primary/10' 
                        : 'hover:bg-muted active:bg-muted'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                      cityId === city.id ? 'bg-primary text-primary-foreground' : 'bg-muted'
                    }`}>
                      <MapPin className="h-5 w-5" />
                    </div>
                    <span className={`font-medium text-base ${cityId === city.id ? 'text-primary' : ''}`}>
                      {city.name}
                    </span>
                  </button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Desktop backdrop for closing dropdowns */}
      {(showCityDropdown || showSuggestions) && (
        <div 
          className="fixed inset-0 z-[9997] hidden md:block" 
          onClick={() => {
            setShowCityDropdown(false);
            setShowSuggestions(false);
          }}
        />
      )}
    </div>
  );
}
