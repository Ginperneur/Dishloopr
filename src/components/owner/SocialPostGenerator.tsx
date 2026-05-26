import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sparkles, Copy, Instagram } from 'lucide-react';
import { toast } from 'sonner';

export function SocialPostGenerator({ restaurantName }: { restaurantName: string }) {
  const [topic, setTopic] = useState('');
  const [platform, setPlatform] = useState<'instagram' | 'tiktok' | 'facebook'>('instagram');
  const [tone, setTone] = useState<'enthousiast' | 'sfeervol' | 'kort'>('enthousiast');
  const [output, setOutput] = useState('');
  const [loading, setLoading] = useState(false);

  const generate = async () => {
    if (!topic.trim()) { toast.error('Beschrijf je nieuws of post-idee'); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-social-post', {
        body: { restaurantName, topic, platform, tone },
      });
      if (error) throw error;
      setOutput((data as any)?.post || '');
    } catch (e: any) {
      toast.error(e.message || 'Genereren mislukt');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-5 w-5 text-primary" /> AI Social-post Generator
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <Label className="text-xs">Onderwerp / nieuws</Label>
          <Textarea
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Bijv. 'Nieuw seizoensgerecht: pompoenrisotto met truffel'"
            rows={3}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Platform</Label>
            <Select value={platform} onValueChange={(v: any) => setPlatform(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="instagram">Instagram</SelectItem>
                <SelectItem value="tiktok">TikTok</SelectItem>
                <SelectItem value="facebook">Facebook</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Tone of voice</Label>
            <Select value={tone} onValueChange={(v: any) => setTone(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="enthousiast">Enthousiast</SelectItem>
                <SelectItem value="sfeervol">Sfeervol</SelectItem>
                <SelectItem value="kort">Kort & krachtig</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button onClick={generate} disabled={loading} className="w-full">
          <Sparkles className="h-4 w-4 mr-1" />
          {loading ? 'Genereren…' : 'Genereer post'}
        </Button>
        {output && (
          <div className="p-3 rounded-lg border bg-muted/30 space-y-2">
            <p className="text-sm whitespace-pre-wrap">{output}</p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => { navigator.clipboard.writeText(output); toast.success('Gekopieerd'); }}
            >
              <Copy className="h-3 w-3 mr-1" /> Kopieer
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}