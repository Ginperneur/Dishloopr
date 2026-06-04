import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Send, Check } from 'lucide-react';
import { z } from 'zod';
import { Layout } from '@/components/layout/Layout';
import { SEOHead } from '@/components/seo/SEOHead';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

const schema = z.object({
  name: z.string().trim().min(2, 'Naam is te kort').max(120),
  address: z.string().trim().max(200).optional().or(z.literal('')),
  city: z.string().trim().max(80).optional().or(z.literal('')),
  website: z.string().trim().url('Ongeldige URL').max(300).optional().or(z.literal('')),
  phone: z.string().trim().max(40).optional().or(z.literal('')),
  cuisine: z.string().trim().max(80).optional().or(z.literal('')),
  notes: z.string().trim().max(1000).optional().or(z.literal('')),
  email: z.string().trim().email('Ongeldig e-mailadres').max(200).optional().or(z.literal('')),
});

export default function SuggestRestaurantPage() {
  const { user } = useAuth();
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    name: '', address: '', city: '', website: '', phone: '', cuisine: '', notes: '',
    email: user?.email || '',
  });

  const update = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message || 'Controleer het formulier');
      return;
    }
    setBusy(true);
    const payload = parsed.data;
    const { error } = await supabase.from('restaurant_suggestions').insert({
      name: payload.name,
      address: payload.address || null,
      city: payload.city || null,
      website: payload.website || null,
      phone: payload.phone || null,
      cuisine: payload.cuisine || null,
      notes: payload.notes || null,
      suggester_email: payload.email || null,
      suggested_by: user?.id || null,
    });
    setBusy(false);
    if (error) {
      console.error(error);
      toast.error('Verzenden mislukt. Probeer het opnieuw.');
      return;
    }
    setSubmitted(true);
    toast.success('Bedankt! We bekijken je suggestie zo snel mogelijk.');
  };

  return (
    <Layout>
      <SEOHead
        title="Stel een restaurant voor | Dishloopr"
        description="Mis je een restaurant op Dishloopr? Stel het in 1 minuut voor. We bekijken elke suggestie."
        noindex
      />
      <div className="max-w-2xl mx-auto px-4 py-8">
        <Link to="/" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4">
          <ArrowLeft className="h-4 w-4 mr-1" /> Terug
        </Link>
        <Card>
          <CardHeader>
            <CardTitle>Stel een restaurant voor</CardTitle>
            <CardDescription>
              Ontbreekt een restaurant op Dishloopr? Vul onderstaand formulier in — ons team checkt elke suggestie binnen een paar dagen.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {submitted ? (
              <div className="text-center py-8 space-y-3">
                <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-primary/10 text-primary">
                  <Check className="h-6 w-6" />
                </div>
                <h3 className="font-semibold">Bedankt voor je suggestie!</h3>
                <p className="text-sm text-muted-foreground">
                  We laten je weten zodra het restaurant op Dishloopr staat.
                </p>
                <Button asChild variant="outline"><Link to="/">Terug naar de homepage</Link></Button>
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-4">
                <div>
                  <Label htmlFor="name">Naam restaurant *</Label>
                  <Input id="name" required maxLength={120} value={form.name} onChange={update('name')} placeholder="Bijv. Restaurant De Plantage" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="city">Stad</Label>
                    <Input id="city" maxLength={80} value={form.city} onChange={update('city')} placeholder="Amsterdam" />
                  </div>
                  <div>
                    <Label htmlFor="cuisine">Keuken / type</Label>
                    <Input id="cuisine" maxLength={80} value={form.cuisine} onChange={update('cuisine')} placeholder="Italiaans, sushi, vegan…" />
                  </div>
                </div>
                <div>
                  <Label htmlFor="address">Adres</Label>
                  <Input id="address" maxLength={200} value={form.address} onChange={update('address')} placeholder="Straatnaam 12, postcode" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="website">Website</Label>
                    <Input id="website" type="url" maxLength={300} value={form.website} onChange={update('website')} placeholder="https://…" />
                  </div>
                  <div>
                    <Label htmlFor="phone">Telefoon</Label>
                    <Input id="phone" maxLength={40} value={form.phone} onChange={update('phone')} placeholder="020 1234567" />
                  </div>
                </div>
                <div>
                  <Label htmlFor="notes">Waarom dit restaurant?</Label>
                  <Textarea id="notes" maxLength={1000} rows={3} value={form.notes} onChange={update('notes')} placeholder="Bekend om hun…" />
                </div>
                <div>
                  <Label htmlFor="email">Jouw e-mail (optioneel)</Label>
                  <Input id="email" type="email" maxLength={200} value={form.email} onChange={update('email')} placeholder="zodat we contact kunnen opnemen" />
                </div>
                <Button type="submit" disabled={busy} className="w-full">
                  <Send className="h-4 w-4 mr-2" /> {busy ? 'Verzenden…' : 'Verstuur suggestie'}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}