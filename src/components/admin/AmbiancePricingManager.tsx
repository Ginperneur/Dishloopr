import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Plus, Edit, Trash2, Palette, GripVertical } from 'lucide-react';

interface AmbiancePricing {
  id: string;
  ambiance_tag: string;
  monthly_price: number;
  display_order: number;
  is_active: boolean;
  created_at: string;
}

export function AmbiancePricingManager() {
  const [items, setItems] = useState<AmbiancePricing[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<AmbiancePricing | null>(null);
  
  const [formData, setFormData] = useState({
    ambiance_tag: '',
    monthly_price: 25,
    display_order: 0,
    is_active: true,
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('ambiance_pricing')
        .select('*')
        .order('display_order', { ascending: true });

      if (error) throw error;
      setItems(data || []);
    } catch (error) {
      console.error('Error fetching ambiance pricing:', error);
      toast.error('Fout bij laden van ambiance prijzen');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!formData.ambiance_tag.trim()) {
      toast.error('Vul een ambiance tag in');
      return;
    }

    try {
      if (editingItem) {
        const { error } = await supabase
          .from('ambiance_pricing')
          .update({
            monthly_price: formData.monthly_price,
            display_order: formData.display_order,
            is_active: formData.is_active,
          })
          .eq('id', editingItem.id);

        if (error) throw error;
        toast.success('Prijs bijgewerkt');
      } else {
        // Check if tag already exists
        const { data: existing } = await supabase
          .from('ambiance_pricing')
          .select('id')
          .eq('ambiance_tag', formData.ambiance_tag.toLowerCase())
          .maybeSingle();

        if (existing) {
          toast.error('Deze ambiance tag bestaat al');
          return;
        }

        const { error } = await supabase
          .from('ambiance_pricing')
          .insert({
            ambiance_tag: formData.ambiance_tag.toLowerCase(),
            monthly_price: formData.monthly_price,
            display_order: formData.display_order,
            is_active: formData.is_active,
          });

        if (error) throw error;
        toast.success('Ambiance prijs toegevoegd');
      }

      setDialogOpen(false);
      setEditingItem(null);
      resetForm();
      fetchData();
    } catch (error) {
      console.error('Error saving ambiance pricing:', error);
      toast.error('Fout bij opslaan');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Weet je zeker dat je deze prijs wilt verwijderen?')) return;

    try {
      const { error } = await supabase
        .from('ambiance_pricing')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Prijs verwijderd');
      fetchData();
    } catch (error) {
      console.error('Error deleting ambiance pricing:', error);
      toast.error('Fout bij verwijderen');
    }
  };

  const handleEdit = (item: AmbiancePricing) => {
    setEditingItem(item);
    setFormData({
      ambiance_tag: item.ambiance_tag,
      monthly_price: item.monthly_price,
      display_order: item.display_order,
      is_active: item.is_active,
    });
    setDialogOpen(true);
  };

  const toggleActive = async (item: AmbiancePricing) => {
    try {
      const { error } = await supabase
        .from('ambiance_pricing')
        .update({ is_active: !item.is_active })
        .eq('id', item.id);

      if (error) throw error;
      toast.success(item.is_active ? 'Gedeactiveerd' : 'Geactiveerd');
      fetchData();
    } catch (error) {
      console.error('Error toggling active:', error);
      toast.error('Fout bij wijzigen status');
    }
  };

  const resetForm = () => {
    setFormData({
      ambiance_tag: '',
      monthly_price: 25,
      display_order: items.length,
      is_active: true,
    });
  };

  const formatTagDisplay = (tag: string) => {
    return tag.charAt(0).toUpperCase() + tag.slice(1).replace(/-/g, ' ');
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5" />
              Ambiance Prijzen
            </CardTitle>
            <CardDescription>
              Beheer de maandelijkse meerprijs per ambiance-tag voor Featured plekken
            </CardDescription>
          </div>
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) {
              setEditingItem(null);
              resetForm();
            }
          }}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-1" />
                Nieuwe Prijs
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingItem ? 'Prijs Bewerken' : 'Nieuwe Ambiance Prijs'}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Ambiance Tag</Label>
                  <Input
                    placeholder="bijv. romantic, cozy, high-end"
                    value={formData.ambiance_tag}
                    onChange={(e) => setFormData(prev => ({ ...prev, ambiance_tag: e.target.value }))}
                    disabled={!!editingItem}
                  />
                  <p className="text-xs text-muted-foreground">
                    Gebruik lowercase met streepjes, bijv. "family-friendly"
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Maandprijs (€)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={200}
                    step={5}
                    value={formData.monthly_price}
                    onChange={(e) => setFormData(prev => ({ ...prev, monthly_price: parseFloat(e.target.value) || 0 }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Sorteervolgorde</Label>
                  <Input
                    type="number"
                    min={0}
                    value={formData.display_order}
                    onChange={(e) => setFormData(prev => ({ ...prev, display_order: parseInt(e.target.value) || 0 }))}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label>Actief</Label>
                  <Switch
                    checked={formData.is_active}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Annuleren
                </Button>
                <Button onClick={handleSubmit}>
                  {editingItem ? 'Opslaan' : 'Toevoegen'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-12 bg-muted rounded animate-pulse" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            Geen ambiance prijzen geconfigureerd
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <GripVertical className="h-4 w-4 text-muted-foreground" />
                </TableHead>
                <TableHead>Ambiance</TableHead>
                <TableHead className="text-center">Maandprijs</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-right">Acties</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map(item => (
                <TableRow key={item.id}>
                  <TableCell className="text-muted-foreground text-sm">
                    {item.display_order}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-medium">
                      {formatTagDisplay(item.ambiance_tag)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center font-medium">
                    €{item.monthly_price.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-center">
                    <Switch
                      checked={item.is_active}
                      onCheckedChange={() => toggleActive(item)}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleEdit(item)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => handleDelete(item.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
