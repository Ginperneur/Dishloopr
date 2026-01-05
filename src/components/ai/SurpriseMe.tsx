import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, X, ChefHat, Utensils, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAIRecommendations } from '@/hooks/useAIRecommendations';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const moods = [
  { id: 'adventurous', label: 'Avontuurlijk', emoji: '🌍' },
  { id: 'comfort', label: 'Comfort food', emoji: '🛋️' },
  { id: 'healthy', label: 'Gezond', emoji: '🥗' },
  { id: 'spicy', label: 'Pittig', emoji: '🌶️' },
  { id: 'sweet', label: 'Zoet', emoji: '🍰' },
  { id: 'quick', label: 'Snel', emoji: '⚡' },
];

interface SurpriseMeProps {
  variant?: 'button' | 'card';
  className?: string;
}

export function SurpriseMe({ variant = 'button', className = '' }: SurpriseMeProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const { surprise, loading, getSurpriseRecommendation, clearRecommendations } = useAIRecommendations();

  const handleSurprise = async () => {
    await getSurpriseRecommendation(selectedMood || undefined);
  };

  const handleSearch = () => {
    if (surprise?.dish) {
      navigate(`/search?q=${encodeURIComponent(surprise.dish)}`);
      setIsOpen(false);
      clearRecommendations();
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    setSelectedMood(null);
    clearRecommendations();
  };

  if (variant === 'button') {
    return (
      <>
        <Button
          onClick={() => setIsOpen(true)}
          className={`group bg-gradient-to-r from-primary to-orange-500 hover:from-primary/90 hover:to-orange-400 text-primary-foreground shadow-lg hover:shadow-xl transition-all duration-300 ${className}`}
        >
          <Sparkles className="w-4 h-4 mr-2 group-hover:animate-pulse" />
          {t('ai.surpriseMe', 'Verras me!')}
        </Button>

        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
              onClick={handleClose}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-card rounded-2xl p-6 max-w-md w-full shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-r from-primary to-orange-500 flex items-center justify-center">
                      <ChefHat className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg">{t('ai.surpriseTitle', 'AI Dish Discovery')}</h3>
                      <p className="text-sm text-muted-foreground">{t('ai.surpriseSubtitle', 'Laat je verrassen')}</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={handleClose}>
                    <X className="w-5 h-5" />
                  </Button>
                </div>

                {!surprise ? (
                  <>
                    <p className="text-muted-foreground mb-4">
                      {t('ai.moodQuestion', 'Waar heb je zin in vandaag?')}
                    </p>
                    
                    <div className="grid grid-cols-3 gap-2 mb-6">
                      {moods.map((mood) => (
                        <button
                          key={mood.id}
                          onClick={() => setSelectedMood(mood.id === selectedMood ? null : mood.id)}
                          className={`p-3 rounded-xl border-2 transition-all duration-200 ${
                            selectedMood === mood.id
                              ? 'border-primary bg-primary/10'
                              : 'border-border hover:border-primary/50'
                          }`}
                        >
                          <span className="text-2xl block mb-1">{mood.emoji}</span>
                          <span className="text-xs font-medium">{mood.label}</span>
                        </button>
                      ))}
                    </div>

                    <Button
                      onClick={handleSurprise}
                      disabled={loading}
                      className="w-full bg-gradient-to-r from-primary to-orange-500 hover:from-primary/90 hover:to-orange-400"
                    >
                      {loading ? (
                        <>
                          <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                          {t('ai.thinking', 'Even denken...')}
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4 mr-2" />
                          {t('ai.generateSurprise', 'Verras mij!')}
                        </>
                      )}
                    </Button>
                  </>
                ) : (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-4"
                  >
                    <div className="text-center py-4">
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', delay: 0.2 }}
                        className="text-5xl mb-3"
                      >
                        🎉
                      </motion.div>
                      <h4 className="text-2xl font-bold text-primary mb-2">{surprise.dish}</h4>
                      <p className="text-muted-foreground text-sm">{surprise.reason}</p>
                    </div>

                    <div className="bg-muted/50 rounded-xl p-4 space-y-3">
                      <p className="text-sm">{surprise.description}</p>
                      <div className="flex items-start gap-2 text-sm text-muted-foreground">
                        <Utensils className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        <span>{surprise.pairingTip}</span>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        onClick={() => {
                          clearRecommendations();
                          handleSurprise();
                        }}
                        disabled={loading}
                        className="flex-1"
                      >
                        <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                        {t('ai.tryAnother', 'Probeer opnieuw')}
                      </Button>
                      <Button
                        onClick={handleSearch}
                        className="flex-1 bg-gradient-to-r from-primary to-orange-500"
                      >
                        {t('ai.searchDish', 'Zoek restaurants')}
                      </Button>
                    </div>
                  </motion.div>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </>
    );
  }

  return null;
}
