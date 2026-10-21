import DOMPurify from 'dompurify';
import { useState, useEffect, useCallback } from 'react';
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
import { Plus, Send, Users, FileText, Check, X, Clock, Mail, Play, Pause, RotateCcw, Eye } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

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

interface Campaign {
  id: string;
  title: string;
  subject: string;
  html_content: string;
  segment: string;
  status: string;
  total_recipients: number;
  sent_count: number;
  failed_count: number;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

const SEGMENT_OPTIONS = [
  { value: 'subscribers', label: '📧 Nieuwsbrief abonnees' },
  { value: 'owners_verified', label: '✅ Geverifieerde eigenaren' },
  { value: 'owners_all', label: '🏪 Alle eigenaren' },
  { value: 'all_users', label: '👥 Alle gebruikers' },
];

const CAMPAIGN_STATUS_MAP: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
  draft: { variant: 'secondary', label: 'Concept' },
  sending: { variant: 'default', label: 'Bezig...' },
  paused: { variant: 'outline', label: 'Gepauzeerd' },
  completed: { variant: 'default', label: 'Voltooid' },
  failed: { variant: 'destructive', label: 'Mislukt' },
};

export function NewsletterManager() {
  const [editions, setEditions] = useState<Edition[]>([]);
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [subscriberCount, setSubscriberCount] = useState(0);
  const [newTitle, setNewTitle] = useState('');
  const [newIntro, setNewIntro] = useState('');
  const [loading, setLoading] = useState(true);

  // Campaign composer state
  const [campTitle, setCampTitle] = useState('');
  const [campSubject, setCampSubject] = useState('');
  const [campHtml, setCampHtml] = useState('');
  const [campSegment, setCampSegment] = useState('subscribers');
  const [campSaving, setCampSaving] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const [sendingCampaignId, setSendingCampaignId] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const [editionsRes, placementsRes, subsRes, campaignsRes] = await Promise.all([
      supabase.from('newsletter_editions').select('*').order('created_at', { ascending: false }),
      supabase.from('newsletter_placements').select('*, restaurants:restaurant_id(name)').order('created_at', { ascending: false }),
      supabase.from('newsletter_subscribers').select('*', { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('email_campaigns').select('*').order('created_at', { ascending: false }).limit(50),
    ]);
    setEditions((editionsRes.data || []) as Edition[]);
    setPlacements((placementsRes.data || []) as Placement[]);
    setSubscriberCount(subsRes.count || 0);
    setCampaigns((campaignsRes.data || []) as Campaign[]);
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
    if (error) toast.error('Update mislukt');
    else { toast.success('Plaatsing bijgewerkt'); fetchData(); }
  };

  const assignPlacementToEdition = async (placementId: string, editionId: string) => {
    const { error } = await supabase.from('newsletter_placements').update({ edition_id: editionId }).eq('id', placementId);
    if (error) toast.error('Toewijzing mislukt');
    else { toast.success('Plaatsing toegewezen aan editie'); fetchData(); }
  };

  const updateEditionStatus = async (id: string, status: string) => {
    const updateData: Record<string, any> = { status };
    if (status === 'sent') {
      updateData.sent_at = new Date().toISOString();
      updateData.recipient_count = subscriberCount;
    }
    const { error } = await supabase.from('newsletter_editions').update(updateData).eq('id', id);
    if (error) toast.error('Update mislukt');
    else { toast.success(status === 'sent' ? 'Editie gemarkeerd als verzonden' : 'Status bijgewerkt'); fetchData(); }
  };

  // Campaign functions
  const createCampaign = async () => {
    if (!campTitle.trim() || !campSubject.trim() || !campHtml.trim()) {
      toast.error('Vul alle velden in');
      return;
    }
    setCampSaving(true);
    const userId = (await supabase.auth.getUser()).data.user?.id;
    const { error } = await supabase.from('email_campaigns').insert({
      title: campTitle,
      subject: campSubject,
      html_content: campHtml,
      segment: campSegment,
      created_by: userId,
    });
    setCampSaving(false);
    if (error) {
      toast.error('Campagne aanmaken mislukt: ' + error.message);
    } else {
      toast.success('Campagne aangemaakt als concept');
      setCampTitle('');
      setCampSubject('');
      setCampHtml('');
      setCampSegment('subscribers');
      fetchData();
    }
  };

  const sendCampaign = useCallback(async (campaignId: string) => {
    setSendingCampaignId(campaignId);
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    const session = (await supabase.auth.getSession()).data.session;

    const sendBatch = async (): Promise<boolean> => {
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/send-bulk-email`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ campaign_id: campaignId }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        toast.error(`Fout: ${data.error}`);
        return false;
      }

      // Refresh campaign data
      const { data: updated } = await supabase
        .from('email_campaigns')
        .select('*')
        .eq('id', campaignId)
        .single();

      if (updated) {
        setCampaigns(prev => prev.map(c => c.id === campaignId ? updated as Campaign : c));
      }

      if (data.has_more) {
        toast.info(`${data.total_sent} verzonden, volgende batch...`);
        return true; // Continue
      } else {
        toast.success(`Campagne voltooid! ${data.total_sent} emails verzonden.`);
        return false; // Done
      }
    };

    try {
      let hasMore = true;
      while (hasMore) {
        hasMore = await sendBatch();
      }
    } catch (err) {
      toast.error('Verzenden mislukt');
    } finally {
      setSendingCampaignId(null);
      fetchData();
    }
  }, []);

  const pauseCampaign = async (campaignId: string) => {
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    const session = (await supabase.auth.getSession()).data.session;
    await fetch(`https://${projectId}.supabase.co/functions/v1/send-bulk-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify({ campaign_id: campaignId, action: 'pause' }),
    });
    toast.success('Campagne gepauzeerd');
    fetchData();
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
      ...CAMPAIGN_STATUS_MAP,
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
        <Card>
          <CardContent className="p-4 text-center">
            <Mail className="h-5 w-5 mx-auto mb-1 text-primary" />
            <p className="text-2xl font-bold">{campaigns.length}</p>
            <p className="text-xs text-muted-foreground">Campagnes</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="campaigns">
        <TabsList>
          <TabsTrigger value="campaigns">
            <Mail className="h-4 w-4 mr-1" />
            Campagnes
          </TabsTrigger>
          <TabsTrigger value="editions">Edities</TabsTrigger>
          <TabsTrigger value="placements" className="relative">
            Plaatsingen
            {paidPlacements.length > 0 && (
              <Badge variant="destructive" className="ml-1 h-4 px-1 text-[10px]">{paidPlacements.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* CAMPAIGNS TAB */}
        <TabsContent value="campaigns" className="space-y-4">
          {/* Campaign composer */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Nieuwe campagne
              </CardTitle>
              <CardDescription>Maak een email campagne aan en verstuur naar een segment.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Input
                  placeholder="Campagne titel (intern)"
                  value={campTitle}
                  onChange={e => setCampTitle(e.target.value)}
                />
                <Input
                  placeholder="Email onderwerp"
                  value={campSubject}
                  onChange={e => setCampSubject(e.target.value)}
                />
              </div>
              <Select value={campSegment} onValueChange={setCampSegment}>
                <SelectTrigger>
                  <SelectValue placeholder="Kies segment" />
                </SelectTrigger>
                <SelectContent>
                  {SEGMENT_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Textarea
                placeholder="HTML inhoud van de email..."
                value={campHtml}
                onChange={e => setCampHtml(e.target.value)}
                rows={8}
                className="font-mono text-xs"
              />
              <div className="flex gap-2">
                <Button onClick={createCampaign} disabled={campSaving || !campTitle.trim() || !campSubject.trim() || !campHtml.trim()} size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  Opslaan als concept
                </Button>
                {campHtml && (
                  <Button variant="outline" size="sm" onClick={() => { setPreviewHtml(campHtml); setPreviewOpen(true); }}>
                    <Eye className="h-4 w-4 mr-1" />
                    Preview
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Campaign list */}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Titel</TableHead>
                <TableHead>Onderwerp</TableHead>
                <TableHead>Segment</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Voortgang</TableHead>
                <TableHead>Acties</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {campaigns.map(campaign => {
                const segmentLabel = SEGMENT_OPTIONS.find(s => s.value === campaign.segment)?.label || campaign.segment;
                const isSending = sendingCampaignId === campaign.id;
                return (
                  <TableRow key={campaign.id}>
                    <TableCell className="font-medium">{campaign.title}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{campaign.subject}</TableCell>
                    <TableCell className="text-xs">{segmentLabel}</TableCell>
                    <TableCell>{statusBadge(campaign.status)}</TableCell>
                    <TableCell>
                      {campaign.sent_count > 0 || campaign.failed_count > 0 ? (
                        <span className="text-xs">
                          ✅ {campaign.sent_count} / ❌ {campaign.failed_count}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {(campaign.status === 'draft' || campaign.status === 'paused') && (
                          <Button
                            size="sm"
                            onClick={() => sendCampaign(campaign.id)}
                            disabled={isSending}
                          >
                            {isSending ? (
                              <RotateCcw className="h-3 w-3 mr-1 animate-spin" />
                            ) : (
                              <Play className="h-3 w-3 mr-1" />
                            )}
                            {campaign.status === 'paused' ? 'Hervatten' : 'Verstuur'}
                          </Button>
                        )}
                        {campaign.status === 'sending' && (
                          <Button size="sm" variant="outline" onClick={() => pauseCampaign(campaign.id)}>
                            <Pause className="h-3 w-3 mr-1" />
                            Pauzeer
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => { setPreviewHtml(campaign.html_content); setPreviewOpen(true); }}
                        >
                          <Eye className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {campaigns.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    Nog geen campagnes aangemaakt
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TabsContent>

        {/* EDITIONS TAB */}
        <TabsContent value="editions" className="space-y-4">
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

        {/* PLACEMENTS TAB */}
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

      {/* HTML Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Email Preview</DialogTitle>
            <DialogDescription>Zo ziet de email eruit voor ontvangers.</DialogDescription>
          </DialogHeader>
          <div
            className="border rounded-lg p-4 bg-white"
            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(previewHtml) }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
