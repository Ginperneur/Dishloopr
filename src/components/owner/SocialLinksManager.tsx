import { useEffect, useState } from 'react';
import { z } from 'zod';
import { Instagram, Save } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TikTokIcon } from '@/components/icons/TikTokIcon';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const schema = z.object({
  instagram_url: z
    .string()
    .trim()
    .max(500, 'URL is te lang')
    .url('Ongeldige Instagram URL')
    .refine((v) => /instagram\.com/i.test(v), 'Moet een instagram.com URL zijn')
    .optional()
    .or(z.literal('')),
  tiktok_url: z
    .string()
    .trim()
    .max(500, 'URL is te lang')
    .url('Ongeldige TikTok URL')
    .refine((v) => /tiktok\.com/i.test(v), 'Moet een tiktok.com URL zijn')
    .optional()
    .or(z.literal('')),
});

interface Props {
  restaurantId: string;
  instagramUrl: string;
  tiktokUrl: string;
  onUpdate?: (instagramUrl: string | null, tiktokUrl: string | null) => void;
}

export function SocialLinksManager({ restaurantId, instagramUrl, tiktokUrl, onUpdate }: Props) {
  const [ig, setIg] = useState(instagramUrl || '');
  const [tk, setTk] = useState(tiktokUrl || '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setIg(instagramUrl || '');
    setTk(tiktokUrl || '');
  }, [instagramUrl, tiktokUrl]);

  const handleSave = async () => {
    const parsed = schema.safeParse({ instagram_url: ig.trim(), tiktok_url: tk.trim() });
    if (!parsed.success) {
      for (const err of parsed.error.errors) toast.error(err.message);
      return;
    }
    setSaving(true);
    const igVal = parsed.data.instagram_url ? parsed.data.instagram_url : null;
    const tkVal = parsed.data.tiktok_url ? parsed.data.tiktok_url : null;
    const { error } = await supabase
      .from('restaurants')
      .update({ instagram_url: igVal, tiktok_url: tkVal })
      .eq('id', restaurantId);
    setSaving(false);
    if (error) {
      toast.error('Kon links niet opslaan');
      return;
    }
    toast.success('Social media links opgeslagen');
    onUpdate?.(igVal, tkVal);
  };

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <p className="text-sm text-muted-foreground">
          Koppel je Instagram en TikTok zodat bezoekers je accounts direct vanaf je restaurantpagina kunnen vinden.
        </p>

        <div className="space-y-2">
          <Label htmlFor="ig-url">Instagram</Label>
          <div className="relative">
            <Instagram className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              id="ig-url"
              type="url"
              placeholder="https://instagram.com/jouw_restaurant"
              value={ig}
              onChange={(e) => setIg(e.target.value)}
              className="pl-10"
              maxLength={500}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="tk-url">TikTok</Label>
          <div className="relative">
            <TikTokIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              id="tk-url"
              type="url"
              placeholder="https://tiktok.com/@jouw_restaurant"
              value={tk}
              onChange={(e) => setTk(e.target.value)}
              className="pl-10"
              maxLength={500}
            />
          </div>
        </div>

        <Button onClick={handleSave} disabled={saving} size="sm">
          <Save className="h-4 w-4 mr-1" />
          {saving ? 'Opslaan...' : 'Opslaan'}
        </Button>
      </CardContent>
    </Card>
  );
}