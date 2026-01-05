import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Zap, TrendingUp, Info } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type Restaurant = Database['public']['Tables']['restaurants']['Row'];

interface DemandRoutingSettingsProps {
  restaurant: Restaurant;
  onUpdate?: () => void;
}

interface RoutingStats {
  totalRouted: number;
  clicked: number;
  converted: number;
}

export function DemandRoutingSettings({ restaurant, onUpdate }: DemandRoutingSettingsProps) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [acceptsRoutedDemand, setAcceptsRoutedDemand] = useState(restaurant.accepts_routed_demand ?? false);
  const [stats, setStats] = useState<RoutingStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, [restaurant.id]);

  const fetchStats = async () => {
    setStatsLoading(true);
    try {
      // Get routing events where this restaurant was the target
      const { data, error } = await supabase
        .from('demand_routing_events')
        .select('was_clicked, was_converted')
        .eq('target_restaurant_id', restaurant.id);

      if (error) throw error;

      const totalRouted = data?.length || 0;
      const clicked = data?.filter(e => e.was_clicked).length || 0;
      const converted = data?.filter(e => e.was_converted).length || 0;

      setStats({ totalRouted, clicked, converted });
    } catch (err) {
      console.error('Error fetching routing stats:', err);
    } finally {
      setStatsLoading(false);
    }
  };

  const handleToggle = async (checked: boolean) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('restaurants')
        .update({ accepts_routed_demand: checked })
        .eq('id', restaurant.id);

      if (error) throw error;

      setAcceptsRoutedDemand(checked);
      toast.success(
        checked 
          ? t('routing.enabledSuccess', 'Je ontvangt nu doorgestuurde vraag')
          : t('routing.disabledSuccess', 'Doorgestuurde vraag uitgeschakeld')
      );
      onUpdate?.();
    } catch (err) {
      console.error('Error updating routing settings:', err);
      toast.error(t('common.error', 'Er ging iets mis'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-primary/10">
            <Zap className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-lg">
              {t('routing.settingsTitle', 'Vraag Routing')}
            </CardTitle>
            <CardDescription>
              {t('routing.settingsDescription', 'Ontvang extra klanten wanneer andere restaurants onbeschikbaar zijn')}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Toggle */}
        <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
          <div className="flex items-center gap-3">
            <Label htmlFor="routing-toggle" className="font-medium cursor-pointer">
              {t('routing.acceptRoutedDemand', 'Ontvang doorgestuurde vraag')}
            </Label>
          </div>
          <Switch
            id="routing-toggle"
            checked={acceptsRoutedDemand}
            onCheckedChange={handleToggle}
            disabled={loading}
          />
        </div>

        {/* Info Box */}
        <div className="flex gap-3 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900">
          <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800 dark:text-blue-200">
            <p className="font-medium mb-1">
              {t('routing.howItWorks', 'Hoe werkt het?')}
            </p>
            <ul className="list-disc list-inside space-y-1 text-blue-700 dark:text-blue-300">
              <li>{t('routing.feature1', 'Wanneer een restaurant gesloten of volgeboekt is, suggereren we alternatieven')}</li>
              <li>{t('routing.feature2', 'We matchen op gerecht, prijsklasse, keuken en locatie')}</li>
              <li>{t('routing.feature3', 'Volledig transparant voor gebruikers')}</li>
            </ul>
          </div>
        </div>

        {/* Stats */}
        {acceptsRoutedDemand && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <h4 className="font-medium text-sm">
                {t('routing.performanceTitle', 'Prestaties (laatste 30 dagen)')}
              </h4>
            </div>

            {statsLoading ? (
              <div className="grid grid-cols-3 gap-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-20" />
                ))}
              </div>
            ) : stats ? (
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 rounded-lg bg-muted/50 text-center">
                  <div className="text-2xl font-bold">{stats.totalRouted}</div>
                  <div className="text-xs text-muted-foreground">
                    {t('routing.statImpressions', 'Vertoningen')}
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-muted/50 text-center">
                  <div className="text-2xl font-bold">{stats.clicked}</div>
                  <div className="text-xs text-muted-foreground">
                    {t('routing.statClicks', 'Kliks')}
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-muted/50 text-center">
                  <div className="text-2xl font-bold">{stats.converted}</div>
                  <div className="text-xs text-muted-foreground">
                    {t('routing.statConversions', 'Conversies')}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {t('routing.noStatsYet', 'Nog geen data beschikbaar')}
              </p>
            )}
          </motion.div>
        )}

        {/* Badge for status */}
        <div className="flex justify-end">
          <Badge variant={acceptsRoutedDemand ? 'default' : 'secondary'}>
            {acceptsRoutedDemand 
              ? t('routing.statusActive', 'Actief')
              : t('routing.statusInactive', 'Inactief')
            }
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}
