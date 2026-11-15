import { useCallback, useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { LifeBuoy, Loader2, Send } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CONTACT_CATEGORIES, CONTACT_STATUS_LABEL, type ContactMessage } from '@/lib/contactMessages';

// The new contact columns are newer than the generated types.
const db = supabase as unknown as SupabaseClient;

/** Owners send a question, problem, complaint or billing issue to Dishloopr and follow its status. */
export function OwnerContactCard({ restaurantId, restaurantName }: { restaurantId?: string; restaurantName?: string }) {
  const { user } = useAuth();
  const [category, setCategory] = useState('vraag');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [history, setHistory] = useState<ContactMessage[]>([]);

  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await db.from('contact_messages')
      .select('id, category, subject, message, status, created_at, restaurant_id')
      .eq('user_id', user.id).order('created_at', { ascending: false }).limit(5);
    setHistory((data ?? []) as ContactMessage[]);
  }, [user]);
  useEffect(() => { void load(); }, [load]);

  const send = async () => {
    if (!user?.email) return;
    if (subject.trim().length < 3 || message.trim().length < 10) {
      toast.error('Vul een onderwerp en een bericht van minimaal 10 tekens in.');
      return;
    }
    setSending(true);
    const name = (user.user_metadata?.name as string | undefined) || user.email;
    const { error } = await db.from('contact_messages').insert({
      name: name.slice(0, 100),
      email: user.email,
      subject: `${restaurantName ? `[${restaurantName}] ` : ''}${subject.trim()}`.slice(0, 200),
      message: message.trim().slice(0, 5000),
      category,
      restaurant_id: restaurantId ?? null,
      user_id: user.id,
    });
    setSending(false);
    if (error) { toast.error('Versturen lukte niet. Probeer het opnieuw of mail info@dishloopr.com.'); return; }
    toast.success('Verstuurd. We reageren meestal binnen 1 werkdag per mail.');
    setSubject(''); setMessage(''); setCategory('vraag');
    void load();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base"><LifeBuoy className="h-5 w-5 text-primary" />Hulp en contact</CardTitle>
        <CardDescription>
          Een vraag, iets dat niet werkt, een klacht of iets met je factuur? Stuur het hier, dan reageren we meestal binnen 1 werkdag per mail.
          Voor snelle vragen kun je ook de chat rechtsonder gebruiken.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-[220px_1fr]">
          <div className="space-y-1.5">
            <Label htmlFor="contact-category">Soort bericht</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger id="contact-category" className="min-h-11"><SelectValue /></SelectTrigger>
              <SelectContent>
                {CONTACT_CATEGORIES.map(c => <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="contact-subject">Onderwerp</Label>
            <Input id="contact-subject" className="min-h-11" value={subject} maxLength={150} onChange={e => setSubject(e.target.value)} placeholder="Waar gaat het over?" />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="contact-message">Bericht</Label>
          <Textarea id="contact-message" rows={5} value={message} maxLength={5000} onChange={e => setMessage(e.target.value)}
            placeholder="Vertel zo concreet mogelijk wat er speelt. Gaat het om een fout, zet er dan bij wat je deed en wat je zag." />
        </div>
        <Button onClick={send} disabled={sending} className="min-h-11">
          {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}Versturen
        </Button>

        {history.length > 0 && (
          <div className="space-y-2 border-t pt-4">
            <p className="text-sm font-medium">Je recente berichten</p>
            {history.map(h => (
              <div key={h.id} className="flex items-start justify-between gap-3 rounded-md border p-3 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium">{h.subject}</p>
                  <p className="text-xs text-muted-foreground">
                    {CONTACT_CATEGORIES.find(c => c.id === h.category)?.label ?? 'Bericht'} · {new Date(h.created_at).toLocaleDateString('nl-NL')}
                  </p>
                </div>
                <Badge variant={h.status === 'afgehandeld' ? 'secondary' : 'default'} className="shrink-0">{CONTACT_STATUS_LABEL[h.status] ?? h.status}</Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
