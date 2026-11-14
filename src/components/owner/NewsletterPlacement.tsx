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
import { Newspaper, CreditCard, Loader2, Globe2, ImagePlus } from 'lucide-react';
import { toEmailJpeg } from '@/lib/emailImage';
import { sendAnalyticsEvent } from '@/lib/cookieConsent';

interface Props {
  restaurantId: string;
  restaurantName: string;
}

// Sold for all of the Netherlands only until the newsletter can be sent per city or province:
// every subscriber gets the same mail, so a city or province choice would promise nothing.
export const NEWSLETTER_PRICE = 20;

export function NewsletterPlacement({ restaurantId, restaurantName }: Props) {
  const { user } = useAuth();
  const [placements, setPlacements] = useState<any[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [promoType, setPromoType] = useState('actie');
  const [submitting, setSubmitting] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // One photo per placement, stored in the restaurant's own folder (restaurant-images/<id>/newsletter/).
  const uploadPhoto = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Kies een foto (jpg, png of webp).'); return; }
    if (file.size > 10 * 1024 * 1024) { toast.error('Deze foto is groter dan 10 MB.'); return; }
    setUploading(true);
    try {
      const blob = await toEmailJpeg(file);
      const path = `${restaurantId}/newsletter/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
      const { error } = await supabase.storage.from('restaurant-images').upload(path, blob, { contentType: 'image/jpeg' });
      if (error) throw error;
      setImageUrl(supabase.storage.from('restaurant-images').getPublicUrl(path).data.publicUrl);
    } catch (e) {
      toast.error('Uploaden lukte niet', { description: e instanceof Error ? e.message : undefined });
    } finally {
      setUploading(false);
    }
  };

  useEffect(() => {
    if (user) fetchPlacements();
  }, [user, restaurantId]);

  const fetchPlacements = async () => {
    const { data } = await supabase
      .from('newsletter_placements')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .eq('user_id', user!.id)
      .order('created_at', { ascending: false });
    setPlacements(data || []);
  };

  const canSubmit = () => {
    return !!title.trim() && !uploading;
  };

  const handleSubmit = async () => {
    if (!canSubmit()) {
      toast.error('Vul alle velden in');
      return;
    }
    setSubmitting(true);
    sendAnalyticsEvent('click_package', { package: 'newsletter' });
    try {
      const { data, error } = await supabase.functions.invoke('create-newsletter-checkout', {
        body: {
          restaurantId,
          restaurantName,
          title,
          description,
          imageUrl,
          promoType,
          scope: 'national',
        },
      });

      if (error) {
        // Show the function's own message instead of "Edge Function returned a non-2xx status code".
        const reason = await (error as { context?: Response }).context?.json?.()
          .then((b: { error?: string }) => b?.error).catch(() => null);
        throw new Error(reason || error.message);
      }
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
        Plaats je actie, event of aanbieding in de nieuwsbrief van Dishloopr, die elke twee weken naar alle
        abonnees in Nederland gaat. Eén plaatsing kost <strong>€{NEWSLETTER_PRICE}</strong>. We controleren je tekst
        voordat hij meegaat.
      </p>

      <div className="flex items-center gap-3 rounded-lg border border-primary bg-primary/5 p-3">
        <Globe2 className="h-4 w-4 shrink-0 text-primary" />
        <div className="flex-1">
          <p className="text-sm font-medium">Heel Nederland</p>
          <p className="text-xs text-muted-foreground">Alle abonnees van de nieuwsbrief</p>
        </div>
        <span className="text-sm font-semibold text-primary">€{NEWSLETTER_PRICE}</span>
      </div>

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
          <div className="space-y-2">
            <p className="text-sm font-medium">Foto (optioneel)</p>
            {imageUrl ? (
              <div className="flex items-center gap-3">
                <img src={imageUrl} alt="Je foto voor de nieuwsbrief" className="h-20 w-32 rounded-md object-cover" />
                <Button type="button" variant="ghost" size="sm" onClick={() => setImageUrl(null)}>Verwijderen</Button>
              </div>
            ) : (
              <label className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed px-3 py-3 text-sm text-muted-foreground hover:border-primary/50">
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                {uploading ? 'Foto uploaden…' : 'Kies een foto van je gerecht of actie'}
                <input type="file" accept="image/*" className="sr-only" disabled={uploading}
                  onChange={e => { void uploadPhoto(e.target.files?.[0]); e.target.value = ''; }} />
              </label>
            )}
            <p className="text-xs text-muted-foreground">Liggend werkt het best. We verkleinen hem automatisch voor de mail.</p>
          </div>
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
              Kosten: <span className="text-primary">€{NEWSLETTER_PRICE},00</span>
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
                <CardContent className="p-3 flex items-center justify-between gap-3">
                  {p.image_url && <img src={p.image_url} alt="" className="h-12 w-16 shrink-0 rounded object-cover" loading="lazy" />}
                  <div className="flex-1 min-w-0">
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
