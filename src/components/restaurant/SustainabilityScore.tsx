import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Leaf, Droplets, Recycle, Truck } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface SustainabilityScoreProps {
  score: number | null | undefined;
  compact?: boolean;
}

export function SustainabilityScore({ score, compact = false }: SustainabilityScoreProps) {
  const { t } = useTranslation();

  if (!score || score < 1 || score > 5) {
    return null;
  }

  const getScoreColor = () => {
    if (score >= 4) return 'text-green-600 dark:text-green-400';
    if (score >= 3) return 'text-lime-600 dark:text-lime-400';
    if (score >= 2) return 'text-amber-600 dark:text-amber-400';
    return 'text-orange-600 dark:text-orange-400';
  };

  const getScoreLabel = () => {
    if (score >= 4) return t('sustainability.excellent', 'Uitstekend');
    if (score >= 3) return t('sustainability.good', 'Goed');
    if (score >= 2) return t('sustainability.average', 'Gemiddeld');
    return t('sustainability.basic', 'Basis');
  };

  const ecoFeatures = [
    { icon: Leaf, label: t('sustainability.localIngredients', 'Lokale ingrediënten'), minScore: 2 },
    { icon: Droplets, label: t('sustainability.sustainableSeafood', 'Duurzame vis'), minScore: 3 },
    { icon: Recycle, label: t('sustainability.wasteReduction', 'Afvalreductie'), minScore: 3 },
    { icon: Truck, label: t('sustainability.lowEmissions', 'Lage emissies'), minScore: 4 },
  ];

  const activeFeatures = ecoFeatures.filter(f => score >= f.minScore);

  if (compact) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={`flex items-center gap-1 ${getScoreColor()}`}>
              <Leaf className="h-4 w-4 fill-current" />
              <span className="text-sm font-medium">{score}/5</span>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p className="font-semibold">{t('sustainability.ecoScore', 'Eco-score')}: {getScoreLabel()}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <div className="p-4 rounded-xl border border-border bg-card">
      <div className="flex items-center gap-2 mb-3">
        <div className={`p-2 rounded-full bg-green-100 dark:bg-green-900/30 ${getScoreColor()}`}>
          <Leaf className="h-5 w-5" />
        </div>
        <div>
          <h3 className="font-semibold">{t('sustainability.ecoScore', 'Eco-score')}</h3>
          <p className={`text-sm font-medium ${getScoreColor()}`}>{getScoreLabel()}</p>
        </div>
        <div className="ml-auto flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((leaf) => (
            <motion.div
              key={leaf}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: leaf * 0.1 }}
            >
              <Leaf 
                className={`h-4 w-4 ${
                  leaf <= score 
                    ? 'text-green-500 fill-green-500' 
                    : 'text-muted'
                }`} 
              />
            </motion.div>
          ))}
        </div>
      </div>

      {activeFeatures.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {activeFeatures.map((feature, index) => (
            <div
              key={index}
              className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 text-xs"
            >
              <feature.icon className="h-3 w-3" />
              <span>{feature.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
