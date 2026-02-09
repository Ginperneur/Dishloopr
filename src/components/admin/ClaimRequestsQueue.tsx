import { useState, useEffect } from 'react';
import { CheckCircle, XCircle, Clock, User, Store, MapPin, Phone, FileText, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useActivityLog } from '@/hooks/useActivityLog';

interface ClaimRequest {
  id: string;
  status: string;
  notes: string | null;
  admin_notes: string | null;
  created_at: string;
  user_id: string;
  restaurant_id: string;
  proof_documents: string[] | null;
  restaurant?: {
    id: string;
    name: string;
    address: string;
    phone: string | null;
  };
  profile?: {
    name: string | null;
    email: string | null;
  };
}

interface ClaimRequestsQueueProps {
  onUpdate?: () => void;
}

export function ClaimRequestsQueue({ onUpdate }: ClaimRequestsQueueProps) {
  const [requests, setRequests] = useState<ClaimRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<ClaimRequest | null>(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [processing, setProcessing] = useState(false);
  const { logActivity } = useActivityLog();

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from('claim_requests')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching claim requests:', error);
      toast.error('Kon claim aanvragen niet laden');
      setLoading(false);
      return;
    }

    // Fetch restaurant and profile data for each request
    const enrichedRequests: ClaimRequest[] = [];
    
    for (const request of data || []) {
      const [restaurantResult, profileResult] = await Promise.all([
        supabase.from('restaurants').select('id, name, address, phone').eq('id', request.restaurant_id).single(),
        supabase.from('profiles').select('name, email').eq('id', request.user_id).single()
      ]);

      enrichedRequests.push({
        ...request,
        restaurant: restaurantResult.data || undefined,
        profile: profileResult.data || undefined
      });
    }

    setRequests(enrichedRequests);
    setLoading(false);
  };

  const handleApprove = async (request: ClaimRequest) => {
    setProcessing(true);

    try {
      // Update claim request status
      const { error: claimError } = await supabase
        .from('claim_requests')
        .update({
          status: 'approved',
          admin_notes: adminNotes || null,
          reviewed_at: new Date().toISOString()
        })
        .eq('id', request.id);

      if (claimError) throw claimError;

      // Update restaurant with owner
      const { error: restaurantError } = await supabase
        .from('restaurants')
        .update({
          claimed_by_owner_id: request.user_id,
          updated_at: new Date().toISOString()
        })
        .eq('id', request.restaurant_id);

      if (restaurantError) throw restaurantError;

      // Give user the owner role
      const { data: existingRole } = await supabase
        .from('user_roles')
        .select('id')
        .eq('user_id', request.user_id)
        .eq('role', 'owner')
        .maybeSingle();

      if (!existingRole) {
        await supabase
          .from('user_roles')
          .insert({
            user_id: request.user_id,
            role: 'owner'
          });
      }

      await logActivity({
        actionType: 'approve',
        entityType: 'claim',
        entityId: request.id,
        entityName: request.restaurant?.name,
        details: { user: request.profile?.email }
      });

      toast.success('Claim goedgekeurd! De eigenaar heeft nu toegang.');
      setSelectedRequest(null);
      setAdminNotes('');
      fetchRequests();
      onUpdate?.();

    } catch (error) {
      console.error('Error approving claim:', error);
      toast.error('Er ging iets mis bij het goedkeuren');
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async (request: ClaimRequest) => {
    setProcessing(true);

    try {
      const { error } = await supabase
        .from('claim_requests')
        .update({
          status: 'rejected',
          admin_notes: adminNotes || null,
          reviewed_at: new Date().toISOString()
        })
        .eq('id', request.id);

      if (error) throw error;

      await logActivity({
        actionType: 'reject',
        entityType: 'claim',
        entityId: request.id,
        entityName: request.restaurant?.name,
        details: { user: request.profile?.email, reason: adminNotes }
      });

      toast.success('Claim afgewezen');
      setSelectedRequest(null);
      setAdminNotes('');
      fetchRequests();
      onUpdate?.();

    } catch (error) {
      console.error('Error rejecting claim:', error);
      toast.error('Er ging iets mis bij het afwijzen');
    } finally {
      setProcessing(false);
    }
  };

  const pendingRequests = requests.filter(r => r.status === 'pending');
  const processedRequests = requests.filter(r => r.status !== 'pending');

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />In afwachting</Badge>;
      case 'approved':
        return <Badge variant="default" className="bg-green-600"><CheckCircle className="h-3 w-3 mr-1" />Goedgekeurd</Badge>;
      case 'rejected':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Afgewezen</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
          <p className="text-sm text-muted-foreground mt-2">Laden...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Claim Aanvragen
              </CardTitle>
              <CardDescription>
                Review en beheer restaurant claim aanvragen
              </CardDescription>
            </div>
            {pendingRequests.length > 0 && (
              <Badge variant="destructive" className="text-lg px-3 py-1">
                {pendingRequests.length} wachtend
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Pending Requests */}
          {pendingRequests.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                In afwachting ({pendingRequests.length})
              </h3>
              {pendingRequests.map(request => (
                <div
                  key={request.id}
                  className="border border-yellow-500/30 bg-yellow-500/5 rounded-lg p-4 hover:border-yellow-500/50 transition-colors cursor-pointer"
                  onClick={() => setSelectedRequest(request)}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <Store className="h-4 w-4 text-muted-foreground" />
                        <span className="font-semibold">{request.restaurant?.name || 'Onbekend restaurant'}</span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {request.profile?.name || request.profile?.email || 'Onbekende gebruiker'}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {new Date(request.created_at).toLocaleDateString('nl-NL')}
                        </span>
                      </div>
                    </div>
                    <Button size="sm">Bekijken</Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {pendingRequests.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <CheckCircle className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Geen openstaande claim aanvragen</p>
            </div>
          )}

          {/* Processed Requests */}
          {processedRequests.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                Verwerkt ({processedRequests.length})
              </h3>
              <ScrollArea className="h-[200px]">
                <div className="space-y-2">
                  {processedRequests.map(request => (
                    <div
                      key={request.id}
                      className="border rounded-lg p-3 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <Store className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{request.restaurant?.name || 'Onbekend'}</span>
                        <span className="text-sm text-muted-foreground">
                          door {request.profile?.name || request.profile?.email}
                        </span>
                      </div>
                      {getStatusBadge(request.status)}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={!!selectedRequest} onOpenChange={() => setSelectedRequest(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Claim Aanvraag Beoordelen</DialogTitle>
            <DialogDescription>
              Bekijk de details en keur goed of wijs af
            </DialogDescription>
          </DialogHeader>

          {selectedRequest && (
            <div className="space-y-6">
              {/* Restaurant Info */}
              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <h4 className="font-semibold flex items-center gap-2">
                  <Store className="h-4 w-4" />
                  {selectedRequest.restaurant?.name}
                </h4>
                {selectedRequest.restaurant?.address && (
                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                    <MapPin className="h-3 w-3" />
                    {selectedRequest.restaurant.address}
                  </p>
                )}
                {selectedRequest.restaurant?.phone && (
                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                    <Phone className="h-3 w-3" />
                    {selectedRequest.restaurant.phone}
                  </p>
                )}
              </div>

              {/* User Info */}
              <div className="space-y-2">
                <h4 className="font-semibold text-sm">Aanvrager</h4>
                <div className="flex items-center gap-3 p-3 border rounded-lg">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">{selectedRequest.profile?.name || 'Geen naam'}</p>
                    <p className="text-sm text-muted-foreground">{selectedRequest.profile?.email}</p>
                  </div>
                </div>
              </div>

              {/* Notes from user */}
              {selectedRequest.notes && (
                <div className="space-y-2">
                  <h4 className="font-semibold text-sm">Notities van aanvrager</h4>
                  <div className="p-3 bg-muted/30 rounded-lg text-sm whitespace-pre-wrap">
                    {selectedRequest.notes}
                  </div>
                </div>
              )}

              {/* Proof documents */}
              {selectedRequest.proof_documents && selectedRequest.proof_documents.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-semibold text-sm flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Bewijsdocumenten ({selectedRequest.proof_documents.length})
                  </h4>
                  <div className="space-y-2">
                    {selectedRequest.proof_documents.map((doc, index) => {
                      const fileName = doc.split('/').pop() || `Document ${index + 1}`;
                      const isImage = /\.(jpg|jpeg|png|webp)$/i.test(doc);
                      return (
                        <a
                          key={index}
                          href={`${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/menus/${doc}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 p-2 bg-muted/30 rounded-lg text-sm hover:bg-muted/50 transition-colors"
                        >
                          <FileText className="h-4 w-4 text-primary" />
                          <span className="truncate flex-1">{fileName}</span>
                          <span className="text-xs text-muted-foreground">
                            {isImage ? 'Afbeelding' : 'PDF'}
                          </span>
                        </a>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Admin notes */}
              <div className="space-y-2">
                <h4 className="font-semibold text-sm">Admin notities (optioneel)</h4>
                <Textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Eventuele opmerkingen bij je beslissing..."
                  rows={2}
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <Button
                  variant="destructive"
                  className="flex-1"
                  onClick={() => handleReject(selectedRequest)}
                  disabled={processing}
                >
                  {processing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <XCircle className="h-4 w-4 mr-2" />}
                  Afwijzen
                </Button>
                <Button
                  className="flex-1 bg-green-600 hover:bg-green-700"
                  onClick={() => handleApprove(selectedRequest)}
                  disabled={processing}
                >
                  {processing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                  Goedkeuren
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
