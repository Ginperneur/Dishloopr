import { useState, useEffect } from 'react';
import { useRestaurantDishes, DishStatus, RestaurantDish } from '@/hooks/useRestaurantDishes';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Check, X, Trash2, Loader2, Search, Sparkles, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface Restaurant {
  id: string;
  name: string;
}

export function DishApprovalManager() {
  const [selectedRestaurant, setSelectedRestaurant] = useState<string>('all');
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loadingRestaurants, setLoadingRestaurants] = useState(true);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [selectedDish, setSelectedDish] = useState<RestaurantDish | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const {
    dishes,
    availableDishes,
    loading,
    refetch,
    approveDish,
    rejectDish,
    deleteDish,
    bulkApprove,
    bulkReject,
    suggestDish,
  } = useRestaurantDishes({
    restaurantId: selectedRestaurant === 'all' ? undefined : selectedRestaurant,
    includeAll: true,
  });

  // Fetch restaurants on mount
  useEffect(() => {
    const fetchRestaurants = async () => {
      const { data } = await supabase
        .from('restaurants')
        .select('id, name')
        .eq('is_active', true)
        .order('name');
      
      if (data) setRestaurants(data);
      setLoadingRestaurants(false);
    };
    fetchRestaurants();
  }, []);

  // Refetch dishes when restaurant changes
  useEffect(() => {
    refetch();
  }, [selectedRestaurant]);

  const getStatusBadge = (status: DishStatus) => {
    const variants: Record<DishStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
      suggested: { label: 'Voorgesteld', variant: 'secondary' },
      approved_by_admin: { label: 'Goedgekeurd', variant: 'default' },
      verified_by_owner: { label: 'Bevestigd door eigenaar', variant: 'default' },
      rejected: { label: 'Afgewezen', variant: 'destructive' },
    };
    const { label, variant } = variants[status];
    return <Badge variant={variant}>{label}</Badge>;
  };

  const getConfidenceBadge = (confidence: number) => {
    if (confidence >= 0.8) return <Badge className="bg-green-500">Hoog ({Math.round(confidence * 100)}%)</Badge>;
    if (confidence >= 0.5) return <Badge className="bg-yellow-500">Gemiddeld ({Math.round(confidence * 100)}%)</Badge>;
    return <Badge className="bg-red-500">Laag ({Math.round(confidence * 100)}%)</Badge>;
  };

  const filterByStatus = (status: DishStatus | DishStatus[]) => {
    const statuses = Array.isArray(status) ? status : [status];
    return dishes.filter((d) => statuses.includes(d.status as DishStatus));
  };

  const filteredDishes = (statusFilter: DishStatus | DishStatus[]) => {
    return filterByStatus(statusFilter).filter((d) => {
      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase();
      return (
        d.dish?.name?.toLowerCase().includes(query) ||
        d.dish?.name_en?.toLowerCase().includes(query) ||
        d.restaurant?.name?.toLowerCase().includes(query)
      );
    });
  };

  const handleReject = async () => {
    if (!selectedDish || !rejectReason.trim()) {
      toast.error('Geef een reden op');
      return;
    }
    await rejectDish(selectedDish.id, rejectReason);
    setRejectDialogOpen(false);
    setSelectedDish(null);
    setRejectReason('');
  };

  const handleBulkApprove = async () => {
    const count = await bulkApprove(0.85);
    toast.success(`${count} gerechten goedgekeurd`);
  };

  const handleBulkReject = async () => {
    const count = await bulkReject(0.4, 'Automatisch afgewezen: lage confidence score');
    toast.success(`${count} gerechten afgewezen`);
  };

  const DishList = ({ statusFilter }: { statusFilter: DishStatus | DishStatus[] }) => {
    const items = filteredDishes(statusFilter);
    
    if (items.length === 0) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          <AlertCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>Geen gerechten gevonden</p>
        </div>
      );
    }

    return (
      <div className="space-y-2">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
          >
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium">{item.dish?.name}</span>
                {item.dish?.name_en && (
                  <span className="text-muted-foreground text-sm">({item.dish.name_en})</span>
                )}
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>{item.restaurant?.name}</span>
                <span>•</span>
                {getConfidenceBadge(item.confidence_score)}
                <span>•</span>
                <span className="capitalize">{item.source.replace('_', ' ')}</span>
              </div>
              {item.rejected_reason && (
                <p className="text-sm text-destructive mt-1">Reden: {item.rejected_reason}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {getStatusBadge(item.status as DishStatus)}
              {item.status === 'suggested' && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-green-600 hover:text-green-700"
                    onClick={() => approveDish(item.id)}
                  >
                    <Check className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-red-600 hover:text-red-700"
                    onClick={() => {
                      setSelectedDish(item);
                      setRejectDialogOpen(true);
                    }}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </>
              )}
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive hover:text-destructive"
                onClick={() => deleteDish(item.id)}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    );
  };

  if (loading || loadingRestaurants) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const suggestedCount = filterByStatus('suggested').length;
  const approvedCount = filterByStatus('approved_by_admin').length;
  const verifiedCount = filterByStatus('verified_by_owner').length;
  const rejectedCount = filterByStatus('rejected').length;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5" />
            Gerecht Suggesties & Goedkeuring
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <Select value={selectedRestaurant} onValueChange={setSelectedRestaurant}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecteer restaurant" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle restaurants</SelectItem>
                  {restaurants.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Zoek gerechten..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {suggestedCount > 0 && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleBulkApprove}>
                <Check className="w-4 h-4 mr-2" />
                Keur alle hoge confidence goed (≥85%)
              </Button>
              <Button variant="outline" size="sm" onClick={handleBulkReject}>
                <X className="w-4 h-4 mr-2" />
                Wijs alle lage confidence af (≤40%)
              </Button>
            </div>
          )}

          <Tabs defaultValue="suggested">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="suggested">
                Voorgesteld ({suggestedCount})
              </TabsTrigger>
              <TabsTrigger value="approved">
                Goedgekeurd ({approvedCount})
              </TabsTrigger>
              <TabsTrigger value="verified">
                Bevestigd ({verifiedCount})
              </TabsTrigger>
              <TabsTrigger value="rejected">
                Afgewezen ({rejectedCount})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="suggested" className="mt-4">
              <DishList statusFilter="suggested" />
            </TabsContent>

            <TabsContent value="approved" className="mt-4">
              <DishList statusFilter="approved_by_admin" />
            </TabsContent>

            <TabsContent value="verified" className="mt-4">
              <DishList statusFilter="verified_by_owner" />
            </TabsContent>

            <TabsContent value="rejected" className="mt-4">
              <DishList statusFilter="rejected" />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gerecht Afwijzen</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p>
              Je wijst <strong>{selectedDish?.dish?.name}</strong> af voor{' '}
              <strong>{selectedDish?.restaurant?.name}</strong>.
            </p>
            <Textarea
              placeholder="Reden voor afwijzing..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
              Annuleren
            </Button>
            <Button variant="destructive" onClick={handleReject}>
              Afwijzen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
