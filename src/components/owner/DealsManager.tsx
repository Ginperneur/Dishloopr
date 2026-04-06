import { useEffect, useState } from 'react';
import { Tag, Plus, Trash2, Calendar } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Deal {
  id: string;
  title: string;
  description: string | null;
  deal_type: string;
  discount_percentage: number | null;
  valid_from: string;
  valid_until: string;
  is_active: boolean;
  conditions: string | null;
}

interface DealsManagerProps {
  restaurantId: string;
}

export function DealsManager({ restaurantId }: DealsManagerProps) {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [discount, setDiscount] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchDeals();
  }, [restaurantId]);

  const fetchDeals = async () => {
    const { data } = await supabase
      .from('restaurant_deals' as any)
      .select('*')
      .eq('restaurant_id', restaurantId)
      .order('created_at', { ascending: false });
    if (data) setDeals(data as any);
  };

  const createDeal = async () => {
    if (!title || !validUntil) {
      toast.error('Vul titel en einddatum in');
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('restaurant_deals' as any).insert({
      restaurant_id: restaurantId,
      title,
      description: description || null,
      discount_percentage: discount ? parseInt(discount) : null,
      valid_until: new Date(validUntil).toISOString(),
      deal_type: discount ? 'discount' : 'special',
    } as any);

    if (error) {
      toast.error('Kon deal niet aanmaken');
    } else {
      toast.success('Deal aangemaakt!');
      setTitle('');
      setDescription('');
      setDiscount('');
      setValidUntil('');
      setShowForm(false);
      fetchDeals();
    }
    setSaving(false);
  };

  const deleteDeal = async (id: string) => {
    await supabase.from('restaurant_deals' as any).delete().eq('id', id);
    toast.success('Deal verwijderd');
    fetchDeals();
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Tag className="h-4 w-4 text-primary" />
            Aanbiedingen & Deals
          </CardTitle>
          <Button size="sm" variant="outline" onClick={() => setShowForm(!showForm)} className="gap-1">
            <Plus className="h-3.5 w-3.5" />
            Nieuwe deal
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {showForm && (
          <div className="space-y-3 p-4 border border-border rounded-lg bg-muted/30">
            <Input
              placeholder="Titel (bijv. '20% korting op lunch')"
              value={title}
              onChange={e => setTitle(e.target.value)}
            />
            <Textarea
              placeholder="Beschrijving (optioneel)"
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={2}
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                type="number"
                placeholder="Korting % (optioneel)"
                value={discount}
                onChange={e => setDiscount(e.target.value)}
              />
              <Input
                type="date"
                value={validUntil}
                onChange={e => setValidUntil(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={createDeal} disabled={saving} className="flex-1">
                {saving ? 'Opslaan...' : 'Deal aanmaken'}
              </Button>
              <Button variant="ghost" onClick={() => setShowForm(false)}>Annuleren</Button>
            </div>
          </div>
        )}

        {deals.length === 0 && !showForm && (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nog geen deals. Maak je eerste aanbieding om meer gasten te trekken!
          </p>
        )}

        {deals.map(deal => (
          <div key={deal.id} className="flex items-start justify-between p-3 border border-border rounded-lg">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <p className="font-medium text-sm truncate">{deal.title}</p>
                {deal.discount_percentage && (
                  <Badge variant="secondary" className="text-xs shrink-0">
                    -{deal.discount_percentage}%
                  </Badge>
                )}
              </div>
              {deal.description && (
                <p className="text-xs text-muted-foreground line-clamp-1">{deal.description}</p>
              )}
              <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3" />
                <span>t/m {new Date(deal.valid_until).toLocaleDateString('nl-NL')}</span>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
              onClick={() => deleteDeal(deal.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
