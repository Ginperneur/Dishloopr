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
import { Newspaper, CreditCard, Loader2, MapPin, Map, Globe2 } from 'lucide-react';

interface Props {
  restaurantId: string;
  restaurantName: string;
}

type Scope = 'city' | 'province' | 'national';

const SCOPE_OPTIONS: { id: Scope; price: number; title: string; subtitle: string; Icon: any }[] = [
  { id: 'city', price: 15, title: 'Eén stad', subtitle: 'Bereik foodies in 1 stad', Icon: MapPin },
  { id: 'province', price: 20, title: 'Eén provincie', subtitle: 'Bereik foodies in 1 provincie', Icon: Map },
  { id: 'national', price: 40, title: 'Heel Nederland', subtitle: 'Bereik alle abonnees in NL', Icon: Globe2 },
];

export function NewsletterPlacement({ restaurantId, restaurantName }: Props) {
  const { user } = useAuth();
  const [placements, setPlacements] = useState<any[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [promoType, setPromoType] = useState('actie');
  const [scope, setScope] = useState<Scope>('city');
  const [targetCityId, setTargetCityId] = useState<string>('');
  const [targetProvince, setTargetProvince] = useState<string>('');
  const [cities, setCities] = useState<{ id: string; name: string }[]>([]);
  const [provinces, setProvinces] = useState<{ slug: string; name: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user) fetchPlacements();
    loadGeoData();
  }, [user, restaurantId]);

  const loadGeoData = async () => {
    const [c, p] = await Promise.all([
      supabase.from('cities').select('id, name').eq('is_active', true).eq('country_code', 'NL').order('name'),
      supabase.from('nl_provinces' as any).select('slug, name').order('name'),
    ]);
    setCities((c.data as any) || []);
    setProvinces((p.data as any) || []);
  };

  const fetchPlacements = async () => {
    const { data } = await supabase
      .from('newsletter_placements')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .eq('user_id', user!.id)
      .order('created_at', { ascending: false });
    setPlacements(data || []);
  };

  const selectedOption = SCOPE_OPTIONS.find(o => o.id === scope)!;

  const canSubmit = () => {
    if (!title.trim()) return false;
    if (scope === 'city' && !targetCityId) return false;
    if (scope === 'province' && !targetProvince) return false;
    return true;
  };

  const handleSubmit = async () => {
    if (!canSubmit()) {
      toast.error('Vul alle velden in');
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
          scope,
          targetCityId: scope === 'city' ? targetCityId : null,
          targetProvince: scope === 'province' ? targetProvince : null,
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
        Plaats je actie, event of aanbieding in de 2-wekelijkse Dishloopr nieuwsbrief.
        Kies hoe groot je bereik moet zijn — vanaf <strong>€15</strong>.
      </p>

      {/* Scope selector */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {SCOPE_OPTIONS.map(opt => {
          const active = scope === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => setScope(opt.id)}
              className={`text-left rounded-lg border p-3 transition-colors ${
                active ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border hover:border-primary/40'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <opt.Icon className={`h-4 w-4 ${active ? 'text-primary' : 'text-muted-foreground'}`} />
                <span className={`text-sm font-semibold ${active ? 'text-primary' : ''}`}>€{opt.price}</span>
              </div>
              <p className="font-medium text-sm">{opt.title}</p>
              <p className="text-xs text-muted-foreground">{opt.subtitle}</p>
            </button>
          );
        })}
      </div>

      {/* New placement form */}
      <Card>
        <CardContent className="p-4 space-y-3">
          {scope === 'city' && (
            <Select value={targetCityId} onValueChange={setTargetCityId}>
              <SelectTrigger>
                <SelectValue placeholder="Kies een stad" />
              </SelectTrigger>
              <SelectContent>
                {cities.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {scope === 'province' && (
            <Select value={targetProvince} onValueChange={setTargetProvince}>
              <SelectTrigger>
                <SelectValue placeholder="Kies een provincie" />
              </SelectTrigger>
              <SelectContent>
                {provinces.map(p => (
                  <SelectItem key={p.slug} value={p.name}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
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
            <p className="text-sm font-medium">
              Kosten: <span className="text-primary">€{selectedOption.price},00</span>
            </p>
            <Button onClick={handleSubmit} disabled={submitting || !canSubmit()}>
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
