import { useState, useEffect } from 'react';
import { Bell, FileText, UtensilsCrossed, Store, AlertCircle, ChevronRight, Loader2, Check } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { Link } from 'react-router-dom';

interface PendingCounts {
  claims: number;
  dishes: number;
  restaurants: number;
}

interface NotificationItem {
  id: string;
  type: 'claim' | 'dish' | 'restaurant';
  title: string;
  subtitle: string;
  created_at: string;
}

interface AdminNotificationsProps {
  onNavigate?: (tab: string) => void;
}

export function AdminNotifications({ onNavigate }: AdminNotificationsProps) {
  const [counts, setCounts] = useState<PendingCounts>({ claims: 0, dishes: 0, restaurants: 0 });
  const [recentItems, setRecentItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPendingCounts();
  }, []);

  const fetchPendingCounts = async () => {
    setLoading(true);

    const [claimsResult, oldClaimsResult, dishesResult] = await Promise.all([
      // New restaurant_claims table
      supabase.from('restaurant_claims').select('id, created_at, restaurant_id', { count: 'exact' }).in('status', ['pending', 'email_verified', 'phone_verified']),
      // Legacy claim_requests table  
      supabase.from('claim_requests').select('id, created_at, restaurant_id', { count: 'exact' }).eq('status', 'pending'),
      supabase.from('restaurant_dishes').select('id, created_at, restaurant_id, dish_id', { count: 'exact' }).eq('status', 'suggested'),
    ]);

    setCounts({
      claims: (claimsResult.count || 0) + (oldClaimsResult.count || 0),
      dishes: dishesResult.count || 0,
      restaurants: 0,
    });

    // Build recent items list
    const items: NotificationItem[] = [];

    // Add recent claims from restaurant_claims
    if (claimsResult.data) {
      for (const claim of claimsResult.data.slice(0, 5)) {
        const { data: restaurant } = await supabase
          .from('restaurants')
          .select('name')
          .eq('id', claim.restaurant_id)
          .single();
        
        items.push({
          id: claim.id,
          type: 'claim',
          title: restaurant?.name || 'Onbekend restaurant',
          subtitle: 'Nieuwe claim aanvraag',
          created_at: claim.created_at,
        });
      }
    }

    // Add recent claims from legacy claim_requests
    if (oldClaimsResult.data) {
      for (const claim of oldClaimsResult.data.slice(0, 3)) {
        const { data: restaurant } = await supabase
          .from('restaurants')
          .select('name')
          .eq('id', claim.restaurant_id)
          .single();
        
        items.push({
          id: claim.id,
          type: 'claim',
          title: restaurant?.name || 'Onbekend restaurant',
          subtitle: 'Claim aanvraag (legacy)',
          created_at: claim.created_at,
        });
      }
    }

    // Add recent dish suggestions
    if (dishesResult.data) {
      for (const dish of dishesResult.data.slice(0, 5)) {
        const [restaurantRes, dishRes] = await Promise.all([
          supabase.from('restaurants').select('name').eq('id', dish.restaurant_id).single(),
          supabase.from('dishes').select('name').eq('id', dish.dish_id).single(),
        ]);
        
        items.push({
          id: dish.id,
          type: 'dish',
          title: dishRes.data?.name || 'Onbekend gerecht',
          subtitle: `Bij ${restaurantRes.data?.name || 'onbekend restaurant'}`,
          created_at: dish.created_at,
        });
      }
    }

    // Sort by date
    items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    setRecentItems(items.slice(0, 10));
    setLoading(false);
  };

  const totalPending = counts.claims + counts.dishes + counts.restaurants;

  const getIcon = (type: string) => {
    switch (type) {
      case 'claim': return FileText;
      case 'dish': return UtensilsCrossed;
      case 'restaurant': return Store;
      default: return AlertCircle;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'claim': return 'Claim';
      case 'dish': return 'Gerecht';
      case 'restaurant': return 'Restaurant';
      default: return type;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (totalPending === 0) {
    return (
      <Card className="border-green-500/30 bg-green-500/5">
        <CardContent className="py-8 text-center">
          <Check className="h-12 w-12 mx-auto text-green-500 mb-3" />
          <p className="font-semibold text-green-700 dark:text-green-400">Alles bijgewerkt!</p>
          <p className="text-sm text-muted-foreground">Er zijn geen openstaande goedkeuringen.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-orange-500/30 bg-orange-500/5">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-orange-500/10 flex items-center justify-center">
              <Bell className="h-5 w-5 text-orange-500" />
            </div>
            <div>
              <CardTitle className="text-lg">Openstaande Goedkeuringen</CardTitle>
              <CardDescription>Je hebt {totalPending} items die aandacht nodig hebben</CardDescription>
            </div>
          </div>
          <Badge variant="destructive" className="text-lg px-3 py-1.5">
            {totalPending}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Quick action buttons */}
        <div className="grid grid-cols-3 gap-3">
          {counts.claims > 0 && (
            <Button 
              variant="outline" 
              className="flex-col h-auto py-3 border-orange-500/30 hover:border-orange-500/50"
              onClick={() => onNavigate?.('claims')}
            >
              <FileText className="h-5 w-5 mb-1 text-orange-500" />
              <span className="text-xs">Claims</span>
              <Badge variant="destructive" className="mt-1">{counts.claims}</Badge>
            </Button>
          )}
          {counts.dishes > 0 && (
            <Button 
              variant="outline" 
              className="flex-col h-auto py-3 border-orange-500/30 hover:border-orange-500/50"
              onClick={() => onNavigate?.('dish-approval')}
            >
              <UtensilsCrossed className="h-5 w-5 mb-1 text-orange-500" />
              <span className="text-xs">Gerechten</span>
              <Badge variant="destructive" className="mt-1">{counts.dishes}</Badge>
            </Button>
          )}
          {counts.restaurants > 0 && (
            <Button 
              variant="outline" 
              className="flex-col h-auto py-3 border-orange-500/30 hover:border-orange-500/50"
              onClick={() => onNavigate?.('restaurants')}
            >
              <Store className="h-5 w-5 mb-1 text-orange-500" />
              <span className="text-xs">Restaurants</span>
              <Badge variant="destructive" className="mt-1">{counts.restaurants}</Badge>
            </Button>
          )}
        </div>

        {/* Recent items */}
        {recentItems.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-muted-foreground mb-2">Recent toegevoegd</h4>
            <ScrollArea className="h-[180px]">
              <div className="space-y-2">
                {recentItems.map((item) => {
                  const Icon = getIcon(item.type);
                  return (
                    <div
                      key={`${item.type}-${item.id}`}
                      className="flex items-center justify-between p-2 rounded-lg bg-background hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() => onNavigate?.(item.type === 'claim' ? 'claims' : 'dish-approval')}
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                          <Icon className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">{item.title}</p>
                          <p className="text-xs text-muted-foreground">{item.subtitle}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {getTypeLabel(item.type)}
                        </Badge>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
