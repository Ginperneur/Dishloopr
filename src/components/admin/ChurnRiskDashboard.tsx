import { useState, useEffect } from 'react';
import { AlertTriangle, Loader2, Store, Crown, Clock, TrendingDown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';

interface InactiveOwner {
  restaurantId: string;
  restaurantName: string;
  ownerEmail: string;
  claimedAt: string;
  lastActivity: string | null;
  daysSinceActivity: number;
}

interface ExpiringFeatured {
  id: string;
  restaurantName: string;
  expiresAt: string;
  daysRemaining: number;
  monthlyPrice: number;
  consecutiveMonths: number;
}

export function ChurnRiskDashboard() {
  const [inactiveOwners, setInactiveOwners] = useState<InactiveOwner[]>([]);
  const [expiringFeatured, setExpiringFeatured] = useState<ExpiringFeatured[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchChurnData();
  }, []);

  const fetchChurnData = async () => {
    setLoading(true);
    try {
      // Fetch claimed restaurants
      const { data: claimedRestaurants } = await supabase
        .from('restaurants')
        .select('id, name, claimed_by_owner_id, updated_at')
        .not('claimed_by_owner_id', 'is', null)
        .eq('is_active', true);

      if (claimedRestaurants) {
        const ownerIds = [...new Set(claimedRestaurants.map(r => r.claimed_by_owner_id).filter(Boolean))];
        
        // Fetch owner profiles
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, email, name')
          .in('id', ownerIds as string[]);
        const profileMap = new Map(profiles?.map(p => [p.id, p.email || p.name || 'Onbekend']) || []);

        // Fetch latest claim activity  
        const { data: claims } = await supabase
          .from('restaurant_claims')
          .select('restaurant_id, updated_at')
          .in('restaurant_id', claimedRestaurants.map(r => r.id))
          .order('updated_at', { ascending: false });
        
        const claimActivityMap = new Map<string, string>();
        for (const c of claims || []) {
          if (!claimActivityMap.has(c.restaurant_id)) {
            claimActivityMap.set(c.restaurant_id, c.updated_at);
          }
        }

        const now = new Date();
        const inactive: InactiveOwner[] = [];

        for (const r of claimedRestaurants) {
          const lastActivity = claimActivityMap.get(r.id) || r.updated_at;
          const daysSince = Math.floor((now.getTime() - new Date(lastActivity).getTime()) / (1000 * 60 * 60 * 24));
          
          if (daysSince >= 30) {
            inactive.push({
              restaurantId: r.id,
              restaurantName: r.name,
              ownerEmail: profileMap.get(r.claimed_by_owner_id!) || 'Onbekend',
              claimedAt: r.updated_at,
              lastActivity,
              daysSinceActivity: daysSince,
            });
          }
        }

        inactive.sort((a, b) => b.daysSinceActivity - a.daysSinceActivity);
        setInactiveOwners(inactive);
      }

      // Fetch expiring featured subscriptions (within 14 days)
      const fourteenDaysFromNow = new Date();
      fourteenDaysFromNow.setDate(fourteenDaysFromNow.getDate() + 14);

      const { data: expiring } = await supabase
        .from('featured_subscriptions')
        .select('id, restaurant_id, expires_at, monthly_price, consecutive_months, restaurants:restaurant_id(name)')
        .eq('status', 'active')
        .lte('expires_at', fourteenDaysFromNow.toISOString())
        .order('expires_at', { ascending: true });

      if (expiring) {
        const now = new Date();
        setExpiringFeatured(expiring.map(e => ({
          id: e.id,
          restaurantName: (e.restaurants as any)?.name || 'Onbekend',
          expiresAt: e.expires_at,
          daysRemaining: Math.max(0, Math.ceil((new Date(e.expires_at).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))),
          monthlyPrice: e.monthly_price,
          consecutiveMonths: e.consecutive_months,
        })));
      }
    } catch (err) {
      console.error('Churn data error:', err);
    } finally {
      setLoading(false);
    }
  };

  const highRisk = inactiveOwners.filter(o => o.daysSinceActivity >= 90);
  const mediumRisk = inactiveOwners.filter(o => o.daysSinceActivity >= 30 && o.daysSinceActivity < 90);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingDown className="h-5 w-5" />
          Churn Risk Dashboard
        </CardTitle>
        <CardDescription>Monitor inactieve eigenaren en aflopende abonnementen</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="py-12 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="p-3 rounded-lg bg-destructive/10">
                <p className="text-xs text-muted-foreground">Hoog risico (90d+)</p>
                <p className="text-2xl font-bold text-destructive">{highRisk.length}</p>
              </div>
              <div className="p-3 rounded-lg bg-orange-500/10">
                <p className="text-xs text-muted-foreground">Medium risico (30-90d)</p>
                <p className="text-2xl font-bold text-orange-600">{mediumRisk.length}</p>
              </div>
              <div className="p-3 rounded-lg bg-orange-500/10">
                <p className="text-xs text-muted-foreground">Aflopend (14d)</p>
                <p className="text-2xl font-bold text-orange-600">{expiringFeatured.length}</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-xs text-muted-foreground">MRR at risk</p>
                <p className="text-2xl font-bold">
                  €{expiringFeatured.reduce((sum, e) => sum + e.monthlyPrice, 0).toFixed(0)}
                </p>
              </div>
            </div>

            <Tabs defaultValue="inactive">
              <TabsList>
                <TabsTrigger value="inactive" className="gap-1.5">
                  <Store className="h-3.5 w-3.5" />
                  Inactieve eigenaren ({inactiveOwners.length})
                </TabsTrigger>
                <TabsTrigger value="expiring" className="gap-1.5">
                  <Crown className="h-3.5 w-3.5" />
                  Aflopend ({expiringFeatured.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="inactive">
                {inactiveOwners.length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground">
                    <Store className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p>Geen inactieve eigenaren gevonden</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Risico</TableHead>
                        <TableHead>Restaurant</TableHead>
                        <TableHead>Eigenaar</TableHead>
                        <TableHead className="text-right">Dagen inactief</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {inactiveOwners.map(owner => (
                        <TableRow key={owner.restaurantId}>
                          <TableCell>
                            <Badge variant={owner.daysSinceActivity >= 90 ? 'destructive' : 'secondary'}>
                              {owner.daysSinceActivity >= 90 ? 'Hoog' : 'Medium'}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-medium">{owner.restaurantName}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{owner.ownerEmail}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className={owner.daysSinceActivity >= 90 ? 'text-destructive font-semibold' : ''}>
                                {owner.daysSinceActivity}d
                              </span>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </TabsContent>

              <TabsContent value="expiring">
                {expiringFeatured.length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground">
                    <Crown className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p>Geen aflopende abonnementen in de komende 14 dagen</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Restaurant</TableHead>
                        <TableHead className="text-right">Prijs/mnd</TableHead>
                        <TableHead className="text-right">Maanden</TableHead>
                        <TableHead className="text-right">Dagen over</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {expiringFeatured.map(sub => (
                        <TableRow key={sub.id}>
                          <TableCell className="font-medium">{sub.restaurantName}</TableCell>
                          <TableCell className="text-right">€{sub.monthlyPrice}</TableCell>
                          <TableCell className="text-right">{sub.consecutiveMonths}</TableCell>
                          <TableCell className="text-right">
                            <Badge variant={sub.daysRemaining <= 3 ? 'destructive' : 'secondary'}>
                              {sub.daysRemaining}d
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </TabsContent>
            </Tabs>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
