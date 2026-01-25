import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Plus, Edit, Trash2, RefreshCw, TrendingUp, Users } from 'lucide-react';

interface FeaturedSlot {
  id: string;
  city_id: string;
  cuisine: string;
  base_price: number;
  max_slots: number;
  cooling_off_days: number;
  created_at: string;
  cities?: { name: string };
  active_count?: number;
}

interface City {
  id: string;
  name: string;
}

export function FeaturedSlotsManager() {
  const [slots, setSlots] = useState<FeaturedSlot[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSlot, setEditingSlot] = useState<FeaturedSlot | null>(null);
  
  const [formData, setFormData] = useState({
    city_id: '',
    cuisine: '',
    base_price: 99,
    max_slots: 15,
    cooling_off_days: 30,
  });

  const cuisineOptions = [
    'Italiaans', 'Japans', 'Chinees', 'Thais', 'Mexicaans', 'Indiaas', 
    'Frans', 'Grieks', 'Turks', 'Amerikaans', 'Steakhouse', 'Vegetarisch',
    'Vis & Zeevruchten', 'Sushi', 'Pizza', 'Burgers', 'Aziatisch', 'Mediterraans'
  ];

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch cities
      const { data: citiesData } = await supabase
        .from('cities')
        .select('id, name')
        .eq('is_active', true)
        .order('name');

      setCities(citiesData || []);

      // Fetch slots with city names
      const { data: slotsData, error: slotsError } = await supabase
        .from('featured_slots')
        .select(`
          *,
          cities:city_id (name)
        `)
        .order('created_at', { ascending: false });

      if (slotsError) throw slotsError;

      // Get active subscription counts for each slot
      const slotsWithCounts = await Promise.all(
        (slotsData || []).map(async (slot) => {
          const { count } = await supabase
            .from('featured_subscriptions')
            .select('*', { count: 'exact', head: true })
            .eq('slot_id', slot.id)
            .eq('status', 'active');

          return { ...slot, active_count: count || 0 };
        })
      );

      setSlots(slotsWithCounts);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Fout bij laden van data');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!formData.city_id || !formData.cuisine) {
      toast.error('Selecteer een stad en keuken');
      return;
    }

    try {
      if (editingSlot) {
        const { error } = await supabase
          .from('featured_slots')
          .update({
            base_price: formData.base_price,
            max_slots: formData.max_slots,
            cooling_off_days: formData.cooling_off_days,
          })
          .eq('id', editingSlot.id);

        if (error) throw error;
        toast.success('Slot bijgewerkt');
      } else {
        // Check if slot already exists
        const { data: existing } = await supabase
          .from('featured_slots')
          .select('id')
          .eq('city_id', formData.city_id)
          .eq('cuisine', formData.cuisine)
          .maybeSingle();

        if (existing) {
          toast.error('Dit slot bestaat al');
          return;
        }

        const { error } = await supabase
          .from('featured_slots')
          .insert({
            city_id: formData.city_id,
            cuisine: formData.cuisine,
            base_price: formData.base_price,
            max_slots: formData.max_slots,
            cooling_off_days: formData.cooling_off_days,
          });

        if (error) throw error;
        toast.success('Slot aangemaakt');
      }

      setDialogOpen(false);
      setEditingSlot(null);
      resetForm();
      fetchData();
    } catch (error) {
      console.error('Error saving slot:', error);
      toast.error('Fout bij opslaan');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Weet je zeker dat je dit slot wilt verwijderen?')) return;

    try {
      const { error } = await supabase
        .from('featured_slots')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Slot verwijderd');
      fetchData();
    } catch (error) {
      console.error('Error deleting slot:', error);
      toast.error('Fout bij verwijderen');
    }
  };

  const handleEdit = (slot: FeaturedSlot) => {
    setEditingSlot(slot);
    setFormData({
      city_id: slot.city_id,
      cuisine: slot.cuisine,
      base_price: slot.base_price,
      max_slots: slot.max_slots,
      cooling_off_days: slot.cooling_off_days,
    });
    setDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({
      city_id: '',
      cuisine: '',
      base_price: 99,
      max_slots: 15,
      cooling_off_days: 30,
    });
  };

  const triggerExpirationCheck = async () => {
    try {
      toast.info('Expiratie check gestart...');
      
      const response = await supabase.functions.invoke('expire-featured-subscriptions');
      
      if (response.error) throw response.error;
      
      toast.success(`Check voltooid: ${response.data.expired_count} subscriptions verlopen`);
      fetchData();
    } catch (error) {
      console.error('Error running expiration check:', error);
      toast.error('Fout bij expiratie check');
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Featured Slots Beheer
            </CardTitle>
            <CardDescription>
              Beheer basisprijzen en slot limieten per stad + keuken
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={triggerExpirationCheck}>
              <RefreshCw className="h-4 w-4 mr-1" />
              Expiratie Check
            </Button>
            <Dialog open={dialogOpen} onOpenChange={(open) => {
              setDialogOpen(open);
              if (!open) {
                setEditingSlot(null);
                resetForm();
              }
            }}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  Nieuw Slot
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>
                    {editingSlot ? 'Slot Bewerken' : 'Nieuw Featured Slot'}
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Stad</Label>
                    <Select 
                      value={formData.city_id} 
                      onValueChange={(v) => setFormData(prev => ({ ...prev, city_id: v }))}
                      disabled={!!editingSlot}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecteer stad" />
                      </SelectTrigger>
                      <SelectContent>
                        {cities.map(city => (
                          <SelectItem key={city.id} value={city.id}>
                            {city.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Keuken</Label>
                    <Select 
                      value={formData.cuisine} 
                      onValueChange={(v) => setFormData(prev => ({ ...prev, cuisine: v }))}
                      disabled={!!editingSlot}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecteer keuken" />
                      </SelectTrigger>
                      <SelectContent>
                        {cuisineOptions.map(cuisine => (
                          <SelectItem key={cuisine} value={cuisine}>
                            {cuisine}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Basisprijs (€/maand)</Label>
                    <Input
                      type="number"
                      min={10}
                      max={500}
                      value={formData.base_price}
                      onChange={(e) => setFormData(prev => ({ ...prev, base_price: parseFloat(e.target.value) || 99 }))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Max Slots</Label>
                    <Input
                      type="number"
                      min={1}
                      max={50}
                      value={formData.max_slots}
                      onChange={(e) => setFormData(prev => ({ ...prev, max_slots: parseInt(e.target.value) || 15 }))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Cooling-off Periode (dagen)</Label>
                    <Input
                      type="number"
                      min={7}
                      max={90}
                      value={formData.cooling_off_days}
                      onChange={(e) => setFormData(prev => ({ ...prev, cooling_off_days: parseInt(e.target.value) || 30 }))}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>
                    Annuleren
                  </Button>
                  <Button onClick={handleSubmit}>
                    {editingSlot ? 'Opslaan' : 'Aanmaken'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-12 bg-muted rounded animate-pulse" />
            ))}
          </div>
        ) : slots.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            Geen featured slots geconfigureerd
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Stad</TableHead>
                <TableHead>Keuken</TableHead>
                <TableHead className="text-center">Basisprijs</TableHead>
                <TableHead className="text-center">Slots</TableHead>
                <TableHead className="text-center">Bezetting</TableHead>
                <TableHead className="text-center">Cooling-off</TableHead>
                <TableHead className="text-right">Acties</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {slots.map(slot => {
                const occupancyRate = slot.active_count !== undefined 
                  ? Math.round((slot.active_count / slot.max_slots) * 100)
                  : 0;
                
                return (
                  <TableRow key={slot.id}>
                    <TableCell className="font-medium">
                      {slot.cities?.name || 'Onbekend'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{slot.cuisine}</Badge>
                    </TableCell>
                    <TableCell className="text-center font-medium">
                      €{slot.base_price}
                    </TableCell>
                    <TableCell className="text-center">
                      {slot.max_slots}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span className={occupancyRate >= 80 ? 'text-orange-500 font-medium' : ''}>
                          {slot.active_count}/{slot.max_slots}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          ({occupancyRate}%)
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center text-muted-foreground">
                      {slot.cooling_off_days} dagen
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleEdit(slot)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => handleDelete(slot.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
