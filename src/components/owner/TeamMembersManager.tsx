import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Users, UserPlus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { OwnerEmptyState } from '@/components/owner/OwnerEmptyState';

interface Member {
  id: string; invited_email: string; role: string; status: string; invited_at: string; accepted_at: string | null;
}

export function TeamMembersManager({ restaurantId }: { restaurantId: string }) {
  const { user } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('staff');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await (supabase as any).from('restaurant_team_members')
      .select('*').eq('restaurant_id', restaurantId).order('invited_at', { ascending: false });
    setMembers(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [restaurantId]);

  const invite = async () => {
    if (!email.includes('@')) { toast.error('Vul een geldig e-mailadres in'); return; }
    const { error } = await (supabase as any).from('restaurant_team_members').insert({
      restaurant_id: restaurantId,
      invited_email: email.toLowerCase().trim(),
      role,
      invited_by: user!.id,
    });
    if (error) {
      if (error.code === '23505') toast.error('Deze persoon is al uitgenodigd');
      else toast.error('Uitnodigen mislukt');
      return;
    }
    toast.success('Uitnodiging aangemaakt');
    setEmail('');
    load();
  };

  const remove = async (id: string) => {
    if (!confirm('Lid verwijderen?')) return;
    await (supabase as any).from('restaurant_team_members').delete().eq('id', id);
    toast.success('Verwijderd');
    load();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="h-5 w-5 text-primary" /> Team-leden
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-2">
          <Input type="email" placeholder="naam@restaurant.nl" value={email} onChange={(e) => setEmail(e.target.value)} className="flex-1" />
          <Select value={role} onValueChange={setRole}>
            <SelectTrigger className="sm:w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="staff">Medewerker</SelectItem>
              <SelectItem value="manager">Manager</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={invite}><UserPlus className="h-4 w-4 mr-1" />Uitnodigen</Button>
        </div>
        {loading ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Laden…</p>
         ) : members.length === 0 ? (
          <OwnerEmptyState
            compact
            icon={UserPlus}
            title="Nog geen team-leden"
            description="Nodig collega's uit om samen reviews en menu's te beheren."
          />
        ) : (
          <ul className="divide-y border rounded-md">
            {members.map((m) => (
              <li key={m.id} className="flex items-center justify-between p-3">
                <div>
                  <div className="font-medium text-sm">{m.invited_email}</div>
                  <div className="flex gap-2 mt-1">
                    <Badge variant="outline" className="text-xs">{m.role === 'manager' ? 'Manager' : 'Medewerker'}</Badge>
                    <Badge variant={m.status === 'accepted' ? 'default' : 'secondary'} className="text-xs">
                      {m.status === 'accepted' ? 'Actief' : 'Uitnodiging open'}
                    </Badge>
                  </div>
                </div>
                <Button size="icon" variant="ghost" onClick={() => remove(m.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-muted-foreground">
          Tip: deel de inlog-link met je team. Uitgenodigde gebruikers krijgen toegang nadat ze met dit e-mailadres inloggen.
        </p>
      </CardContent>
    </Card>
  );
}