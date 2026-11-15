import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Loader2, LogOut } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PasswordStrengthMeter, type PasswordCheck } from '@/components/auth/PasswordStrengthMeter';

function authErrorMessage(error: { message?: string; code?: string; status?: number }): string {
  const m = error.message ?? '';
  if (error.code === 'weak_password' || /pwned|leaked|weak|at least \d+ characters/i.test(m)) return 'Dit wachtwoord is niet sterk genoeg of komt voor in gelekte lijsten. Kies een ander.';
  if (error.code === 'same_password' || /different from the old/i.test(m)) return 'Dit is je huidige wachtwoord. Kies een nieuw wachtwoord.';
  if (error.code === 'email_exists' || /already (been )?registered/i.test(m)) return 'Dit e-mailadres hoort al bij een ander account.';
  if (error.status === 429 || /rate limit|too many/i.test(m)) return 'Te veel pogingen. Wacht een paar minuten en probeer het opnieuw.';
  if (error.code === 'reauthentication_needed' || /reauthenticat/i.test(m)) return 'Log voor de zekerheid opnieuw in en probeer het dan nog eens.';
  return m ? `Dat lukte niet: ${m}` : 'Dat lukte niet. Probeer het opnieuw.';
}

/** Name, e-mail address, password and sign-out for the owner, inside the dashboard. */
export function AccountSettings({ onNameSaved }: { onNameSaved?: (name: string) => void }) {
  const { user, signOut, updatePassword } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [savedName, setSavedName] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [email, setEmail] = useState(user?.email ?? '');
  const [savingEmail, setSavingEmail] = useState(false);
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [check, setCheck] = useState<PasswordCheck | null>(null);
  const [savingPw, setSavingPw] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from('profiles').select('name').eq('id', user.id).maybeSingle();
      const n = data?.name ?? (user.user_metadata?.name as string | undefined) ?? '';
      setName(n); setSavedName(n);
    })();
  }, [user]);

  if (!user) return null;

  const saveName = async () => {
    const n = name.trim();
    if (n.length < 2) { toast.error('Vul je naam in.'); return; }
    setSavingName(true);
    const { error } = await supabase.from('profiles').update({ name: n.slice(0, 100) }).eq('id', user.id);
    if (!error) await supabase.auth.updateUser({ data: { name: n.slice(0, 100) } });
    setSavingName(false);
    if (error) { toast.error('Naam opslaan lukte niet.'); return; }
    setSavedName(n);
    onNameSaved?.(n);
    toast.success('Naam opgeslagen');
  };

  const saveEmail = async () => {
    const e = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) { toast.error('Vul een geldig e-mailadres in.'); return; }
    setSavingEmail(true);
    const { error } = await supabase.auth.updateUser({ email: e });
    setSavingEmail(false);
    if (error) { toast.error(authErrorMessage(error)); return; }
    toast.success('Check je mail', { description: `We stuurden een bevestigingslink naar ${e}. Pas na het klikken wordt je e-mailadres aangepast.`, duration: 10000 });
  };

  const savePassword = async () => {
    if (pw.length < 8) { toast.error('Kies een wachtwoord van minimaal 8 tekens.'); return; }
    if (pw !== pw2) { toast.error('De wachtwoorden zijn niet gelijk.'); return; }
    if (check?.pwned) { toast.error('Dit wachtwoord komt voor in gelekte wachtwoordlijsten. Kies een ander.'); return; }
    setSavingPw(true);
    const { error } = await updatePassword(pw);
    setSavingPw(false);
    if (error) { toast.error(authErrorMessage(error)); return; }
    setPw(''); setPw2('');
    toast.success('Wachtwoord gewijzigd');
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Je gegevens</CardTitle>
          <CardDescription>Je naam gebruiken we in het dashboard en in mails van Dishloopr.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="account-name">Naam</Label>
            <div className="flex gap-2">
              <Input id="account-name" autoComplete="name" value={name} onChange={e => setName(e.target.value)} className="min-h-11" />
              <Button variant="outline" onClick={saveName} disabled={savingName || name.trim() === savedName} className="min-h-11">
                {savingName && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Opslaan
              </Button>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="account-email">E-mailadres</Label>
            <div className="flex gap-2">
              <Input id="account-email" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} className="min-h-11" />
              <Button variant="outline" onClick={saveEmail} disabled={savingEmail || email.trim().toLowerCase() === (user.email ?? '').toLowerCase()} className="min-h-11">
                {savingEmail && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Wijzigen
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Je krijgt eerst een bevestigingsmail op het nieuwe adres.</p>
          </div>
          <div className="flex flex-wrap gap-2 border-t pt-5">
            <Button variant="outline" className="min-h-11" onClick={async () => { await signOut(); navigate('/'); }}>
              <LogOut className="mr-2 h-4 w-4" />Uitloggen
            </Button>
            <Button variant="ghost" className="min-h-11 text-muted-foreground" asChild>
              <Link to="/account">Account verwijderen</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Wachtwoord wijzigen</CardTitle>
          <CardDescription>Minimaal 8 tekens. Gelekte wachtwoorden worden geweigerd.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="account-pw">Nieuw wachtwoord</Label>
            <Input id="account-pw" type="password" autoComplete="new-password" value={pw} onChange={e => setPw(e.target.value)} className="min-h-11" />
            <PasswordStrengthMeter id="account-pw-strength" password={pw} context={[name, (user.email ?? '').split('@')[0]]} onCheck={setCheck} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="account-pw2">Herhaal wachtwoord</Label>
            <Input id="account-pw2" type="password" autoComplete="new-password" value={pw2} onChange={e => setPw2(e.target.value)} className="min-h-11" />
          </div>
          <Button onClick={savePassword} disabled={savingPw || !pw} className="min-h-11">
            {savingPw && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Wachtwoord opslaan
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
