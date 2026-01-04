import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, MapPin, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { dishes, cities } from '@/data/mockData';

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
  const [query, setQuery] = useState(initialQuery);
  const [cityId, setCityId] = useState(initialCity);
  const [suggestions, setSuggestions] = useState<typeof dishes>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showCityDropdown, setShowCityDropdown] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (query.length >= 2) {
      const filtered = dishes.filter(
        d =>
          d.name.toLowerCase().includes(query.toLowerCase()) ||
          d.synonyms.some(s => s.toLowerCase().includes(query.toLowerCase()))
      );
      setSuggestions(filtered.slice(0, 6));
      setShowSuggestions(true);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }, [query]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearch = () => {
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

  const handleSuggestionClick = (dish: typeof dishes[0]) => {
    setQuery(dish.name);
    setShowSuggestions(false);
    if (onSearch) {
      onSearch(dish.name, cityId);
    } else {
      const params = new URLSearchParams();
      params.set('dish', dish.name);
      if (cityId && cityId !== 'all') params.set('city', cityId);
      navigate(`/search?${params.toString()}`);
    }
  };

  const selectedCity = cities.find(c => c.id === cityId);
  const cityLabel = cityId === 'all' ? t('cities.all') : selectedCity?.name || t('cities.all');

  const isHero = variant === 'hero';

  return (
    <div className={`relative w-full ${isHero ? 'max-w-3xl mx-auto' : ''}`}>
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
            {showSuggestions && suggestions.length > 0 && (
              <motion.div
                ref={suggestionsRef}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="absolute top-full left-0 right-0 mt-2 bg-card rounded-xl shadow-lg border border-border z-50 overflow-hidden"
              >
                {suggestions.map((dish, index) => (
                  <button
                    key={dish.id}
                    onClick={() => handleSuggestionClick(dish)}
                    className="w-full px-4 py-3 text-left hover:bg-muted transition-colors flex items-center gap-3"
                  >
                    <Search className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <span className="font-medium">{dish.name}</span>
                      {dish.synonyms.length > 0 && (
                        <span className="text-sm text-muted-foreground ml-2">
                          ({dish.synonyms.slice(0, 2).join(', ')})
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Divider */}
        <div className={`h-8 w-px bg-border ${!isHero && 'hidden md:block'}`} />

        {/* City Selector */}
        <div className={`relative ${!isHero && 'hidden md:block'}`}>
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
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="absolute top-full right-0 mt-2 bg-card rounded-xl shadow-lg border border-border z-50 overflow-hidden min-w-[180px]"
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
              </motion.div>
            )}
          </AnimatePresence>
        </div>

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
    </div>
  );
}
