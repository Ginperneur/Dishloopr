import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Gift, Clock, Percent, Sparkles, Copy, Check } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';

interface Perk {
  id: string;
  perk_type: string;
  perk_code: string | null;
  discount_percent: number | null;
  valid_until: string | null;
  is_redeemed: boolean;
}

interface PerksDisplayProps {
  perks: Perk[];
}

const perkConfig: Record<string, {
  label: { nl: string; en: string };
  description: { nl: string; en: string };
  icon: React.ElementType;
}> = {
  early_adopter: {
    label: { nl: 'Early Adopter Bonus', en: 'Early Adopter Bonus' },
    description: { nl: 'Exclusieve korting voor onze eerste gebruikers', en: 'Exclusive discount for our first users' },
    icon: Sparkles,
  },
  review_reward: {
    label: { nl: 'Reviewer Beloning', en: 'Reviewer Reward' },
    description: { nl: 'Bedankt voor je waardevolle reviews', en: 'Thanks for your valuable reviews' },
    icon: Gift,
  },
  loyalty_discount: {
    label: { nl: 'Loyaliteitskorting', en: 'Loyalty Discount' },
    description: { nl: 'Een cadeau voor trouwe gebruikers', en: 'A gift for loyal users' },
    icon: Percent,
  },
};

export function PerksDisplay({ perks }: PerksDisplayProps) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language as 'nl' | 'en';
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  if (perks.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <Gift className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
          <p className="text-muted-foreground">
            {t('perks.none', 'Nog geen perks beschikbaar. Blijf actief om beloningen te verdienen!')}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {perks.map((perk, index) => {
        const config = perkConfig[perk.perk_type] || {
          label: { nl: 'Exclusieve Perk', en: 'Exclusive Perk' },
          description: { nl: 'Een speciale beloning voor jou', en: 'A special reward for you' },
          icon: Gift,
        };
        const Icon = config.icon;

        return (
          <motion.div
            key={perk.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card className="overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary to-primary/50" />
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-xl bg-primary/10 text-primary">
                    <Icon className="h-6 w-6" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-semibold">
                          {config.label[lang] || config.label.nl}
                        </h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          {config.description[lang] || config.description.nl}
                        </p>
                      </div>
                      {perk.discount_percent && (
                        <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-lg px-3">
                          {perk.discount_percent}% {t('perks.off', 'korting')}
                        </Badge>
                      )}
                    </div>

                    {perk.perk_code && (
                      <div className="mt-4 flex items-center gap-2">
                        <code className="px-4 py-2 rounded-lg bg-muted font-mono text-sm flex-1">
                          {perk.perk_code}
                        </code>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => handleCopyCode(perk.perk_code!)}
                        >
                          {copiedCode === perk.perk_code ? (
                            <Check className="h-4 w-4 text-green-500" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    )}

                    {perk.valid_until && (
                      <div className="flex items-center gap-1 mt-3 text-sm text-muted-foreground">
                        <Clock className="h-4 w-4" />
                        <span>
                          {t('perks.validUntil', 'Geldig tot')}{' '}
                          {format(new Date(perk.valid_until), 'd MMMM yyyy', { locale: nl })}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        );
      })}
    </div>
  );
}
