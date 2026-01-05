import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Sparkles, 
  ChevronRight, 
  ChevronLeft,
  Star,
  MapPin,
  PieChart,
  Camera,
  Heart,
  Share2,
  Utensils
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useYearlyWrapped } from '@/hooks/useYearlyWrapped';
import { Skeleton } from '@/components/ui/skeleton';

interface WrappedSlide {
  id: string;
  title: string;
  value: string | number;
  subtitle: string;
  icon: React.ElementType;
  color: string;
  bgGradient: string;
}

export function YearlyWrapped() {
  const { t } = useTranslation();
  const { wrapped, loading, generating, generateWrapped, year } = useYearlyWrapped();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  if (loading) {
    return (
      <Card className="p-8">
        <Skeleton className="h-64 w-full" />
      </Card>
    );
  }

  if (!wrapped) {
    return (
      <Card className="p-8 text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-primary to-primary/50 flex items-center justify-center">
            <Sparkles className="h-10 w-10 text-white" />
          </div>
          <h2 className="text-2xl font-bold mb-2">
            {t('wrapped.title', 'Jouw {{year}} in Eten', { year })}
          </h2>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            {t('wrapped.generateDescription', 'Ontdek je culinaire hoogtepunten van dit jaar. Net als Spotify Wrapped, maar dan voor eten!')}
          </p>
          <Button 
            onClick={generateWrapped} 
            disabled={generating}
            size="lg"
            className="gap-2"
          >
            {generating ? (
              <>
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 1 }}
                >
                  <Sparkles className="h-5 w-5" />
                </motion.div>
                {t('wrapped.generating', 'Even geduld...')}
              </>
            ) : (
              <>
                <Sparkles className="h-5 w-5" />
                {t('wrapped.generate', 'Genereer mijn Wrapped')}
              </>
            )}
          </Button>
        </motion.div>
      </Card>
    );
  }

  const slides: WrappedSlide[] = [
    {
      id: 'restaurants',
      title: t('wrapped.slide.restaurants', 'Restaurants bezocht'),
      value: wrapped.total_restaurants,
      subtitle: t('wrapped.slide.restaurantsSubtitle', 'nieuwe smaken ontdekt'),
      icon: Utensils,
      color: 'text-orange-500',
      bgGradient: 'from-orange-500/20 to-red-500/20',
    },
    {
      id: 'reviews',
      title: t('wrapped.slide.reviews', 'Reviews geschreven'),
      value: wrapped.total_reviews,
      subtitle: t('wrapped.slide.reviewsSubtitle', 'anderen geholpen met kiezen'),
      icon: Star,
      color: 'text-amber-500',
      bgGradient: 'from-amber-500/20 to-yellow-500/20',
    },
    {
      id: 'cuisines',
      title: t('wrapped.slide.cuisines', 'Keukens geprobeerd'),
      value: wrapped.total_cuisines,
      subtitle: wrapped.cuisines_list?.slice(0, 3).join(', ') || '',
      icon: PieChart,
      color: 'text-blue-500',
      bgGradient: 'from-blue-500/20 to-cyan-500/20',
    },
    {
      id: 'cities',
      title: t('wrapped.slide.cities', 'Steden bezocht'),
      value: wrapped.cities_list?.length || 0,
      subtitle: wrapped.cities_list?.join(', ') || '',
      icon: MapPin,
      color: 'text-purple-500',
      bgGradient: 'from-purple-500/20 to-pink-500/20',
    },
    {
      id: 'topCuisine',
      title: t('wrapped.slide.topCuisine', 'Favoriete keuken'),
      value: wrapped.top_cuisine || '-',
      subtitle: t('wrapped.slide.topCuisineSubtitle', 'Dit was jouw go-to'),
      icon: Heart,
      color: 'text-red-500',
      bgGradient: 'from-red-500/20 to-pink-500/20',
    },
    {
      id: 'personality',
      title: t('wrapped.slide.personality', 'Jouw foodie type'),
      value: wrapped.foodie_personality || 'Foodie',
      subtitle: year.toString(),
      icon: Sparkles,
      color: 'text-primary',
      bgGradient: 'from-primary/20 to-primary/10',
    },
  ];

  const currentSlideData = slides[currentSlide];

  const nextSlide = () => {
    if (currentSlide < slides.length - 1) {
      setCurrentSlide(currentSlide + 1);
    }
  };

  const prevSlide = () => {
    if (currentSlide > 0) {
      setCurrentSlide(currentSlide - 1);
    }
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: `Mijn ${year} in Eten`,
        text: `Ik heb ${wrapped.total_restaurants} restaurants bezocht en ${wrapped.total_cuisines} keukens geprobeerd! Bekijk je eigen Wrapped op Dishloopr.`,
        url: window.location.href,
      });
    }
  };

  return (
    <Card className="overflow-hidden">
      <div className={`relative min-h-[400px] bg-gradient-to-br ${currentSlideData.bgGradient}`}>
        {/* Progress dots */}
        <div className="absolute top-4 left-0 right-0 flex justify-center gap-1.5 z-10">
          {slides.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentSlide(index)}
              className={`h-1.5 rounded-full transition-all ${
                index === currentSlide 
                  ? 'w-8 bg-foreground' 
                  : 'w-1.5 bg-foreground/30'
              }`}
            />
          ))}
        </div>

        {/* Slide Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentSlide}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.3 }}
            className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring' }}
              className={`w-16 h-16 rounded-full bg-background flex items-center justify-center mb-6 ${currentSlideData.color}`}
            >
              <currentSlideData.icon className="h-8 w-8" />
            </motion.div>

            <p className="text-sm text-muted-foreground uppercase tracking-wider mb-2">
              {currentSlideData.title}
            </p>

            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-5xl md:text-7xl font-bold mb-4"
            >
              {currentSlideData.value}
            </motion.h2>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="text-muted-foreground max-w-xs"
            >
              {currentSlideData.subtitle}
            </motion.p>
          </motion.div>
        </AnimatePresence>

        {/* Navigation Buttons */}
        <div className="absolute bottom-4 left-0 right-0 flex justify-between items-center px-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={prevSlide}
            disabled={currentSlide === 0}
            className="rounded-full"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>

          {currentSlide === slides.length - 1 ? (
            <Button onClick={handleShare} className="gap-2">
              <Share2 className="h-4 w-4" />
              {t('wrapped.share', 'Delen')}
            </Button>
          ) : (
            <span className="text-sm text-muted-foreground">
              {currentSlide + 1} / {slides.length}
            </span>
          )}

          <Button
            variant="ghost"
            size="icon"
            onClick={nextSlide}
            disabled={currentSlide === slides.length - 1}
            className="rounded-full"
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
