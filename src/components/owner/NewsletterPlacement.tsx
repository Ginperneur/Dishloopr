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
import { Newspaper, CreditCard, Loader2, Globe2, ImagePlus, FileText } from 'lucide-react';
import { toEmailJpeg } from '@/lib/emailImage';
import { sendAnalyticsEvent } from '@/lib/cookieConsent';
import { VatTotal } from '@/components/common/VatTotal';

interface Props {
  restaurantId: string;
  restaurantName: string;
}

// The newsletter goes out per city: one edition per Tuesday, at most 4 restaurants, 30 euro per
// 1.000 readers in the restaurant's own city (at least 20 euro). Dominant includes one a month.
type Edition = { edition_date: string; places_left: number; readers: number; price_cents: number };
const fmtDate = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' });

export function NewsletterPlacement({ restaurantId, restaurantName }: Props) {
  const { user } = useAuth();
  const [placements, setPlacements] = useState<any[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [promoType, setPromoType] = useState('actie');
  const [submitting, setSubmitting] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [pdf, setPdf] = useState<{ url: string; name: string } | null>(null);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [cityId, setCityId] = useState<string | null>(null);
  const [cityName, setCityName] = useState('je stad');
  const [editions, setEditions] = useState<Edition[]>([]);
  const [editionDate, setEditionDate] = useState('');
  useEffect(() => {
    let off = false;
    (async () => {
      const { data: r } = await supabase.from('restaurants').select('city_id, cities(name)').eq('id', restaurantId).maybeSingle();
      if (off || !r?.city_id) return;
      setCityId(r.city_id);
      setCityName((r.cities as { name?: string } | null)?.name ?? 'je stad');
      const { data } = await (supabase.rpc as any)('newsletter_city_editions', { p_city: r.city_id });
      if (!off) setEditions((data ?? []) as Edition[]);
    })();
    return () => { off = true; };
  }, [restaurantId]);
  const edition = editions.find(e => e.edition_date === editionDate);
  const priceCents = edition?.price_cents ?? editions[0]?.price_cents ?? 2000;

  // One PDF per placement (menu or flyer): linked from the mail, stored next to the photo.
  const uploadPdf = async (file: File | undefined) => {
    if (!file) return;
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) { toast.error('Kies een pdf-bestand.'); return; }
    if (file.size > 10 * 1024 * 1024) { toast.error('Deze pdf is groter dan 10 MB.'); return; }
    setUploadingPdf(true);
    try {
      const path = `${restaurantId}/newsletter/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.pdf`;
      const { error } = await supabase.storage.from('restaurant-images').upload(path, file, { contentType: 'application/pdf' });
      if (error) throw error;
      setPdf({ url: supabase.storage.from('restaurant-images').getPublicUrl(path).data.publicUrl, name: file.name });
    } catch (e) {
      toast.error('Uploaden lukte niet', { description: e instanceof Error ? e.message : undefined });
    } finally {
      setUploadingPdf(false);
    }
  };

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
    return !!title.trim() && !uploading && !uploadingPdf;
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
          pdfUrl: pdf?.url ?? null,
          promoType,
          scope: 'city',
          editionDate,
        },
      });

      if (error) {
        // Show the function's own message instead of "Edge Function returned a non-2xx status code".
        const reason = await (error as { context?: Response }).context?.json?.()
          .then((b: { error?: string }) => b?.error).catch(() => null);
        throw new Error(reason || error.message);
      }
      if (data?.included) {
        toast.success('Geplaatst, inbegrepen bij Dominant. We controleren je tekst voordat hij meegaat.');
        setSubmitting(false);
        return;
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
        Plaats je actie, event of aanbieding in de nieuwsbrief van {cityName}. Die gaat elke dinsdag naar de abonnees
        in jouw stad, met maximaal 4 restaurants per editie. Je betaalt €30 per 1.000 lezers, minimaal €20, excl. btw.
        We controleren je tekst voordat hij meegaat. Bij Dominant zit 1 plaatsing per maand inbegrepen.
      </p>

      <fieldset className="space-y-2 rounded-lg border p-3">
        <legend className="flex items-center gap-2 px-1 text-sm font-medium"><Globe2 className="h-4 w-4 text-primary" />Kies een editie in {cityName}</legend>
        {!cityId && <p className="text-sm text-muted-foreground">Je restaurant heeft nog geen stad. Vul je adres in onder Profiel.</p>}
        {editions.map(e => (
          <label key={e.edition_date} className={`flex min-h-11 items-center gap-3 rounded-md border px-3 ${e.places_left === 0 ? 'opacity-60' : 'cursor-pointer'}`}>
            <input type="radio" name="edition" value={e.edition_date} disabled={e.places_left === 0}
              checked={editionDate === e.edition_date} onChange={() => setEditionDate(e.edition_date)} />
            <span className="flex-1 text-sm first-letter:uppercase">{fmtDate(e.edition_date)}</span>
            <span className="text-xs text-muted-foreground">{e.places_left === 0 ? 'vol' : `nog ${e.places_left} ${e.places_left === 1 ? 'plek' : 'plekken'}`}</span>
          </label>
        ))}
        {editions[0] && <p className="text-xs text-muted-foreground">{editions[0].readers.toLocaleString('nl-NL')} lezers in {cityName}.</p>}
      </fieldset>

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
          <div className="space-y-2">
            <p className="text-sm font-medium">Pdf (optioneel)</p>
            {pdf ? (
              <div className="flex items-center gap-3 rounded-md border p-2 text-sm">
                <FileText className="h-4 w-4 shrink-0 text-primary" />
                <a href={pdf.url} target="_blank" rel="noopener" className="flex-1 truncate underline">{pdf.name}</a>
                <Button type="button" variant="ghost" size="sm" onClick={() => setPdf(null)}>Verwijderen</Button>
              </div>
            ) : (
              <label className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed px-3 py-3 text-sm text-muted-foreground hover:border-primary/50">
                {uploadingPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                {uploadingPdf ? 'Pdf uploaden…' : 'Voeg een pdf toe, bijvoorbeeld je menukaart of flyer'}
                <input type="file" accept="application/pdf,.pdf" className="sr-only" disabled={uploadingPdf}
                  onChange={e => { void uploadPdf(e.target.files?.[0]); e.target.value = ''; }} />
              </label>
            )}
            <p className="text-xs text-muted-foreground">In de mail komt een knop "Bekijk de pdf". Maximaal 10 MB.</p>
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
            <div>
              <p className="text-sm font-medium">
                Kosten: <span className="text-primary">€{(priceCents / 100).toFixed(2).replace('.', ',')}</span> excl. btw
              </p>
              <VatTotal exCents={priceCents} className="text-xs" />
            </div>
            <Button onClick={handleSubmit} disabled={submitting || !canSubmit() || !editionDate}>
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
