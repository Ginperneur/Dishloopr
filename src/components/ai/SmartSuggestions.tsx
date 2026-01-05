import { motion } from 'framer-motion';
import { Lightbulb, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

interface SmartSuggestion {
  dish: string;
  connection: string;
}

interface SmartSuggestionsProps {
  currentDish: string;
  suggestions: SmartSuggestion[];
}

export function SmartSuggestions({ currentDish, suggestions }: SmartSuggestionsProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  if (suggestions.length === 0) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-r from-primary/5 to-orange-500/5 border border-primary/20 rounded-xl p-5"
    >
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-full bg-gradient-to-r from-primary to-orange-500 flex items-center justify-center">
          <Lightbulb className="w-4 h-4 text-white" />
        </div>
        <div>
          <h3 className="font-semibold text-sm">
            {t('ai.becauseYouLiked', 'Omdat je {{dish}} lekker vond', { dish: currentDish })}
          </h3>
          <p className="text-xs text-muted-foreground">
            {t('ai.youMightAlsoLike', 'Misschien vind je dit ook lekker')}
          </p>
        </div>
      </div>

      <div className="space-y-2">
        {suggestions.map((suggestion, index) => (
          <motion.button
            key={suggestion.dish}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            onClick={() => navigate(`/search?q=${encodeURIComponent(suggestion.dish)}`)}
            className="w-full flex items-center justify-between p-3 bg-card hover:bg-muted/50 rounded-lg transition-all group"
          >
            <div className="text-left">
              <span className="font-medium group-hover:text-primary transition-colors">
                {suggestion.dish}
              </span>
              <p className="text-xs text-muted-foreground">{suggestion.connection}</p>
            </div>
            <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
}
