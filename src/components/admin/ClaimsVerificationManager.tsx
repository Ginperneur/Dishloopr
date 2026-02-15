import { useState, useEffect } from 'react';
import { 
  Shield, 
  CheckCircle, 
  XCircle, 
  Clock, 
  AlertTriangle,
  Lock,
  Unlock,
  Eye,
  Phone,
  Mail,
  Globe,
  CreditCard,
  RefreshCw,
  Search,
  Filter
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

interface ClaimWithDetails {
  id: string;
  user_id: string;
  restaurant_id: string;
  status: string;
  email_verified: boolean;
  phone_verified: boolean;
  verification_method: string | null;
  verification_completed_at: string | null;
  created_at: string;
  updated_at: string;
  admin_notes: string | null;
  restaurant: {
    name: string;
    slug: string;
    address: string;
    claim_status: string;
  };
  profile: {
    name: string | null;
    email: string | null;
  };
}

interface ActivityLog {
  id: string;
  actor_id: string;
  actor_role: string;
  action_type: string;
  action_category: string;
  restaurant_id: string | null;
  claim_id: string | null;
  created_at: string;
  metadata: any;
}

const statusConfig = {
  pending: { label: 'Wachtend', color: 'bg-yellow-500/10 text-yellow-600', icon: Clock },
  email_verified: { label: 'Email geverifieerd', color: 'bg-blue-500/10 text-blue-600', icon: Mail },
  phone_verified: { label: 'Telefoon geverifieerd', color: 'bg-indigo-500/10 text-indigo-600', icon: Phone },
  verified: { label: 'Geverifieerd', color: 'bg-green-500/10 text-green-600', icon: CheckCircle },
  rejected: { label: 'Afgewezen', color: 'bg-red-500/10 text-red-600', icon: XCircle },
  disputed: { label: 'Betwist', color: 'bg-orange-500/10 text-orange-600', icon: AlertTriangle },
  pending_admin_review: { label: 'Admin review nodig', color: 'bg-purple-500/10 text-purple-600', icon: AlertTriangle },
};

const restaurantStatusConfig = {
  unclaimed: { label: 'Niet geclaimd', color: 'bg-gray-500/10 text-gray-600' },
  claimed_unverified: { label: 'Geclaimd (niet geverifieerd)', color: 'bg-yellow-500/10 text-yellow-600' },
  verified_owner: { label: 'Geverifieerde eigenaar', color: 'bg-green-500/10 text-green-600' },
  disputed: { label: 'Betwist', color: 'bg-orange-500/10 text-orange-600' },
  locked: { label: 'Vergrendeld', color: 'bg-red-500/10 text-red-600' },
};

export function ClaimsVerificationManager() {
  const { user } = useAuth();
  const [claims, setClaims] = useState<ClaimWithDetails[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClaim, setSelectedClaim] = useState<ClaimWithDetails | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [adminNotes, setAdminNotes] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchClaims();
    fetchActivityLogs();
  }, []);

  const fetchClaims = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('restaurant_claims')
        .select(`
          *,
          restaurant:restaurants!restaurant_claims_restaurant_id_fkey (
            name,
            slug,
            address,
            claim_status
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch profiles separately
      const userIds = [...new Set((data || []).map(c => c.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, email')
        .in('id', userIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

      const claimsWithProfiles = (data || []).map(claim => ({
        ...claim,
        profile: profileMap.get(claim.user_id) || { name: null, email: null }
      }));

      setClaims(claimsWithProfiles as ClaimWithDetails[]);
    } catch (error) {
      console.error('Error fetching claims:', error);
      toast.error('Kon claims niet laden');
    } finally {
      setLoading(false);
    }
  };

  const fetchActivityLogs = async () => {
    try {
      const { data, error } = await supabase
        .from('claim_activity_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      setActivityLogs(data || []);
    } catch (error) {
      console.error('Error fetching activity logs:', error);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchClaims(), fetchActivityLogs()]);
    setRefreshing(false);
    toast.success('Data vernieuwd');
  };

  const logActivity = async (
    actionType: string,
    actionCategory: string,
    claimId: string,
    restaurantId: string,
    beforeData?: any,
    afterData?: any
  ) => {
    try {
      await supabase.from('claim_activity_logs').insert({
        actor_id: user?.id,
        actor_role: 'admin',
        action_type: actionType,
        action_category: actionCategory,
        claim_id: claimId,
        restaurant_id: restaurantId,
        before_data: beforeData,
        after_data: afterData,
      });
    } catch (error) {
      console.error('Error logging activity:', error);
    }
  };

  const handleApproveVerification = async (claim: ClaimWithDetails) => {
    setActionLoading(true);
    try {
      const beforeData = { status: claim.status, claim_status: claim.restaurant.claim_status };

      // Update claim status
      await supabase
        .from('restaurant_claims')
        .update({
          status: 'verified',
          verification_completed_at: new Date().toISOString(),
          reviewed_at: new Date().toISOString(),
          reviewed_by: user?.id,
          admin_notes: adminNotes || null,
        })
        .eq('id', claim.id);

      // Update restaurant status
      await supabase
        .from('restaurants')
        .update({
          claim_status: 'verified_owner',
          claimed_by_owner_id: claim.user_id,
        })
        .eq('id', claim.restaurant_id);

      // Add user as primary_owner in restaurant_managers
      await supabase
        .from('restaurant_managers')
        .upsert({
          restaurant_id: claim.restaurant_id,
          user_id: claim.user_id,
          role: 'primary_owner',
          accepted_at: new Date().toISOString(),
        });

      // Update user role to 'owner' if not already
      const { data: existingRole } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', claim.user_id)
        .single();

      if (!existingRole || existingRole.role === 'user') {
        await supabase
          .from('user_roles')
          .upsert({ user_id: claim.user_id, role: 'owner' });
      }

      await logActivity(
        'VERIFY_CLAIM',
        'verification',
        claim.id,
        claim.restaurant_id,
        beforeData,
        { status: 'verified', claim_status: 'verified_owner' }
      );

      toast.success('Claim goedgekeurd! Eigenaar heeft nu volledige toegang.');
      setDetailDialogOpen(false);
      fetchClaims();
    } catch (error) {
      console.error('Error approving claim:', error);
      toast.error('Kon claim niet goedkeuren');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectClaim = async (claim: ClaimWithDetails) => {
    if (!adminNotes.trim()) {
      toast.error('Voeg een reden toe voor afwijzing');
      return;
    }

    setActionLoading(true);
    try {
      const beforeData = { status: claim.status };

      await supabase
        .from('restaurant_claims')
        .update({
          status: 'rejected',
          reviewed_at: new Date().toISOString(),
          reviewed_by: user?.id,
          admin_notes: adminNotes,
        })
        .eq('id', claim.id);

      // Reset restaurant status if this was the only claim
      await supabase
        .from('restaurants')
        .update({ claim_status: 'unclaimed' })
        .eq('id', claim.restaurant_id);

      await logActivity(
        'REJECT_CLAIM',
        'verification',
        claim.id,
        claim.restaurant_id,
        beforeData,
        { status: 'rejected', admin_notes: adminNotes }
      );

      toast.success('Claim afgewezen');
      setDetailDialogOpen(false);
      fetchClaims();
    } catch (error) {
      console.error('Error rejecting claim:', error);
      toast.error('Kon claim niet afwijzen');
    } finally {
      setActionLoading(false);
    }
  };

  const handleLockRestaurant = async (claim: ClaimWithDetails) => {
    setActionLoading(true);
    try {
      const beforeData = { claim_status: claim.restaurant.claim_status };

      await supabase
        .from('restaurants')
        .update({ claim_status: 'locked' })
        .eq('id', claim.restaurant_id);

      await logActivity(
        'LOCK_RESTAURANT',
        'moderation',
        claim.id,
        claim.restaurant_id,
        beforeData,
        { claim_status: 'locked', reason: adminNotes }
      );

      toast.success('Restaurant vergrendeld');
      fetchClaims();
    } catch (error) {
      console.error('Error locking restaurant:', error);
      toast.error('Kon restaurant niet vergrendelen');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnlockRestaurant = async (claim: ClaimWithDetails) => {
    setActionLoading(true);
    try {
      const beforeData = { claim_status: claim.restaurant.claim_status };

      await supabase
        .from('restaurants')
        .update({ claim_status: 'unclaimed' })
        .eq('id', claim.restaurant_id);

      await logActivity(
        'UNLOCK_RESTAURANT',
        'moderation',
        claim.id,
        claim.restaurant_id,
        beforeData,
        { claim_status: 'unclaimed' }
      );

      toast.success('Restaurant ontgrendeld');
      fetchClaims();
    } catch (error) {
      console.error('Error unlocking restaurant:', error);
      toast.error('Kon restaurant niet ontgrendelen');
    } finally {
      setActionLoading(false);
    }
  };

  const handleMarkDisputed = async (claim: ClaimWithDetails) => {
    setActionLoading(true);
    try {
      const beforeData = { claim_status: claim.restaurant.claim_status, status: claim.status };

      await supabase
        .from('restaurants')
        .update({ claim_status: 'disputed' })
        .eq('id', claim.restaurant_id);

      await supabase
        .from('restaurant_claims')
        .update({ status: 'disputed' })
        .eq('id', claim.id);

      await logActivity(
        'MARK_DISPUTED',
        'dispute',
        claim.id,
        claim.restaurant_id,
        beforeData,
        { claim_status: 'disputed', reason: adminNotes }
      );

      toast.success('Restaurant gemarkeerd als betwist');
      fetchClaims();
    } catch (error) {
      console.error('Error marking disputed:', error);
      toast.error('Kon niet markeren als betwist');
    } finally {
      setActionLoading(false);
    }
  };

  const filteredClaims = claims.filter(claim => {
    if (statusFilter !== 'all' && claim.status !== statusFilter) return false;
    if (searchQuery) {
      const search = searchQuery.toLowerCase();
      return (
        claim.restaurant?.name?.toLowerCase().includes(search) ||
        claim.profile?.name?.toLowerCase().includes(search) ||
        claim.profile?.email?.toLowerCase().includes(search)
      );
    }
    return true;
  });

  const getStatusBadge = (status: string) => {
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
    const Icon = config.icon;
    return (
      <Badge className={config.color}>
        <Icon className="h-3 w-3 mr-1" />
        {config.label}
      </Badge>
    );
  };

  const getRestaurantStatusBadge = (status: string) => {
    const config = restaurantStatusConfig[status as keyof typeof restaurantStatusConfig] || restaurantStatusConfig.unclaimed;
    return <Badge className={config.color}>{config.label}</Badge>;
  };

  const getVerificationMethodIcon = (method: string | null) => {
    switch (method) {
      case 'micro_payment': return <CreditCard className="h-4 w-4" />;
      case 'dns_txt':
      case 'html_file': return <Globe className="h-4 w-4" />;
      case 'google_business': return <Globe className="h-4 w-4" />;
      default: return null;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-muted rounded w-1/3" />
            <div className="h-64 bg-muted rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Claims & Verificatie Beheer
              </CardTitle>
              <CardDescription>
                Beheer restaurant claims, verificaties en disputes
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              Vernieuwen
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="claims">
            <TabsList className="mb-4">
              <TabsTrigger value="claims">Claims ({claims.length})</TabsTrigger>
              <TabsTrigger value="activity">Activiteit Log</TabsTrigger>
            </TabsList>

            <TabsContent value="claims">
              <div className="flex flex-wrap gap-3 mb-4">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Zoek op restaurant of gebruiker..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[180px]">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Filter status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle statussen</SelectItem>
                    <SelectItem value="pending">Wachtend</SelectItem>
                    <SelectItem value="email_verified">Email geverifieerd</SelectItem>
                    <SelectItem value="phone_verified">Telefoon geverifieerd</SelectItem>
                    <SelectItem value="verified">Geverifieerd</SelectItem>
                    <SelectItem value="rejected">Afgewezen</SelectItem>
                    <SelectItem value="disputed">Betwist</SelectItem>
                    <SelectItem value="pending_admin_review">Admin review nodig</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Restaurant</TableHead>
                      <TableHead>Aanvrager</TableHead>
                      <TableHead>Claim Status</TableHead>
                      <TableHead>Restaurant Status</TableHead>
                      <TableHead>Verificaties</TableHead>
                      <TableHead>Datum</TableHead>
                      <TableHead className="text-right">Acties</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredClaims.map((claim) => (
                      <TableRow key={claim.id}>
                        <TableCell>
                          <div className="font-medium">{claim.restaurant?.name}</div>
                          <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                            {claim.restaurant?.address}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{claim.profile?.name || 'Onbekend'}</div>
                          <div className="text-xs text-muted-foreground">{claim.profile?.email}</div>
                        </TableCell>
                        <TableCell>{getStatusBadge(claim.status)}</TableCell>
                        <TableCell>{getRestaurantStatusBadge(claim.restaurant?.claim_status)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {claim.email_verified && (
                              <span title="Email geverifieerd">
                                <Mail className="h-4 w-4 text-green-500" />
                              </span>
                            )}
                            {claim.phone_verified && (
                              <span title="Telefoon geverifieerd">
                                <Phone className="h-4 w-4 text-green-500" />
                              </span>
                            )}
                            {claim.verification_method && getVerificationMethodIcon(claim.verification_method)}
                          </div>
                        </TableCell>
                        <TableCell>
                          {new Date(claim.created_at).toLocaleDateString('nl-NL')}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedClaim(claim);
                              setAdminNotes(claim.admin_notes || '');
                              setDetailDialogOpen(true);
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredClaims.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          Geen claims gevonden
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="activity">
              <div className="rounded-md border max-h-[500px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Datum</TableHead>
                      <TableHead>Actie</TableHead>
                      <TableHead>Categorie</TableHead>
                      <TableHead>Actor</TableHead>
                      <TableHead>Details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activityLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="text-sm">
                          {new Date(log.created_at).toLocaleString('nl-NL')}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{log.action_type}</Badge>
                        </TableCell>
                        <TableCell>{log.action_category}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{log.actor_role}</Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                          {log.metadata ? JSON.stringify(log.metadata) : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Claim Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Claim Details</DialogTitle>
            <DialogDescription>
              Bekijk en beheer deze claim aanvraag
            </DialogDescription>
          </DialogHeader>

          {selectedClaim && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium mb-2">Restaurant</h4>
                  <p className="text-lg font-semibold">{selectedClaim.restaurant?.name}</p>
                  <p className="text-sm text-muted-foreground">{selectedClaim.restaurant?.address}</p>
                  <div className="mt-2">
                    {getRestaurantStatusBadge(selectedClaim.restaurant?.claim_status)}
                  </div>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Aanvrager</h4>
                  <p className="text-lg font-semibold">{selectedClaim.profile?.name || 'Onbekend'}</p>
                  <p className="text-sm text-muted-foreground">{selectedClaim.profile?.email}</p>
                  <div className="mt-2">
                    {getStatusBadge(selectedClaim.status)}
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-medium mb-2">Verificatiestatus</h4>
                <div className="flex flex-wrap gap-3">
                  <Badge className={selectedClaim.email_verified ? 'bg-green-500/10 text-green-600' : 'bg-gray-500/10 text-gray-600'}>
                    <Mail className="h-3 w-3 mr-1" />
                    Email: {selectedClaim.email_verified ? 'Geverifieerd' : 'Niet geverifieerd'}
                  </Badge>
                  <Badge className={selectedClaim.phone_verified ? 'bg-green-500/10 text-green-600' : 'bg-gray-500/10 text-gray-600'}>
                    <Phone className="h-3 w-3 mr-1" />
                    Telefoon: {selectedClaim.phone_verified ? 'Geverifieerd' : 'Niet geverifieerd'}
                  </Badge>
                  {selectedClaim.verification_method && (
                    <Badge className="bg-blue-500/10 text-blue-600">
                      {getVerificationMethodIcon(selectedClaim.verification_method)}
                      <span className="ml-1">{selectedClaim.verification_method.replace('_', ' ')}</span>
                    </Badge>
                  )}
                </div>
              </div>

              <div>
                <h4 className="font-medium mb-2">Admin notities</h4>
                <Textarea
                  placeholder="Voeg notities toe (verplicht bij afwijzen)..."
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  rows={3}
                />
              </div>

              <DialogFooter className="flex-wrap gap-2">
                {selectedClaim.restaurant?.claim_status === 'locked' ? (
                  <Button variant="outline" onClick={() => handleUnlockRestaurant(selectedClaim)} disabled={actionLoading}>
                    <Unlock className="h-4 w-4 mr-2" />
                    Ontgrendelen
                  </Button>
                ) : (
                  <Button variant="outline" onClick={() => handleLockRestaurant(selectedClaim)} disabled={actionLoading}>
                    <Lock className="h-4 w-4 mr-2" />
                    Vergrendelen
                  </Button>
                )}

                {selectedClaim.status !== 'disputed' && (
                  <Button variant="outline" onClick={() => handleMarkDisputed(selectedClaim)} disabled={actionLoading}>
                    <AlertTriangle className="h-4 w-4 mr-2" />
                    Markeer Betwist
                  </Button>
                )}

                {selectedClaim.status !== 'rejected' && selectedClaim.status !== 'verified' && (
                  <>
                    <Button variant="destructive" onClick={() => handleRejectClaim(selectedClaim)} disabled={actionLoading}>
                      <XCircle className="h-4 w-4 mr-2" />
                      Afwijzen
                    </Button>
                    <Button onClick={() => handleApproveVerification(selectedClaim)} disabled={actionLoading}>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Goedkeuren & Verifiëren
                    </Button>
                  </>
                )}
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
