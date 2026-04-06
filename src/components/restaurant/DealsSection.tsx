import { useEffect, useState } from 'react';
import { Tag, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';

interface Deal {
  id: string;
  title: string;
  description: string | null;
  discount_percentage: number | null;
  valid_until: string;
  conditions: string | null;
}

export function DealsSection({ restaurantId }: { restaurantId: string }) {
  const [deals, setDeals] = useState<Deal[]>([]);

  useEffect(() => {
    const fetchDeals = async () => {
      const { data } = await supabase
        .from('restaurant_deals' as any)
        .select('id, title, description, discount_percentage, valid_until, conditions')
        .eq('restaurant_id', restaurantId)
        .eq('is_active', true)
        .gt('valid_until', new Date().toISOString())
        .order('valid_until', { ascending: true });
      if (data) setDeals(data as any);
    };
    fetchDeals();
  }, [restaurantId]);

  if (deals.length === 0) return null;

  const daysLeft = (date: string) => {
    const diff = Math.ceil((new Date(date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return diff;
  };

  return (
    <div className="space-y-3">
      <h3 className="font-semibold flex items-center gap-2">
        <Tag className="h-4 w-4 text-primary" />
        Aanbiedingen
      </h3>
      {deals.map(deal => (
        <div key={deal.id} className="p-4 rounded-xl border border-primary/20 bg-primary/5">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-semibold text-sm">{deal.title}</p>
              {deal.description && (
                <p className="text-sm text-muted-foreground mt-1">{deal.description}</p>
              )}
              {deal.conditions && (
                <p className="text-xs text-muted-foreground mt-1 italic">{deal.conditions}</p>
              )}
            </div>
            {deal.discount_percentage && (
              <Badge className="bg-primary text-primary-foreground shrink-0">
                -{deal.discount_percentage}%
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>
              {daysLeft(deal.valid_until) <= 3
                ? `Nog ${daysLeft(deal.valid_until)} ${daysLeft(deal.valid_until) === 1 ? 'dag' : 'dagen'}!`
                : `Geldig t/m ${new Date(deal.valid_until).toLocaleDateString('nl-NL')}`
              }
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
