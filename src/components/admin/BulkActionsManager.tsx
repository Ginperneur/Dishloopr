import { useState } from 'react';
import { Zap, Loader2, Check, Store, Eye, EyeOff, MapPin, Tag } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useActivityLog } from '@/hooks/useActivityLog';

import { openConfirm } from '@/components/ui/confirm-dialog';
export function BulkActionsManager() {
  const [restaurants, setRestaurants] = useState<any[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [cityFilter, setCityFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [cities, setCities] = useState<any[]>([]);
  const { logActivity } = useActivityLog();

  const fetchRestaurants = async () => {
    setLoading(true);
    // Fetch cities
    const { data: cityData } = await supabase.from('cities').select('id, name').eq('is_active', true).order('name');
    setCities(cityData || []);

    let query = supabase
      .from('restaurants')
      .select('id, name, slug, is_active, is_featured, city_id, cities:city_id(name)')
      .order('name');

    if (cityFilter !== 'all') query = query.eq('city_id', cityFilter);
    if (statusFilter === 'active') query = query.eq('is_active', true);
    if (statusFilter === 'inactive') query = query.eq('is_active', false);

    const { data } = await query.limit(500);
    setRestaurants(data || []);
    setSelected(new Set());
    setLoading(false);
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  const selectAll = () => {
    if (selected.size === filteredRestaurants.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filteredRestaurants.map(r => r.id)));
    }
  };

  const bulkUpdate = async (field: string, value: any, label: string) => {
    if (selected.size === 0) { toast.error('Selecteer eerst restaurants'); return; }
    if (!(await openConfirm(`${label} toepassen op ${selected.size} restaurants?`))) return;

    setExecuting(true);
    const ids = Array.from(selected);
    
    // Update in chunks of 200
    let updated = 0;
    for (let i = 0; i < ids.length; i += 200) {
      const chunk = ids.slice(i, i + 200);
      const { error } = await supabase
        .from('restaurants')
        .update({ [field]: value })
        .in('id', chunk);
      if (!error) updated += chunk.length;
    }

    await logActivity({
      actionType: 'update',
      entityType: 'restaurant',
      entityName: `Bulk: ${label}`,
      details: { count: updated, field, value },
    });

    toast.success(`${updated} restaurants bijgewerkt`);
    setSelected(new Set());
    setExecuting(false);
    fetchRestaurants();
  };

  const filteredRestaurants = restaurants.filter(r =>
    r.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5" />
          Bulk Acties
        </CardTitle>
        <CardDescription>Selecteer restaurants en voer massa-bewerkingen uit</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          <Select value={cityFilter} onValueChange={setCityFilter}>
            <SelectTrigger className="w-[180px] h-9">
              <SelectValue placeholder="Stad" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle steden</SelectItem>
              {cities.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px] h-9">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle</SelectItem>
              <SelectItem value="active">Actief</SelectItem>
              <SelectItem value="inactive">Inactief</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={fetchRestaurants} disabled={loading} size="sm">
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Store className="h-4 w-4 mr-2" />}
            Laden
          </Button>
        </div>

        {restaurants.length > 0 && (
          <>
            {/* Search & bulk actions bar */}
            <div className="flex flex-wrap items-center gap-2 p-3 rounded-lg bg-muted/50">
              <Input
                placeholder="Filter op naam..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-48 h-8 text-sm"
              />
              <div className="flex-1" />
              <Badge variant="outline">{selected.size} geselecteerd</Badge>
              <Button
                size="sm"
                variant="outline"
                onClick={() => bulkUpdate('is_active', true, 'Activeren')}
                disabled={executing || selected.size === 0}
              >
                <Eye className="h-3.5 w-3.5 mr-1" />
                Activeren
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => bulkUpdate('is_active', false, 'Deactiveren')}
                disabled={executing || selected.size === 0}
              >
                <EyeOff className="h-3.5 w-3.5 mr-1" />
                Deactiveren
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => bulkUpdate('is_featured', true, 'Featured maken')}
                disabled={executing || selected.size === 0}
              >
                <Tag className="h-3.5 w-3.5 mr-1" />
                Featured
              </Button>
            </div>

            {/* Table */}
            <div className="max-h-[400px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={selected.size === filteredRestaurants.length && filteredRestaurants.length > 0}
                        onCheckedChange={selectAll}
                      />
                    </TableHead>
                    <TableHead>Naam</TableHead>
                    <TableHead>Stad</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRestaurants.map(r => (
                    <TableRow key={r.id}>
                      <TableCell>
                        <Checkbox
                          checked={selected.has(r.id)}
                          onCheckedChange={() => toggleSelect(r.id)}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {(r.cities as any)?.name || '-'}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={r.is_active ? 'default' : 'secondary'}>
                          {r.is_active ? 'Actief' : 'Inactief'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}

        {restaurants.length === 0 && !loading && (
          <div className="py-8 text-center text-muted-foreground">
            <Zap className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>Klik op "Laden" om restaurants op te halen</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
