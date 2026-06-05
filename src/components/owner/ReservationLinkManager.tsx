import { useEffect, useState } from 'react';
import { z } from 'zod';
import { Calendar, Save, Wand2, ExternalLink, X } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const schema = z.object({
  reservation_url: z
    .string()
    .trim()
    .max(500, 'URL is te lang')
    .url('Ongeldige URL')
    .optional()
    .or(z.literal('')),
});

const PROVIDER_PATTERNS: { name: string; regex: RegExp }[] = [
  { name: 'Zenchef', regex: /zenchef\.com/i },
  { name: 'TheFork', regex: /thefork\.[a-z.]+/i },
  { name: 'OpenTable', regex: /opentable\.[a-z.]+/i },
  { name: 'Resy', regex: /resy\.com/i },
  { name: 'Formitable', regex: /formitable\.com/i },
  { name: 'Quandoo', regex: /quandoo\.[a-z.]+/i },
  { name: 'Bookatable', regex: /bookatable\.[a-z.]+/i },
  { name: 'SevenRooms', regex: /sevenrooms\.com/i },
  { name: 'Eveve', regex: /eveve\.com/i },
];

function detectProvider(url: string): string | null {
  for (const p of PROVIDER_PATTERNS) if (p.regex.test(url)) return p.name;
  return null;
}

interface Props {
  restaurantId: string;
  reservationUrl: string;
  hasWebsite: boolean;
  onUpdate?: (url: string | null) => void;
}

export function ReservationLinkManager({ restaurantId, reservationUrl, hasWebsite, onUpdate }: Props) {
  const [url, setUrl] = useState(reservationUrl || '');
  const [saving, setSaving] = useState(false);
  const [detecting, setDetecting] = useState(false);

  useEffect(() => setUrl(reservationUrl || ''), [reservationUrl]);

  const provider = url ? detectProvider(url) : null;

  const handleSave = async () => {
    const parsed = schema.safeParse({ reservation_url: url.trim() });
    if (!parsed.success) {
      for (const err of parsed.error.errors) toast.error(err.message);
      return;
    }
    setSaving(true);
    const val = parsed.data.reservation_url ? parsed.data.reservation_url : null;
    const { error } = await supabase
      .from('restaurants')
      .update({ reservation_url: val, accepts_reservations: !!val })
      .eq('id', restaurantId);
    setSaving(false);
    if (error) {
      toast.error('Kon link niet opslaan');
      return;
    }
    toast.success(val ? 'Reserveringslink opgeslagen' : 'Reserveringslink verwijderd');
    onUpdate?.(val);
  };

  const handleAutoDetect = async () => {
    if (!hasWebsite) {
      toast.error('Voeg eerst een website toe voordat we kunnen scannen');
      return;
    }
    setDetecting(true);
    const { data, error } = await supabase.functions.invoke('detect-reservation-links', {
      body: { restaurantId, forceRefresh: true },
    });
    setDetecting(false);
    if (error) {
      toast.error('Auto-detectie mislukt');
      return;
    }
    const found = (data?.results || []).find((r: any) => r.status === 'found');
    if (found) {
      setUrl(found.url);
      toast.success(`${found.provider} herkend op je website`);
      onUpdate?.(found.url);
    } else {
      toast.info('Geen reserveringsprovider gevonden op je website');
    }
  };

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <p className="text-sm text-muted-foreground">
          Koppel je reserveringslink (Zenchef, TheFork, OpenTable, eigen formulier, …) zodat gasten direct via je restaurantpagina kunnen boeken.
        </p>

        <div className="space-y-2">
          <Label htmlFor="reservation-url">Reserveringslink</Label>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              id="reservation-url"
              type="url"
              placeholder="https://module.zenchef.com/..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="pl-10 pr-10"
              maxLength={500}
            />
            {url && (
              <button
                type="button"
                onClick={() => setUrl('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Wissen"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          {provider && (
            <div className="flex items-center gap-2 text-xs">
              <Badge variant="secondary">{provider} herkend</Badge>
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-primary hover:underline"
              >
                Test link <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={handleSave} disabled={saving} size="sm">
            <Save className="h-4 w-4 mr-1" />
            {saving ? 'Opslaan...' : 'Opslaan'}
          </Button>
          <Button
            onClick={handleAutoDetect}
            disabled={detecting || !hasWebsite}
            size="sm"
            variant="outline"
          >
            <Wand2 className="h-4 w-4 mr-1" />
            {detecting ? 'Scannen...' : 'Auto-detecteer via website'}
          </Button>
        </div>

        {!hasWebsite && (
          <p className="text-xs text-muted-foreground">
            Voeg eerst een website toe in je restaurantgegevens om auto-detectie te gebruiken.
          </p>
        )}
      </CardContent>
    </Card>
  );
}