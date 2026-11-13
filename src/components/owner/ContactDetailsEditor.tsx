import { useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { Loader2, MapPin, Phone, Globe } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// set_restaurant_contact and the contact_messages columns are newer than the generated types.
const db = supabase as unknown as SupabaseClient;

interface Props {
  restaurantId: string;
  restaurantName: string;
  phone: string | null;
  websiteUrl: string | null;
  address: string | null;
  onSaved: (next: { phone: string | null; website_url: string | null }) => void;
}

/**
 * Phone and website are saved straight away by the verified owner (checked again server-side).
 * A new address goes to Dishloopr as a contact message, because the map and search depend on it.
 */
export function ContactDetailsEditor({ restaurantId, restaurantName, phone, websiteUrl, address, onSaved }: Props) {
  const { user } = useAuth();
  const [p, setP] = useState(phone ?? '');
  const [w, setW] = useState(websiteUrl ?? '');
  const [saving, setSaving] = useState(false);
  const [newAddress, setNewAddress] = useState('');
  const [sendingAddress, setSendingAddress] = useState(false);

  useEffect(() => { setP(phone ?? ''); setW(websiteUrl ?? ''); }, [restaurantId, phone, websiteUrl]);

  const dirty = p.trim() !== (phone ?? '') || w.trim() !== (websiteUrl ?? '');

  const save = async () => {
    setSaving(true);
    const { data, error } = await db.rpc('set_restaurant_contact', {
      p_restaurant_id: restaurantId,
      p_phone: p.trim(),
      p_website_url: w.trim(),
    });
    setSaving(false);
    if (error) {
      toast.error(error.message.startsWith('Ongeldig') ? error.message : 'Opslaan lukte niet. Probeer het opnieuw.');
      return;
    }
    const next = data as { phone: string | null; website_url: string | null };
    setP(next.phone ?? '');
    setW(next.website_url ?? '');
    onSaved(next);
    toast.success('Contactgegevens opgeslagen en direct zichtbaar op je pagina');
  };

  const requestAddress = async () => {
    if (!user?.email || newAddress.trim().length < 8) {
      toast.error('Vul het volledige nieuwe adres in, met postcode en plaats.');
      return;
    }
    setSendingAddress(true);
    const { error } = await db.from('contact_messages').insert({
      name: ((user.user_metadata?.name as string | undefined) || user.email).slice(0, 100),
      email: user.email,
      subject: `[${restaurantName}] Adres wijzigen`.slice(0, 200),
      message: `Huidig adres: ${address ?? 'onbekend'}\nNieuw adres: ${newAddress.trim()}`.slice(0, 5000),
      category: 'gegevens',
      restaurant_id: restaurantId,
      user_id: user.id,
    });
    setSendingAddress(false);
    if (error) { toast.error('Versturen lukte niet. Probeer het opnieuw.'); return; }
    setNewAddress('');
    toast.success('Aanvraag verstuurd. We passen het adres meestal binnen 1 werkdag aan.');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Contactgegevens</CardTitle>
        <CardDescription>Telefoon en website zijn na opslaan direct zichtbaar op je pagina.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="contact-phone" className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" />Telefoonnummer</Label>
            <Input id="contact-phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="020 123 45 67"
              value={p} onChange={e => setP(e.target.value)} className="min-h-11" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="contact-website" className="flex items-center gap-1.5"><Globe className="h-3.5 w-3.5" />Website</Label>
            <Input id="contact-website" type="url" inputMode="url" autoComplete="url" placeholder="https://jouwrestaurant.nl"
              value={w} onChange={e => setW(e.target.value)} className="min-h-11" />
          </div>
        </div>
        <Button onClick={save} disabled={!dirty || saving} className="min-h-11">
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Opslaan
        </Button>

        <div className="space-y-2 border-t pt-5">
          <Label htmlFor="contact-address" className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />Adres</Label>
          <p className="text-sm">{address || 'Nog geen adres bekend'}</p>
          <p className="text-xs text-muted-foreground">
            Verhuisd of klopt het niet? Geef het nieuwe adres door. We controleren het kort, omdat de kaart en zoekresultaten ervan afhangen.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input id="contact-address" placeholder="Straat 12, 1234 AB Plaats" value={newAddress}
              onChange={e => setNewAddress(e.target.value)} className="min-h-11" />
            <Button variant="outline" onClick={requestAddress} disabled={sendingAddress || !newAddress.trim()} className="min-h-11 shrink-0">
              {sendingAddress && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Adres doorgeven
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
