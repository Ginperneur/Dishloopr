import { useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { z } from 'zod';
import { Layout } from '@/components/layout/Layout';
import { SEOHead } from '@/components/seo/SEOHead';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { supabase } from '@/integrations/supabase/client';

const schema = z.object({
  naam_restaurant: z.string().trim().min(1, 'Vul de restaurantnaam in').max(200),
  website: z.string().trim().max(300).optional(),
  email: z.string().trim().email('Vul een geldig e-mailadres in').max(255),
  naam: z.string().trim().min(1, 'Vul je naam in').max(120),
  soort: z.enum(['geen_mail', 'verwijderen', 'gegevens_aanpassen']),
  toelichting: z.string().trim().max(2000).optional(),
});

const OPTIONS = [
  { v: 'geen_mail', l: 'Geen e-mails meer van Dishloopr' },
  { v: 'verwijderen', l: 'Mijn restaurant van Dishloopr verwijderen' },
  { v: 'gegevens_aanpassen', l: 'Gegevens laten aanpassen' },
] as const;

export default function RestaurantOptoutPage() {
  const [params] = useSearchParams();
  const slug = params.get('slug') || '';
  const [form, setForm] = useState({
    naam_restaurant: params.get('naam') || '', website: '', email: '', naam: '',
    soort: 'geen_mail' as string, toelichting: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const p = schema.safeParse(form);
    if (!p.success) { setError(p.error.issues[0].message); return; }
    setError(null); setBusy(true);
    const d = p.data;
    const { error: err } = await supabase.rpc('request_restaurant_optout', {
      p_restaurant_slug: slug || null, p_restaurant_naam: d.naam_restaurant, p_website: d.website || null,
      p_email: d.email, p_naam: d.naam, p_soort: d.soort, p_toelichting: d.toelichting || null,
    } as never);
    setBusy(false);
    if (err) { setError('Er ging iets mis. Probeer het opnieuw of mail privacy@dishloopr.com.'); return; }
    setDone(true);
  };

  return (
    <Layout>
      <SEOHead title="Gegevens aanpassen of verwijderen | Dishloopr" description="Restauranteigenaren kunnen hier e-mails stoppen of gegevens laten aanpassen of verwijderen." noindex />
      <div className="container py-12 max-w-xl">
        <h1 className="text-3xl font-bold mb-2">Gegevens aanpassen of verwijderen</h1>
        <p className="text-muted-foreground mb-6">Voor restaurants die op Dishloopr staan.</p>
        {done ? (
          <div role="status" className="rounded-lg border border-border bg-muted/40 p-5">
            Ontvangen. Je ontvangt geen mails meer; verzoeken om te verwijderen of aan te passen handelen we binnen 5 werkdagen af.
            <div className="mt-4"><Link to="/" className="text-primary hover:underline">Terug naar Dishloopr</Link></div>
          </div>
        ) : (
          <form onSubmit={submit} noValidate className="space-y-4">
            <div><Label htmlFor="r">Restaurantnaam</Label><Input id="r" value={form.naam_restaurant} onChange={set('naam_restaurant')} /></div>
            <div><Label htmlFor="w">Website (optioneel)</Label><Input id="w" value={form.website} onChange={set('website')} /></div>
            <div><Label htmlFor="e">E-mailadres</Label><Input id="e" type="email" autoComplete="email" value={form.email} onChange={set('email')} /></div>
            <div><Label htmlFor="n">Je naam</Label><Input id="n" autoComplete="name" value={form.naam} onChange={set('naam')} /></div>
            <div>
              <Label>Wat wil je?</Label>
              <RadioGroup value={form.soort} onValueChange={(v) => setForm({ ...form, soort: v })} className="mt-2">
                {OPTIONS.map(o => (
                  <div key={o.v} className="flex items-center gap-2 min-h-[44px]">
                    <RadioGroupItem value={o.v} id={o.v} /><Label htmlFor={o.v} className="font-normal">{o.l}</Label>
                  </div>
                ))}
              </RadioGroup>
            </div>
            <div><Label htmlFor="t">Toelichting</Label><Textarea id="t" rows={4} value={form.toelichting} onChange={set('toelichting')} /></div>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <Button type="submit" disabled={busy} className="w-full h-11">{busy ? 'Versturen…' : 'Versturen'}</Button>
          </form>
        )}
      </div>
    </Layout>
  );
}
