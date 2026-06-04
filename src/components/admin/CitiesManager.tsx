import { useState, useEffect } from 'react';
import { 
  MapPin, 
  Search, 
  Plus, 
  Trash2, 
  Edit2,
  Globe
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useActivityLog } from '@/hooks/useActivityLog';

import { openConfirm } from '@/components/ui/confirm-dialog';
interface City {
  id: string;
  name: string;
  slug: string;
  country_code: string;
  is_active: boolean;
  created_at: string;
}

interface CitiesManagerProps {
  onUpdate?: () => void;
}

const COUNTRY_OPTIONS = [
  { code: 'NL', name: 'Nederland' },
  { code: 'BE', name: 'België' },
  { code: 'DE', name: 'Duitsland' },
  { code: 'FR', name: 'Frankrijk' },
  { code: 'ES', name: 'Spanje' },
];

export function CitiesManager({ onUpdate }: CitiesManagerProps) {
  const [cities, setCities] = useState<City[]>([]);
  const [restaurantCounts, setRestaurantCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingCity, setEditingCity] = useState<City | null>(null);
  const [newCityName, setNewCityName] = useState('');
  const [newCityCountry, setNewCityCountry] = useState('NL');
  const { logActivity } = useActivityLog();

  useEffect(() => {
    fetchCities();
  }, []);

  const fetchCities = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('cities')
      .select('*')
      .order('name');

    if (error) {
      toast.error('Fout bij ophalen steden');
    } else {
      setCities(data || []);
      
      // Fetch restaurant counts per city
      const counts: Record<string, number> = {};
      for (const city of data || []) {
        const { count } = await supabase
          .from('restaurants')
          .select('*', { count: 'exact', head: true })
          .eq('city_id', city.id);
        counts[city.id] = count || 0;
      }
      setRestaurantCounts(counts);
    }
    setLoading(false);
  };

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  };

  const addCity = async () => {
    if (!newCityName.trim()) {
      toast.error('Geef een naam op');
      return;
    }

    const { data, error } = await supabase
      .from('cities')
      .insert({
        name: newCityName.trim(),
        slug: generateSlug(newCityName),
        country_code: newCityCountry,
        is_active: true
      })
      .select()
      .single();

    if (error) {
      toast.error('Toevoegen mislukt: ' + error.message);
    } else {
      await logActivity({
        actionType: 'create',
        entityType: 'city',
        entityId: data?.id,
        entityName: newCityName.trim()
      });
      toast.success('Stad toegevoegd');
      setNewCityName('');
      setNewCityCountry('NL');
      setIsAddDialogOpen(false);
      fetchCities();
      onUpdate?.();
    }
  };

  const updateCity = async () => {
    if (!editingCity) return;

    const { error } = await supabase
      .from('cities')
      .update({
        name: editingCity.name,
        slug: generateSlug(editingCity.name),
        country_code: editingCity.country_code,
        is_active: editingCity.is_active
      })
      .eq('id', editingCity.id);

    if (error) {
      toast.error('Bijwerken mislukt');
    } else {
      await logActivity({
        actionType: 'update',
        entityType: 'city',
        entityId: editingCity.id,
        entityName: editingCity.name
      });
      toast.success('Stad bijgewerkt');
      setEditingCity(null);
      fetchCities();
      onUpdate?.();
    }
  };

  const toggleCityActive = async (id: string, name: string, isActive: boolean) => {
    const { error } = await supabase
      .from('cities')
      .update({ is_active: !isActive })
      .eq('id', id);

    if (error) {
      toast.error('Status bijwerken mislukt');
    } else {
      await logActivity({
        actionType: isActive ? 'deactivate' : 'activate',
        entityType: 'city',
        entityId: id,
        entityName: name
      });
      toast.success(isActive ? 'Stad gedeactiveerd' : 'Stad geactiveerd');
      setCities(prev => prev.map(c => c.id === id ? { ...c, is_active: !isActive } : c));
    }
  };

  const deleteCity = async (id: string, name: string) => {
    if (restaurantCounts[id] > 0) {
      toast.error('Kan stad niet verwijderen: er zijn nog restaurants gekoppeld');
      return;
    }
    
    if (!(await openConfirm('Weet je zeker dat je deze stad wilt verwijderen?'))) return;

    const { error } = await supabase
      .from('cities')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error('Verwijderen mislukt: ' + error.message);
    } else {
      await logActivity({
        actionType: 'delete',
        entityType: 'city',
        entityId: id,
        entityName: name
      });
      toast.success('Stad verwijderd');
      setCities(prev => prev.filter(c => c.id !== id));
      onUpdate?.();
    }
  };

  const filteredCities = cities.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getCountryName = (code: string) => {
    return COUNTRY_OPTIONS.find(c => c.code === code)?.name || code;
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Steden beheren
            </CardTitle>
            <CardDescription>{cities.length} steden totaal</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Zoek steden..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  Toevoegen
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Nieuwe stad toevoegen</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <div>
                    <Label>Naam</Label>
                    <Input
                      value={newCityName}
                      onChange={(e) => setNewCityName(e.target.value)}
                      placeholder="bijv. Amsterdam"
                    />
                  </div>
                  <div>
                    <Label>Land</Label>
                    <Select value={newCityCountry} onValueChange={setNewCityCountry}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {COUNTRY_OPTIONS.map(country => (
                          <SelectItem key={country.code} value={country.code}>
                            {country.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                      Annuleren
                    </Button>
                    <Button onClick={addCity}>
                      Toevoegen
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Naam</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Land</TableHead>
                <TableHead className="text-center">Restaurants</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-right">Acties</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={6}>
                      <div className="h-10 bg-muted rounded animate-pulse" />
                    </TableCell>
                  </TableRow>
                ))
              ) : filteredCities.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Geen steden gevonden
                  </TableCell>
                </TableRow>
              ) : (
                filteredCities.map(city => (
                  <TableRow key={city.id}>
                    <TableCell className="font-medium">{city.name}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{city.slug}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="gap-1">
                        <Globe className="h-3 w-3" />
                        {getCountryName(city.country_code)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary">
                        {restaurantCounts[city.id] || 0}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge 
                        variant={city.is_active ? 'default' : 'secondary'}
                        className="cursor-pointer"
                        onClick={() => toggleCityActive(city.id, city.name, city.is_active)}
                      >
                        {city.is_active ? 'Actief' : 'Inactief'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-7 w-7"
                              onClick={() => setEditingCity(city)}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Stad bewerken</DialogTitle>
                            </DialogHeader>
                            {editingCity && (
                              <div className="space-y-4 pt-4">
                                <div>
                                  <Label>Naam</Label>
                                  <Input
                                    value={editingCity.name}
                                    onChange={(e) => setEditingCity({ ...editingCity, name: e.target.value })}
                                  />
                                </div>
                                <div>
                                  <Label>Land</Label>
                                  <Select 
                                    value={editingCity.country_code} 
                                    onValueChange={(v) => setEditingCity({ ...editingCity, country_code: v })}
                                  >
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {COUNTRY_OPTIONS.map(country => (
                                        <SelectItem key={country.code} value={country.code}>
                                          {country.name}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="flex justify-end">
                                  <Button onClick={updateCity}>
                                    Opslaan
                                  </Button>
                                </div>
                              </div>
                            )}
                          </DialogContent>
                        </Dialog>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => deleteCity(city.id, city.name)}
                          disabled={restaurantCounts[city.id] > 0}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
