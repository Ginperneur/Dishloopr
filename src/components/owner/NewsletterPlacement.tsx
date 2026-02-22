import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Newspaper, CreditCard, Check, Clock, Loader2 } from 'lucide-react';

interface Props {
  restaurantId: string;
  restaurantName: string;
}

export function NewsletterPlacement({ restaurantId, restaurantName }: Props) {
  const { user } = useAuth();
  const [placements, setPlacements] = useState<any[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [promoType, setPromoType] = useState('actie');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user) fetchPlacements();
  }, [user, restaurantId]);

  const fetchPlacements = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('newsletter_placements')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .eq('user_id', user!.id)
      .order('created_at', { ascending: false });
    setPlacements(data || []);
    setLoading(false);
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast.error('Vul een titel in');
      return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-newsletter-checkout', {
        body: {
          restaurantId,
          restaurantName,
          title,
          description,
          promoType,
        },
      });

      if (error) throw error;
      if (data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error('Geen checkout URL ontvangen');
      }
    } catch (err: any) {
      toast.error('Fout bij aanmaken: ' + (err.message || 'Onbekende fout'));
      setSubmitting(false);
    }
  };

  const statusLabel: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
    pending_payment: { label: 'Wacht op betaling', variant: 'outline' },
    paid: { label: 'Betaald - in review', variant: 'secondary' },
    approved: { label: 'Goedgekeurd', variant: 'default' },
    rejected: { label: 'Afgewezen', variant: 'destructive' },
    published: { label: 'Gepubliceerd', variant: 'default' },
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Newspaper className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-semibold">Nieuwsbrief Plaatsing</h3>
      </div>
      <p className="text-sm text-muted-foreground">
        Plaats je actie, event of aanbieding in de wekelijkse Dishloopr nieuwsbrief voor <strong>€15</strong> per plaatsing. 
        Bereik alle geabonneerde foodies in jouw regio!
      </p>

      {/* New placement form */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <Input 
            placeholder="Titel van je actie (bijv. '2e pizza gratis')" 
            value={title} 
            onChange={e => setTitle(e.target.value)} 
          />
          <Textarea 
            placeholder="Korte beschrijving (optioneel)" 
            value={description} 
            onChange={e => setDescription(e.target.value)} 
            rows={2} 
          />
          <Select value={promoType} onValueChange={setPromoType}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="actie">🏷️ Actie / Korting</SelectItem>
              <SelectItem value="event">🎉 Event</SelectItem>
              <SelectItem value="nieuw_gerecht">🍽️ Nieuw gerecht</SelectItem>
              <SelectItem value="aanbieding">💰 Aanbieding</SelectItem>
              <SelectItem value="overig">📌 Overig</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Kosten: <span className="text-primary">€15,00</span></p>
            <Button onClick={handleSubmit} disabled={submitting || !title.trim()}>
              {submitting ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <CreditCard className="h-4 w-4 mr-1" />
              )}
              Betaal & Plaatsen
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Existing placements */}
      {placements.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-muted-foreground mb-2">Je plaatsingen</h4>
          <div className="space-y-2">
            {placements.map(p => (
              <Card key={p.id}>
                <CardContent className="p-3 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">{p.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(p.created_at).toLocaleDateString('nl')}
                    </p>
                  </div>
                  <Badge variant={statusLabel[p.status]?.variant || 'secondary'}>
                    {statusLabel[p.status]?.label || p.status}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
