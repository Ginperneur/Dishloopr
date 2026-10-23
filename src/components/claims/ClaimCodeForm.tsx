import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export type ClaimCodeState = { id: string; email: string; sentAt: string | null; attempts: number; expiresAt: string | null };

export async function claimCall(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('verify-claim', { body });
  if (error) {
    let message = error.message;
    try { const detail = await error.context?.json(); if (detail?.error) message = detail.error; } catch { /* transport failure */ }
    throw new Error(message);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

export function ClaimCodeForm({ initial, onVerified }: { initial: ClaimCodeState; onVerified: () => void }) {
  const [state, setState] = useState(initial);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { setState(initial); }, [initial]);
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  const wait = state.sentAt ? Math.max(0, Math.ceil((Date.parse(state.sentAt) + 60000 - now) / 1000)) : 0;
  const blocked = state.attempts >= 5 || (state.expiresAt !== null && Date.parse(state.expiresAt) < now);
  const verify = async () => {
    setBusy(true); setError('');
    try { await claimCall({ action: 'verify_domain_code', claimId: state.id, code }); onVerified(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Bevestigen mislukt');
      try { const data = await claimCall({ action: 'code_status', claimId: state.id }); setState(data); } catch { /* keep error */ }
    } finally { setBusy(false); }
  };
  const resend = async () => {
    setBusy(true); setError('');
    try { const data = await claimCall({ action: 'send_domain_code', claimId: state.id, email: state.email });
      setState({ ...state, sentAt: data.sentAt, expiresAt: data.expiresAt, attempts: 0 }); setCode(''); setNow(Date.now());
    } catch (e) { setError(e instanceof Error ? e.message : 'Versturen mislukt'); } finally { setBusy(false); }
  };
  return <div className="space-y-4 text-left">
    <h2 className="text-lg font-semibold">Vul je code in</h2>
    <p className="text-sm text-muted-foreground">Code verstuurd naar {state.email}. De code is 30 minuten geldig.</p>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {blocked && <p className="text-sm text-destructive">Vraag een nieuwe code aan om verder te gaan.</p>}
    <Label>Code<Input aria-label="Code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} /></Label>
    <Button onClick={verify} disabled={busy || blocked || code.length !== 6}>Bevestigen</Button>
    <Button variant="outline" onClick={resend} disabled={busy || wait > 0 || !state.email}>Code opnieuw sturen{wait > 0 ? ` (${wait}s)` : ''}</Button>
  </div>;
}