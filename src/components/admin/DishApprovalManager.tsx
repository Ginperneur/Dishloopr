import { useState, useEffect, useCallback, useMemo } from 'react';
import { DishStatus } from '@/hooks/useRestaurantDishes';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Check, X, Trash2, Loader2, Search, Sparkles, AlertCircle, ChevronLeft, ChevronRight, Copy, Edit2 } from 'lucide-react';
import { DuplicateDishChecker } from './DuplicateDishChecker';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface Restaurant {
  id: string;
  name: string;
}

interface DishItem {
  id: string;
  restaurant_id: string;
  dish_id: string;
  status: string;
  source: string;
  confidence_score: number;
  rejected_reason: string | null;
  dish: { id: string; name: string; name_en: string | null } | null;
  restaurant: { id: string; name: string } | null;
}

const PAGE_SIZE = 50;

export function DishApprovalManager() {
  const { user } = useAuth();
  const [selectedRestaurant, setSelectedRestaurant] = useState<string>('all');
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loadingRestaurants, setLoadingRestaurants] = useState(true);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [selectedDish, setSelectedDish] = useState<DishItem | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<string>('suggested');
  const [dishes, setDishes] = useState<DishItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({
    suggested: 0,
    approved_by_admin: 0,
    verified_by_owner: 0,
    rejected: 0,
  });
  const [actionLoading, setActionLoading] = useState<Set<string>>(new Set());
  const [deduplicating, setDeduplicating] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<DishItem | null>(null);
  const [editDishName, setEditDishName] = useState('');
  const [editCourseType, setEditCourseType] = useState('hoofdgerecht');
  const [editIsSignature, setEditIsSignature] = useState(false);
  const [editIsVegetarian, setEditIsVegetarian] = useState(false);
  const [editIsVegan, setEditIsVegan] = useState(false);
  const [editIsHalal, setEditIsHalal] = useState(false);
  const [editIsGlutenFree, setEditIsGlutenFree] = useState(false);
  const [editSaving, setEditSaving] = useState(false);

  // Map tab names to status values
  const tabToStatus: Record<string, string> = {
    suggested: 'suggested',
    approved: 'approved_by_admin',
    verified: 'verified_by_owner',
    rejected: 'rejected',
  };

  const currentStatus = tabToStatus[activeTab] || 'suggested';

  // Fetch restaurants once
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

  // Fetch status counts (lightweight query)
  const fetchStatusCounts = useCallback(async () => {
    const restaurantFilter = selectedRestaurant !== 'all' ? selectedRestaurant : undefined;
    
    const countPromises = Object.entries(tabToStatus).map(async ([, status]) => {
      let query = supabase
        .from('restaurant_dishes')
        .select('id', { count: 'exact', head: true })
        .eq('status', status);

      if (restaurantFilter) {
        query = query.eq('restaurant_id', restaurantFilter);
      }

      const { count } = await query;
      return { status, count: count || 0 };
    });

    const results = await Promise.all(countPromises);
    const counts: Record<string, number> = {};
    results.forEach(r => { counts[r.status] = r.count; });
    setStatusCounts(counts);
  }, [selectedRestaurant]);

  // Fetch dishes for current tab with pagination
  const fetchDishes = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('restaurant_dishes')
        .select(`
          id, restaurant_id, dish_id, status, source, confidence_score, rejected_reason,
          dish:dishes(id, name, name_en),
          restaurant:restaurants(id, name)
        `, { count: 'exact' })
        .eq('status', currentStatus)
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (selectedRestaurant !== 'all') {
        query = query.eq('restaurant_id', selectedRestaurant);
      }

      const { data, error, count } = await query;
      if (error) throw error;

      setDishes((data || []) as unknown as DishItem[]);
      setTotalCount(count || 0);
    } catch (err) {
      console.error('Error fetching dishes:', err);
      toast.error('Kon gerechten niet laden');
    } finally {
      setLoading(false);
    }
  }, [currentStatus, selectedRestaurant, page]);

  useEffect(() => { fetchStatusCounts(); }, [fetchStatusCounts]);
  useEffect(() => { fetchDishes(); }, [fetchDishes]);

  // Reset page when filters change
  useEffect(() => { setPage(0); }, [selectedRestaurant, activeTab]);

  // Filter locally by search
  const filteredDishes = useMemo(() => {
    if (!searchQuery) return dishes;
    const q = searchQuery.toLowerCase();
    return dishes.filter(d =>
      d.dish?.name?.toLowerCase().includes(q) ||
      d.dish?.name_en?.toLowerCase().includes(q) ||
      d.restaurant?.name?.toLowerCase().includes(q)
    );
  }, [dishes, searchQuery]);

  const setItemLoading = (id: string, isLoading: boolean) => {
    setActionLoading(prev => {
      const next = new Set(prev);
      isLoading ? next.add(id) : next.delete(id);
      return next;
    });
  };

  // Optimistic single actions
  const handleApprove = async (id: string) => {
    if (!user) return;
    setItemLoading(id, true);
    
    // Optimistic: remove from list
    setDishes(prev => prev.filter(d => d.id !== id));
    setStatusCounts(prev => ({
      ...prev,
      suggested: Math.max(0, (prev.suggested || 0) - 1),
      approved_by_admin: (prev.approved_by_admin || 0) + 1,
    }));
    setTotalCount(prev => Math.max(0, prev - 1));

    const { error } = await supabase
      .from('restaurant_dishes')
      .update({
        status: 'approved_by_admin',
        approved_by: user.id,
        approved_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) {
      toast.error('Kon gerecht niet goedkeuren');
      // Revert on error
      await fetchDishes();
      await fetchStatusCounts();
    } else {
      toast.success('Gerecht goedgekeurd');
    }
    setItemLoading(id, false);
  };

  const handleDelete = async (id: string) => {
    setItemLoading(id, true);
    const removedDish = dishes.find(d => d.id === id);
    
    setDishes(prev => prev.filter(d => d.id !== id));
    setTotalCount(prev => Math.max(0, prev - 1));
    if (removedDish) {
      setStatusCounts(prev => ({
        ...prev,
        [removedDish.status]: Math.max(0, (prev[removedDish.status] || 0) - 1),
      }));
    }

    const { error } = await supabase
      .from('restaurant_dishes')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error('Kon gerecht niet verwijderen');
      await fetchDishes();
      await fetchStatusCounts();
    } else {
      toast.success('Gerecht verwijderd');
    }
    setItemLoading(id, false);
  };

  const handleReject = async () => {
    if (!selectedDish || !rejectReason.trim()) {
      toast.error('Geef een reden op');
      return;
    }

    const id = selectedDish.id;
    setRejectDialogOpen(false);
    setItemLoading(id, true);

    setDishes(prev => prev.filter(d => d.id !== id));
    setStatusCounts(prev => ({
      ...prev,
      suggested: Math.max(0, (prev.suggested || 0) - 1),
      rejected: (prev.rejected || 0) + 1,
    }));
    setTotalCount(prev => Math.max(0, prev - 1));

    const { error } = await supabase
      .from('restaurant_dishes')
      .update({ status: 'rejected', rejected_reason: rejectReason })
      .eq('id', id);

    if (error) {
      toast.error('Kon gerecht niet afwijzen');
      await fetchDishes();
      await fetchStatusCounts();
    } else {
      toast.success('Gerecht afgewezen');
    }
    setSelectedDish(null);
    setRejectReason('');
    setItemLoading(id, false);
  };

  // Batch operations using single SQL update
  const handleBulkApprove = async () => {
    if (!user) return;
    setLoading(true);

    let query = supabase
      .from('restaurant_dishes')
      .update({
        status: 'approved_by_admin',
        approved_by: user.id,
        approved_at: new Date().toISOString(),
      })
      .eq('status', 'suggested')
      .gte('confidence_score', 0.85);

    if (selectedRestaurant !== 'all') {
      query = query.eq('restaurant_id', selectedRestaurant);
    }

    const { error, count } = await query.select('id');

    if (error) {
      toast.error('Bulk goedkeuring mislukt');
    } else {
      toast.success(`${count || 0} gerechten goedgekeurd`);
    }
    await Promise.all([fetchDishes(), fetchStatusCounts()]);
    setLoading(false);
  };

  const handleBulkReject = async () => {
    if (!user) return;
    setLoading(true);

    let query = supabase
      .from('restaurant_dishes')
      .update({
        status: 'rejected',
        rejected_reason: 'Automatisch afgewezen: lage confidence score',
      })
      .eq('status', 'suggested')
      .lte('confidence_score', 0.4);

    if (selectedRestaurant !== 'all') {
      query = query.eq('restaurant_id', selectedRestaurant);
    }

    const { error, count } = await query.select('id');

    if (error) {
      toast.error('Bulk afwijzing mislukt');
    } else {
      toast.success(`${count || 0} gerechten afgewezen`);
    }
    await Promise.all([fetchDishes(), fetchStatusCounts()]);
    setLoading(false);
  };

  const openEditDialog = async (item: DishItem) => {
    setEditingItem(item);
    setEditDishName(item.dish?.name || '');
    // Fetch full restaurant_dish data for flags
    const { data } = await supabase
      .from('restaurant_dishes')
      .select('course_type, is_signature, is_vegetarian, is_vegan, is_halal, is_gluten_free')
      .eq('id', item.id)
      .single();
    if (data) {
      setEditCourseType(data.course_type || 'hoofdgerecht');
      setEditIsSignature(data.is_signature || false);
      setEditIsVegetarian(data.is_vegetarian || false);
      setEditIsVegan(data.is_vegan || false);
      setEditIsHalal(data.is_halal || false);
      setEditIsGlutenFree(data.is_gluten_free || false);
    }
    setEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingItem) return;
    setEditSaving(true);

    // Update dish name if changed
    if (editDishName.trim() && editDishName !== editingItem.dish?.name) {
      const { error: dishError } = await supabase
        .from('dishes')
        .update({ name: editDishName.trim() })
        .eq('id', editingItem.dish_id);
      if (dishError) {
        toast.error('Kon gerechtnaam niet bijwerken');
        setEditSaving(false);
        return;
      }
    }

    // Update restaurant_dish flags
    const { error } = await supabase
      .from('restaurant_dishes')
      .update({
        course_type: editCourseType,
        is_signature: editIsSignature,
        is_vegetarian: editIsVegetarian,
        is_vegan: editIsVegan,
        is_halal: editIsHalal,
        is_gluten_free: editIsGlutenFree,
      })
      .eq('id', editingItem.id);

    if (error) {
      toast.error('Kon gerecht niet bijwerken');
    } else {
      toast.success('Gerecht bijgewerkt');
      setEditDialogOpen(false);
      await fetchDishes();
    }
    setEditSaving(false);
  };

  const getConfidenceBadge = (confidence: number) => {
    if (confidence >= 0.8) return <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold bg-primary/20 text-primary border-primary/30">Hoog ({Math.round(confidence * 100)}%)</span>;
    if (confidence >= 0.5) return <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold bg-accent text-accent-foreground border-accent">Gemiddeld ({Math.round(confidence * 100)}%)</span>;
    return <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold bg-destructive/20 text-destructive border-destructive/30">Laag ({Math.round(confidence * 100)}%)</span>;
  };

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  if (loadingRestaurants) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

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
                    <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
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

          {statusCounts.suggested > 0 && activeTab === 'suggested' && (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={handleBulkApprove} disabled={loading}>
                <Check className="w-4 h-4 mr-2" />
                Keur alle hoge confidence goed (≥85%)
              </Button>
              <Button variant="outline" size="sm" onClick={handleBulkReject} disabled={loading}>
                <X className="w-4 h-4 mr-2" />
                Wijs alle lage confidence af (≤40%)
              </Button>
              <DuplicateDishChecker onCleanupDone={async () => {
                await Promise.all([fetchDishes(), fetchStatusCounts()]);
              }} />
              <Button variant="outline" size="sm" onClick={async () => {
                if (!confirm('Wil je dubbele restaurant-gerecht koppelingen opschonen? De koppeling met de hoogste confidence wordt behouden.')) return;
                setDeduplicating(true);
                try {
                  const { data, error } = await supabase.rpc('deduplicate_restaurant_dishes');
                  if (error) throw error;
                  const result = data as any;
                  if (result?.duplicates_removed > 0) {
                    toast.success(`${result.duplicates_removed} dubbele koppelingen verwijderd`);
                  } else {
                    toast.info('Geen duplicaten gevonden');
                  }
                  await Promise.all([fetchDishes(), fetchStatusCounts()]);
                } catch (err) {
                  toast.error('Deduplicatie mislukt');
                  console.error(err);
                } finally {
                  setDeduplicating(false);
                }
              }} disabled={loading || deduplicating}>
                {deduplicating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Copy className="w-4 h-4 mr-2" />}
                Duplicaten opschonen
              </Button>
            </div>
          )}

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="suggested">
                Voorgesteld ({statusCounts.suggested || 0})
              </TabsTrigger>
              <TabsTrigger value="approved">
                Goedgekeurd ({statusCounts.approved_by_admin || 0})
              </TabsTrigger>
              <TabsTrigger value="verified">
                Bevestigd ({statusCounts.verified_by_owner || 0})
              </TabsTrigger>
              <TabsTrigger value="rejected">
                Afgewezen ({statusCounts.rejected || 0})
              </TabsTrigger>
            </TabsList>

            <div className="mt-4">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : filteredDishes.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <AlertCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>Geen gerechten gevonden</p>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    {filteredDishes.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium truncate">{item.dish?.name}</span>
                            {item.dish?.name_en && (
                              <span className="text-muted-foreground text-sm truncate">({item.dish.name_en})</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
                            <span className="truncate">{item.restaurant?.name}</span>
                            <span>•</span>
                            {getConfidenceBadge(item.confidence_score)}
                            <span>•</span>
                            <span className="capitalize">{item.source?.replace('_', ' ')}</span>
                          </div>
                          {item.rejected_reason && (
                            <p className="text-sm text-destructive mt-1 truncate">Reden: {item.rejected_reason}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openEditDialog(item)}
                            disabled={actionLoading.has(item.id)}
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          {item.status === 'suggested' && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-primary hover:text-primary/80"
                                onClick={() => handleApprove(item.id)}
                                disabled={actionLoading.has(item.id)}
                              >
                                {actionLoading.has(item.id) ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-destructive hover:text-destructive/80"
                                onClick={() => { setSelectedDish(item); setRejectDialogOpen(true); }}
                                disabled={actionLoading.has(item.id)}
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive hover:text-destructive"
                            onClick={() => handleDelete(item.id)}
                            disabled={actionLoading.has(item.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between mt-4 pt-4 border-t">
                      <span className="text-sm text-muted-foreground">
                        Pagina {page + 1} van {totalPages} ({totalCount} totaal)
                      </span>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setPage(p => Math.max(0, p - 1))}
                          disabled={page === 0}
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                          disabled={page >= totalPages - 1}
                        >
                          <ChevronRight className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
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
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>Annuleren</Button>
            <Button variant="destructive" onClick={handleReject}>Afwijzen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Gerecht bewerken</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Gerechtnaam</Label>
              <Input value={editDishName} onChange={(e) => setEditDishName(e.target.value)} />
            </div>
            <div>
              <Label>Restaurant</Label>
              <Input value={editingItem?.restaurant?.name || ''} disabled className="opacity-60" />
            </div>
            <div>
              <Label>Gang</Label>
              <Select value={editCourseType} onValueChange={setEditCourseType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="voorgerecht">Voorgerecht</SelectItem>
                  <SelectItem value="hoofdgerecht">Hoofdgerecht</SelectItem>
                  <SelectItem value="dessert">Dessert</SelectItem>
                  <SelectItem value="bijgerecht">Bijgerecht</SelectItem>
                  <SelectItem value="snack">Snack</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center justify-between rounded-lg border p-3">
                <Label className="text-sm">Signature</Label>
                <Switch checked={editIsSignature} onCheckedChange={setEditIsSignature} />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <Label className="text-sm">Vegetarisch</Label>
                <Switch checked={editIsVegetarian} onCheckedChange={setEditIsVegetarian} />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <Label className="text-sm">Vegan</Label>
                <Switch checked={editIsVegan} onCheckedChange={setEditIsVegan} />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <Label className="text-sm">Halal</Label>
                <Switch checked={editIsHalal} onCheckedChange={setEditIsHalal} />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3 col-span-2">
                <Label className="text-sm">Glutenvrij</Label>
                <Switch checked={editIsGlutenFree} onCheckedChange={setEditIsGlutenFree} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Annuleren</Button>
            <Button onClick={handleSaveEdit} disabled={editSaving}>
              {editSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Opslaan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
