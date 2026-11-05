import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tag, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  restaurantId: string;
}

interface TagRequest {
  id: string;
  tag_type: string;
  tag_value: string;
  note: string | null;
  status: string;
  admin_notes: string | null;
  created_at: string;
}

const TAG_TYPE_LABELS: Record<string, string> = {
  cuisine: 'Keuken',
  ambience: 'Sfeer',
  concept: 'Concept',
};

const STATUS_LABELS: Record<string, { label: string; variant: 'secondary' | 'default' | 'destructive' }> = {
  pending: { label: 'In behandeling', variant: 'secondary' },
  approved: { label: 'Goedgekeurd', variant: 'default' },
  rejected: { label: 'Afgewezen', variant: 'destructive' },
};

export function TagRequestForm({ restaurantId }: Props) {
  const [requests, setRequests] = useState<TagRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [tagType, setTagType] = useState<string>('cuisine');
  const [tagValue, setTagValue] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchRequests = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('restaurant_tag_requests')
      .select('id, tag_type, tag_value, note, status, admin_notes, created_at')
      .eq('restaurant_id', restaurantId)
      .order('created_at', { ascending: false });
    if (!error && data) setRequests(data as TagRequest[]);
    setLoading(false);
  };

  useEffect(() => { if (restaurantId) fetchRequests(); }, [restaurantId]);

  const submit = async () => {
    if (!tagValue.trim()) {
      toast.error('Vul een naam voor de tag in');
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from('restaurant_tag_requests').insert({
      restaurant_id: restaurantId,
      requested_by: (await supabase.auth.getUser()).data.user?.id,
      tag_type: tagType,
      tag_value: tagValue.trim(),
      note: note.trim() || null,
    });
    setSubmitting(false);
    if (error) {
      toast.error('Kon aanvraag niet versturen', { description: error.message });
      return;
    }
    toast.success('Aanvraag verstuurd — we beoordelen deze zo snel mogelijk');
    setTagValue('');
    setNote('');
    fetchRequests();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Tag className="h-4 w-4 text-primary" />
          Tag aanvragen
        </CardTitle>
        <CardDescription>
          Staat jouw type keuken, sfeer of concept er nog niet bij? Vraag het aan — we keuren elke aanvraag handmatig goed.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-2">
          <Select value={tagType} onValueChange={setTagType} disabled={submitting}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="cuisine">Keuken</SelectItem>
              <SelectItem value="ambience">Sfeer</SelectItem>
              <SelectItem value="concept">Concept</SelectItem>
            </SelectContent>
          </Select>
          <Input
            placeholder="Bijv. Steakhouse, Terrasbar, All you can eat…"
            value={tagValue}
            onChange={(e) => setTagValue(e.target.value)}
            disabled={submitting}
            maxLength={60}
          />
        </div>
        <Textarea
          placeholder="Toelichting (optioneel) — waarom past deze tag bij jouw restaurant?"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          disabled={submitting}
          rows={2}
          maxLength={300}
        />
        <Button size="sm" onClick={submit} disabled={submitting || !tagValue.trim()}>
          {submitting && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
          Aanvraag versturen
        </Button>

        {!loading && requests.length > 0 && (
          <div className="pt-2 border-t space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Jouw aanvragen</p>
            {requests.map(r => {
              const status = STATUS_LABELS[r.status] || STATUS_LABELS.pending;
              return (
                <div key={r.id} className="flex items-start justify-between gap-2 text-sm">
                  <div>
                    <span className="font-medium">{TAG_TYPE_LABELS[r.tag_type] || r.tag_type}: {r.tag_value}</span>
                    {r.admin_notes && (
                      <p className="text-xs text-muted-foreground mt-0.5">Opmerking: {r.admin_notes}</p>
                    )}
                  </div>
                  <Badge variant={status.variant} className="text-[10px] shrink-0">{status.label}</Badge>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
