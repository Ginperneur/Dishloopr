import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Download, FileText, Loader2, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface OpenClaim {
  id: string;
  user_id: string;
  status: string;
  verification_method: string | null;
  verification_proof: any;
  created_at: string;
  restaurant: { id: string; name: string; slug: string; website_url: string | null } | null;
  files: string[];
}

export function ClaimReviewQueue({ onUpdate }: { onUpdate?: () => void }) {
  const [claims, setClaims] = useState<OpenClaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectFor, setRejectFor] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('restaurant_claims')
      .select('id, user_id, status, verification_method, verification_proof, created_at, restaurant:restaurants(id, name, slug, website_url)')
      .eq('verification_method', 'manual_proof' as any)
      .eq('status', 'pending')
      .order('created_at', { ascending: true });
    if (error) { toast.error(error.message); setLoading(false); return; }
    const rows = (data || []).map((c: any) => ({ ...c, files: c.verification_proof?.files || [] }) as OpenClaim);
    setClaims(rows);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Proofs open inside the admin from a blob URL. A new tab to the storage domain is often
  // blocked by ad or privacy extensions (ERR_BLOCKED_BY_CLIENT); an in-app download is not.
  const [proof, setProof] = useState<{ title: string; url: string; type: string; filename: string } | null>(null);
  const [proofBusy, setProofBusy] = useState<string | null>(null);
  const openProof = async (path: string, title: string) => {
    setProofBusy(path);
    const { data, error } = await supabase.storage.from('claim-proofs').download(path);
    setProofBusy(null);
    if (error || !data) { toast.error(`Bewijsstuk openen lukte niet${error ? `: ${error.message}` : ''}`); return; }
    setProof({ title, url: URL.createObjectURL(data), type: data.type, filename: path.split('/').pop() || 'bewijsstuk' });
  };
  const closeProof = () => { if (proof) URL.revokeObjectURL(proof.url); setProof(null); };

  const act = async (claimId: string, action: 'admin_approve' | 'admin_reject') => {
    setBusyId(claimId);
    try {
      const { data, error } = await supabase.functions.invoke('verify-claim', {
        body: { action, claimId, reason: action === 'admin_reject' ? reason : undefined },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success(action === 'admin_approve' ? 'Claim goedgekeurd' : 'Claim afgewezen');
      setRejectFor(null); setReason('');
      await load(); onUpdate?.();
    } catch (e: any) { toast.error(e.message || 'Mislukt'); } finally { setBusyId(null); }
  };

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (!claims.length) return <p className="text-muted-foreground py-6">Geen openstaande aanvragen met bewijsstukken.</p>;

  return (
    <div className="space-y-4">
      {claims.map((c) => {
        const p = c.verification_proof || {};
        return (
          <Card key={c.id}>
            <CardContent className="p-5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  {c.restaurant ? (
                    <Link to={`/restaurant/${c.restaurant.slug}`} className="font-semibold hover:underline">{c.restaurant.name}</Link>
                  ) : <span className="font-semibold">Onbekend restaurant</span>}
                  <p className="text-xs text-muted-foreground">Ingediend {new Date(p.submitted_at || c.created_at).toLocaleString('nl-NL')}</p>
                </div>
                <Badge variant="secondary">Handmatig</Badge>
              </div>
              <div className="text-sm grid sm:grid-cols-3 gap-2">
                <div><span className="text-muted-foreground">Naam: </span>{p.full_name}</div>
                <div><span className="text-muted-foreground">Functie: </span>{p.job_title}</div>
                <div><span className="text-muted-foreground">Telefoon: </span>{p.phone}</div>
              </div>
              {p.ai_screening && (
                <div className={`rounded-md border p-3 text-sm ${p.ai_screening.verdict === 'auto_approve' ? 'border-green-500/40 bg-green-500/5' : 'border-orange-500/30 bg-orange-500/5'}`}>
                  <p className="font-medium">
                    AI-check: {({ kvk_extract: 'KvK-uittreksel', invoice: 'factuur', menu: 'menukaart', other: 'ander document' } as Record<string, string>)[p.ai_screening.doc_type] ?? p.ai_screening.doc_type}
                    {' '}({Math.round((p.ai_screening.confidence ?? 0) * 100)}% zeker)
                  </p>
                  <ul className="mt-1 grid gap-0.5 sm:grid-cols-2">
                    {([['name', 'Bedrijfsnaam'], ['postal_code', 'Postcode'], ['house_number', 'Huisnummer'], ['claimant_listed', 'Aanvrager op document']] as const).map(([k, label]) => (
                      <li key={k}>{p.ai_screening.checks?.[k] ? '✓' : '✗'} {label}</li>
                    ))}
                  </ul>
                  {p.ai_screening.business_names?.length > 0 && <p className="mt-1 text-xs text-muted-foreground">Op document: {p.ai_screening.business_names.join(', ')}{p.ai_screening.persons?.length ? ` · ${p.ai_screening.persons.join(', ')}` : ''}{p.ai_screening.kvk_number ? ` · KvK ${p.ai_screening.kvk_number}` : ''}</p>}
                  {p.ai_screening.notes && <p className="mt-1 text-xs text-muted-foreground">{p.ai_screening.notes}</p>}
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                {c.files.map((path, i) => (
                  <Button key={path} type="button" variant="outline" className="min-h-11 gap-1" disabled={proofBusy === path}
                    onClick={() => openProof(path, `${c.restaurant?.name ?? 'Claim'}: bewijsstuk ${i + 1}`)}>
                    {proofBusy === path ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />} Bewijsstuk {i + 1}
                  </Button>
                ))}
              </div>
              {rejectFor === c.id ? (
                <div className="space-y-2">
                  <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reden van afwijzing (wordt naar de aanvrager gemaild)" />
                  <div className="flex gap-2">
                    <Button variant="destructive" disabled={!reason.trim() || busyId === c.id} onClick={() => act(c.id, 'admin_reject')}>Afwijzen bevestigen</Button>
                    <Button variant="ghost" onClick={() => setRejectFor(null)}>Annuleren</Button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Button disabled={busyId === c.id} onClick={() => act(c.id, 'admin_approve')}>
                    {busyId === c.id ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />} Goedkeuren
                  </Button>
                  <Button variant="outline" onClick={() => { setRejectFor(c.id); setReason(''); }}>
                    <XCircle className="h-4 w-4 mr-2" /> Afwijzen
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
      <Dialog open={proof !== null} onOpenChange={o => { if (!o) closeProof(); }}>
        <DialogContent className="max-w-4xl">
          <DialogHeader><DialogTitle>{proof?.title}</DialogTitle></DialogHeader>
          {proof && (proof.type.startsWith('image/') ? (
            <img src={proof.url} alt={proof.title} className="max-h-[70vh] w-full rounded-md object-contain" />
          ) : proof.type === 'application/pdf' ? (
            <iframe src={proof.url} title={proof.title} className="h-[70vh] w-full rounded-md border" />
          ) : (
            <p className="text-sm text-muted-foreground">Dit bestandstype kan hier niet worden getoond. Download het om het te bekijken.</p>
          ))}
          {proof && (
            <Button asChild variant="outline" className="min-h-11 w-fit gap-2">
              <a href={proof.url} download={proof.filename}><Download className="h-4 w-4" /> Downloaden</a>
            </Button>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
