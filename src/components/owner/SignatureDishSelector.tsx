import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Star, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface ApprovedDish {
  id: string;              // restaurant_dishes.id
  name: string;            // dishes.name
  is_signature: boolean;
}

interface Props {
  restaurantId: string;
}

export function SignatureDishSelector({ restaurantId }: Props) {
  const [dishes, setDishes] = useState<ApprovedDish[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedId, setSelectedId] = useState<string>('');

  const fetchDishes = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('restaurant_dishes')
      .select('id, is_signature, dish:dishes(name)')
      .eq('restaurant_id', restaurantId)
      .eq('status', 'approved_by_admin');
    if (!error && data) {
      const list: ApprovedDish[] = (data as any[])
        .filter(rd => rd.dish?.name)
        .map(rd => ({ id: rd.id, name: rd.dish.name, is_signature: !!rd.is_signature }))
        .sort((a, b) => a.name.localeCompare(b.name));
      setDishes(list);
      const current = list.find(d => d.is_signature);
      setSelectedId(current?.id || '');
    }
    setLoading(false);
  };

  useEffect(() => { if (restaurantId) fetchDishes(); }, [restaurantId]);

  const save = async () => {
    if (!selectedId) return;
    setSaving(true);
    const { error } = await supabase.rpc('set_signature_dish', {
      _restaurant_id: restaurantId,
      _rd_id: selectedId,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message || 'Kon signature niet opslaan');
      return;
    }
    toast.success('"Bekend om"-gerecht opgeslagen');
    fetchDishes();
  };

  const clear = async () => {
    setSaving(true);
    const { error } = await supabase.rpc('clear_signature_dish', { _restaurant_id: restaurantId });
    setSaving(false);
    if (error) {
      toast.error(error.message || 'Kon niet wissen');
      return;
    }
    toast.success('"Bekend om" gewist');
    setSelectedId('');
    fetchDishes();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Star className="h-4 w-4 text-primary" />
          Kies je "Bekend om"-gerecht
        </CardTitle>
        <CardDescription>
          Eén gerecht per restaurant. Alleen goedgekeurde gerechten kunnen worden gekozen. Dit gerecht verschijnt als "Bekend om" op de restaurantkaart.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Laden…
          </div>
        ) : dishes.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nog geen goedgekeurde gerechten. Bevestig eerst gerechten hieronder.
          </p>
        ) : (
          <>
            <Select value={selectedId} onValueChange={setSelectedId} disabled={saving}>
              <SelectTrigger>
                <SelectValue placeholder="Kies een goedgekeurd gerecht" />
              </SelectTrigger>
              <SelectContent>
                {dishes.map(d => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}{d.is_signature ? ' • huidig' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              <Button size="sm" onClick={save} disabled={!selectedId || saving}>
                {saving && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                Opslaan
              </Button>
              {dishes.some(d => d.is_signature) && (
                <Button size="sm" variant="ghost" onClick={clear} disabled={saving}>
                  Wissen
                </Button>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}