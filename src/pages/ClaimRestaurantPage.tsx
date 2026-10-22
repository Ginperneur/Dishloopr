import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Clock, FileUp, Loader2, Mail, ShieldAlert, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Layout } from '@/components/layout/Layout';
import { SEOHead } from '@/components/seo/SEOHead';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { sendAnalyticsEvent } from '@/lib/cookieConsent';

type Status = {
  claimStatus: string | null;
  isOwner: boolean;
  websiteDomain: string | null;
  openClaim: { id: string; status: string; method: string | null; manualSubmitted: boolean } | null;
};

async function call(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('verify-claim', { body });
  if (error) {
    let msg = error.message;
    try { const j = await (error as any).context?.json?.(); if (j?.error) msg = j.error; } catch { /* ignore */ }
    throw new Error(msg);
  }
  if ((data as any)?.error) throw new Error((data as any).error);
  return data as any;
}

export default function ClaimRestaurantPage() {
  const { slug } = useParams<{ slug: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [restaurant, setRestaurant] = useState<{ id: string; name: string; slug: string } | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [status, setStatus] = useState<Status | null>(null);
  const [route, setRoute] = useState<'choose' | 'email' | 'manual' | 'pending' | 'done'>('choose');
  const [claimId, setClaimId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Route A
  const [email, setEmail] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState('');
  // Route B
  const [files, setFiles] = useState<File[]>([]);
  const [fullName, setFullName] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [phone, setPhone] = useState('');

  useEffect(() => {
    if (user) sessionStorage.removeItem('postAuthRedirect');
  }, [user]);

  useEffect(() => {
    if (!slug) return;
    supabase.from('restaurants').select('id, name, slug').eq('slug', slug).maybeSingle().then(({ data }) => {
      if (!data) setNotFound(true); else setRestaurant(data);
    });
  }, [slug]);

  useEffect(() => {
    if (!user || !restaurant) return;
    call({ action: 'status', restaurantId: restaurant.id })
      .then((s: Status) => {
        setStatus(s);
        if (s.openClaim) {
          setClaimId(s.openClaim.id);
          if (s.openClaim.manualSubmitted) setRoute('pending');
        }
      })
      .catch((e) => toast.error(e.message));
  }, [user, restaurant]);

  if (!authLoading && !user) {
    return <Navigate to={`/login?tab=signup&redirect=${encodeURIComponent(`/claim/${slug}`)}`} replace />;
  }

  const ensureClaim = async (claimRoute: 'email' | 'manual') => {
    if (claimId) return claimId;
    if (!restaurant) throw new Error('Restaurant niet gevonden');
    sendAnalyticsEvent('claim_start', { restaurant_slug: restaurant.slug, route: claimRoute });
    const r = await call({ action: 'start_claim', restaurantId: restaurant.id });
    setClaimId(r.claimId);
    return r.claimId as string;
  };

  const sendCode = async () => {
    setBusy(true);
    try {
      const id = await ensureClaim('email');
      await call({ action: 'send_domain_code', claimId: id, email: email.trim().toLowerCase() });
      setCodeSent(true);
      toast.success(`Code verstuurd naar ${email.trim()}`);
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };

  const verifyCode = async () => {
    setBusy(true);
    try {
      await call({ action: 'verify_domain_code', claimId, code });
      setRoute('done');
      sendAnalyticsEvent('claim_submitted', { restaurant_slug: restaurant?.slug || '', route: 'email' });
      toast.success('Gelukt! Je bent nu de geverifieerde eigenaar.');
      setTimeout(() => navigate('/owner-dashboard?welcome=1'), 1200);
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };

  const submitManual = async () => {
    if (!files.length) { toast.error('Upload minimaal één bewijsstuk'); return; }
    setBusy(true);
    try {
      const id = await ensureClaim('manual');
      const paths: string[] = [];
      for (const f of files.slice(0, 5)) {
        const ext = (f.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '');
        const path = `${user!.id}/${id}/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage.from('claim-proofs').upload(path, f, { contentType: f.type });
        if (error) throw new Error(`Uploaden mislukt: ${error.message}`);
        paths.push(path);
      }
      await call({ action: 'submit_manual', claimId: id, files: paths, fullName, jobTitle, phone });
      sendAnalyticsEvent('claim_submitted', { restaurant_slug: restaurant?.slug || '', route: 'manual' });
      setRoute('pending');
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };

  const loading = !restaurant || !status;
  const alreadyClaimed = status && status.claimStatus === 'verified_owner' && !status.isOwner;

  return (
    <Layout>
      <SEOHead title="Restaurant claimen | Dishloopr" description="Claim je restaurant gratis op Dishloopr." noindex />
      <div className="container max-w-xl py-8 px-4 space-y-6">
        <Link to={restaurant ? `/restaurant/${restaurant.slug}` : '/'} className="inline-flex items-center gap-1 min-h-11 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Terug naar restaurant
        </Link>

        {notFound ? (
          <p>Restaurant niet gevonden.</p>
        ) : loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : (
          <>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">{restaurant.name} claimen</h1>
              <p className="text-muted-foreground mt-1">Gratis. Kies hoe je laat zien dat dit jouw restaurant is.</p>
            </div>

            {status.isOwner ? (
              <Card><CardContent className="p-6 space-y-3">
                <CheckCircle2 className="h-8 w-8 text-primary" />
                <p className="font-semibold">Je bent al de geverifieerde eigenaar.</p>
                <Button asChild><Link to="/owner-dashboard">Naar je dashboard</Link></Button>
              </CardContent></Card>
            ) : alreadyClaimed ? (
              <Card><CardContent className="p-6 space-y-3">
                <ShieldAlert className="h-8 w-8 text-destructive" />
                <p className="font-semibold">Dit restaurant is al geclaimd.</p>
                <p className="text-sm text-muted-foreground">Onterecht? <Link to="/contact" className="text-primary underline">Neem contact op</Link>.</p>
              </CardContent></Card>
            ) : route === 'pending' ? (
              <Card><CardContent className="p-6 space-y-3">
                <Clock className="h-8 w-8 text-primary" />
                <p className="font-semibold">Aanvraag ontvangen</p>
                <p className="text-muted-foreground">We controleren je aanvraag binnen 2 werkdagen. Je krijgt een e-mail zodra we hem hebben beoordeeld.</p>
              </CardContent></Card>
            ) : route === 'done' ? (
              <Card><CardContent className="p-6 space-y-3">
                <CheckCircle2 className="h-8 w-8 text-primary" />
                <p className="font-semibold">Je bent nu de eigenaar. We sturen je door naar je dashboard…</p>
              </CardContent></Card>
            ) : route === 'choose' ? (
              <div className="grid gap-4">
                <button
                  type="button"
                  disabled={!status.websiteDomain}
                  onClick={() => setRoute('email')}
                  className="text-left rounded-lg border bg-card p-5 hover:border-primary transition disabled:opacity-50 disabled:hover:border-border"
                >
                  <Mail className="h-6 w-6 text-primary mb-2" />
                  <p className="font-semibold">Direct via zakelijk e-mailadres</p>
                  <p className="text-sm text-muted-foreground">
                    {status.websiteDomain
                      ? <>We sturen een code naar een adres dat eindigt op <strong>@{status.websiteDomain}</strong>. Binnen een paar minuten klaar.</>
                      : 'Niet beschikbaar: dit restaurant heeft geen website bij ons.'}
                  </p>
                </button>
                <button type="button" onClick={() => setRoute('manual')} className="text-left rounded-lg border bg-card p-5 hover:border-primary transition">
                  <FileUp className="h-6 w-6 text-primary mb-2" />
                  <p className="font-semibold">Handmatig met bewijsstuk</p>
                  <p className="text-sm text-muted-foreground">Geen mailadres op je eigen domein (bijv. gmail)? Upload een KvK-uittreksel of een foto van een factuur of menukaart met de restaurantnaam. We controleren binnen 2 werkdagen.</p>
                </button>
              </div>
            ) : route === 'email' ? (
              <Card><CardContent className="p-6 space-y-4">
                {!codeSent ? (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="claim-email">Zakelijk e-mailadres</Label>
                      <Input id="claim-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={`info@${status.websiteDomain}`} />
                      <p className="text-xs text-muted-foreground">Moet eindigen op @{status.websiteDomain}</p>
                    </div>
                    <Button className="w-full" onClick={sendCode} disabled={busy || !email.includes('@')}>
                      {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Stuur code
                    </Button>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-muted-foreground">We hebben een 6-cijferige code gestuurd naar <strong className="text-foreground">{email}</strong>. De code is 15 minuten geldig. Kijk ook in je spam.</p>
                    <div className="space-y-2">
                      <Label htmlFor="claim-code">Code</Label>
                      <Input id="claim-code" inputMode="numeric" value={code} maxLength={6}
                        onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        className="font-mono text-lg tracking-[0.5em] text-center" placeholder="123456" />
                    </div>
                    <Button className="w-full" onClick={verifyCode} disabled={busy || code.length !== 6}>
                      {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Bevestigen
                    </Button>
                    <button type="button" onClick={sendCode} disabled={busy} className="block mx-auto min-h-11 text-sm text-muted-foreground underline">Nieuwe code sturen</button>
                  </>
                )}
                <Button variant="ghost" className="w-full" onClick={() => { setRoute('choose'); setCodeSent(false); }}>Andere methode kiezen</Button>
              </CardContent></Card>
            ) : (
              <Card><CardContent className="p-6 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="proof">Bewijsstuk (KvK-uittreksel, factuur of menukaart)</Label>
                  <label htmlFor="proof" className="flex items-center gap-2 rounded-md border border-dashed p-4 cursor-pointer text-sm text-muted-foreground hover:border-primary">
                    <Upload className="h-4 w-4" /> {files.length ? files.map((f) => f.name).join(', ') : 'Kies bestanden (max 5, tot 10 MB)'}
                  </label>
                  <input id="proof" type="file" multiple accept="image/*,application/pdf" className="sr-only"
                    onChange={(e) => setFiles(Array.from(e.target.files || []).slice(0, 5))} />
                </div>
                <div className="space-y-2"><Label htmlFor="fullname">Je naam</Label><Input id="fullname" value={fullName} onChange={(e) => setFullName(e.target.value)} /></div>
                <div className="space-y-2"><Label htmlFor="jobtitle">Functie</Label><Input id="jobtitle" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} placeholder="Eigenaar, bedrijfsleider…" /></div>
                <div className="space-y-2"><Label htmlFor="phone">Telefoonnummer</Label><Input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+31 6 12345678" /></div>
                <Button className="w-full" onClick={submitManual} disabled={busy || !fullName || !jobTitle || !phone || !files.length}>
                  {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Aanvraag versturen
                </Button>
                <Button variant="ghost" className="w-full" onClick={() => setRoute('choose')}>Andere methode kiezen</Button>
              </CardContent></Card>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}
