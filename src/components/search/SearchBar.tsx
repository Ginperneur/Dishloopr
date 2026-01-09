import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, MapPin, ChevronDown, UtensilsCrossed } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { VoiceSearch } from '@/components/search/VoiceSearch';
import { supabase } from '@/integrations/supabase/client';
import { useSearchHistory } from '@/hooks/useSearchHistory';
import type { Database } from '@/integrations/supabase/types';

type Dish = Database['public']['Tables']['dishes']['Row'];
type City = Database['public']['Tables']['cities']['Row'];

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
  const [cuisineSuggestions, setCuisineSuggestions] = useState<string[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [allDishes, setAllDishes] = useState<Dish[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showCityDropdown, setShowCityDropdown] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const lastDropdownOpenedAtRef = useRef(0);

  // Fetch cities and dishes on mount
  useEffect(() => {
    const fetchData = async () => {
      const [citiesRes, dishesRes] = await Promise.all([
        supabase.from('cities').select('*').eq('is_active', true).order('name'),
        supabase.from('dishes').select('*').eq('is_active', true).order('search_count', { ascending: false })
      ]);
      setCities(citiesRes.data || []);
      setAllDishes(dishesRes.data || []);
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

      // Filter cuisines
      const filteredCuisines = allCuisines.filter(c =>
        c.toLowerCase().includes(queryLower)
      );
      setCuisineSuggestions(filteredCuisines.slice(0, 3));

      setShowSuggestions(filteredDishes.length > 0 || filteredCuisines.length > 0);
    } else {
      setSuggestions([]);
      setCuisineSuggestions([]);
      setShowSuggestions(false);
    }
  }, [query, allDishes]);

  // Track when dropdowns open (prevents immediate close on mobile "address bar" scroll)
  useEffect(() => {
    if (showSuggestions || showCityDropdown) {
      lastDropdownOpenedAtRef.current = Date.now();
    }
  }, [showSuggestions, showCityDropdown]);

  // Close dropdowns on outside click, scroll, or escape
  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;

      // Close suggestions on outside tap
      if (
        showSuggestions &&
        suggestionsRef.current &&
        !suggestionsRef.current.contains(target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(target as Node)
      ) {
        setShowSuggestions(false);
      }

      // Close city dropdown on outside tap
      if (showCityDropdown && !target.closest('[data-city-dropdown]')) {
        setShowCityDropdown(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowSuggestions(false);
        setShowCityDropdown(false);
      }
    };

    // Close dropdowns when user scrolls the main page
    const handleScroll = () => {
      const msSinceOpen = Date.now() - lastDropdownOpenedAtRef.current;
      if (msSinceOpen < 250) return;

      if (showSuggestions) setShowSuggestions(false);
      if (showCityDropdown) setShowCityDropdown(false);
    };

    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('scroll', handleScroll);
    };
  }, [showSuggestions, showCityDropdown]);

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
  };

  const handleSuggestionClick = (value: string) => {
    setQuery(value);
    addSearch(value);
    setShowSuggestions(false);
    if (onSearch) {
      onSearch(value, cityId);
    } else {
      const params = new URLSearchParams();
      params.set('dish', value);
      if (cityId && cityId !== 'all') params.set('city', cityId);
      navigate(`/search?${params.toString()}`);
    }
  };

  const selectedCity = cities.find(c => c.id === cityId);
  const cityLabel = cityId === 'all' ? t('cities.all') : selectedCity?.name || t('cities.all');

  const isHero = variant === 'hero';

  return (
    <div className={`relative w-full ${isHero ? 'max-w-3xl mx-auto' : ''}`}>
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
            placeholder={t('hero.searchPlaceholder')}
            className={`w-full bg-transparent border-0 outline-none placeholder:text-muted-foreground ${
              isHero 
                ? 'pl-12 pr-4 py-3 text-base md:text-lg' 
                : 'pl-10 pr-3 py-2.5 text-sm'
            }`}
          />

          {/* Autocomplete Suggestions */}
          <AnimatePresence>
            {showSuggestions && (suggestions.length > 0 || cuisineSuggestions.length > 0) && (
              <motion.div
                ref={suggestionsRef}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                transition={{ duration: 0.15 }}
                className="absolute top-full left-0 right-0 mt-2 bg-card rounded-xl shadow-lg border border-border z-50 overflow-hidden"
              >
                <ScrollArea className="max-h-[60vh]">
                  <div
                    style={{ WebkitOverflowScrolling: 'touch' }}
                    className="overscroll-contain touch-pan-y scrollbar-hide"
                  >
                    {/* Dish suggestions */}
                    {suggestions.length > 0 && (
                      <>
                        <div className="px-4 py-2 text-xs font-semibold text-muted-foreground bg-muted/50">
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

                    {/* Cuisine suggestions */}
                    {cuisineSuggestions.length > 0 && (
                      <>
                        <div className="px-4 py-2 text-xs font-semibold text-muted-foreground bg-muted/50">
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
                </ScrollArea>
              </motion.div>
            )}
          </AnimatePresence>
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
            <ChevronDown className={`text-muted-foreground ${isHero ? 'h-4 w-4' : 'h-3 w-3'}`} />
          </button>

          <AnimatePresence>
            {showCityDropdown && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                transition={{ duration: 0.15 }}
                className="absolute top-full right-0 mt-2 bg-card rounded-xl shadow-lg border border-border z-50 overflow-hidden min-w-[180px]"
              >
                <ScrollArea className="max-h-[60vh]">
                  <div
                    style={{ WebkitOverflowScrolling: 'touch' }}
                    className="overscroll-contain touch-pan-y scrollbar-hide"
                  >
                    <button
                      onClick={() => {
                        setCityId('all');
                        setShowCityDropdown(false);
                      }}
                      className={`w-full px-4 py-3 text-left hover:bg-muted transition-colors ${
                        cityId === 'all' ? 'bg-accent' : ''
                      }`}
                    >
                      {t('cities.all')}
                    </button>
                    {cities.map((city) => (
                      <button
                        key={city.id}
                        onClick={() => {
                          setCityId(city.id);
                          setShowCityDropdown(false);
                        }}
                        className={`w-full px-4 py-3 text-left hover:bg-muted transition-colors ${
                          cityId === city.id ? 'bg-accent' : ''
                        }`}
                      >
                        {city.name}
                      </button>
                    ))}
                  </div>
                </ScrollArea>
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
        data-city-dropdown
        initial={isHero ? { y: 20, opacity: 0 } : false}
        animate={{ y: 0, opacity: 1 }}
        transition={isHero ? { delay: 0.4, duration: 0.5 } : { duration: 0.2 }}
        className={`md:hidden ${isHero ? 'mt-3' : 'mt-2'} relative`}
      >
        <button
          onClick={() => setShowCityDropdown(!showCityDropdown)}
          className={`w-full flex items-center justify-center gap-2 bg-card hover:bg-muted rounded-xl border border-border transition-colors ${
            isHero ? 'px-4 py-3' : 'px-3 py-2'
          }`}
        >
          <MapPin className={`text-muted-foreground ${isHero ? 'h-5 w-5' : 'h-4 w-4'}`} />
          <span className={`font-medium ${isHero ? '' : 'text-sm'}`}>{cityLabel}</span>
          <ChevronDown className={`text-muted-foreground transition-transform ${showCityDropdown ? 'rotate-180' : ''} ${isHero ? 'h-4 w-4' : 'h-3.5 w-3.5'}`} />
        </button>

        <AnimatePresence>
          {showCityDropdown && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.15 }}
              className="absolute top-full left-0 right-0 mt-2 bg-card rounded-xl shadow-lg border border-border z-50 overflow-hidden"
            >
              <ScrollArea className="max-h-[60vh]">
                <div
                  style={{ WebkitOverflowScrolling: 'touch' }}
                  className="overscroll-contain touch-pan-y scrollbar-hide"
                >
                  <button
                    onClick={() => {
                      setCityId('all');
                      setShowCityDropdown(false);
                    }}
                    className={`w-full px-4 py-3 text-left hover:bg-muted transition-colors ${
                      cityId === 'all' ? 'bg-accent' : ''
                    }`}
                  >
                    {t('cities.all')}
                  </button>
                  {cities.map((city) => (
                    <button
                      key={city.id}
                      onClick={() => {
                        setCityId(city.id);
                        setShowCityDropdown(false);
                      }}
                      className={`w-full px-4 py-3 text-left hover:bg-muted transition-colors ${
                        cityId === city.id ? 'bg-accent' : ''
                      }`}
                    >
                      {city.name}
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
