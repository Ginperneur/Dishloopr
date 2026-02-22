import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Plus, Send, Users, FileText, Check, X, Clock } from 'lucide-react';

interface Edition {
  id: string;
  title: string;
  intro_text: string | null;
  status: string;
  scheduled_for: string | null;
  sent_at: string | null;
  recipient_count: number;
  created_at: string;
}

interface Placement {
  id: string;
  edition_id: string | null;
  restaurant_id: string;
  title: string;
  description: string | null;
  promo_type: string;
  status: string;
  price_paid: number;
  admin_notes: string | null;
  created_at: string;
  restaurants?: { name: string } | null;
}

export function NewsletterManager() {
  const [editions, setEditions] = useState<Edition[]>([]);
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [subscriberCount, setSubscriberCount] = useState(0);
  const [newTitle, setNewTitle] = useState('');
  const [newIntro, setNewIntro] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const [editionsRes, placementsRes, subsRes] = await Promise.all([
      supabase.from('newsletter_editions').select('*').order('created_at', { ascending: false }),
      supabase.from('newsletter_placements').select('*, restaurants:restaurant_id(name)').order('created_at', { ascending: false }),
      supabase.from('newsletter_subscribers').select('*', { count: 'exact', head: true }).eq('is_active', true),
    ]);
    setEditions((editionsRes.data || []) as Edition[]);
    setPlacements((placementsRes.data || []) as Placement[]);
    setSubscriberCount(subsRes.count || 0);
    setLoading(false);
  };

  const createEdition = async () => {
    if (!newTitle.trim()) return;
    const { error } = await supabase.from('newsletter_editions').insert({
      title: newTitle,
      intro_text: newIntro || null,
      created_by: (await supabase.auth.getUser()).data.user?.id,
    });
    if (error) {
      toast.error('Kon editie niet aanmaken: ' + error.message);
    } else {
      toast.success('Editie aangemaakt');
      setNewTitle('');
      setNewIntro('');
      fetchData();
    }
  };

  const updatePlacementStatus = async (id: string, status: string) => {
    const { error } = await supabase.from('newsletter_placements').update({ status }).eq('id', id);
    if (error) {
      toast.error('Update mislukt');
    } else {
      toast.success('Plaatsing bijgewerkt');
      fetchData();
    }
  };

  const assignPlacementToEdition = async (placementId: string, editionId: string) => {
    const { error } = await supabase.from('newsletter_placements').update({ edition_id: editionId }).eq('id', placementId);
    if (error) {
      toast.error('Toewijzing mislukt');
    } else {
      toast.success('Plaatsing toegewezen aan editie');
      fetchData();
    }
  };

  const updateEditionStatus = async (id: string, status: string) => {
    const updateData: Record<string, any> = { status };
    if (status === 'sent') {
      updateData.sent_at = new Date().toISOString();
      updateData.recipient_count = subscriberCount;
    }
    const { error } = await supabase.from('newsletter_editions').update(updateData).eq('id', id);
    if (error) {
      toast.error('Update mislukt');
    } else {
      toast.success(status === 'sent' ? 'Editie gemarkeerd als verzonden' : 'Status bijgewerkt');
      fetchData();
    }
  };

  const statusBadge = (status: string) => {
    const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
      draft: { variant: 'secondary', label: 'Concept' },
      scheduled: { variant: 'outline', label: 'Gepland' },
      sent: { variant: 'default', label: 'Verzonden' },
      pending_payment: { variant: 'outline', label: 'Wacht op betaling' },
      paid: { variant: 'secondary', label: 'Betaald' },
      approved: { variant: 'default', label: 'Goedgekeurd' },
      rejected: { variant: 'destructive', label: 'Afgewezen' },
      published: { variant: 'default', label: 'Gepubliceerd' },
    };
    const v = variants[status] || { variant: 'secondary' as const, label: status };
    return <Badge variant={v.variant}>{v.label}</Badge>;
  };

  const promoTypeLabel: Record<string, string> = {
    actie: '🏷️ Actie',
    event: '🎉 Event',
    nieuw_gerecht: '🍽️ Nieuw gerecht',
    aanbieding: '💰 Aanbieding',
    overig: '📌 Overig',
  };

  const draftEditions = editions.filter(e => e.status === 'draft' || e.status === 'scheduled');
  const paidPlacements = placements.filter(p => p.status === 'paid' || p.status === 'approved');

  if (loading) return <div className="animate-pulse h-48 bg-muted rounded-lg" />;

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <Users className="h-5 w-5 mx-auto mb-1 text-primary" />
            <p className="text-2xl font-bold">{subscriberCount}</p>
            <p className="text-xs text-muted-foreground">Abonnees</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <FileText className="h-5 w-5 mx-auto mb-1 text-primary" />
            <p className="text-2xl font-bold">{editions.length}</p>
            <p className="text-xs text-muted-foreground">Edities</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Send className="h-5 w-5 mx-auto mb-1 text-primary" />
            <p className="text-2xl font-bold">{paidPlacements.length}</p>
            <p className="text-xs text-muted-foreground">Betaalde plaatsingen</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="editions">
        <TabsList>
          <TabsTrigger value="editions">Edities</TabsTrigger>
          <TabsTrigger value="placements" className="relative">
            Plaatsingen
            {paidPlacements.length > 0 && (
              <Badge variant="destructive" className="ml-1 h-4 px-1 text-[10px]">{paidPlacements.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="editions" className="space-y-4">
          {/* Create new edition */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Nieuwe editie aanmaken</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input placeholder="Titel (bijv. 'Week 12 - Lente Special')" value={newTitle} onChange={e => setNewTitle(e.target.value)} />
              <Textarea placeholder="Intro tekst (optioneel)" value={newIntro} onChange={e => setNewIntro(e.target.value)} rows={2} />
              <Button onClick={createEdition} disabled={!newTitle.trim()} size="sm">
                <Plus className="h-4 w-4 mr-1" />
                Aanmaken
              </Button>
            </CardContent>
          </Card>

          {/* Editions list */}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Titel</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Plaatsingen</TableHead>
                <TableHead>Verzonden</TableHead>
                <TableHead>Acties</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {editions.map(edition => {
                const editionPlacements = placements.filter(p => p.edition_id === edition.id);
                return (
                  <TableRow key={edition.id}>
                    <TableCell className="font-medium">{edition.title}</TableCell>
                    <TableCell>{statusBadge(edition.status)}</TableCell>
                    <TableCell>{editionPlacements.length}</TableCell>
                    <TableCell>
                      {edition.sent_at ? new Date(edition.sent_at).toLocaleDateString('nl') : '-'}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {edition.status === 'draft' && (
                          <Button size="sm" variant="outline" onClick={() => updateEditionStatus(edition.id, 'scheduled')}>
                            <Clock className="h-3 w-3 mr-1" />
                            Plan
                          </Button>
                        )}
                        {(edition.status === 'draft' || edition.status === 'scheduled') && (
                          <Button size="sm" onClick={() => updateEditionStatus(edition.id, 'sent')}>
                            <Send className="h-3 w-3 mr-1" />
                            Markeer verzonden
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {editions.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    Nog geen edities aangemaakt
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TabsContent>

        <TabsContent value="placements" className="space-y-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Restaurant</TableHead>
                <TableHead>Titel</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Editie</TableHead>
                <TableHead>Acties</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {placements.map(placement => (
                <TableRow key={placement.id}>
                  <TableCell className="font-medium">{(placement.restaurants as any)?.name || '-'}</TableCell>
                  <TableCell>{placement.title}</TableCell>
                  <TableCell className="text-xs">{promoTypeLabel[placement.promo_type] || placement.promo_type}</TableCell>
                  <TableCell>{statusBadge(placement.status)}</TableCell>
                  <TableCell>
                    {placement.status === 'paid' || placement.status === 'approved' ? (
                      <Select
                        value={placement.edition_id || ''}
                        onValueChange={v => assignPlacementToEdition(placement.id, v)}
                      >
                        <SelectTrigger className="w-40 h-8 text-xs">
                          <SelectValue placeholder="Kies editie" />
                        </SelectTrigger>
                        <SelectContent>
                          {draftEditions.map(e => (
                            <SelectItem key={e.id} value={e.id}>{e.title}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {placement.status === 'paid' && (
                        <>
                          <Button size="sm" variant="outline" onClick={() => updatePlacementStatus(placement.id, 'approved')}>
                            <Check className="h-3 w-3" />
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => updatePlacementStatus(placement.id, 'rejected')}>
                            <X className="h-3 w-3" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {placements.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    Nog geen plaatsingen ontvangen
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TabsContent>
      </Tabs>
    </div>
  );
}
