import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, FileText, Loader2, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';

interface OpenClaim {
  id: string;
  user_id: string;
  status: string;
  verification_method: string | null;
  verification_proof: any;
  created_at: string;
  restaurant: { id: string; name: string; slug: string; website_url: string | null } | null;
  fileUrls: { path: string; url: string | null }[];
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
    const rows = await Promise.all((data || []).map(async (c: any) => {
      const files: string[] = c.verification_proof?.files || [];
      const fileUrls = await Promise.all(files.map(async (path) => {
        const { data: s } = await supabase.storage.from('claim-proofs').createSignedUrl(path, 3600);
        return { path, url: s?.signedUrl ?? null };
      }));
      return { ...c, fileUrls } as OpenClaim;
    }));
    setClaims(rows);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

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
              <div className="flex flex-wrap gap-2">
                {c.fileUrls.map((f, i) => (
                  <a key={f.path} href={f.url ?? '#'} target="_blank" rel="noreferrer"
                    className="inline-flex items-center gap-1 min-h-11 px-3 rounded-md border text-sm hover:border-primary">
                    <FileText className="h-4 w-4" /> Bewijsstuk {i + 1}
                  </a>
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
    </div>
  );
}
