import { useState, useEffect } from 'react';
import { 
  Crown, 
  Search, 
  Shield, 
  ShieldCheck,
  User,
  Store,
  Plus,
  Trash2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useActivityLog } from '@/hooks/useActivityLog';

interface UserRole {
  id: string;
  user_id: string;
  role: 'user' | 'owner' | 'admin' | 'moderator';
  created_at: string;
  profiles?: {
    name: string | null;
    email: string | null;
  };
}

interface UserRolesManagerProps {
  users: any[];
  onUpdate?: () => void;
}

const ROLE_INFO = {
  user: { label: 'Gebruiker', icon: User, color: 'bg-blue-500/10 text-blue-600' },
  owner: { label: 'Eigenaar', icon: Store, color: 'bg-purple-500/10 text-purple-600' },
  moderator: { label: 'Moderator', icon: ShieldCheck, color: 'bg-amber-500/10 text-amber-600' },
  admin: { label: 'Admin', icon: Shield, color: 'bg-red-500/10 text-red-600' }
};

export function UserRolesManager({ users, onUpdate }: UserRolesManagerProps) {
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedRole, setSelectedRole] = useState<'user' | 'owner' | 'admin' | 'moderator'>('owner');
  const { logActivity } = useActivityLog();

  useEffect(() => {
    fetchRoles();
  }, []);

  const fetchRoles = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('user_roles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      toast.error('Fout bij ophalen rollen');
    } else {
      // Map roles with user info from the users prop
      const rolesWithProfiles = (data || []).map(role => {
        const userProfile = users.find(u => u.id === role.user_id);
        return {
          ...role,
          profiles: userProfile ? { name: userProfile.name, email: userProfile.email } : undefined
        };
      });
      setRoles(rolesWithProfiles);
    }
    setLoading(false);
  };

  const addRole = async () => {
    if (!selectedUserId) {
      toast.error('Selecteer een gebruiker');
      return;
    }

    // Check if user already has this role
    const existingRole = roles.find(r => r.user_id === selectedUserId && r.role === selectedRole);
    if (existingRole) {
      toast.error('Gebruiker heeft deze rol al');
      return;
    }

    const { error } = await supabase
      .from('user_roles')
      .insert({
        user_id: selectedUserId,
        role: selectedRole
      });

    if (error) {
      toast.error('Toevoegen mislukt: ' + error.message);
    } else {
      const userProfile = users.find(u => u.id === selectedUserId);
      await logActivity({
        actionType: 'assign',
        entityType: 'role',
        entityId: selectedUserId,
        entityName: userProfile?.name || userProfile?.email,
        details: { role: selectedRole }
      });
      toast.success('Rol toegevoegd');
      setSelectedUserId('');
      setSelectedRole('owner');
      setIsAddDialogOpen(false);
      fetchRoles();
      onUpdate?.();
    }
  };

  const removeRole = async (id: string, role: string, userName?: string) => {
    if (role === 'admin') {
      // Count remaining admins
      const adminCount = roles.filter(r => r.role === 'admin').length;
      if (adminCount <= 1) {
        toast.error('Kan de laatste admin niet verwijderen');
        return;
      }
    }

    if (!confirm('Weet je zeker dat je deze rol wilt verwijderen?')) return;

    const { error } = await supabase
      .from('user_roles')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error('Verwijderen mislukt: ' + error.message);
    } else {
      await logActivity({
        actionType: 'remove',
        entityType: 'role',
        entityId: id,
        entityName: userName,
        details: { role }
      });
      toast.success('Rol verwijderd');
      setRoles(prev => prev.filter(r => r.id !== id));
      onUpdate?.();
    }
  };

  const filteredRoles = roles.filter(r => {
    const name = r.profiles?.name?.toLowerCase() || '';
    const email = r.profiles?.email?.toLowerCase() || '';
    const query = searchQuery.toLowerCase();
    return name.includes(query) || email.includes(query);
  });

  // Users without special roles (for adding)
  const availableUsers = users.filter(u => 
    !roles.some(r => r.user_id === u.id && r.role === selectedRole)
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Crown className="h-5 w-5" />
              Gebruikersrollen
            </CardTitle>
            <CardDescription>
              {roles.filter(r => r.role === 'admin').length} admins, {' '}
              {roles.filter(r => r.role === 'owner').length} eigenaren
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Zoek gebruikers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  Rol toekennen
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Rol toekennen aan gebruiker</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <div>
                    <Label>Rol</Label>
                    <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v as any)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="owner">
                          <div className="flex items-center gap-2">
                            <Store className="h-4 w-4" />
                            Eigenaar
                          </div>
                        </SelectItem>
                        <SelectItem value="moderator">
                          <div className="flex items-center gap-2">
                            <ShieldCheck className="h-4 w-4" />
                            Moderator
                          </div>
                        </SelectItem>
                        <SelectItem value="admin">
                          <div className="flex items-center gap-2">
                            <Shield className="h-4 w-4" />
                            Admin
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Gebruiker</Label>
                    <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecteer gebruiker..." />
                      </SelectTrigger>
                      <SelectContent>
                        {availableUsers.map(user => (
                          <SelectItem key={user.id} value={user.id}>
                            {user.name || user.email || user.id.slice(0, 8)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                      Annuleren
                    </Button>
                    <Button onClick={addRole}>
                      Toekennen
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Gebruiker</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Toegekend op</TableHead>
                <TableHead className="text-right">Acties</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={5}>
                      <div className="h-10 bg-muted rounded animate-pulse" />
                    </TableCell>
                  </TableRow>
                ))
              ) : filteredRoles.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Geen rollen gevonden
                  </TableCell>
                </TableRow>
              ) : (
                filteredRoles.map(role => {
                  const roleInfo = ROLE_INFO[role.role];
                  const RoleIcon = roleInfo.icon;
                  
                  return (
                    <TableRow key={role.id}>
                      <TableCell className="font-medium">
                        {role.profiles?.name || '(Geen naam)'}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {role.profiles?.email || '-'}
                      </TableCell>
                      <TableCell>
                        <Badge className={`gap-1 ${roleInfo.color}`}>
                          <RoleIcon className="h-3 w-3" />
                          {roleInfo.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(role.created_at).toLocaleDateString('nl-NL')}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => removeRole(role.id, role.role, role.profiles?.name || role.profiles?.email || undefined)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
